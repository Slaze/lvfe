/* Place thumb helpers — Esri tile math + soft fail paths. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(path.join(__dirname, "../web/js/place-thumb.js"), "utf8");
const sandbox = { window: {}, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const T = sandbox.window.LvfePlaceThumb;
assert.ok(T, "LvfePlaceThumb exported");

const enugu = T.esriUrl(6.45, 7.515, 16);
assert.match(enugu, /World_Imagery\/MapServer\/tile\/16\/\d+\/\d+/);
assert.ok(enugu.includes("/16/"), "z16 in path");

const same = T.esriUrl(6.45, 7.515, 16);
assert.strictEqual(enugu, same);

const bad = T.esriUrl(NaN, 7.515);
assert.strictEqual(bad, "");

const c = T.resolveCoords({ lat: 6.4, lon: 7.5 });
assert.strictEqual(c.lat, 6.4);
assert.strictEqual(c.lon, 7.5);

const fromGeom = T.resolveCoords({
  geometry: { coordinates: [7.52, 6.46] },
});
assert.strictEqual(fromGeom.lon, 7.52);
assert.strictEqual(fromGeom.lat, 6.46);

const chip = T.chipHtml({ id: "x", lat: 6.45, lon: 7.515 }, (s) => String(s));
assert.ok(chip.includes("cat-thumb"));
assert.ok(chip.includes("World_Imagery"));

console.log("test_place_thumb: ok");
