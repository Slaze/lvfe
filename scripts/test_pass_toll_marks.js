#!/usr/bin/env node
/* Pass-by toll formula / cooldown / escape + mark persistence. */
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

global.__lvfeTollMem = {};
global.__lvfeMarksMem = {};
global.__lvfeNotifyMem = {};

const Toll = require("../web/js/pass-toll.js");
const Marks = require("../web/js/game-marks.js");
const Notify = require("../web/js/game-notify.js");
Toll.applyConfig({ enabled: true });

/* —— Formula —— */
assert(Toll.computeToll({ ownerStake: 0 }).toll === 2, "floor 2 on empty stake");
assert(Toll.computeToll({ ownerStake: 40 }).toll === 2, "40*5%=2");
assert(Toll.computeToll({ ownerStake: 100 }).toll === 5, "100*5%=5");
assert(Toll.computeToll({ ownerStake: 199 }).toll === 9, "199*5% floor 9");
assert(Toll.escapeFeeFor(10) === 4, "escape 40% of 10");
assert(Toll.escapeFeeFor(1) === 1, "escape min 1");
assert(Toll.formulaCopy().short.indexOf("5%") >= 0, "copy mentions 5%");

/* —— Cooldown + charge —— */
const t0 = 1_700_100_000_000;
Toll.saveState({ lastByPlace: {}, pending: {}, debtByPlace: {} });
Toll.saveInbox({ items: [] });

let wallet = 20;
const hit = {
  placeId: "cafe1",
  placeName: "Cafe",
  playerKey: "me",
  passerName: "Me",
  ownerId: "them",
  ownerName: "Them",
  ownerStake: 100,
  displayValue: 120,
  ownable: true,
  walletBefore: wallet,
  now: t0,
};
const charged = Toll.applyToll(hit, {
  getBalance: () => wallet,
  debitFn: (want) => {
    const take = Math.min(want, wallet);
    wallet -= take;
    return { ok: take > 0, charged: take };
  },
  creditOwnerFn: () => {},
});
assert(charged.ok && charged.charged === 5, "charged 5 from stake 100");
assert(wallet === 15, "wallet 15");
assert(Toll.onCooldown("cafe1", { now: t0 + 1000 }).cooled, "on cooldown");
assert(!Toll.applyToll(Object.assign({}, hit, { now: t0 + 1000, walletBefore: wallet }), {
  debitFn: () => ({ ok: true, charged: 5 }),
}).ok, "blocked by cooldown");

const coolOk = Toll.applyToll(Object.assign({}, hit, {
  placeId: "cafe2",
  now: t0 + Toll.COOLDOWN_MS + 10,
  walletBefore: wallet,
}), {
  getBalance: () => wallet,
  debitFn: (want) => {
    const take = Math.min(want, wallet);
    wallet -= take;
    return { ok: true, charged: take };
  },
});
assert(coolOk.ok, "new place after other cooldown ok");

/* Partial + debt */
wallet = 1;
Toll.saveState({ lastByPlace: {}, pending: {}, debtByPlace: {} });
const poor = Toll.applyToll(Object.assign({}, hit, {
  placeId: "poor1",
  ownerStake: 200,
  walletBefore: 1,
  now: t0,
}), {
  getBalance: () => wallet,
  debitFn: (want) => {
    const take = Math.min(want, wallet);
    wallet -= take;
    return { ok: take > 0, charged: take };
  },
});
assert(poor.ok && poor.charged === 1 && poor.debt === 9, "partial 1 + debt 9 (toll 10)");
assert(Toll.loadState().debtByPlace.poor1 === 9, "debt recorded");

