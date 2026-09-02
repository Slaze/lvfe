/**
 * MapLibre pitch + OSM-true extrusion + free Terrarium DEM for Lvfe.
 * Liberty already ships `building-3d`; this module enables tilt, extrudes
 * only buildings with real height data, drapes AWS/Mapzen terrain, and
 * keeps catalog circles/poles above the mesh.
 *
 * Height rules (no city-wide fallback):
 *   1. OSM `height` if > 0
 *   2. `levels` / `building:levels` × 3 m + 2 m roof
 *   3. OpenMapTiles `render_height` if present and not the 5 m sentinel
 *   4. else unknown → skip extrusion, keep 2D fill
 * Cap 80 m. Three.js is not used (MapLibre 5.x fill-extrusion + raster-dem).
 */
(function (global) {
  const PITCH_3D = 52;
  const PITCH_FLAT = 0;
  const BEARING_3D = -16;
  const HEIGHT_CAP_M = 80;
  const LEVEL_M = 3;
  const ROOF_M = 2;
  /** OpenMapTiles: ceil(COALESCE(height, levels*3.66, 5)). Untagged → 5. */
  const OMT_SENTINEL_M = 5;
  const EXTRUSION_ID = "building-3d";
  const FILL_2D_ID = "building";
  const STORE_KEY = "lvfe.map3d";
  const POLE_ID = "place-poles";
  const POLE_SRC = "place-poles";
  const POLE_HEIGHT_M = 24;
  const POLE_HALF_M = 2.2;
  const DEM_ID = "lvfe-dem";
  const HILLSHADE_ID = "lvfe-hillshade";
  /** Enugu plateau is gentle; 1.7× makes Independence Layout vs valley readable. */
  const TERRAIN_EXAGGERATION = 1.7;
  const DEM_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

  function numProp(key) {
    return ["to-number", ["coalesce", ["get", key], 0]];
  }

  /** True when the tile carries a real height, not the OMT 5 m “no data” default. */
  function hasTrueHeightExpr() {
    return [
      "any",
      [">", numProp("height"), 0],
      [">", numProp("levels"), 0],
      [">", numProp("building:levels"), 0],
      [
        "all",
        [">", numProp("render_height"), 0],
        ["!=", numProp("render_height"), OMT_SENTINEL_M],
      ],
    ];
  }

  function extrusionFilter() {
    return [
      "all",
      ["!=", ["get", "hide_3d"], true],
      hasTrueHeightExpr(),
    ];
  }

  function unknownFootprintFilter() {
    return [
      "any",
      ["==", ["get", "hide_3d"], true],
      ["!", hasTrueHeightExpr()],
    ];
  }

  function heightExpr() {
    return [
      "min", HEIGHT_CAP_M,
      [
        "case",
        [">", numProp("height"), 0], numProp("height"),
        [">", numProp("levels"), 0], ["+", ["*", numProp("levels"), LEVEL_M], ROOF_M],
        [">", numProp("building:levels"), 0], ["+", ["*", numProp("building:levels"), LEVEL_M], ROOF_M],
        [
          "all",
          [">", numProp("render_height"), 0],
          ["!=", numProp("render_height"), OMT_SENTINEL_M],
        ],
        numProp("render_height"),
        0,
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
    };
  }

  function applyExtrusion(map) {
    const src = buildingSourceId(map);
    if (!src) return;

    const paint = {
      "fill-extrusion-color": "hsl(35,8%,85%)",
      "fill-extrusion-height": heightExpr(),
      "fill-extrusion-base": baseExpr(),
      "fill-extrusion-opacity": 0.85,
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
  }

  function applyBuildingMode(map, on) {
    rememberFill2d(map);
    if (map.getLayer(EXTRUSION_ID)) {
      map.setLayoutProperty(EXTRUSION_ID, "visibility", on ? "visible" : "none");
    }
    if (!map.getLayer(FILL_2D_ID) || map.getLayer(FILL_2D_ID).type !== "fill") return;
    map.setLayoutProperty(FILL_2D_ID, "visibility", "visible");
    if (on) {
      try { map.setLayerZoomRange(FILL_2D_ID, 13, 24); } catch (err) { /* ignore */ }
      try { map.setFilter(FILL_2D_ID, unknownFootprintFilter()); } catch (err) { /* ignore */ }
    } else {
      const orig = map.__lvfeFill2d;
      if (orig) {
        try { map.setLayerZoomRange(FILL_2D_ID, orig.minzoom, orig.maxzoom); } catch (err) { /* ignore */ }
        try { map.setFilter(FILL_2D_ID, orig.filter); } catch (err) { /* ignore */ }
      }
    }
  }

  function hillshadeBeforeId(map) {
    if (map.getLayer("landuse_residential")) return "landuse_residential";
    if (map.getLayer(FILL_2D_ID)) return FILL_2D_ID;
    return undefined;
  }

  function ensureAttrib() {
    const el = document.querySelector(".attrib");
    if (!el || el.dataset.lvfeDem === "1") return;
    el.dataset.lvfeDem = "1";
    el.appendChild(document.createTextNode(" · terrain "));
    const a = document.createElement("a");
    a.href = "https://github.com/tilezen/joerd/blob/master/docs/attribution.md";
    a.textContent = "AWS/Mapzen";
    el.appendChild(a);
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
        attribution: "Terrain AWS/Mapzen",
      });
      ensureAttrib();
      return true;
    } catch (err) {
      return false;
    }
  }

  function ensureHillshade(map) {
    if (map.getLayer(HILLSHADE_ID) || !map.getSource(DEM_ID)) return;
    try {
      map.addLayer({
        id: HILLSHADE_ID,
        type: "hillshade",
        source: DEM_ID,
        maxzoom: 18,
        paint: {
          "hillshade-exaggeration": 0.35,
          "hillshade-shadow-color": "#2a2418",
          "hillshade-highlight-color": "#f4f1ea",
          "hillshade-illumination-direction": 315,
        },
      }, hillshadeBeforeId(map));
    } catch (err) { /* hillshade optional */ }
  }

  function applyTerrain(map, on) {
    if (!ensureDem(map)) return;
    ensureHillshade(map);
    try {
      if (on) map.setTerrain({ source: DEM_ID, exaggeration: TERRAIN_EXAGGERATION });
      else map.setTerrain(null);
    } catch (err) { /* DEM fetch / WebGL */ }
    if (map.getLayer(HILLSHADE_ID)) {
      map.setLayoutProperty(HILLSHADE_ID, "visibility", on ? "visible" : "none");
    }
  }

  /** Prefer style-ready over `load`: missing sprites / DEM tiles can keep loaded() false. */
  function scheduleTerrain(map, on) {
    map.__lvfeTerrainWanted = on;
    const run = () => applyTerrain(map, !!map.__lvfeTerrainWanted);
    const styleOk = () => {
      try {
        const s = map.getStyle && map.getStyle();
        return Boolean(s && s.layers && s.layers.length);
      } catch (err) {
        return false;
      }
    };
    if (styleOk()) {
      setTimeout(run, 50);
      return;
    }
    if (map.__lvfeTerrainWait) return;
    map.__lvfeTerrainWait = true;
    const kick = () => {
      map.__lvfeTerrainWait = false;
      setTimeout(run, 50);
    };
    map.once("style.load", kick);
    map.once("load", kick);
  }

  function placesCollection(map) {
    const src = map.getSource("places");
    if (!src) return null;
    if (typeof src.serialize === "function") {
      const s = src.serialize();
      const d = s && s.data;
      if (d && Array.isArray(d.features)) return d;
    }
    const q = map.querySourceFeatures("places");
    if (!q.length) return null;
    return { type: "FeatureCollection", features: q };
  }

  function polesFromPlaces(fc) {
    const features = [];
    for (let i = 0; i < fc.features.length; i++) {
      const f = fc.features[i];
      if (!f.geometry || f.geometry.type !== "Point") continue;
      const lon = f.geometry.coordinates[0];
      const lat = f.geometry.coordinates[1];
      const dLat = POLE_HALF_M / 111320;
      const dLon = POLE_HALF_M / (111320 * Math.cos(lat * Math.PI / 180) || 1);
      features.push({
        type: "Feature",
        properties: f.properties,
        geometry: {
          type: "Polygon",
          coordinates: [[
            [lon - dLon, lat - dLat],
            [lon + dLon, lat - dLat],
            [lon + dLon, lat + dLat],
            [lon - dLon, lat + dLat],
            [lon - dLon, lat - dLat],
          ]],
        },
      });
    }
    return { type: "FeatureCollection", features };
  }

  function hookPlaceFilter(map) {
    if (map.__lvfeFilterHook) return;
    map.__lvfeFilterHook = true;
    const orig = map.setFilter.bind(map);
    map.setFilter = function (id, filter, options) {
      const r = orig(id, filter, options);
      if (id === "places-circles" && map.getLayer(POLE_ID)) {
        orig(POLE_ID, filter, options);
      }
      return r;
    };
  }

  function openCatalogPlace(id) {
    if (!id || typeof global.placeById !== "function") return;
    const feat = global.placeById(id);
    if (feat && typeof global.openPlacePopup === "function") global.openPlacePopup(feat);
  }

  function raisePinLayers(map) {
    [POLE_ID, "places-circles", "places-nearby", "you-dot"].forEach((id) => {
      if (!map.getLayer(id)) return;
      try { map.moveLayer(id); } catch (err) { /* ignore */ }
    });
  }

  function ensurePoles(map) {
    if (!map.getLayer("places-circles")) return false;
    hookPlaceFilter(map);
    const fc = placesCollection(map);
    if (!fc) return false;
    try {
      const color = map.getPaintProperty("places-circles", "circle-color");
      const filter = map.getFilter("places-circles");
      if (!map.getSource(POLE_SRC)) {
        map.addSource(POLE_SRC, { type: "geojson", data: polesFromPlaces(fc) });
      }
      if (!map.getLayer(POLE_ID)) {
        map.addLayer({
          id: POLE_ID,
          type: "fill-extrusion",
          source: POLE_SRC,
          minzoom: 14,
          paint: {
            "fill-extrusion-color": color,
            "fill-extrusion-height": POLE_HEIGHT_M,
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.95,
            "fill-extrusion-vertical-gradient": true,
          },
        }, "places-circles");
        if (filter) map.setFilter(POLE_ID, filter);
        map.on("click", POLE_ID, (e) => {
          if (!e.features || !e.features.length) return;
          openCatalogPlace(e.features[0].properties.id);
        });
        map.on("mouseenter", POLE_ID, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", POLE_ID, () => { map.getCanvas().style.cursor = ""; });
      } else {
        try { map.setPaintProperty(POLE_ID, "fill-extrusion-height", POLE_HEIGHT_M); } catch (err) { /* ignore */ }
      }
      const box = document.getElementById("toggle3d");
      const on = box ? box.checked : readPref();
      map.setLayoutProperty(POLE_ID, "visibility", on ? "visible" : "none");
      raisePinLayers(map);
      return true;
    } catch (err) {
      return false;
    }
  }

  function liftCatalogPins(map) {
    ["places-circles", "places-nearby", "you-dot"].forEach((id) => {
      if (!map.getLayer(id)) return;
      try { map.setPaintProperty(id, "circle-pitch-alignment", "viewport"); } catch (err) { /* ignore */ }
      try { map.setPaintProperty(id, "circle-pitch-scale", "viewport"); } catch (err) { /* ignore */ }
    });
    if (map.getLayer("places-circles")) {
      try { map.setPaintProperty("places-circles", "circle-translate", [0, -16]); } catch (err) { /* ignore */ }
      try { map.setPaintProperty("places-circles", "circle-translate-anchor", "viewport"); } catch (err) { /* ignore */ }
    }
    ensurePoles(map);
  }

  function readPref() {
    try {
      const v = localStorage.getItem(STORE_KEY);
      if (v === "0") return false;
      if (v === "1") return true;
    } catch (err) { /* private mode */ }
    return true;
  }

  function writePref(on) {
    try { localStorage.setItem(STORE_KEY, on ? "1" : "0"); } catch (err) { /* ignore */ }
  }

  function setPitched(map, on, animate) {
    map.__lvfeTerrainWanted = on;
    applyBuildingMode(map, on);
    if (map.getLayer(POLE_ID)) {
      map.setLayoutProperty(POLE_ID, "visibility", on ? "visible" : "none");
    }
    if (on) {
      if (map.getSource(DEM_ID)) applyTerrain(map, true);
      else scheduleTerrain(map, true);
    } else if (map.getSource(DEM_ID)) {
      applyTerrain(map, false);
    } else {
      scheduleTerrain(map, false);
    }
    const pitch = on ? PITCH_3D : PITCH_FLAT;
    const opts = { pitch, duration: animate ? 450 : 0 };
    if (!animate && on && Math.abs(map.getBearing()) < 2) opts.bearing = BEARING_3D;
    map.easeTo(opts);
  }

  function ensureHint(box) {
    let hint = document.querySelector(".lvfe-3d-hint");
    if (!hint) {
      hint = document.createElement("span");
      hint.className = "lvfe-3d-hint";
      const row = box.closest("label") || box.parentElement;
      if (row && row.parentNode) row.parentNode.insertBefore(hint, row.nextSibling);
      else return;
    }
    hint.textContent = "";
    hint.hidden = true;
  }

  function ensureToggle(map) {
    let box = document.getElementById("toggle3d");
    if (!box) {
      const panel = document.querySelector(".panel");
      if (!panel) return null;
      const label = document.createElement("label");
      label.className = "row";
      label.setAttribute("data-lvfe-3d", "1");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = "toggle3d";
      const cube = document.createElement("span");
      cube.className = "cube";
      const text = document.createTextNode(" 3D");
      label.appendChild(input);
      label.appendChild(cube);
      label.appendChild(text);
      panel.appendChild(label);
      box = input;
    }
    ensureHint(box);
    box.checked = readPref();
    if (box.dataset.lvfeBound === "1") return box;
    box.dataset.lvfeBound = "1";
    box.addEventListener("change", () => {
      writePref(box.checked);
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

  function onStyleReady(map) {
    map.__lvfeFill2d = null;
    hideOsmPoiLabels(map);
    applyExtrusion(map);
    liftCatalogPins(map);
    const box = ensureToggle(map);
    const on = box ? box.checked : readPref();
    setPitched(map, on, false);
  }

  function lvfeEnable3d(map) {
    if (!map || map.__lvfe3d) return map;
    map.__lvfe3d = true;
    global.lvfeMap = map;
    enableControls(map);
    ensureToggle(map);

    const boot = () => onStyleReady(map);
    if (map.loaded()) boot();
    else map.once("load", boot);
    map.on("style.load", boot);

    const waitPins = () => {
      liftCatalogPins(map);
      if (map.getLayer(POLE_ID) || (map.getLayer("places-circles") && map.__lvfePolesGaveUp)) {
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
})(typeof window !== "undefined" ? window : globalThis);
