#!/usr/bin/env node
/* Wallet / rankings / notify throttle / bid-to-own. */
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

global.__lvfeNotifyMem = {};
global.__lvfeWalletMem = {};

const Notify = require("../web/js/game-notify.js");
const Rank = require("../web/js/rankings.js");
const Wallet = require("../web/js/wallet-earn.js");
const Ledger = require("../web/js/place-ledger.js");

/* —— Notify throttle —— */
const t0 = 1_700_000_000_000;
Notify.savePrefs({ muted: false, allowClaims: true, allowNearby: true, allowEnemy: true });
Notify.saveState({ lastAnyAt: 0, lastByType: {}, lastByPlace: {}, day: "", dayCount: 0 });

let gate = Notify.canNotify({ type: Notify.TYPES.NEARBY_CLAIMABLE, placeId: "p1" }, { now: t0, force: false });
assert(gate.ok, "first nearby ok");
Notify.markSent({ type: Notify.TYPES.NEARBY_CLAIMABLE, placeId: "p1" }, { now: t0 });

gate = Notify.canNotify({ type: Notify.TYPES.ENEMY_NEARBY, placeId: "p2" }, { now: t0 + 60_000 });
assert(!gate.ok && gate.reason === "global_gap", "global gap blocks");

/* After global gap, type cooldown still blocks same type; use enemy type + same place key later. */
gate = Notify.canNotify({ type: Notify.TYPES.NEARBY_CLAIMABLE, placeId: "p1" }, { now: t0 + Notify.GLOBAL_GAP_MS + 1 });
assert(!gate.ok && (gate.reason === "type_gap" || gate.reason === "place_gap"), "nearby still cooled");

Notify.markSent({ type: Notify.TYPES.ENEMY_NEARBY, placeId: "p9" }, { now: t0 + Notify.GLOBAL_GAP_MS + 2 });
gate = Notify.canNotify(
  { type: Notify.TYPES.ENEMY_NEARBY, placeId: "p9" },
  { now: t0 + Notify.GLOBAL_GAP_MS + Notify.TYPE_GAP_MS.enemy_nearby + 10 },
);
assert(!gate.ok && gate.reason === "place_gap", "same place blocked");

gate = Notify.canNotify({ type: Notify.TYPES.TEST, placeId: "" }, { now: t0, force: true });
assert(gate.ok, "force test ok");

const payload = Notify.buildPayload({
  type: Notify.TYPES.ENEMY_NEARBY,
  placeId: "cafe1",
  placeName: "Cafe",
});
assert(payload.channel === "enemy", "enemy channel");
assert(payload.actions.some((a) => a.id === "bid"), "bid action");
assert(payload.actions.some((a) => a.id === "ignore"), "ignore action");

const scan = Notify.scanNearby(
  [
    { id: "a", name: "Open", lon: 7.5, lat: 6.4, ownable: true, ownerId: "" },
    { id: "b", name: "Held", lon: 7.5001, lat: 6.4, ownable: true, ownerId: "rival", factionId: "coal_camp", ownerName: "Riva" },
  ],
  { lat: 6.4, lon: 7.5, playerKey: "me", factionId: "abakpa", radiusM: 500 },
);
assert(scan.claimable && scan.claimable.placeId === "a", "claimable found");
assert(scan.enemy && scan.enemy.placeId === "b", "enemy found");

const rivals = Notify.rivalClaimsFromDiff(
  { x: "me" },
  { x: "them" },
  { playerKey: "me", names: { x: "Spot" }, ownerNames: { x: "Them" } },
);
assert(rivals.length === 1 && rivals[0].type === Notify.TYPES.CLAIM_RIVAL, "rival diff");

/* —— Bid to own —— */
const empty = { ownerId: "", stakes: {}, value: 0 };
assert(Wallet.bidToOwn(empty, "me", 5).add === 5, "first claim min");
const held = {
  ownerId: "them",
  ownerName: "Them",
  stakes: { them: { amount: 40 } },
  value: 40,
};
assert(Wallet.bidToOwn(held, "me", 5).add === 41, "overturn needs owner+1");
assert(Wallet.bidToOwn({
  ownerId: "them",
  stakes: { them: { amount: 40 }, me: { amount: 30 } },
}, "me", 5).add === 11, "top-up to beat");

const y = Wallet.visitYieldExample(50);
assert(y.yieldPaid === 0 && Ledger.yieldFromIncoming(50) === 0, "visit NCN cut removed");
assert(y.intoPlace === 50, "full stake on pin");

/* —— Rankings —— */
const places = {
  p1: {
    ownerId: "ada",
    ownerName: "Ada",
    factionId: "independence_layout",
    stakes: {
      ada: { amount: 60, playerName: "Ada" },
      chidi: { amount: 20, playerName: "Chidi" },
    },
    value: 80,
  },
  p2: {
    ownerId: "chidi",
    ownerName: "Chidi",
    factionId: "coal_camp",
    stakes: { chidi: { amount: 30, playerName: "Chidi" } },
    value: 30,
  },
};
const leaders = Rank.globalLeaders(places, {
  identities: {
    ada: { playerName: "Ada", factionId: "independence_layout" },
    chidi: { playerName: "Chidi", factionId: "coal_camp" },
  },
  metric: "staked",
});
assert(leaders[0].playerKey === "ada" && leaders[0].rank === 1, "ada leads stakes");
assert(leaders[0].staked === 60, "ada staked 60");

const fac = Rank.factionWhoIsWho("independence_layout", places, {
  identities: {
    ada: { playerName: "Ada", factionId: "independence_layout" },
    chidi: { playerName: "Chidi", factionId: "coal_camp" },
  },
});
assert(fac.leader && fac.leader.playerKey === "ada", "faction leader ada");

const stakes = Wallet.stakesOut("chidi", places);
assert(stakes.total === 50, "chidi stakes out 50");
assert(stakes.owned === 1 && stakes.backed === 1, "chidi owned+backed");

Wallet.appendActivity({ kind: "stake", placeId: "p1", amount: 10, text: "test" });
assert(Wallet.loadActivity()[0].placeId === "p1", "activity logged");

console.log("game economy notify/rank/wallet ok");
