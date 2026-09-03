/* Why: critic d819a262 failed because satellite was missing.
   Satellite must be a FAB overlay (no setStyle), Esri z/y/x, fail-to-streets. */
require("../web/js/satellite.js");
const fs = require("fs");
const path = require("path");

const S = global.LvfeSatellite;
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

assert(S, "LvfeSatellite");
assert(S.TILE_TMPL.indexOf("World_Imagery") >= 0, "Esri World Imagery");
assert(S.TILE_TMPL.indexOf("{z}/{y}/{x}") >= 0, "ArcGIS is z/y/x not z/x/y");
assert(S.TILE_TMPL.indexOf("{z}/{x}/{y}") < 0, "must not use Google/OSM xyz order");
assert(S.TILE_TMPL.indexOf("arcgisonline.com") >= 0, "Esri host");
assert(S.FAIL_MSG.indexOf("Satellite") >= 0, "fail copy names Satellite");
assert(S.LAYER_ID === "esri-sat" && S.SOURCE_ID === "esri-sat", "layer ids");

const t15 = S.lonLatToTile(6.45, 7.515, 15);
assert(t15.x === 17068 && t15.y === 15795, "Enugu z15 tile " + t15.x + "/" + t15.y);
const t18 = S.lonLatToTile(6.45, 7.515, 18);
assert(t18.x === 136544 && t18.y === 126365, "Enugu z18 tile");
assert(S.tileUrl(15, t15.x, t15.y).indexOf("/15/15795/17068") >= 0, "url uses y then x");

const src = fs.readFileSync(path.join(__dirname, "../web/js/satellite.js"), "utf8");
assert(!/\.setStyle\s*\(/.test(src), "satellite.js must not setStyle");
assert(!/maps\.googleapis|maps\.google\.com|GMAPS|google.maps/i.test(src), "no Google Maps SKU in satellite.js");

const html = fs.readFileSync(path.join(__dirname, "../web/index.html"), "utf8");
assert(/id="btnSat"/.test(html), "obvious SAT FAB");
assert(/id="satFail"/.test(html), "fail banner in chrome");
assert(/js\/satellite\.js/.test(html), "satellite.js loaded on map");
assert(/Esri/.test(html), "About credits Esri");
assert(!/maps\.googleapis|maps\.google\.com/i.test(html), "no Google Maps SKU in index");
assert(/How to play|rules\.html/.test(html), "profile links How to play");
assert(/My assets|assets\.html/.test(html), "profile links My assets");
assert(/reattachOverlays|layersReady = false/.test(html), "catalog can re-attach after style events");

const mockLayers = {};
const mockSources = {};
const map = {
  getSource(id) { return mockSources[id] || null; },
  getLayer(id) { return mockLayers[id] || null; },
  getStyle() {
    return {
      layers: [
        { id: "background", type: "background" },
        { id: "highway_name", type: "symbol" },
        { id: "territories-fill", type: "fill" },
        { id: "places-circles", type: "circle" },
        { id: "guide-line", type: "line" },
        { id: "you-dot", type: "circle" },
      ],
    };
  },
  addSource(id, spec) { mockSources[id] = spec; },
  addLayer(spec, before) {
    mockLayers[spec.id] = Object.assign({ before: before }, spec);
  },
  setLayoutProperty(id, k, v) {
    if (!mockLayers[id].layout) mockLayers[id].layout = {};
    mockLayers[id].layout[k] = v;
  },
  moveLayer() {},
  on() {},
};
assert(S.ensure(map) === true, "ensure adds raster without setStyle");
assert(mockSources["esri-sat"].type === "raster", "raster source");
assert(mockSources["esri-sat"].tiles[0] === S.TILE_TMPL, "Esri tiles");
assert(mockLayers["esri-sat"].before === "territories-fill", "sat under pins/territories");
assert(mockLayers["esri-sat"].layout.visibility === "none", "opt-in default");

assert(fs.existsSync(path.join(__dirname, "../web/rules.html")), "rules page");
assert(fs.existsSync(path.join(__dirname, "../web/assets.html")), "assets page");
const rules = fs.readFileSync(path.join(__dirname, "../web/rules.html"), "utf8");
assert(/80 m/.test(rules) && /NairaCoin/.test(rules), "rules mention 80 m and NairaCoin");
assert(!/Architect|IOU|RPC|genesis/i.test(rules), "rules are player English");
assert(/Banks and ATMs cannot be owned|cannot be owned/.test(rules), "banks not ownable");
assert(/most NairaCoin/.test(rules), "ownership is highest backer");

console.log("satellite overlay + profile pages ok");
