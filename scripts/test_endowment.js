#!/usr/bin/env node
/* Ada/Chidi contest: yield from incoming stake, not mint. */
const Ledger = require("../web/js/place-ledger.js");

const FAUCET = 100;
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

function emptyRec() {
  return { value: 0, ownerId: "", ownerName: "", factionId: "", hasPhoto: false, quality: "", stakes: {} };
}

function recompute(rec, identities) {
  let best = null;
  for (const pid of Object.keys(rec.stakes || {})) {
    const st = rec.stakes[pid];
    if (!st || !(Number(st.amount) > 0)) continue;
    const amt = Number(st.amount) || 0;
    const firstAt = String(st.firstAt || "");
    if (!best || amt > best.amt || (amt === best.amt && firstAt < best.firstAt)) {
      best = { pid, amt, firstAt, st };
    }
  }
  if (!best) {
    rec.ownerId = "";
    rec.ownerName = "";
    rec.factionId = "";
    Ledger.syncValue(rec);
    return rec;
  }
  rec.ownerId = best.pid;
  rec.ownerName = identities[best.pid].name;
  rec.factionId = identities[best.pid].factionId;
  Ledger.syncValue(rec);
  return rec;
}

const idn = {
  ada: { name: "ada", factionId: "independence_layout" },
  chidi: { name: "chidi", factionId: "coal_camp" },
};
const wallets = { ada: FAUCET, chidi: FAUCET };
const faction = { independence_layout: 0, coal_camp: 0 };
const rec = emptyRec();

function pay(who, amount, t) {
  wallets[who] -= amount;
  const split = Ledger.applyIncomingStake(rec, {
    visitorId: who,
    visitorName: idn[who].name,
    amount,
    now: t,
  });
  if (split.ownerPaid) wallets[split.prevOwner] += split.ownerPaid;
  if (split.factionPaid && split.factionId) faction[split.factionId] += split.factionPaid;
  recompute(rec, idn);
  return split;
}

const s1 = pay("ada", 42, "2026-09-02T10:00:00.000Z");
assert(s1.intoPlace === 42 && s1.yieldPaid === 0, "first stake is 100% endowment");
assert(rec.value === 42 && rec.stakes.ada.amount === 42, "value === ada stake");
assert(rec.ownerId === "ada" && rec.factionId === "independence_layout", "ada owns");
assert(wallets.ada === 58, "ada faucet minus 42");

const s2 = pay("chidi", 50, "2026-09-02T10:01:00.000Z");
assert(s2.yieldPaid === 0 && s2.ownerPaid === 0 && s2.factionPaid === 0, "no visit NCN cut");
assert(s2.intoPlace === 50, "full stake endows pin");
assert(rec.stakes.chidi.amount === 50 && rec.stakes.ada.amount === 42, "stakes recorded");
assert(rec.value === 92, "value 92");
assert(rec.value === Ledger.sumStakes(rec), "value === sum(stakes)");
assert(rec.ownerId === "chidi", "chidi highest staker");
assert(wallets.ada === 58, "ada wallet unchanged by visit");
assert(wallets.chidi === 50, "chidi paid 50");
assert(faction.independence_layout === 0, "no faction cut");
const conserved = wallets.ada + wallets.chidi + faction.independence_layout + rec.value;
assert(conserved === 200, "two faucets conserved, got " + conserved);

console.log("Ada/Chidi endowment contest ok: value", rec.value, "owner", rec.ownerId, "wallets", wallets, "faction", faction);
