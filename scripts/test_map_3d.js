/* Why: critic a07cc0ab failed — skip-filter deleted Liberty’s box city,
   3D was empty tilt, poles/−16 hid pins, visualizePitch was a second control. */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "web/map-3d.js"), "utf8");
const html = fs.readFileSync(path.join(root, "web/index.html"), "utf8");

const chk = spawnSync("node", ["--check", path.join(root, "web/map-3d.js")], { encoding: "utf8" });
assert(chk.status === 0, "map-3d.js must parse: " + (chk.stderr || chk.stdout || ""));

require(path.join(root, "web/map-3d.js"));
const M = global.lvfeMap3d;
assert(M, "lvfeMap3d export");
assert(M.PITCH_3D >= 50 && M.PITCH_3D <= 60, "pitch ~52");
assert(M.ZOOM_3D >= 14.2, "3D zoom at least 14.2");
assert(M.UNTAGGED_M === 5, "untagged is OMT 5 m, not a 9 m lie");
assert(M.HEIGHT_CAP_M === 80, "cap 80 m");
assert(M.TERRAIN_EXAGGERATION === 1, "terrain 1.0×");
assert(/Terrain/.test(M.FAIL_MSG), "DEM fail copy");
assert(/elevation-tiles-prod\/terrarium/.test(M.DEM_TILES), "free Terrarium DEM");

const hex = JSON.stringify(M.heightExpr());
assert(hex.indexOf("height") >= 0 && hex.indexOf("levels") >= 0, "tagged height/levels win");
assert(/,5]|,\s*5]/.test(hex.replace(/\s/g, "")), "untagged fallback 5");

assert(!/hasTrueHeightExpr/.test(js), "no skip-filter that deletes the city");
assert(!/unknownFootprintFilter/.test(js), "do not leave untagged as 2D only");
assert(!/POLE_HEIGHT_M\s*=\s*24/.test(js), "no 24 m chimneys");
assert(!/circle-translate", on \? \[0, -16\]/.test(js), "no −16 px pin nudge");
assert(M.SOLID_EXTRUSION_OPACITY === 1, "SAT-off solid boxes");
assert(M.SAT_EXTRUSION_OPACITY >= 0.35 && M.SAT_EXTRUSION_OPACITY <= 0.6, "SAT+3D ghost walls");
assert(/fill-extrusion-opacity": SOLID_EXTRUSION_OPACITY/.test(js), "default paint is solid");
assert(/moveLayer\(SAT_LAYER_ID\)/.test(js), "SAT above beige paper before ghost walls");
assert(/lvfeSyncSat3d/.test(js), "SAT toggle restacks 3D");
assert(/setSky/.test(js), "sky when 3D on");
assert(/text-pitch-alignment/.test(js), "labels viewport at pitch");
assert(/visibility", "none"/.test(js) && /FILL_2D_ID/.test(js), "hide 2D fill while extruded");
assert(!/maps\.googleapis|maps\.google\.com|play-services-maps/i.test(js), "no Google 3D SKU");

assert(/visualizePitch:\s*false/.test(html), "NavigationControl visualizePitch hidden");
assert(/id="btn3d"/.test(html) && /role="switch"/.test(html), "one 3D switch");
assert(/id:\s*"places-x"/.test(html), "sibling X pins kept");
assert(/id:\s*"places-x-unknown"/.test(html), "unknown black X kept");
assert(/addLy\(\{\)/.test(html) === false, "do not reintroduce addLy({)");
assert(/id="btnSat"/.test(html), "SAT switch kept");

const inlineStart = html.lastIndexOf("<script>");
const inlineEnd = html.indexOf("</script>", inlineStart);
const inline = html.slice(inlineStart + 8, inlineEnd);
const ichk = spawnSync("node", ["--check"], { input: inline, encoding: "utf8" });
assert(ichk.status === 0, "index inline must parse: " + (ichk.stderr || ""));
assert(!/box\.checked = !\(pitched \|\| box\.checked\)/.test(inline), "3D click is one control, not pitch-or");

console.log("map-3d critic a07cc0ab checks ok");
