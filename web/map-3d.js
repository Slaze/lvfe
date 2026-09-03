/**
 * MapLibre 3D for Lvfe — free only (no Google Photorealistic / Mapbox billed 3D).
 * One switch (#btn3d): off = north-up pitch 0; on = pitch 52 + zoom ≥ 14.2.
 * Every OSM footprint is a box. Tagged height/levels win; untagged = OMT 5 m.
 * Cap 80 m. SAT-off opacity 1 (solid box city). SAT+3D: ghost walls (~0.45)
 * so Esri SAT draped on Terrarium reads as roofs. Not photoreal facades.
 * 2D building fill hidden while extruded. Terrain 1.0× + sky.
 * DEM fail → banner, switch off, stay flat.
 * Pins stay billboards (X/circle). No −16 px nudge. No chimney poles.
 */
(function (global) {
  const PITCH_3D = 52;
  const PITCH_FLAT = 0;
  const ZOOM_3D = 14.2;
  const HEIGHT_CAP_M = 80;
  const LEVEL_M = 3;
  const UNTAGGED_M = 5;
  const SOLID_EXTRUSION_OPACITY = 1;
  /** SAT roofs must read through the boxes. Not opaque beige paper. */
  const SAT_EXTRUSION_OPACITY = 0.35;
  const EXTRUSION_ID = "building-3d";
  const SAT_LAYER_ID = "esri-sat";
  const FILL_2D_ID = "building";
  const STORE_KEY = "lvfe.map3d.v3";
  const DEM_ID = "lvfe-dem";
  const DEM_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
  const TERRAIN_EXAGGERATION = 1.0;
  const DEM_WATCH_MS = 8000;
  const FAIL_MSG = "Terrain couldn’t load";
  const PIN_CIRCLES = ["places-circles", "places-nearby", "you-dot", "places-hit"];
  const RAISE_IDS = [
    "places-hit", "places-circles", "places-x", "places-x-unknown", "places-nearby",
    "guide-casing", "guide-line", "pay-fill", "pay-ring", "you-dot",
  ];

  function numProp(key) {
    return ["to-number", ["coalesce", ["get", key], 0]];
  }

  /** Tagged OSM height/levels, else OMT render_height (5 m sentinel = untagged box). */
  function heightExpr() {
    return [
      "min", HEIGHT_CAP_M,
      [
        "case",
        [">", numProp("height"), 0], numProp("height"),
        [">", numProp("levels"), 0], ["*", numProp("levels"), LEVEL_M],
        [">", numProp("building:levels"), 0], ["*", numProp("building:levels"), LEVEL_M],
        [">", numProp("render_height"), 0], numProp("render_height"),
        UNTAGGED_M,
      ],
    ];
  }

  function baseExpr() {
    return [
      "case",
      [">", numProp("render_min_height"), 0], numProp("render_min_height"),
      [">", numProp("min_height"), 0], numProp("min_height"),
      0,
    ];
  }

  function extrusionFilter() {
    return ["!=", ["get", "hide_3d"], true];
  }

  function firstSymbolId(map) {
    const layers = map.getStyle().layers || [];
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (layer.type === "symbol" && layer.layout && layer.layout["text-field"]) {
        return layer.id;
      }
    }
    return undefined;
  }

  function buildingSourceId(map) {
    const layers = map.getStyle().layers || [];
    const hit = layers.find((l) => l["source-layer"] === "building");
    if (hit && hit.source) return hit.source;
    if (map.getSource("openmaptiles")) return "openmaptiles";
    return null;
  }

  function rememberFill2d(map) {
    if (map.__lvfeFill2d) return;
    const layer = map.getLayer(FILL_2D_ID);
    if (!layer || layer.type !== "fill") return;
    map.__lvfeFill2d = {
      minzoom: layer.minzoom == null ? 0 : layer.minzoom,
      maxzoom: layer.maxzoom == null ? 24 : layer.maxzoom,
      filter: map.getFilter(FILL_2D_ID) || null,
      visibility: (map.getLayoutProperty && map.getLayoutProperty(FILL_2D_ID, "visibility")) || "visible",
    };
  }

  function satWanted() {
    const sat = global.LvfeSatellite;
    return !!(sat && typeof sat.isOn === "function" && sat.isOn());
  }

  function threeWanted(map) {
    if (map && map.__lvfe3dLive) return true;
    try {
      const box = document.getElementById("toggle3d");
      return !!(box && box.checked);
    } catch (err) {
      return false;
    }
  }

  function sat3dOpacity(map) {
    return (threeWanted(map) && satWanted()) ? SAT_EXTRUSION_OPACITY : SOLID_EXTRUSION_OPACITY;
  }

  function applySatExtrusionOpacity(map) {
    if (!map || !map.getLayer(EXTRUSION_ID)) return;
    try {
      map.setPaintProperty(EXTRUSION_ID, "fill-extrusion-opacity", sat3dOpacity(map));
    } catch (err) { /* paint key unsupported */ }
  }

  function applyExtrusion(map) {
    const src = buildingSourceId(map);
    if (!src) return false;

    const paint = {
      "fill-extrusion-color": [
        "coalesce",
        ["get", "colour"],
        ["get", "color"],
        "hsl(32, 12%, 76%)",
      ],
      "fill-extrusion-height": heightExpr(),
      "fill-extrusion-base": baseExpr(),
      "fill-extrusion-opacity": SOLID_EXTRUSION_OPACITY,
      "fill-extrusion-vertical-gradient": true,
    };
    const filter = extrusionFilter();

    if (map.getLayer(EXTRUSION_ID)) {
      Object.keys(paint).forEach((k) => {
        try { map.setPaintProperty(EXTRUSION_ID, k, paint[k]); } catch (err) { /* paint key unsupported */ }
      });
      try { map.setLayerZoomRange(EXTRUSION_ID, 14, 24); } catch (err) { /* ignore */ }
      try { map.setFilter(EXTRUSION_ID, filter); } catch (err) { /* ignore */ }
    } else {
      map.addLayer({
        id: EXTRUSION_ID,
        type: "fill-extrusion",
        source: src,
        "source-layer": "building",
        minzoom: 14,
        filter,
        paint,
      }, firstSymbolId(map));
    }
    applySatExtrusionOpacity(map);
    return Boolean(map.getLayer(EXTRUSION_ID));
  }

  function applyBuildingMode(map, on) {
    rememberFill2d(map);
    if (on) applyExtrusion(map);
    if (map.getLayer(EXTRUSION_ID)) {
      map.setLayoutProperty(EXTRUSION_ID, "visibility", on ? "visible" : "none");
    }
    if (!map.getLayer(FILL_2D_ID) || map.getLayer(FILL_2D_ID).type !== "fill") return;
    if (on) {
      try { map.setLayoutProperty(FILL_2D_ID, "visibility", "none"); } catch (err) { /* ignore */ }
    } else {
      const orig = map.__lvfeFill2d;
      try {
        map.setLayoutProperty(FILL_2D_ID, "visibility", (orig && orig.visibility) || "visible");
      } catch (err) { /* ignore */ }
      if (orig) {
        try { map.setLayerZoomRange(FILL_2D_ID, orig.minzoom, orig.maxzoom); } catch (err) { /* ignore */ }
        try { map.setFilter(FILL_2D_ID, orig.filter); } catch (err) { /* ignore */ }
      }
    }
  }

  function applyLight(map, on) {
    try {
      if (typeof map.setLight === "function") {
        map.setLight(on
          ? { anchor: "viewport", color: "#fff8ee", intensity: 0.58, position: [1.15, 210, 30] }
          : { anchor: "viewport", color: "#ffffff", intensity: 0.5, position: [1.15, 210, 30] });
      }
    } catch (err) { /* old style */ }
  }

  function applySky(map, on) {
    if (typeof map.setSky !== "function") return;
    try {
      if (on) {
        map.setSky({
          "sky-color": "#88C6FC",
          "horizon-color": "#f4f7fb",
          "fog-color": "#d4e4f0",
          "fog-ground-blend": 0.35,
          "horizon-fog-blend": 0.65,
          "sky-horizon-blend": 0.55,
          "atmosphere-blend": 0.45,
        });
      } else {
        map.setSky();
      }
    } catch (err) { /* sky optional on this GL build */ }
  }

  function applyLabelPitch(map, on) {
    const layers = (map.getStyle() && map.getStyle().layers) || [];
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (!layer || layer.type !== "symbol") continue;
      try {
        map.setLayoutProperty(layer.id, "text-pitch-alignment", on ? "viewport" : "map");
      } catch (err) { /* no text */ }
      try {
        map.setLayoutProperty(layer.id, "icon-pitch-alignment", "viewport");
      } catch (err) { /* no icon */ }
    }
  }

  function ensureDem(map) {
    if (map.getSource(DEM_ID)) return true;
    try {
      map.addSource(DEM_ID, {
        type: "raster-dem",
        tiles: [DEM_TILES],
        tileSize: 256,
        encoding: "terrarium",
        maxzoom: 15,
        attribution: "",
      });
      return Boolean(map.getSource(DEM_ID));
    } catch (err) {
      return false;
    }
  }

  function applyTerrain(map, on) {
    if (on && !ensureDem(map)) return false;
    try {
      if (on) map.setTerrain({ source: DEM_ID, exaggeration: TERRAIN_EXAGGERATION });
      else map.setTerrain(null);
      return true;
    } catch (err) {
      return false;
    }
  }

  function hidePoles(map) {
    if (!map.getLayer("place-poles")) return;
    try { map.setLayoutProperty("place-poles", "visibility", "none"); } catch (err) { /* ignore */ }
    try { map.removeLayer("place-poles"); } catch (err) { /* still in style */ }
  }

  function raisePinLayers(map) {
    RAISE_IDS.forEach((id) => {
      if (!map.getLayer(id)) return;
      try { map.moveLayer(id); } catch (err) { /* ignore */ }
    });
  }

  function restackSat3d(map) {
    if (!map) return;
    const sat = global.LvfeSatellite;
    applySatExtrusionOpacity(map);
    /* SAT+3D: photo above Liberty beige, ghost walls above SAT, pins last.
       MapLibre drapes the raster on Terrarium once setTerrain is live. */
    if (satWanted() && threeWanted(map) && map.getLayer(SAT_LAYER_ID) && map.getLayer(EXTRUSION_ID)) {
      try { map.moveLayer(SAT_LAYER_ID); } catch (err) { /* ignore */ }
      try { map.moveLayer(EXTRUSION_ID); } catch (err) { /* ignore */ }
    }
    raisePinLayers(map);
    if (sat && typeof sat.raiseGame === "function") {
      try { sat.raiseGame(map); } catch (err) { /* ignore */ }
    }
  }

  function syncSat3d(map) {
    const m = map || global.lvfeMap;
    if (!m) return;
    restackSat3d(m);
  }

  function liftCatalogPins(map) {
    hidePoles(map);
    PIN_CIRCLES.forEach((id) => {
      if (!map.getLayer(id)) return;
      try { map.setPaintProperty(id, "circle-pitch-alignment", "viewport"); } catch (err) { /* ignore */ }
      try { map.setPaintProperty(id, "circle-pitch-scale", "viewport"); } catch (err) { /* ignore */ }
      try { map.setPaintProperty(id, "circle-translate", [0, 0]); } catch (err) { /* ignore */ }
    });
    ["places-x", "places-x-unknown"].forEach((id) => {
      if (!map.getLayer(id)) return;
      try { map.setLayoutProperty(id, "icon-pitch-alignment", "viewport"); } catch (err) { /* ignore */ }
      try { map.setPaintProperty(id, "icon-translate", [0, 0]); } catch (err) { /* ignore */ }
    });
    restackSat3d(map);
  }

  function pitchedNow(map) {
    try {
      return Boolean(map && map.getPitch && map.getPitch() > 1);
    } catch (err) {
      return false;
    }
  }

  function terrainLive(map) {
    try {
      return Boolean(map && map.getTerrain && map.getTerrain());
    } catch (err) {
      return false;
    }
  }

  function sync3dFab(map) {
    const box = document.getElementById("toggle3d");
    const live = !!(box && box.checked && map && map.__lvfe3dLive && pitchedNow(map) && terrainLive(map));
    const btn = document.getElementById("btn3d");
    if (btn) {
      btn.setAttribute("aria-checked", live ? "true" : "false");
      btn.setAttribute("aria-label", live ? "3D on" : "3D off");
    }
  }

  function writePref(on) {
    try { localStorage.setItem(STORE_KEY, on ? "1" : "0"); } catch (err) { /* ignore */ }
  }

  function ensureDemBanner() {
    let el = document.getElementById("demFail");
    if (!el) {
      el = document.createElement("div");
      el.id = "demFail";
      el.hidden = true;
      el.innerHTML = "<span id=\"demFailMsg\">" + FAIL_MSG + "</span>" +
        "<button type=\"button\" id=\"demFailClose\" aria-label=\"Close\">×</button>";
      const sat = document.getElementById("satFail");
      if (sat && sat.parentNode) sat.parentNode.insertBefore(el, sat.nextSibling);
      else {
        const mapEl = document.getElementById("map");
        if (mapEl && mapEl.parentNode) mapEl.parentNode.insertBefore(el, mapEl);
        else document.body.appendChild(el);
      }
    }
    const close = document.getElementById("demFailClose");
    if (close && close.dataset.lvfeBound !== "1") {
      close.dataset.lvfeBound = "1";
      close.addEventListener("click", () => { el.hidden = true; });
    }
    return el;
  }

  function showDemFail() {
    const el = ensureDemBanner();
    const msg = document.getElementById("demFailMsg");
    if (msg) msg.textContent = FAIL_MSG;
    el.hidden = false;
  }

  function hideDemFail() {
    const el = document.getElementById("demFail");
    if (el) el.hidden = true;
  }

  function stopDemWatch(map) {
    if (!map || !map.__lvfeDemWatch) return;
    clearTimeout(map.__lvfeDemWatch);
    map.__lvfeDemWatch = 0;
  }

  function failToFlat(map) {
    if (!map) return;
    stopDemWatch(map);
    map.__lvfe3dLive = false;
    map.__lvfeTerrainWanted = false;
    const box = document.getElementById("toggle3d");
    if (box) box.checked = false;
    writePref(false);
    applyBuildingMode(map, false);
    applySky(map, false);
    applyLight(map, false);
    applyLabelPitch(map, false);
    try { map.setTerrain(null); } catch (err) { /* ignore */ }
    try { map.easeTo({ pitch: PITCH_FLAT, bearing: 0, duration: 280 }); } catch (err) { /* ignore */ }
    liftCatalogPins(map);
    sync3dFab(map);
    showDemFail();
  }

  function startDemWatch(map) {
    stopDemWatch(map);
    map.__lvfeDemGot = false;
    map.__lvfeDemWatch = setTimeout(() => {
      map.__lvfeDemWatch = 0;
      if (!map.__lvfeTerrainWanted) return;
      let loaded = map.__lvfeDemGot;
      try {
        if (!loaded && map.isSourceLoaded && map.isSourceLoaded(DEM_ID)) loaded = true;
      } catch (err) { /* ignore */ }
      if (!loaded) failToFlat(map);
    }, DEM_WATCH_MS);
  }

  function onDemData(e) {
    if (!e || e.sourceId !== DEM_ID) return;
    if (e.tile || e.isSourceLoaded || e.sourceDataType === "idle") {
      const map = this;
      map.__lvfeDemGot = true;
    }
  }

  function onDemError(e) {
    const map = this;
    if (!map.__lvfeTerrainWanted) return;
    const src = e && (e.sourceId || (e.source && e.source.id));
    const msg = (e && e.error && (e.error.message || String(e.error))) || "";
    if (src !== DEM_ID && !/terrarium|elevation-tiles|raster-dem|lvfe-dem/i.test(msg)) return;
    if (/Could not load image|AbortError|styleimagemissing/i.test(msg)) return;
    failToFlat(map);
  }

  function setPitched(map, on, animate) {
    const box = document.getElementById("toggle3d");
    if (on) {
      hideDemFail();
      map.__lvfeTerrainWanted = true;
      applyBuildingMode(map, true);
      if (!map.getLayer(EXTRUSION_ID)) {
        failToFlat(map);
        return;
      }
      applySky(map, true);
      applyLight(map, true);
      applyLabelPitch(map, true);
      if (!applyTerrain(map, true)) {
        failToFlat(map);
        return;
      }
      map.__lvfe3dLive = true;
      if (global.LvfeSatellite && typeof global.LvfeSatellite.ensure === "function") {
        try { global.LvfeSatellite.ensure(map); } catch (err) { /* SAT optional */ }
      }
      applySatExtrusionOpacity(map);
      startDemWatch(map);
      const opts = {
        pitch: PITCH_3D,
        duration: animate ? 480 : 0,
      };
      try {
        if (map.getZoom() < ZOOM_3D) opts.zoom = ZOOM_3D;
      } catch (err) { /* ignore */ }
      map.easeTo(opts);
      if (box) box.checked = true;
      writePref(true);
    } else {
      stopDemWatch(map);
      map.__lvfeTerrainWanted = false;
      map.__lvfe3dLive = false;
      applyBuildingMode(map, false);
      applySky(map, false);
      applyLight(map, false);
      applyLabelPitch(map, false);
      applyTerrain(map, false);
      map.easeTo({
        pitch: PITCH_FLAT,
        bearing: 0,
        duration: animate ? 420 : 0,
      });
      if (box) box.checked = false;
      writePref(false);
    }
    liftCatalogPins(map);
    sync3dFab(map);
  }

  function ensureToggle(map) {
    const box = document.getElementById("toggle3d");
    if (!box) return null;
    if (box.dataset.lvfeBound === "1") return box;
    box.dataset.lvfeBound = "1";
    box.checked = false;
    box.addEventListener("change", () => {
      setPitched(map, box.checked, true);
    });
    return box;
  }

  function enableControls(map) {
    try { map.setMaxPitch(85); } catch (err) { /* ignore */ }
    try { map.setMinPitch(0); } catch (err) { /* ignore */ }
    if (map.dragRotate) map.dragRotate.enable();
    if (map.touchPitch) map.touchPitch.enable();
    if (map.touchZoomRotate && map.touchZoomRotate.enableRotation) {
      map.touchZoomRotate.enableRotation();
    }
  }

  function hideOsmPoiLabels(map) {
    const layers = (map.getStyle() && map.getStyle().layers) || [];
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (!layer || layer.type !== "symbol") continue;
      const id = layer.id || "";
      if (id.indexOf("poi_") === 0 || id === "label_other" || id === "label_village") {
        try { map.setLayoutProperty(id, "visibility", "none"); } catch (err) { /* removed */ }
      }
    }
  }

  function hidePitchWidget() {
    const nodes = document.querySelectorAll(".maplibregl-ctrl-pitch");
    for (let i = 0; i < nodes.length; i++) nodes[i].style.display = "none";
  }

  function styleOk(map) {
    try {
      const s = map.getStyle && map.getStyle();
      return Boolean(s && s.layers && s.layers.length);
    } catch (err) {
      return false;
    }
  }

  function onStyleReady(map) {
    map.__lvfeFill2d = null;
    map.__lvfe3dLive = false;
    hideOsmPoiLabels(map);
    hidePoles(map);
    applyExtrusion(map);
    liftCatalogPins(map);
    const box = ensureToggle(map);
    const on = !!(box && box.checked);
    setPitched(map, on, false);
    sync3dFab(map);
    hidePitchWidget();
  }

  function lvfeEnable3d(map) {
    if (!map || map.__lvfe3d) return map;
    map.__lvfe3d = true;
    global.lvfeMap = map;
    enableControls(map);
    ensureToggle(map);
    ensureDemBanner();
    sync3dFab(map);

    if (!map.__lvfeDemHooks) {
      map.__lvfeDemHooks = true;
      map.on("sourcedata", onDemData);
      map.on("error", onDemError);
    }

    const boot = () => onStyleReady(map);
    if (styleOk(map) || map.loaded() || (map.isStyleLoaded && map.isStyleLoaded())) boot();
    else {
      map.once("style.load", boot);
      map.once("load", boot);
      setTimeout(() => { if (styleOk(map)) boot(); }, 800);
    }
    map.on("style.load", boot);
    map.on("pitch", () => sync3dFab(map));
    map.on("move", () => sync3dFab(map));

    const waitPins = () => {
      liftCatalogPins(map);
      if (map.getLayer("places-circles") || map.getLayer("places-x") || map.__lvfePolesGaveUp) {
        map.off("idle", waitPins);
      }
    };
    map.on("idle", waitPins);
    map.on("sourcedata", (e) => {
      if (e && e.sourceId === "places") liftCatalogPins(map);
    });
    setTimeout(() => { map.__lvfePolesGaveUp = true; }, 12000);
    return map;
  }

  global.lvfeEnable3d = lvfeEnable3d;
  global.lvfePaint3dFab = sync3dFab;
  global.lvfeSyncSat3d = syncSat3d;
  global.lvfeMap3d = {
    PITCH_3D,
    ZOOM_3D,
    UNTAGGED_M,
    HEIGHT_CAP_M,
    TERRAIN_EXAGGERATION,
    SOLID_EXTRUSION_OPACITY,
    SAT_EXTRUSION_OPACITY,
    FAIL_MSG,
    DEM_TILES,
    heightExpr,
  };
})(typeof window !== "undefined" ? window : globalThis);
