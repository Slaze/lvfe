/* Place thumbs — ground photos only; never Esri satellite. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(path.join(__dirname, "../web/js/place-thumb.js"), "utf8");
assert.ok(!/ESRI_TMPL|esriUrl\s*=|MapServer\/tile\/\{z\}/i.test(src), "no Esri tile template");
assert.ok(!/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery\/MapServer\/tile\//.test(src),
  "no Esri tile URL builder");
assert.ok(/No photo yet — visit to confirm/.test(src), "placeholder copy");
assert.ok(/wikimedia_commons|wikipedia|mapillary|visit/i.test(src), "real-photo sources");

const sandbox = { window: {}, console, fetch: undefined, indexedDB: undefined };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const T = sandbox.window.LvfePlaceThumb;
assert.ok(T, "LvfePlaceThumb exported");
assert.strictEqual(typeof T.esriUrl, "undefined", "esriUrl removed");

const c = T.resolveCoords({ lat: 6.4, lon: 7.5 });
assert.strictEqual(c.lat, 6.4);
assert.strictEqual(c.lon, 7.5);

const fromGeom = T.resolveCoords({
  geometry: { coordinates: [7.52, 6.46] },
});
assert.strictEqual(fromGeom.lon, 7.52);
assert.strictEqual(fromGeom.lat, 6.46);

const media = T.mediaFromProps({
  image: "https://example.com/shop.jpg",
  tags: { wikimedia_commons: "File:Foo.jpg" },
});
assert.strictEqual(media.image, "https://example.com/shop.jpg");

assert.strictEqual(T.httpImageUrl("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/16/1/2"), "");
assert.ok(T.httpImageUrl("https://upload.wikimedia.org/wikipedia/commons/a/a0/x.jpg").length > 0);
assert.ok(T.isAerialish("Enugu aerial view", ""));
assert.ok(!T.isAerialish("Shoprite Enugu facade", ""));

assert.strictEqual(T.commonsFileTitle("File:Enugu.jpg"), "File:Enugu.jpg");
assert.strictEqual(T.commonsFileTitle("Category:Enugu"), "");

const chip = T.chipHtml({ id: "x", lat: 6.45, lon: 7.515 }, (s) => String(s));
assert.ok(chip.includes("cat-thumb"));
assert.ok(!chip.includes("World_Imagery"), "chip must not use SAT");

const chipImg = T.chipHtml({ image: "https://example.com/a.jpg" }, (s) => String(s));
assert.ok(chipImg.includes("example.com/a.jpg"));

console.log("test_place_thumb: ok");