/* Escape refunds charged, costs fee */
wallet = 50;
Toll.saveState({ lastByPlace: {}, pending: {}, debtByPlace: {} });
const full = Toll.applyToll(Object.assign({}, hit, {
  placeId: "esc1",
  ownerStake: 100,
  walletBefore: wallet,
  now: t0,
}), {
  getBalance: () => wallet,
  debitFn: (want) => {
    const take = Math.min(want, wallet);
    wallet -= take;
    return { ok: true, charged: take };
  },
});
assert(full.charged === 5 && wallet === 45, "pre-escape bal");
const esc = Toll.escapeToll("esc1", {
  getBalance: () => wallet,
  debitEscapeFn: (fee) => {
    if (wallet < fee) return false;
    wallet -= fee;
    return true;
  },
  creditRefundFn: (amt) => { wallet += amt; },
});
assert(esc.ok && esc.fee === 2 && esc.refunded === 5, "escape fee 2 refund 5");
assert(wallet === 48, "net -2 from 50"); /* 50-5+5-2=48 */

/* Empty wallet debt-only */
wallet = 0;
Toll.saveState({ lastByPlace: {}, pending: {}, debtByPlace: {} });
const empty = Toll.applyToll(Object.assign({}, hit, {
  placeId: "empty1",
  ownerStake: 80,
  walletBefore: 0,
  now: t0,
}), {
  getBalance: () => 0,
  debitFn: () => ({ ok: false, charged: 0 }),
});
assert(empty.ok && empty.charged === 0 && empty.debt === 4, "debt-only toll 4");

/* Scan radius */
const scan = Toll.scanPass(
  [
    { id: "near", name: "Near", lon: 7.5, lat: 6.4, ownable: true, ownerId: "them", ownerStake: 50 },
    { id: "far", name: "Far", lon: 7.6, lat: 6.4, ownable: true, ownerId: "them", ownerStake: 50 },
    { id: "mine", name: "Mine", lon: 7.50001, lat: 6.4, ownable: true, ownerId: "me", ownerStake: 50 },
    { id: "bank", name: "Bank", lon: 7.50001, lat: 6.4, ownable: true, bankOrAtm: true, ownerId: "them", ownerStake: 50 },
  ],
  { lat: 6.4, lon: 7.5, playerKey: "me", radiusM: 80, now: t0 },
);
assert(scan.length === 1 && scan[0].placeId === "near", "only enemy within 80m");

/* Notify payload actions */
const payload = Notify.buildPayload({
  type: Notify.TYPES.PASS_TOLL,
  placeId: "cafe1",
  placeName: "Cafe",
  charged: 5,
});
assert(payload.actions.some((a) => a.id === "bid"), "outpay/bid");
assert(payload.actions.some((a) => a.id === "escape"), "escape");
assert(payload.actions.some((a) => a.id === "ignore"), "accept/ignore");
assert(payload.channel === "enemy", "enemy channel");

/* —— Marks persistence —— */
Marks.save(Marks.empty());
Marks.markPlace("p1", { name: "Spot", lastValue: 10, lastOwnerId: "a", lat: 6.4, lon: 7.5 });
assert(Marks.isWatchingPlace("p1"), "watching");
Marks.markThreat("rival", { name: "Rival" });
assert(Marks.isThreat("rival"), "threat");
Marks.planTakeover("p1", { name: "Spot", ownerName: "Rival", lat: 6.4, lon: 7.5 });
assert(Marks.isTakeover("p1"), "takeover");
assert(Marks.watchList().length === 1, "watch list");
assert(Marks.threatList()[0].name === "Rival", "threat list");

Marks.saveSnap({ places: { p1: { value: 10, ownerId: "a", ownerName: "A", threatStakes: { rival: 0 } } } });
const diffs = Marks.diffWatches({
  p1: {
    value: 25,
    ownerId: "rival",
    ownerName: "Rival",
    stakes: { rival: { amount: 25 } },
  },
}, { playerKey: "me", dry: false });
assert(diffs.some((d) => d.kind === "watch_value"), "value change");
assert(diffs.some((d) => d.kind === "watch_owner"), "owner change");
assert(diffs.some((d) => d.kind === "threat_act"), "threat act");

Marks.unmarkPlace("p1");
Marks.unmarkThreat("rival");
Marks.unplanTakeover("p1");
assert(!Marks.isWatchingPlace("p1") && !Marks.isThreat("rival") && !Marks.isTakeover("p1"), "cleared");

console.log("pass-toll + marks ok");
