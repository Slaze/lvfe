#!/usr/bin/env node
/* Mission briefing HTML + notify engagement types. */
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

global.__lvfeNotifyMem = {};
global.localStorage = {
  _d: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; },
};

require("../web/js/claim-rules.js");
require("../web/js/conquest.js");
require("../web/js/rankings.js");
require("../web/js/rank-sigils.js");
require("../web/js/wallet-earn.js");
require("../web/js/dossier.js");
const Notify = require("../web/js/game-notify.js");

assert(global.LvfeRules.formatDistM(120) === "120 m", "dist m");
assert(global.LvfeRules.formatDistM(1500) === "1.5 km", "dist km");
assert(/hr/.test(global.LvfeRules.walkEtaText(20000, 240)), "long walk hr");

const D = global.LvfeDossier;
const p = {
  id: "cafe1",
  name: "Very Long Place Name That Should Clamp Nicely Without Overlap",
  catalog_type: "food",
  quality: "B",
  claim_points: 10,
  territory_id: "abakpa",
  lat: 6.45,
  lon: 7.51,
};
const rec = { value: 0, ownerId: "", ownerName: "", factionId: "", stakes: {} };
const features = [
  { properties: p },
  { properties: { id: "x2", catalog_type: "shop", territory_id: "abakpa", claim_points: 5 } },
  { properties: { id: "x3", catalog_type: "shop", territory_id: "unclaimed", claim_points: 5 } },
];
const places = {
  x2: { ownerId: "me", ownerName: "Me", factionId: "abakpa", value: 10, stakes: { me: { amount: 10 } } },
  x3: { ownerId: "me", ownerName: "Me", factionId: "abakpa", value: 5, stakes: { me: { amount: 5 } } },
};

const html = D.html({
  p: p,
  rec: rec,
  dist: 420,
  userPos: { lat: 6.45, lon: 7.505 },
  walletWhole: 100,
  tracking: false,
  tab: "mission",
  playerKey: "me",
  features: features,
  places: places,
  factionId: "abakpa",
  factionNames: D.FACTION_NAMES,
});

assert(/Property Asset sighted !!!/.test(html), "kicker");
assert(/data-page="mission"/.test(html) && /mission-brief/.test(html), "mission brief");
assert(/data-mission-buy="cafe1"/.test(html), "buy cta");
assert(/data-mission-track="cafe1"/.test(html), "track cta");
assert(/data-mission-rank/.test(html), "rank deep link");
assert(/data-mission-faction/.test(html), "faction deep link");
assert(/Cost of Property/.test(html) && /NCN/.test(html), "cost NCN");
assert(/No of Properties in Faction/.test(html), "faction count label");
assert(/Current rank/.test(html), "rank line");
assert(!/NairaCoin/.test(html), "no NairaCoin sprawl in mission");

const stats = D.missionFactionStats("me", {
  features: features,
  places: places,
  factionId: "abakpa",
  factionNames: D.FACTION_NAMES,
});
assert(stats.inFaction === 2, "inFaction=" + stats.inFaction);
assert(stats.ownedIn === 1, "ownedIn=" + stats.ownedIn);
assert(stats.ownedOut === 1, "ownedOut=" + stats.ownedOut);

assert(Notify.TYPES.ASSET_SIGHTED === "asset_sighted", "asset type");
assert(Notify.TYPES.TRACKING_STARTED === "tracking_started", "track type");
assert(Notify.TYPES.APPROACHING === "approaching_claim", "approach type");
assert(/green walk|Tracking started|walk line/.test(Notify.bodyFor({ type: Notify.TYPES.TRACKING_STARTED, placeName: "Cafe" })), "track body");
assert(/80 m|pay ring|claim zone/.test(Notify.bodyFor({ type: Notify.TYPES.APPROACHING, placeName: "Cafe", dist: 95 })), "approach body");
assert(Notify.titleFor({ type: Notify.TYPES.ASSET_SIGHTED }) === "Property Asset sighted" || /Asset sighted/.test(Notify.titleFor({ type: Notify.TYPES.ASSET_SIGHTED })), "asset title");

const scan = Notify.scanNearby(
  [{ id: "a", name: "Open", lon: 7.5, lat: 6.4, ownable: true, ownerId: "" }],
  { lat: 6.4, lon: 7.5, playerKey: "me", radiusM: 500 },
);
assert(scan.claimable && scan.claimable.type === Notify.TYPES.ASSET_SIGHTED, "scan uses asset_sighted");

const payload = Notify.buildPayload({
  type: Notify.TYPES.ASSET_SIGHTED,
  placeId: "a",
  placeName: "Open",
});
assert(payload.actions.some((a) => a.id === "track"), "track action on asset");

console.log("mission brief + notify engagement ok");
