/* OSM bus stops / platforms near the viewport. Dedicated layer (not claimable).
   Overpass only — rate-limited, fail soft. No Google. */
(function (global) {
  const CACHE_KEY = "lvfe.bus.overpass.v1";
  const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  const UA = "LvfeXperience/0.3 (bus stops; OSM ODbL)";
  const PAD_DEG = 0.018;
  const MAX_FEATURES = 120;
  const MIN_INTERVAL_MS = 45000;
  const CACHE_TTL_MS = 25 * 60 * 1000;
  const CELL = 0.025;
  const EMPTY = { type: "FeatureCollection", features: [] };

  let mapRef = null;
  let lastFetchAt = 0;
  let inFlight = null;
  let moveTimer = 0;
  let tipEl = null;
  let tipTimer = 0;
  let clickBound = false;

  function lsGet(key, fallback) {
    try {
      if (typeof localStorage === "undefined") return fallback;
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function lsSet(key, val) {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(key, JSON.stringify(val));
    } catch (err) { /* quota */ }
  }

  function cellKey(lat, lon) {
    return Math.round(Number(lat) / CELL) + ":" + Math.round(Number(lon) / CELL);
  }

  function bboxFromMap(map) {
    try {
      const b = map.getBounds();
      const sw = b.getSouthWest();
      const ne = b.getNorthEast();
      return {
        s: sw.lat - PAD_DEG * 0.15,
        w: sw.lng - PAD_DEG * 0.15,
        n: ne.lat + PAD_DEG * 0.15,
        e: ne.lng + PAD_DEG * 0.15,
      };
    } catch (err) {
      return null;
    }
  }

  function overpassQl(b) {
    const bbox = "(" + b.s.toFixed(5) + "," + b.w.toFixed(5) + "," + b.n.toFixed(5) + "," + b.e.toFixed(5) + ")";
    return "[out:json][timeout:20];\n(\n" +
      "  node[\"highway\"=\"bus_stop\"]" + bbox + ";\n" +
      "  node[\"public_transport\"=\"platform\"][\"bus\"=\"yes\"]" + bbox + ";\n" +
      "  node[\"public_transport\"=\"stop_position\"][\"bus\"=\"yes\"]" + bbox + ";\n" +
      "  node[\"amenity\"=\"bus_station\"]" + bbox + ";\n" +
      ");\nout center tags;";
  }

  function stopName(tags) {
    if (!tags) return "Bus stop";
    const n = tags.name || tags["name:en"] || tags.ref || tags["bus_routes"];
    if (n && String(n).trim()) return String(n).trim();
    return "Bus stop";
  }

  function toFeatures(elements) {
    const feats = [];
    const seen = {};
    for (let i = 0; i < (elements || []).length && feats.length < MAX_FEATURES; i++) {
      const el = elements[i];
      if (!el) continue;
      let lon = el.lon;
      let lat = el.lat;
      if ((!Number.isFinite(lon) || !Number.isFinite(lat)) && el.center) {
        lon = el.center.lon;
        lat = el.center.lat;
      }
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      const id = "bus-" + (el.type || "n") + "-" + el.id;
      if (seen[id]) continue;
      seen[id] = 1;
      const tags = el.tags || {};
      feats.push({
        type: "Feature",
        properties: {
          id: id,
          name: stopName(tags),
          kind: "bus_stop",
          claimable: 0,
        },
        geometry: { type: "Point", coordinates: [lon, lat] },
      });
    }
    return { type: "FeatureCollection", features: feats };
  }

  function fetchOverpass(b) {
    const body = "data=" + encodeURIComponent(overpassQl(b));
    const tryOne = (url) => fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "Accept": "application/json",
      },
      body: body,
    }).then((res) => {
      if (!res.ok) throw new Error("overpass " + res.status);
      return res.json();
    });
    return tryOne(OVERPASS_ENDPOINTS[0]).catch(() => tryOne(OVERPASS_ENDPOINTS[1]));
  }

  function ensureBusIcon(map) {
    if (!map || !map.addImage) return;
    if (map.hasImage && map.hasImage("lvfe-bus")) return;
    const size = 64;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#1565c0";
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(10, 14, 44, 36, 8);
    } else {
      ctx.rect(10, 14, 44, 36);
    }
    ctx.fill();
    ctx.fillStyle = "#e3f2fd";
    ctx.fillRect(16, 20, 14, 10);
    ctx.fillRect(34, 20, 14, 10);
    ctx.fillStyle = "#0d47a1";
    ctx.beginPath();
    ctx.arc(22, 48, 5, 0, Math.PI * 2);
    ctx.arc(42, 48, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("B", 32, 40);
    try {
      map.addImage("lvfe-bus", ctx.getImageData(0, 0, size, size), { pixelRatio: 2 });
    } catch (err) { /* */ }
  }

  function ensureLayers(map) {
    if (!map || !map.getSource) return false;
    try {
      ensureBusIcon(map);
      if (!map.getSource("bus-stops")) {
        map.addSource("bus-stops", { type: "geojson", data: EMPTY });
      }
      if (!map.getLayer("bus-stops-dot")) {
        map.addLayer({
          id: "bus-stops-dot",
          type: "symbol",
          source: "bus-stops",
          minzoom: 13.5,
          layout: {
            "icon-image": "lvfe-bus",
            "icon-size": [
              "interpolate", ["linear"], ["zoom"],
              13.5, 0.55,
              15, 0.75,
              17, 0.95,
            ],
            "icon-allow-overlap": false,
            "icon-ignore-placement": false,
            "text-field": ["step", ["zoom"], "", 15, ["get", "name"]],
            "text-size": 11,
            "text-font": ["Noto Sans Regular"],
            "text-offset": [0, 1.15],
            "text-anchor": "top",
            "text-optional": true,
            "text-max-width": 8,
          },
          paint: {
            "text-color": "#0d47a1",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.2,
            "icon-opacity": [
              "interpolate", ["linear"], ["zoom"],
              13.5, 0.7,
              14.5, 0.95,
            ],
          },
        });
      }
      bindClicks(map);
      return true;
    } catch (err) {
      return false;
    }
  }

  function ensureTip() {
    if (tipEl) return tipEl;
    tipEl = document.createElement("div");
    tipEl.id = "busTip";
    tipEl.setAttribute("role", "status");
    tipEl.hidden = true;
    tipEl.style.cssText = [
      "position:absolute", "z-index:8", "left:50%", "bottom:calc(96px + env(safe-area-inset-bottom,0px))",
      "transform:translateX(-50%)", "max-width:86vw",
      "background:rgba(20,20,22,.92)", "color:#f5f5f7",
      "border:1px solid rgba(255,255,255,.12)", "border-radius:12px",
      "padding:10px 14px", "font:650 13px/1.3 system-ui,sans-serif",
      "box-shadow:0 8px 24px rgba(0,0,0,.35)", "pointer-events:none",
    ].join(";");
    const host = document.getElementById("map") && document.getElementById("map").parentElement;
    (host || document.body).appendChild(tipEl);
    return tipEl;
  }

  function showTip(name) {
    const el = ensureTip();
    el.textContent = "🚌 " + (name || "Bus stop") + " · not claimable";
    el.hidden = false;
    if (tipTimer) clearTimeout(tipTimer);
    tipTimer = setTimeout(() => { el.hidden = true; }, 2800);
  }

  function bindClicks(map) {
    if (!map || map.__lvfeBusClick || typeof map.on !== "function") return;
    map.__lvfeBusClick = true;
    clickBound = true;
    try {
      map.on("click", "bus-stops-dot", (e) => {
        const f = e.features && e.features[0];
        const name = f && f.properties && f.properties.name;
        showTip(name);
        if (e.originalEvent && e.originalEvent.stopPropagation) e.originalEvent.stopPropagation();
      });
      map.on("mouseenter", "bus-stops-dot", () => {
        try { map.getCanvas().style.cursor = "pointer"; } catch (err) { /* */ }
      });
      map.on("mouseleave", "bus-stops-dot", () => {
        try { map.getCanvas().style.cursor = ""; } catch (err2) { /* */ }
      });
    } catch (err) { /* */ }
  }

  function setData(fc) {
    const map = mapRef || global.lvfeMap;
    if (!map || !map.getSource) return;
    ensureLayers(map);
    const src = map.getSource("bus-stops");
    if (src) src.setData(fc || EMPTY);
  }

  function refresh(force) {
    const map = mapRef || global.lvfeMap;
    if (!map) return;
    ensureLayers(map);
    let zoom = 12;
    try { zoom = map.getZoom(); } catch (err) { /* */ }
    if (zoom < 13.2) {
      setData(EMPTY);
      return;
    }
    const b = bboxFromMap(map);
    if (!b) return;
    const midLat = (b.s + b.n) / 2;
    const midLon = (b.w + b.e) / 2;
    const key = cellKey(midLat, midLon);
    const cache = lsGet(CACHE_KEY, {}) || {};
    const hit = cache[key];
    const now = Date.now();
    if (!force && hit && hit.t && (now - hit.t) < CACHE_TTL_MS && hit.fc) {
      setData(hit.fc);
      return;
    }
    if (!force && now - lastFetchAt < MIN_INTERVAL_MS) {
      if (hit && hit.fc) setData(hit.fc);
      return;
    }
    if (inFlight) return;
    lastFetchAt = now;
    inFlight = fetchOverpass(b).then((data) => {
      const fc = toFeatures(data && data.elements);
      cache[key] = { t: Date.now(), fc: fc };
      const keys = Object.keys(cache);
      if (keys.length > 24) {
        keys.sort((a, b2) => (cache[a].t || 0) - (cache[b2].t || 0));
        for (let i = 0; i < keys.length - 18; i++) delete cache[keys[i]];
      }
      lsSet(CACHE_KEY, cache);
      setData(fc);
    }).catch(() => {
      if (hit && hit.fc) setData(hit.fc);
      else setData(EMPTY);
    }).then(() => { inFlight = null; });
  }

  function scheduleRefresh() {
    if (moveTimer) clearTimeout(moveTimer);
    moveTimer = setTimeout(() => refresh(false), 650);
  }

  function bindMap(map) {
    mapRef = map;
    if (!map) return;
    ensureLayers(map);
    if (!map.__lvfeBusMove) {
      map.__lvfeBusMove = true;
      try {
        map.on("moveend", scheduleRefresh);
        map.on("zoomend", scheduleRefresh);
      } catch (err) { /* */ }
    }
    scheduleRefresh();
  }

  global.LvfeBusStops = {
    bindMap: bindMap,
    ensureLayers: ensureLayers,
    refresh: refresh,
    showTip: showTip,
  };
})(typeof window !== "undefined" ? window : globalThis);
