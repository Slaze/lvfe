/* Track a marked pin: pulse beep, OSRM walking (+alts) + optional car ETA labels,
   80 m pay ring. Beep path is AudioContext + navigator.vibrate. Mute is in-app.
   No Google Directions / Maps SKUs — public OSRM only. */
(function (global) {
  const STORE = "lvfe.track.v1";
  const MUTE_KEY = "lvfe.track.mute.v1";
  const OSRM_WALK = "https://router.project-osrm.org/route/v1/walking/";
  const OSRM_DRIVE = "https://router.project-osrm.org/route/v1/driving/";
  const EMPTY = { type: "FeatureCollection", features: [] };
  const WALK_KMH = 5;
  const MAX_ALTS = 3;

  let target = null;
  let muted = false;
  let pulseTimer = 0;
  let lastPulse = 0;
  let wasIn = false;
  let audioCtx = null;
  let lastRouteAt = 0;
  let lastFetchPos = null;
  let routes = [];
  let activeIdx = 0;
  let carEtaSec = null;
  let mapRef = null;
  let pendingPaint = false;
  let fetchCtl = null;
  let clickBound = false;

  function R() {
    return global.LvfeRules;
  }

  function radius() {
    return R().CLAIM_RADIUS_M;
  }

  function readMute() {
    try { return localStorage.getItem(MUTE_KEY) === "1"; } catch (err) { return false; }
  }

  function writeMute(on) {
    muted = Boolean(on);
    try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch (err) { /* */ }
  }

  function loadStored() {
    try {
      const o = JSON.parse(localStorage.getItem(STORE) || "null");
      if (!o || !o.id || !Number.isFinite(Number(o.lat))) return null;
      return {
        id: String(o.id),
        name: o.name || "This place",
        lon: Number(o.lon),
        lat: Number(o.lat),
      };
    } catch (err) {
      return null;
    }
  }

  function persist() {
    try {
      if (!target) localStorage.removeItem(STORE);
      else localStorage.setItem(STORE, JSON.stringify(target));
    } catch (err) { /* */ }
  }

  function publish() {
    global.lvfeTracked = target;
  }

  function unlockAudio() {
    try {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch (err) { /* WebView may block until gesture */ }
  }

  function tone(freq, dur, delay) {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime + (delay || 0);
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function vibrate(inRadius) {
    try {
      if (!navigator.vibrate) return;
      navigator.vibrate(inRadius ? [50, 40, 50] : [28]);
    } catch (err) { /* */ }
  }

  function pulse(inRadius) {
    const kind = inRadius ? "pay-radius" : "track";
    const rec = { kind: kind, inRadius: Boolean(inRadius), muted: muted, t: Date.now() };
    global.__lvfeLastBeep = rec;
    try { console.log("[lvfe-beep]", kind, rec.t, muted ? "muted" : "fire"); } catch (err) { /* */ }
    if (muted) return;
    unlockAudio();
    if (inRadius) {
      tone(880, 0.09, 0);
      tone(1175, 0.12, 0.11);
    } else {
      tone(520, 0.08, 0);
    }
    vibrate(inRadius);
  }

  function distNow() {
    if (!target || !global.lvfeUserPos) return Infinity;
    return R().haversineM(global.lvfeUserPos.lat, global.lvfeUserPos.lon, target.lat, target.lon);
  }

  function tickPulse() {
    if (!target) return;
    const dist = distNow();
    const inR = Number.isFinite(dist) && dist <= radius();
    const now = Date.now();
    if (inR && !wasIn) {
      pulse(true);
      lastPulse = now;
      wasIn = true;
      paintChip();
      return;
    }
    if (!inR) wasIn = false;
    const gap = inR ? 2200 : 3800;
    if (now - lastPulse >= gap) {
      pulse(inR);
      lastPulse = now;
    }
  }

  function startPulse() {
    if (pulseTimer) return;
    lastPulse = 0;
    wasIn = false;
    pulseTimer = setInterval(tickPulse, 400);
    tickPulse();
  }

  function stopPulse() {
    if (pulseTimer) {
      clearInterval(pulseTimer);
      pulseTimer = 0;
    }
    wasIn = false;
  }

  function activeRoute() {
    if (!routes.length) return null;
    const i = Math.max(0, Math.min(activeIdx, routes.length - 1));
    return routes[i] || null;
  }

  function geodesicRoute(from, to) {
    const dist = R().haversineM(from.lat, from.lon, to.lat, to.lon);
    return {
      coords: [[from.lon, from.lat], [to.lon, to.lat]],
      distance: dist,
      duration: (dist / 1000) / WALK_KMH * 3600,
      source: "geodesic",
      profile: "walk",
    };
  }

  function fmtDist(m) {
    const n = Number(m) || 0;
    if (n >= 1000) return (Math.round(n / 100) / 10) + " km";
    return Math.round(n) + " m";
  }

  function fmtMins(sec) {
    const mins = Math.max(1, Math.round((Number(sec) || 0) / 60));
    return mins + " min";
  }

  function carSecsFor(route) {
    if (!route || !Number.isFinite(carEtaSec) || carEtaSec <= 0) return null;
    const prim = routes[0];
    if (!prim || !prim.distance) return carEtaSec;
    const ratio = (Number(route.distance) || prim.distance) / prim.distance;
    return Math.max(30, carEtaSec * ratio);
  }

  function routeLabel(route, active) {
    if (!route) return "";
    const walk = "Walk " + fmtMins(route.duration) + " · " + fmtDist(route.distance);
    const carS = carSecsFor(route);
    const car = carS != null ? " · Car " + fmtMins(carS) : "";
    const mark = active ? "● " : "";
    return mark + walk + car;
  }

  function applyRoutes(list, preferIdx) {
    routes = Array.isArray(list) ? list.slice(0, MAX_ALTS) : [];
    if (!routes.length) {
      activeIdx = 0;
    } else if (Number.isFinite(preferIdx) && preferIdx >= 0 && preferIdx < routes.length) {
      activeIdx = preferIdx;
    } else {
      activeIdx = Math.max(0, Math.min(activeIdx, routes.length - 1));
    }
    paintMap();
    paintChip();
  }

  function abortFetch() {
    if (fetchCtl) {
      try { fetchCtl.abort(); } catch (err) { /* */ }
    }
    fetchCtl = typeof AbortController !== "undefined" ? new AbortController() : null;
    return fetchCtl ? fetchCtl.signal : undefined;
  }

  function fetchJson(url, signal, ms) {
    const timer = setTimeout(() => {
      if (fetchCtl) fetchCtl.abort();
    }, ms || 7000);
    return fetch(url, { signal: signal }).then((res) => {
      clearTimeout(timer);
      if (!res.ok) throw new Error("osrm");
      return res.json();
    }).catch((err) => {
      clearTimeout(timer);
      throw err;
    });
  }

  function parseWalkRoutes(data, from, to) {
    const list = data && data.routes;
    if (!list || !list.length) throw new Error("empty");
    const out = [];
    for (let i = 0; i < list.length && out.length < MAX_ALTS; i++) {
      const r0 = list[i];
      const geom = r0 && r0.geometry && r0.geometry.coordinates;
      if (!geom || geom.length < 2) continue;
      out.push({
        coords: geom,
        distance: Number(r0.distance) || R().haversineM(from.lat, from.lon, to.lat, to.lon),
        duration: Number(r0.duration) || 0,
        source: "osrm",
        profile: "walk",
      });
    }
    if (!out.length) throw new Error("empty");
    return out;
  }

  function midOffset(from, to, meters) {
    const midLat = (from.lat + to.lat) / 2;
    const midLon = (from.lon + to.lon) / 2;
    const dLat = to.lat - from.lat;
    const dLon = to.lon - from.lon;
    const latM = 111320;
    const lonM = 111320 * Math.cos(midLat * Math.PI / 180) || 1;
    const nx = -dLon * lonM;
    const ny = dLat * latM;
    const len = Math.hypot(nx, ny) || 1;
    return {
      lat: midLat + (ny / len) * meters / latM,
      lon: midLon + (nx / len) * meters / lonM,
    };
  }

  function routeDiffers(a, b) {
    if (!a || !b) return true;
    const da = Number(a.distance) || 0;
    const db = Number(b.distance) || 0;
    if (Math.abs(da - db) / Math.max(da, db, 1) > 0.08) return true;
    const ca = a.coords;
    const cb = b.coords;
    if (!ca || !cb || ca.length < 4 || cb.length < 4) return true;
    const ia = Math.floor(ca.length / 2);
    const ib = Math.floor(cb.length / 2);
    const d = R().haversineM(ca[ia][1], ca[ia][0], cb[ib][1], cb[ib][0]);
    return d > 90;
  }

  function fetchOsrmBundle(from, to) {
    const sig = abortFetch();
    const base = from.lon + "," + from.lat + ";" + to.lon + "," + to.lat;
    const walkUrl = OSRM_WALK + base + "?overview=full&geometries=geojson&alternatives=3";
    const driveUrl = OSRM_DRIVE + base + "?overview=false&alternatives=false";
    const walkP = fetchJson(walkUrl, sig, 7000).then((data) => parseWalkRoutes(data, from, to));
    const driveP = fetchJson(driveUrl, sig, 7000).then((data) => {
      const r0 = data && data.routes && data.routes[0];
      if (!r0 || !Number.isFinite(Number(r0.duration))) return null;
      return Number(r0.duration);
    }).catch(() => null);
    return Promise.all([walkP, driveP]).then((pair) => {
      carEtaSec = pair[1];
      let list = pair[0] || [];
      if (list.length >= 2) return list;
      const via = midOffset(from, to, 420);
      const viaPath = from.lon + "," + from.lat + ";" + via.lon + "," + via.lat + ";" + to.lon + "," + to.lat;
      return fetchJson(OSRM_WALK + viaPath + "?overview=full&geometries=geojson&alternatives=false", undefined, 7000)
        .then((data) => parseWalkRoutes(data, from, to))
        .catch(() => [])
        .then((extra) => {
          for (let i = 0; i < extra.length && list.length < MAX_ALTS; i++) {
            if (routeDiffers(list[0], extra[i])) list.push(extra[i]);
          }
          return list;
        });
    }).catch(() => {
      carEtaSec = null;
      return [geodesicRoute(from, to)];
    });
  }

  function maybeFetchRoute(force) {
    if (!target) return;
    const pos = global.lvfeUserPos;
    if (!pos) {
      applyRoutes([]);
      paintMap();
      paintChip();
      return;
    }
    const moved = !lastFetchPos ||
      R().haversineM(pos.lat, pos.lon, lastFetchPos.lat, lastFetchPos.lon) > 22;
    const stale = Date.now() - lastRouteAt > 18000;
    if (!force && !moved && !stale && routes.length) {
      paintMap();
      paintChip();
      return;
    }
    lastRouteAt = Date.now();
    lastFetchPos = { lat: pos.lat, lon: pos.lon };
    const fallback = geodesicRoute(pos, target);
    if (!routes.length) applyRoutes([fallback], 0);
    const keepIdx = activeIdx;
    fetchOsrmBundle(pos, target).then((list) => {
      applyRoutes(list, keepIdx < list.length ? keepIdx : 0);
    });
  }

  function payRing(lon, lat, r) {
    const coords = [];
    const latR = r / 111320;
    const lonR = r / (111320 * Math.cos(lat * Math.PI / 180) || 1);
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * 2 * Math.PI;
      coords.push([lon + lonR * Math.cos(t), lat + latR * Math.sin(t)]);
    }
    return { type: "Polygon", coordinates: [coords] };
  }

  function midCoord(coords) {
    if (!coords || coords.length < 2) return null;
    const mid = Math.floor(coords.length / 2);
    return coords[mid];
  }

  function addSourceOnce(map, id) {
    if (!map.getSource(id)) {
      map.addSource(id, { type: "geojson", data: EMPTY });
    }
  }

  function addLayerOnce(map, spec) {
    if (!map.getLayer(spec.id)) {
      map.addLayer(spec);
    }
  }

  function guideCasingSpec() {
    return {
      id: "guide-casing",
      type: "line",
      source: "guide",
      filter: ["==", ["get", "active"], 1],
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#00c853",
        "line-width": 12,
        "line-opacity": 0.7,
      },
    };
  }

  function guideLineSpec() {
    return {
      id: "guide-line",
      type: "line",
      source: "guide",
      filter: ["==", ["get", "active"], 1],
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#00e676",
        "line-width": 7,
        "line-opacity": 1,
      },
    };
  }

  function guideAltCasingSpec() {
    return {
      id: "guide-alt-casing",
      type: "line",
      source: "guide",
      filter: ["==", ["get", "active"], 0],
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#1b5e20",
        "line-width": 9,
        "line-opacity": 0.35,
        "line-dasharray": [1.2, 1.6],
      },
    };
  }

  function guideAltLineSpec() {
    return {
      id: "guide-alt-line",
      type: "line",
      source: "guide",
      filter: ["==", ["get", "active"], 0],
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#66bb6a",
        "line-width": 5,
        "line-opacity": 0.55,
        "line-dasharray": [1.4, 1.8],
      },
    };
  }

  function guideLabelSpec() {
    return {
      id: "guide-label",
      type: "symbol",
      source: "guide-labels",
      layout: {
        "text-field": ["get", "label"],
        "text-size": 12,
        "text-font": ["Noto Sans Regular"],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
        "text-anchor": "center",
        "text-offset": [0, 0],
        "text-max-width": 16,
      },
      paint: {
        "text-color": ["case", ["==", ["get", "active"], 1], "#0a3d14", "#335c3a"],
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.6,
      },
    };
  }

  function ensureLayers(map) {
    if (!map || !map.getSource || !map.getLayer) return false;
    try {
      addSourceOnce(map, "guide");
      addSourceOnce(map, "guide-labels");
      addLayerOnce(map, guideAltCasingSpec());
      addLayerOnce(map, guideAltLineSpec());
      addLayerOnce(map, guideCasingSpec());
      addLayerOnce(map, guideLineSpec());
      addLayerOnce(map, guideLabelSpec());
      addSourceOnce(map, "payring");
      addLayerOnce(map, {
        id: "pay-fill",
        type: "fill",
        source: "payring",
        paint: { "fill-color": "#f4c430", "fill-opacity": 0.16 },
      });
      addLayerOnce(map, {
        id: "pay-ring",
        type: "line",
        source: "payring",
        paint: {
          "line-color": "#e67e22",
          "line-width": 3,
          "line-opacity": 1,
        },
      });
      bindRouteClicks(map);
      const ok = Boolean(
        map.getLayer("guide-casing") &&
        map.getLayer("guide-line") &&
        map.getLayer("guide-alt-line") &&
        map.getLayer("pay-fill") &&
        map.getLayer("pay-ring")
      );
      if (!ok) pendingPaint = true;
      return ok;
    } catch (err) {
      pendingPaint = true;
      return false;
    }
  }

  function bindRouteClicks(map) {
    if (!map || map.__lvfeRouteClick || typeof map.on !== "function") return;
    map.__lvfeRouteClick = true;
    clickBound = true;
    const pick = (e) => {
      if (!routes.length || routes.length < 2) return;
      const feats = e && e.features;
      if (!feats || !feats.length) return;
      const idx = Number(feats[0].properties && feats[0].properties.idx);
      if (!Number.isFinite(idx) || idx < 0 || idx >= routes.length) return;
      if (idx === activeIdx) return;
      activeIdx = idx;
      paintMap();
      paintChip();
      if (e.originalEvent && typeof e.originalEvent.stopPropagation === "function") {
        e.originalEvent.stopPropagation();
      }
    };
    try {
      map.on("click", "guide-alt-line", pick);
      map.on("click", "guide-alt-casing", pick);
      map.on("click", "guide-label", pick);
      map.on("mouseenter", "guide-alt-line", () => {
        try { map.getCanvas().style.cursor = "pointer"; } catch (err) { /* */ }
      });
      map.on("mouseleave", "guide-alt-line", () => {
        try { map.getCanvas().style.cursor = ""; } catch (err2) { /* */ }
      });
    } catch (err) { /* */ }
  }

  function paintMap() {
    const map = mapRef || global.lvfeMap;
    if (!map) return;
    if (!ensureLayers(map)) return;
    if (!target) {
      if (map.getSource("guide")) map.getSource("guide").setData(EMPTY);
      if (map.getSource("guide-labels")) map.getSource("guide-labels").setData(EMPTY);
      if (map.getSource("payring")) map.getSource("payring").setData(EMPTY);
      return;
    }
    const lineFeats = [];
    const labelFeats = [];
    if (routes.length) {
      for (let i = 0; i < routes.length; i++) {
        const r = routes[i];
        const active = i === activeIdx ? 1 : 0;
        lineFeats.push({
          type: "Feature",
          properties: { kind: "walk", idx: i, active: active },
          geometry: { type: "LineString", coordinates: r.coords },
        });
        const mid = midCoord(r.coords);
        if (mid) {
          labelFeats.push({
            type: "Feature",
            properties: {
              idx: i,
              active: active,
              label: routeLabel(r, active === 1),
            },
            geometry: { type: "Point", coordinates: mid },
          });
        }
      }
    } else if (global.lvfeUserPos) {
      const line = [
        [global.lvfeUserPos.lon, global.lvfeUserPos.lat],
        [target.lon, target.lat],
      ];
      lineFeats.push({
        type: "Feature",
        properties: { kind: "walk", idx: 0, active: 1 },
        geometry: { type: "LineString", coordinates: line },
      });
    }
    map.getSource("guide").setData({ type: "FeatureCollection", features: lineFeats });
    map.getSource("guide-labels").setData({ type: "FeatureCollection", features: labelFeats });
    map.getSource("payring").setData({
      type: "Feature",
      properties: { kind: "pay" },
      geometry: payRing(target.lon, target.lat, radius()),
    });
  }

  function walkParts() {
    const pos = global.lvfeUserPos;
    if (!target) return { dist: Infinity, mins: 0, line: "Not tracking" };
    const dist = pos ? R().haversineM(pos.lat, pos.lon, target.lat, target.lon) : Infinity;
    const route = activeRoute();
    const use = route && Number.isFinite(route.distance) ? route.distance : dist;
    const mins = route && route.source === "osrm" && route.duration > 0
      ? Math.max(1, Math.round(route.duration / 60))
      : R().walkMinutes(use);
    return {
      dist: dist,
      routeDist: use,
      mins: mins,
      source: route ? route.source : "geodesic",
      alts: routes.length,
      carSec: carSecsFor(route),
    };
  }

  function chipLine() {
    if (!target) return "";
    const w = walkParts();
    const title = target.name;
    if (!global.lvfeUserPos) return title + " · tap GPS to guide · 80 m pay ring";
    const how = w.source === "osrm" ? "walk" : "as the crow flies";
    let line = Math.round(w.routeDist) + " m · " + R().walkEtaText(w.routeDist, w.mins) +
      " (" + how + ")";
    if (w.carSec != null) line += " · Car " + fmtMins(w.carSec);
    if (w.alts > 1) line += " · tap muted path for alt";
    return line + " · 80 m pay ring";
  }

  function paintChip() {
    const chip = document.getElementById("trackChip");
    if (!chip) return;
    if (!target) {
      chip.hidden = true;
      return;
    }
    chip.hidden = false;
    const name = document.getElementById("trackName");
    const meta = document.getElementById("trackMeta");
    const muteBtn = document.getElementById("trackMute");
    if (name) name.textContent = target.name;
    if (meta) meta.textContent = chipLine();
    if (muteBtn) {
      muteBtn.setAttribute("aria-checked", muted ? "true" : "false");
    }
  }

  function bindChip() {
    const muteBtn = document.getElementById("trackMute");
    const stopBtn = document.getElementById("trackStop");
    if (muteBtn && muteBtn.dataset.bound !== "1") {
      muteBtn.dataset.bound = "1";
      muteBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        writeMute(!muted);
        paintChip();
      });
    }
    if (stopBtn && stopBtn.dataset.bound !== "1") {
      stopBtn.dataset.bound = "1";
      stopBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        stop();
      });
    }
  }

  function bindMap(map) {
    mapRef = map;
    if (target) {
      ensureLayers(map);
      paintMap();
    } else if (pendingPaint) {
      pendingPaint = false;
    }
  }

  function start(featOrTarget, opts) {
    unlockAudio();
    muted = readMute();
    let next = featOrTarget;
    if (featOrTarget && featOrTarget.properties) {
      const p = featOrTarget.properties;
      const c = featOrTarget.geometry && featOrTarget.geometry.coordinates;
      next = {
        id: String(p.id),
        name: R().placeTitle(p),
        lon: Number(c[0]),
        lat: Number(c[1]),
      };
    }
    if (!next || !next.id || !Number.isFinite(next.lat)) return;
    target = {
      id: String(next.id),
      name: R().placeTitle({ name: next.name, catalog_type: next.catalog_type }) || next.name,
      lon: Number(next.lon),
      lat: Number(next.lat),
    };
    persist();
    publish();
    routes = [];
    activeIdx = 0;
    carEtaSec = null;
    lastFetchPos = null;
    lastRouteAt = 0;
    bindChip();
    startPulse();
    maybeFetchRoute(true);
    paintChip();
    if (opts && opts.fit && (mapRef || global.lvfeMap) && global.lvfeUserPos) {
      const map = mapRef || global.lvfeMap;
      try {
        map.fitBounds(
          [
            [Math.min(global.lvfeUserPos.lon, target.lon), Math.min(global.lvfeUserPos.lat, target.lat)],
            [Math.max(global.lvfeUserPos.lon, target.lon), Math.max(global.lvfeUserPos.lat, target.lat)],
          ],
          { padding: 72, maxZoom: 16.4, duration: 800 }
        );
      } catch (err) { /* */ }
    }
    if (typeof global.lvfeOnTrackChange === "function") global.lvfeOnTrackChange(target);
  }

  function stop() {
    target = null;
    routes = [];
    activeIdx = 0;
    carEtaSec = null;
    persist();
    publish();
    stopPulse();
    paintMap();
    paintChip();
    if (typeof global.lvfeOnTrackChange === "function") global.lvfeOnTrackChange(null);
  }

  function toggle(feat) {
    const id = feat && feat.properties ? String(feat.properties.id) : String(feat && feat.id || "");
    if (target && target.id === id) stop();
    else start(feat, { fit: true });
  }

  function onUserPos() {
    if (!target) return;
    maybeFetchRoute(false);
    paintChip();
  }

  function get() {
    return target;
  }

  function isTracking(id) {
    return Boolean(target && String(target.id) === String(id));
  }

  function selectRoute(idx) {
    const i = Number(idx);
    if (!Number.isFinite(i) || i < 0 || i >= routes.length) return;
    activeIdx = i;
    paintMap();
    paintChip();
  }

  muted = readMute();
  target = loadStored();
  publish();
  if (target) {
    bindChip();
    startPulse();
  }

  global.LvfeTrack = {
    start: start,
    stop: stop,
    clear: stop,
    toggle: toggle,
    get: get,
    isTracking: isTracking,
    bindMap: bindMap,
    bindChip: bindChip,
    onUserPos: onUserPos,
    paintChip: paintChip,
    chipLine: chipLine,
    walkParts: walkParts,
    pulse: pulse,
    unlockAudio: unlockAudio,
    ensureLayers: ensureLayers,
    guideCasingSpec: guideCasingSpec,
    guideLineSpec: guideLineSpec,
    guideAltLineSpec: guideAltLineSpec,
    selectRoute: selectRoute,
    OSRM_WALK: OSRM_WALK,
    OSRM_DRIVE: OSRM_DRIVE,
  };
})(typeof window !== "undefined" ? window : globalThis);
