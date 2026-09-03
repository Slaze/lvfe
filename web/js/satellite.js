/* Free Esri World Imagery overlay. Never setStyle — catalog, green walk,
   80 m ring, you-dot, and 3D stay on the live Liberty style. */
(function (global) {
  const SOURCE_ID = "esri-sat";
  const LAYER_ID = "esri-sat";
  const STORE = "lvfe.sat.v1";
  const FAIL_MSG = "Satellite couldn’t load";
  /** ArcGIS MapServer is {z}/{row}/{col} = {z}/{y}/{x}. {z}/{x}/{y} is empty junk. */
  const TILE_TMPL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const ATTRIBUTION = "Imagery © Esri, Maxar, Earthstar Geographics";
  /** Last native Esri LOD with rooftops in Enugu. z19 HTTP 200 is the empty plate. */
  const MAXZOOM = 18;
  /** Layer stays on at street zoom; source maxzoom overscales z18 instead of fetching z19. */
  const LAYER_MAXZOOM = 24;
  const WATCH_MS = 8000;
  const GAME_STACK = [
    "territories-fill",
    "territories-line",
    "territories-label",
    "you-accuracy",
    "place-poles",
    "places-hit",
    "places-circles",
    "places-x",
    "places-x-unknown",
    "places-nearby",
    "guide-casing",
    "guide-line",
    "pay-fill",
    "pay-ring",
    "you-dot",
  ];
  const GAME_IDS = {};
  GAME_STACK.forEach((id) => { GAME_IDS[id] = true; });
  GAME_IDS[LAYER_ID] = true;

  let mapRef = null;
  let hooks = {};
  let wantedOn = false;
  let hybridOn = true;
  let watchTimer = 0;
  let gotTile = false;
  let bound = false;

  function readPref() {
    try {
      const o = JSON.parse(localStorage.getItem(STORE) || "null");
      if (o && typeof o === "object" && typeof o.on === "boolean") {
        hybridOn = o.hybrid !== false;
        return o;
      }
    } catch (err) { /* */ }
    /* Default: satellite ON at first boot (GMaps-like). */
    return { on: true, hybrid: true };
  }

  function writePref() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ on: wantedOn, hybrid: hybridOn }));
    } catch (err) { /* */ }
  }

  function lonLatToTile(lat, lon, z) {
    const n = Math.pow(2, z);
    const latRad = lat * Math.PI / 180;
    const x = Math.floor((lon + 180) / 360 * n);
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x: x, y: y, z: z };
  }

  function tileUrl(z, x, y) {
    return TILE_TMPL.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
  }

  function isOsmPoiLabel(id) {
    return id.indexOf("poi_") === 0 || id === "label_other" || id === "label_village";
  }

  function satBeforeId(map) {
    if (typeof map.getLayer === "function") {
      if (map.getLayer("territories-fill")) return "territories-fill";
      if (map.getLayer("places-circles")) return "places-circles";
    }
    const layers = (map.getStyle && map.getStyle() && map.getStyle().layers) || [];
    const prefer = ["territories-fill", "places-hit", "places-circles"];
    for (let i = 0; i < prefer.length; i++) {
      for (let j = 0; j < layers.length; j++) {
        if (layers[j] && layers[j].id === prefer[i]) return prefer[i];
      }
    }
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (layer && layer.type === "symbol") return layer.id;
    }
    return undefined;
  }

  function ensure(map) {
    if (!map || typeof map.addSource !== "function") return false;
    try {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: "raster",
          tiles: [TILE_TMPL],
          tileSize: 256,
          scheme: "xyz",
          minzoom: 0,
          maxzoom: MAXZOOM,
          attribution: "",
        });
      }
      if (!map.getLayer(LAYER_ID)) {
        map.addLayer({
          id: LAYER_ID,
          type: "raster",
          source: SOURCE_ID,
          minzoom: 0,
          maxzoom: LAYER_MAXZOOM,
          layout: { visibility: wantedOn ? "visible" : "none" },
          paint: {
            "raster-opacity": 1,
            "raster-fade-duration": 0,
            "raster-resampling": "linear",
          },
        }, satBeforeId(map));
      } else {
        try { map.setLayerZoomRange(LAYER_ID, 0, LAYER_MAXZOOM); } catch (err) { /* */ }
      }
      return Boolean(map.getLayer(LAYER_ID));
    } catch (err) {
      return false;
    }
  }

  function raiseGame(map) {
    for (let i = 0; i < GAME_STACK.length; i++) {
      const id = GAME_STACK[i];
      if (!map.getLayer(id)) continue;
      try { map.moveLayer(id); } catch (err) { /* gone */ }
    }
  }

  function syncSat3d(map) {
    if (typeof global.lvfeSyncSat3d === "function") {
      try { global.lvfeSyncSat3d(map); } catch (err) { /* 3D optional */ }
    }
  }

  function applyHybrid(map) {
    const layers = (map.getStyle() && map.getStyle().layers) || [];
    const vis = (!wantedOn || hybridOn) ? "visible" : "none";
    const before = map.getLayer("territories-fill")
      ? "territories-fill"
      : (map.getLayer("places-circles") ? "places-circles" : undefined);
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (!layer || layer.type !== "symbol") continue;
      const id = layer.id || "";
      if (GAME_IDS[id]) continue;
      if (isOsmPoiLabel(id)) {
        try { map.setLayoutProperty(id, "visibility", "none"); } catch (err) { /* */ }
        continue;
      }
      try { map.setLayoutProperty(id, "visibility", vis); } catch (err) { /* */ }
      if (wantedOn && hybridOn && before) {
        try { map.moveLayer(id, before); } catch (err) { /* */ }
      }
    }
  }

  function stack(map) {
    if (!map) return;
    applyHybrid(map);
    raiseGame(map);
  }

  function paintFab() {
    const btn = document.getElementById("btnSat");
    if (btn) {
      btn.setAttribute("aria-checked", wantedOn ? "true" : "false");
      btn.setAttribute("aria-label", wantedOn ? "Satellite on" : "Satellite off");
    }
    const box = document.getElementById("satHybrid");
    if (box) {
      box.checked = hybridOn;
      box.setAttribute("aria-checked", hybridOn ? "true" : "false");
    }
  }

  function showFail() {
    const el = document.getElementById("satFail");
    if (el) {
      const msg = document.getElementById("satFailMsg");
      if (msg) msg.textContent = FAIL_MSG;
      el.hidden = false;
    }
    if (typeof hooks.onFail === "function") hooks.onFail(FAIL_MSG);
  }

  function hideFail() {
    const el = document.getElementById("satFail");
    if (el) el.hidden = true;
  }

  function stopWatch() {
    if (watchTimer) {
      clearTimeout(watchTimer);
      watchTimer = 0;
    }
  }

  function failToStreets() {
    stopWatch();
    wantedOn = false;
    writePref();
    if (mapRef && mapRef.getLayer(LAYER_ID)) {
      try { mapRef.setLayoutProperty(LAYER_ID, "visibility", "none"); } catch (err) { /* */ }
    }
    applyHybrid(mapRef);
    raiseGame(mapRef);
    paintFab();
    syncSat3d(mapRef);
    showFail();
  }

  function startWatch(map) {
    stopWatch();
    gotTile = false;
    watchTimer = setTimeout(() => {
      watchTimer = 0;
      if (!wantedOn) return;
      let loaded = gotTile;
      try {
        if (!loaded && map.isSourceLoaded && map.isSourceLoaded(SOURCE_ID)) loaded = true;
      } catch (err) { /* */ }
      if (!loaded) failToStreets();
    }, WATCH_MS);
  }

  function setHybrid(on) {
    hybridOn = Boolean(on);
    writePref();
    if (mapRef) stack(mapRef);
  }

  function fitMap(map) {
    const m = map || mapRef;
    if (!m || typeof m.resize !== "function") return;
    try { m.resize(); } catch (err) { /* WebView layout */ }
  }

  function setOn(on) {
    const want = Boolean(on);
    if (!mapRef) {
      wantedOn = want;
      writePref();
      paintFab();
      return;
    }
    if (!want) {
      wantedOn = false;
      stopWatch();
      writePref();
      try {
        if (mapRef.getLayer(LAYER_ID)) mapRef.setLayoutProperty(LAYER_ID, "visibility", "none");
      } catch (err) { /* */ }
      applyHybrid(mapRef);
      raiseGame(mapRef);
      paintFab();
      fitMap(mapRef);
      syncSat3d(mapRef);
      return;
    }
    hideFail();
    if (!ensure(mapRef)) {
      failToStreets();
      return;
    }
    wantedOn = true;
    writePref();
    try { mapRef.setLayoutProperty(LAYER_ID, "visibility", "visible"); } catch (err) { /* */ }
    stack(mapRef);
    paintFab();
    fitMap(mapRef);
    syncSat3d(mapRef);
    if (typeof hooks.reattach === "function") hooks.reattach();
    startWatch(mapRef);
  }

  function toggle() {
    setOn(!wantedOn);
  }

  function isOn() {
    return wantedOn;
  }

  function isHybrid() {
    return hybridOn;
  }

  function onMapError(e) {
    if (!wantedOn) return;
    const src = e && (e.sourceId || (e.source && e.source.id));
    const msg = (e && e.error && (e.error.message || String(e.error))) || "";
    if (src !== SOURCE_ID && !/World_Imagery|esri-sat|arcgisonline/i.test(msg)) return;
    if (/Could not load image|AbortError|styleimagemissing/i.test(msg)) return;
    if (/Failed to fetch|NetworkError|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/i.test(msg)) {
      failToStreets();
    }
  }

  function onSourceData(e) {
    if (!e || e.sourceId !== SOURCE_ID) return;
    if (e.tile || e.isSourceLoaded || e.sourceDataType === "idle") gotTile = true;
  }

  function bind(map, opts) {
    hooks = opts || {};
    const pref = readPref();
    hybridOn = pref.hybrid !== false;
    wantedOn = pref.on !== false;
    if (!map) {
      paintFab();
      return;
    }
    mapRef = map;
    paintFab();
    if (!bound) {
      bound = true;
      map.on("error", onMapError);
      map.on("sourcedata", onSourceData);
      map.on("style.load", () => {
        ensure(map);
        if (wantedOn) {
          try { map.setLayoutProperty(LAYER_ID, "visibility", "visible"); } catch (err) { /* */ }
        }
        stack(map);
        fitMap(map);
        if (typeof hooks.reattach === "function") hooks.reattach();
      });
      const failClose = document.getElementById("satFailClose");
      if (failClose && failClose.dataset.bound !== "1") {
        failClose.dataset.bound = "1";
        failClose.addEventListener("click", () => hideFail());
      }
      const hyb = document.getElementById("satHybrid");
      if (hyb && hyb.dataset.bound !== "1") {
        hyb.dataset.bound = "1";
        hyb.checked = hybridOn;
        hyb.setAttribute("aria-checked", hybridOn ? "true" : "false");
        hyb.addEventListener("change", () => {
          hyb.setAttribute("aria-checked", hyb.checked ? "true" : "false");
          setHybrid(hyb.checked);
        });
      }
      writePref();
    }
    ensure(map);
    if (wantedOn) {
      try { map.setLayoutProperty(LAYER_ID, "visibility", "visible"); } catch (err) { /* */ }
      startWatch(map);
    }
  }

  const api = {
    SOURCE_ID,
    LAYER_ID,
    TILE_TMPL,
    ATTRIBUTION,
    FAIL_MSG,
    MAXZOOM,
    LAYER_MAXZOOM,
    GAME_STACK,
    lonLatToTile,
    tileUrl,
    ensure,
    bind,
    setOn,
    setHybrid,
    toggle,
    isOn,
    isHybrid,
    stack,
    paintFab,
    raiseGame,
    fitMap,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfeSatellite = api;
})(typeof window !== "undefined" ? window : globalThis);
