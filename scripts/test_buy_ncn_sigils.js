#!/usr/bin/env node
/* Buy NCN clamp + rank sigil tiers. */
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const BuyCfg = require("../web/js/buy-ncn.config.js");
const Sig = require("../web/js/rank-sigils.js");
const { clampNcn, keysStatus, creditSave, ATOMIC_PER_COIN } = require("../server/buy.js");

assert(BuyCfg.NCN_PER_USD === 1, "1 NCN = $1");
assert(!BuyCfg.isConfigured(), "empty public key = not configured");
assert(BuyCfg.BLOCKER_STEPS.length >= 4, "blocker steps present");

assert(clampNcn(0) === 1, "min 1");
assert(clampNcn(9999) === 500, "max 500");
assert(clampNcn(12.9) === 12, "floor");

const st = keysStatus({});
assert(st.configured === false, "no keys");
assert(st.provider === "paystack", "paystack");

const initiate = Sig.tierForPoints(0);
assert(initiate.id === "initiate", "initiate");
assert(Sig.tierForPoints(50).id === "scout", "scout");
assert(Sig.tierForPoints(200).id === "pathfinder", "pathfinder");
assert(Sig.tierForPoints(500).id === "warden", "warden");
assert(Sig.tierForPoints(1000).id === "marshal", "marshal");
assert(Sig.tierForPoints(2500).id === "sovereign", "sovereign");
assert(Sig.roleForFactionRank(1).id === "banner_lord", "banner lord");
assert(Sig.roleForFactionRank(2).id === "vanguard", "vanguard");
assert(Sig.roleForFactionRank(9).id === "kin", "kin");

const html = Sig.emblemHtml({ staked: 60, owned: 2, points: 80 }, { factionRank: 1 });
assert(/sigil/.test(html) && /scout|data-tier/.test(html), "emblem html");
assert(ATOMIC_PER_COIN === 100000000, "8 decimals");

const mem = {};
const credit = creditSave({
  safeKey: (k) => String(k || "").slice(0, 32),
  readSave: (k) => mem[k] || null,
  writeSave: (k, doc) => { mem[k] = doc; },
}, "ada", 5, "ref-test-1");
assert(credit.ok && credit.ncnAmount === 5, "credit ok");
assert(mem.ada.pack.wallets["lvfe.nc.iou.v1.ada"].atomic === 5 * ATOMIC_PER_COIN, "atomic");
const again = creditSave({
  safeKey: (k) => String(k || "").slice(0, 32),
  readSave: (k) => mem[k] || null,
  writeSave: (k, doc) => { mem[k] = doc; },
}, "ada", 5, "ref-test-1");
assert(again.idempotent === true, "idempotent purchase");

console.log("buy ncn + rank sigils ok");
