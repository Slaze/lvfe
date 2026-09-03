/* Why: neighbourhood conquest must raise display value / cost without
   minting into the ledger, and hinterland must stay unboosted. */
require("../web/js/conquest.js");
const C = global.LvfeConquest;
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

assert(C, "LvfeConquest");
assert(C.MAX_BONUS === 0.5, "winner bonus is +50%");
assert(C.isHinterland("unclaimed") && C.isHinterland(""), "hinterland ids");
assert(!C.isHinterland("independence_layout"), "named neighbourhood is not hinterland");

const features = [
  { properties: { id: "a", territory_id: "independence_layout" } },
  { properties: { id: "b", territory_id: "independence_layout" } },
  { properties: { id: "c", territory_id: "coal_camp" } },
  { properties: { id: "d", territory_id: "unclaimed" } },
  { properties: { id: "e", territory_id: "new_haven" } },
];
const stored = {
  a: { ownerId: "p1", value: 10 },
  b: { ownerId: "p2", value: 20 },
  c: { ownerId: "p3", value: 10 },
  d: { ownerId: "p4", value: 10 },
};

const counts = C.ownedCounts(features, stored);
assert(counts.byId.independence_layout === 2, "IL has 2 owned");
assert(counts.byId.coal_camp === 1, "Coal Camp has 1 owned");
assert(counts.byId.unclaimed == null, "hinterland owned places do not compete");
assert(counts.max === 2, "max is the winning neighbourhood");

assert(C.bonus("independence_layout", counts) === 0.5, "winner gets full multiplier");
assert(C.bonus("coal_camp", counts) === 0.25, "others proportional to max");
assert(C.bonus("new_haven", counts) === 0, "zero owned → no bonus");
assert(C.bonus("unclaimed", counts) === 0, "hinterland no bonus");

assert(C.displayValue({ value: 10 }, { territory_id: "independence_layout" }, counts) === 15, "10 * 1.5");
assert(C.displayValue({ value: 10 }, { territory_id: "coal_camp" }, counts) === 13, "10 * 1.25");
assert(C.displayValue({ value: 10 }, { territory_id: "unclaimed" }, counts) === 10, "hinterland unboosted");
assert(C.displayValue({ value: 0 }, { territory_id: "independence_layout", quality: "B" }, counts) === 0, "empty named stays 0");
assert(C.costToBack(5, { territory_id: "independence_layout" }, counts) === 8, "min stake 5 * 1.5");
assert(C.costToBack(5, { territory_id: "unclaimed" }, counts) === 5, "hinterland cost unchanged");

assert(C.X_COLOR === "#ff3b30", "unclaimed X is red");
assert(C.UNKNOWN_COLOR === "#111111", "unknown X is black");
assert(C.UNKNOWN_INTRINSIC === 100, "unknown base is top tier");
assert(C.isUnknownPlace({ quality: "D" }) && C.isUnknownPlace({ catalog_type: "civic_unknown" }), "unknown = D / unidentified");
assert(!C.isUnknownPlace({ quality: "C", catalog_type: "shop" }), "named-type C is not unknown");
assert(C.baseValue({ value: 0 }, { quality: "D" }) === 100, "unknown unstaked base is intrinsic");
assert(C.baseValue({ value: 40 }, { quality: "B" }) === 40, "named base is ledger");
assert(C.baseValue({ value: 200 }, { quality: "D" }) === 200, "unknown ledger wins when above floor");
assert(C.displayValue({ value: 0 }, { quality: "D", territory_id: "unclaimed" }, counts) === 100, "unknown hinterland unboosted floor");
assert(C.displayValue({ value: 0 }, { quality: "D", territory_id: "independence_layout" }, counts) === 150, "unknown base then +50%");
assert(C.costToBack(8, { quality: "D", territory_id: "unclaimed" }, counts) === 100, "unknown cost uses floor");
assert(C.costToBack(8, { quality: "D", territory_id: "independence_layout" }, counts) === 150, "unknown cost then bonus");
assert(C.markKind({}, "me") === "x", "named unclaimed is red X");
assert(C.markKind({}, "me", { quality: "D" }) === "unknown", "unknown unclaimed is black X");
assert(C.markKind({ ownerId: "me" }, "me", { quality: "D" }) === "self", "claimed unknown is still a circle");
assert(C.markColor({}, "me", null, { quality: "B" }) === C.X_COLOR, "unclaimed named red");
assert(C.markColor({}, "me", null, { quality: "D" }) === C.UNKNOWN_COLOR, "unclaimed unknown black");

const empty = C.ownedCounts(features, {});
assert(empty.max === 0, "nobody owns → no race");
assert(C.bonus("independence_layout", empty) === 0, "no bonus until someone owns");
assert(C.costToBack(5, { territory_id: "independence_layout" }, empty) === 5, "base cost when tied at zero");

assert(C.markKind({ ownerId: "me" }, "me") === "self", "self is circle");
assert(C.markKind({ ownerId: "them" }, "me") === "other", "other is circle");
assert(C.markColor({ ownerId: "me" }, "me") === C.SELF_COLOR, "self color");
assert(C.markColor({ ownerId: "them", factionId: "coal_camp" }, "me", { coal_camp: "#e67e22" }) === "#e67e22", "other uses faction color");

console.log("conquest bonus + mark kinds ok");
