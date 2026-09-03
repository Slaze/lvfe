/* Track a marked pin: pulse beep, OSRM walking line, 80 m pay ring.
   Beep path is AudioContext + navigator.vibrate (Android WebView). Mute is in-app. */
(function (global) {
  const STORE = "lvfe.track.v1";
  const MUTE_KEY = "lvfe.track.mute.v1";
  const OSRM = "https://router.project-osrm.org/route/v1/walking/";
  const EMPTY = { type: "FeatureCollection", features: [] };
  const WALK_KMH = 5;

  let target = null;
  let muted = false;
  let pulseTimer = 0;
  let lastPulse = 0;
  let wasIn = false;
  let audioCtx = null;
  let lastRouteAt = 0;
  let lastFetchPos = null;
  let route = null;
  let mapRef = null;
  let pendingPaint = false;
  let fetchCtl = null;

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

  function geodesicRoute(from, to) {
    const dist = R().haversineM(from.lat, from.lon, to.lat, to.lon);
    return {
      coords: [[from.lon, from.lat], [to.lon, to.lat]],
      distance: dist,
      duration: (dist / 1000) / WALK_KMH * 3600,
      source: "geodesic",
    };
  }

  function applyRoute(next) {
    route = next;
    paintMap();
    paintChip();
  }

  function fetchOsrm(from, to) {
    const url = OSRM + from.lon + "," + from.lat + ";" + to.lon + "," + to.lat +
      "?overview=full&geometries=geojson";
    if (fetchCtl) {
      try { fetchCtl.abort(); } catch (err) { /* */ }
    }
    fetchCtl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const sig = fetchCtl ? fetchCtl.signal : undefined;
    const timer = setTimeout(() => {
      if (fetchCtl) fetchCtl.abort();
    }, 6000);
    return fetch(url, { signal: sig }).then((res) => {
      clearTimeout(timer);
      if (!res.ok) throw new Error("osrm");
      return res.json();
    }).then((data) => {
      const r0 = data && data.routes && data.routes[0];
      const geom = r0 && r0.geometry && r0.geometry.coordinates;
      if (!geom || geom.length < 2) throw new Error("empty");
      return {
        coords: geom,
        distance: Number(r0.distance) || R().haversineM(from.lat, from.lon, to.lat, to.lon),
        duration: Number(r0.duration) || 0,
        source: "osrm",
      };
    }).catch(() => geodesicRoute(from, to));
  }

  function maybeFetchRoute(force) {
    if (!target) return;
    const pos = global.lvfeUserPos;
    if (!pos) {
      applyRoute(null);
      paintMap();
      paintChip();
      return;
    }
    const moved = !lastFetchPos ||
      R().haversineM(pos.lat, pos.lon, lastFetchPos.lat, lastFetchPos.lon) > 22;
    const stale = Date.now() - lastRouteAt > 18000;
    if (!force && !moved && !stale && route) {
      paintMap();
      paintChip();
      return;
    }
    lastRouteAt = Date.now();
    lastFetchPos = { lat: pos.lat, lon: pos.lon };
    const fallback = geodesicRoute(pos, target);
    if (!route) applyRoute(fallback);
    fetchOsrm(pos, target).then((next) => {
      applyRoute(next);
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

  function ensureLayers(map) {
    if (!map || !map.getSource || !map.getLayer) return false;
    try {
      addSourceOnce(map, "guide");
      addLayerOnce(map, guideCasingSpec());
      addLayerOnce(map, guideLineSpec());
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
      const ok = Boolean(
        map.getLayer("guide-casing") &&
        map.getLayer("guide-line") &&
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

  function paintMap() {
    const map = mapRef || global.lvfeMap;
    if (!map) return;
    if (!ensureLayers(map)) return;
    if (!target) {
      if (map.getSource("guide")) map.getSource("guide").setData(EMPTY);
      if (map.getSource("payring")) map.getSource("payring").setData(EMPTY);
      return;
    }
    const line = route && route.coords && route.coords.length >= 2
      ? route.coords
      : (global.lvfeUserPos
        ? [[global.lvfeUserPos.lon, global.lvfeUserPos.lat], [target.lon, target.lat]]
        : [[target.lon, target.lat], [target.lon, target.lat]]);
    map.getSource("guide").setData({
      type: "Feature",
      properties: { kind: "walk" },
      geometry: { type: "LineString", coordinates: line },
    });
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
    const use = route && Number.isFinite(route.distance) ? route.distance : dist;
    const mins = route && route.source === "osrm" && route.duration > 0
      ? Math.max(1, Math.round(route.duration / 60))
      : R().walkMinutes(use);
    return { dist: dist, routeDist: use, mins: mins, source: route ? route.source : "geodesic" };
  }

  function chipLine() {
    if (!target) return "";
    const w = walkParts();
    const title = target.name;
    if (!global.lvfeUserPos) return title + " · tap GPS to guide · 80 m pay ring";
    const how = w.source === "osrm" ? "walk" : "as the crow flies";
    return Math.round(w.routeDist) + " m · " + R().walkEtaText(w.routeDist, w.mins) +
      " (" + how + ") · 80 m pay ring";
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
    route = null;
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
    route = null;
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
  };
})(typeof window !== "undefined" ? window : globalThis);
