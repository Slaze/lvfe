const R = require("../web/js/claim-rules.js");
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

assert(R.placeTitle({ name: "-", catalog_type: "shop" }) === "Shop", "dash shop");
assert(R.placeTitle({ name: "undefined", catalog_type: "food" }) === "Food", "undefined food");
assert(R.placeTitle({ name: "Unnamed civic_unknown", catalog_type: "civic_unknown" }) === "Unidentified building", "unnamed civic");
assert(R.placeTitle({ name: "Unnamed pitch", catalog_type: "pitch" }) === "Pitch", "unnamed pitch");
assert(R.placeTitle({ name: "", catalog_type: "bank" }) === "Bank", "empty bank");
assert(R.placeTitle({ name: "Chukky Clothing", catalog_type: "shop" }) === "Chukky Clothing", "keep real name");
assert(R.CLAIM_RADIUS_M === 80, "radius 80");
assert(R.walkMinutes(5000) === 60, "5km/h hour");
assert(R.walkMinutes(80) === 1, "80m is 1 min at floor");
console.log("placeTitle ok");
