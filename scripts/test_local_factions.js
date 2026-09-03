/* Location factions: Enugu canonical vs Lagos OSM build + chapter persist. */
require("../web/js/field-claim.js");
require("../web/js/local-factions.js");

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const LF = global.LvfeLocalFactions;
const F = global.LvfeField;

assert(LF && F, "modules loaded");
assert(LF.isEnugu(6.45, 7.51), "Independence Layout GPS is Enugu");
assert(!LF.isEnugu(6.5244, 3.3792), "Lagos GPS is outside Enugu");
assert(F.outsideCatalog(6.5244, 3.3792, LF.ENUGU_BBOX), "Lagos outside catalog bbox");

const enugu = LF.forPositionSync(6.45, 7.51);
assert(enugu.canonical === true, "Enugu sync is canonical");
assert(enugu.factions.length === 4, "four Enugu factions");
assert(enugu.factions[0].id === "independence_layout", "Independence Layout first");
const ids = enugu.factions.map((f) => f.id).sort().join(",");
assert(ids === "abakpa,coal_camp,emene,independence_layout", "canonical id set: " + ids);

const lagosMock = {
  elements: [
    { type: "node", lat: 6.53, lon: 3.38, tags: { place: "suburb", name: "Ikeja" } },
    { type: "node", lat: 6.45, lon: 3.39, tags: { place: "suburb", name: "Surulere" } },
    { type: "node", lat: 6.50, lon: 3.35, tags: { place: "neighbourhood", name: "Yaba" } },
    { type: "node", lat: 6.52, lon: 3.37, tags: { place: "quarter", name: "Obalende" } },
    { type: "way", center: { lat: 6.51, lon: 3.36 }, tags: { place: "neighbourhood", name: "Victoria Island" } },
    { type: "node", lat: 6.55, lon: 3.40, tags: { landuse: "residential", name: "Maryland" } },
  ],
};
const lagos = LF.fromOverpassPayload(lagosMock, 6.5244, 3.3792);
assert(lagos.canonical === false, "Lagos not canonical");
assert(lagos.ok === true, "Lagos ok");
assert(lagos.factions.length >= 3 && lagos.factions.length <= 6, "3–6 local factions: " + lagos.factions.length);
assert(lagos.factions.some((f) => /ikeja/i.test(f.name)), "includes Ikeja");
assert(lagos.factions[0].role === "prize_zone", "closest/high-rank is prize_zone analog");
assert(lagos.factions.slice(1).every((f) => f.role === "playable_faction"), "rest playable");

const sparse = LF.fromOverpassPayload({ elements: [] }, 6.5244, 3.3792);
assert(sparse.ok === false || sparse.factions.length >= 3, "sparse → soft fallback");
assert(sparse.factions.length >= 3, "generic quarters");
assert(/Unclaimed|generic|Sparse/i.test(sparse.message), "fail soft message");

const chapter = LF.resolveChapter(
  { factionId: "independence_layout", playerName: "Ada" },
  lagos,
);
assert(chapter.lockedChapter === true, "travel keeps chapter");
assert(chapter.factionId === "independence_layout", "not wiped");
assert(chapter.canPick === false, "no silent re-pick");
assert(/chapter|travel|stays/i.test(chapter.note), "documents travel behavior");

const unset = LF.resolveChapter({ playerName: "New" }, lagos);
assert(unset.canPick === true && !unset.factionId, "unset can pick local");

const enuguAgain = LF.fromOverpassPayload(lagosMock, 6.45, 7.51);
assert(enuguAgain.canonical === true, "Enugu GPS ignores Lagos OSM payload");

console.log("local factions (Enugu + Lagos simulate) ok");
