/* Why: line-join/line-cap in paint makes MapLibre addLayer throw.
   After that throw the guide source still exists, so a source-only
   ensureLayers skip leaves guide-line / guide-casing unpainted. */
require("../web/js/claim-rules.js");
require("../web/js/track-guide.js");
const fs = require("fs");
const path = require("path");

const T = global.LvfeTrack;
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

function makeMap() {
  const sources = {};
  const layers = {};
  return {
    getSource(id) { return sources[id] || null; },
    getLayer(id) { return layers[id] || null; },
    addSource(id, spec) { sources[id] = spec; },
    addLayer(spec) {
      if (spec.paint && ("line-join" in spec.paint || "line-cap" in spec.paint)) {
        throw new Error("layers." + spec.id + ".line-join: unknown property \"line-join\"");
      }
      layers[spec.id] = spec;
    },
  };
}

assert(T && typeof T.ensureLayers === "function", "LvfeTrack.ensureLayers");

const casing = T.guideCasingSpec();
const line = T.guideLineSpec();
assert(casing.layout["line-join"] === "round" && casing.layout["line-cap"] === "round", "casing join/cap in layout");
assert(line.layout["line-join"] === "round" && line.layout["line-cap"] === "round", "line join/cap in layout");
assert(!("line-join" in casing.paint) && !("line-cap" in casing.paint), "casing paint has no join/cap");
assert(!("line-join" in line.paint) && !("line-cap" in line.paint), "line paint has no join/cap");
assert(line.paint["line-color"] === "#00e676", "walk line is bright green");
assert(casing.paint["line-color"] === "#00c853", "walk casing is green");
assert(line.paint["line-color"] !== "#f4c430", "walk line is not gold");

const map = makeMap();
assert(T.ensureLayers(map) === true, "first attach");
assert(map.getLayer("guide-line") && map.getLayer("guide-casing"), "green walk layers attach");
assert(map.getLayer("guide-alt-line") && map.getLayer("guide-alt-casing"), "alt walk layers attach");
assert(map.getLayer("pay-ring") && map.getLayer("pay-fill"), "80 m ring attaches");
assert(T.OSRM_WALK.indexOf("router.project-osrm.org/route/v1/walking") >= 0, "walk OSRM");
assert(T.OSRM_DRIVE.indexOf("router.project-osrm.org/route/v1/driving") >= 0, "drive OSRM");
const alt = T.guideAltLineSpec();
assert(alt.layout["line-join"] === "round" && alt.layout["line-cap"] === "round", "alt join/cap in layout");
assert(Array.isArray(alt.paint["line-dasharray"]), "alt dashed");

const retry = makeMap();
retry.addSource("guide", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
retry.addSource("payring", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
assert(retry.getSource("guide") && !retry.getLayer("guide-line"), "source-only is the failed-first-add state");
assert(T.ensureLayers(retry) === true, "retry when source already exists");
assert(retry.getLayer("guide-line") && retry.getLayer("guide-casing"), "retry paints walk line");
assert(retry.getLayer("pay-ring"), "retry paints pay ring");

const html = fs.readFileSync(path.join(__dirname, "../web/index.html"), "utf8");
assert(/function dossierPinned\(/.test(html), "dossierPinned helper");
const move = html.match(/map\.on\("movestart",[\s\S]*?\n      \}\);/);
const drag = html.match(/map\.on\("dragstart",[\s\S]*?\n      \}\);/);
assert(move && /dossierPinned\(\)/.test(move[0]), "movestart keeps open file / tracking");
assert(drag && /dossierPinned\(\)/.test(drag[0]), "dragstart keeps open file / tracking");
assert(/refreshOpenDossier\(\)/.test(html), "geolocate still re-renders Pay");

console.log("track layers + dossier pin ok");
