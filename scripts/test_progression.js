#!/usr/bin/env node
/* A–I core: toll off, no visit NCN cut, XP split, 24h check-in, 30d rank, ratings, tiers, hood, unlocks, sponsorship. */
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

global.__lvfeTollMem = {};
global.__lvfeProgMem = {};
global.__lvfeRateMem = {};
global.__lvfeUnlockMem = {};
global.__lvfeSponMem = {};
global.__lvfeAccountMem = {};

const Toll = require("../web/js/pass-toll.js");
const Ledger = require("../web/js/place-ledger.js");
const Conquest = require("../web/js/conquest.js");
const Prog = require("../web/js/progression.js");
const Rate = require("../web/js/ratings.js");
const Unlock = require("../web/js/unlocks.js");
const Spon = require("../web/js/sponsorship.js");

/* A) Toll disabled by default — walking rival turf costs 0 NCN */
assert(Toll.ENABLED === false, "toll off");
assert(Toll.scanPass([{ id: "x", ownable: true, ownerId: "them", lat: 6.4, lon: 7.5 }], {
  lat: 6.4, lon: 7.5, playerKey: "me",
}).length === 0, "scan empty when disabled");
assert(Toll.applyToll({
  placeId: "x", playerKey: "me", ownerId: "them", ownable: true, ownerStake: 100,
}, { debitFn: () => { throw new Error("must not debit"); } }).reason === "disabled", "applyToll no-op");
assert(Toll.formulaCopy() == null, "no toll copy when off");

/* B) Stake is 100% endowment — no 10% visit cut */
const rec = { value: 0, ownerId: "ada", stakes: { ada: { amount: 40, firstAt: "t0" } } };
const split = Ledger.applyIncomingStake(rec, { visitorId: "chidi", visitorName: "Chidi", amount: 50, now: "t1" });
assert(split.yieldPaid === 0 && split.intoPlace === 50, "no yield sliced");
assert(rec.stakes.chidi.amount === 50, "full 50 on pin");
assert(Ledger.yieldFromIncoming(50) === 0, "yieldFromIncoming 0");

/* XP split: visitor 100%, owner 20% referral */
Prog.save(Prog.emptyState());
const xp = Prog.visitXp({ visitCount: 0, uniqueVisitors: 0 });
assert(xp.visitorXp === 10 && xp.ownerXp === 2, "10 and 20% of 10");
const v1 = Prog.recordCheckIn({
  placeId: "cafe", playerKey: "chidi", playerName: "Chidi", ownerId: "ada", ownerName: "Ada",
  now: 1_700_000_000_000,
});
assert(v1.ok && v1.visitorXp === 10 && v1.ownerXp === 2, "referral XP");
const st = Prog.load();
assert(st.players.chidi.totalXp === 10, "visitor XP");
assert(st.players.ada.totalXp === 2, "owner referral XP");

/* C) 1 check-in / place / player / 24h */
const v1b = Prog.recordCheckIn({
  placeId: "cafe", playerKey: "chidi", ownerId: "ada", now: 1_700_000_000_000 + 60_000,
});
assert(!v1b.ok && v1b.reason === "cooldown_24h", "same place same day blocked");
const v2 = Prog.recordCheckIn({
  placeId: "cafe", playerKey: "chidi", ownerId: "ada",
  now: 1_700_000_000_000 + 24 * 60 * 60 * 1000 + 1,
});
assert(v2.ok, "next day allowed");
const other = Prog.recordCheckIn({
  placeId: "park", playerKey: "chidi", ownerId: "ada", now: 1_700_000_000_000,
});
assert(other.ok, "different place same time ok");

/* D) Rank formula + 30-day window + tie-breaker */
assert(Prog.rankScore({ placesClaimed: 3, totalXp: 20, checkIns30d: 4 }) === 3 * 10 + 20 + 4 * 5, "formula");
const tNow = 1_800_000_000_000;
Prog.save(Prog.emptyState());
/* Veteran: 10 places, lots of old XP, zero recent check-ins */
const vetPlaces = {};
for (let i = 0; i < 10; i++) vetPlaces["p" + i] = { ownerId: "vet" };
Prog.recordCheckIn({ placeId: "old", playerKey: "vet", now: tNow - 40 * 24 * 60 * 60 * 1000 });
const stV = Prog.load();
stV.players.vet.totalXp = 100;
Prog.save(stV);
const vet = Prog.playerRankRow("vet", vetPlaces, { now: tNow });
assert(vet.placesClaimed === 10 && vet.checkIns30d === 0, "old check-in outside 30d");
assert(vet.score === 10 * 10 + 100 + 0, "veteran score 200");
/* Active new player: 2 places, 20 XP, 12 check-ins in window */
const newPlaces = { a: { ownerId: "neo" }, b: { ownerId: "neo" } };
for (let i = 0; i < 12; i++) {
  Prog.recordCheckIn({
    placeId: "spot" + i, playerKey: "neo", now: tNow - i * 24 * 60 * 60 * 1000,
  });
}
const neo = Prog.playerRankRow("neo", newPlaces, { now: tNow });
assert(neo.checkIns30d === 12, "12 in window");
assert(neo.score === 2 * 10 + 12 * 10 + 12 * 5, "neo 20+120+60=200");
/* Same score: later check-in wins */
const board = Prog.rankPlayers(Object.assign({}, vetPlaces, newPlaces), { now: tNow });
const vetRow = board.find((r) => r.playerKey === "vet");
const neoRow = board.find((r) => r.playerKey === "neo");
assert(vetRow.score === neoRow.score, "tied score");
assert(neoRow.rank < vetRow.rank, "newer check-in wins tie");
assert(neo.placesClaimed === 2 && neo.totalXp === 120 && neo.checkIns30d === 12, "three metrics separate");

/* Early-player snowball: places×10 is cumulative. 30d window is the decay term.
   Idle 100-pin veteran (score 1000+XP) still beats a casual new player.
   Formula is as specified — not activity-only. */
const idle = Prog.rankScore({ placesClaimed: 100, totalXp: 0, checkIns30d: 0 });
const grind = Prog.rankScore({ placesClaimed: 5, totalXp: 50, checkIns30d: 30 });
assert(idle > grind, "places claimed still snowballs; 30d is not a full equalizer");

/* E) Ratings after check-in */
Prog.save(Prog.emptyState());
assert(Rate.rate({ locationId: "cafe", playerKey: "me", stars: 5 }).reason === "check_in_required", "rate needs visit");
Prog.recordCheckIn({ placeId: "cafe", playerKey: "me", now: tNow });
const rated = Rate.rate({ locationId: "cafe", playerKey: "me", stars: 5, text: "great", now: tNow });
assert(rated.ok && rated.average.avg === 5, "5 star avg");
assert(Rate.average("cafe").high === true, "4.5+ high");
assert(Rate.rate({ locationId: "cafe", playerKey: "me", stars: 9 }).reason === "stars_1_5", "clamp 1-5");

/* F) Location tiers 3 / 4-10 / 11-50 / 50 unique */
assert(Prog.locationTier({ visitCount: 3, uniqueVisitors: 1 }).id === "t1", "t1 at 3 visits");
assert(Prog.locationTier({ visitCount: 4, uniqueVisitors: 2 }).id === "t2", "t2 insight");
assert(Prog.locationTier({ visitCount: 11, uniqueVisitors: 5 }).id === "t3", "t3 trending");
assert(Prog.locationTier({ visitCount: 20, uniqueVisitors: 50 }).id === "t4", "t4 landmark unique");
Prog.save(Prog.emptyState());
for (let i = 0; i < 4; i++) {
  Prog.recordCheckIn({ placeId: "shop", playerKey: "p" + i, now: tNow + i });
}
assert(Prog.load().locations.shop.tierStatus === "t2", "4 unique visits → insight");

/* New-player achievability: 4 visits = t2 in four days if they walk; landmark needs 50 unique people, not 50 self-visits */
assert(Prog.HOOD_PIN_GOAL === 20, "hood 20");
assert(Prog.CHECK_IN_MS === 24 * 60 * 60 * 1000, "24h");

/* G) Hood completion — 20 unique pins, not ownership density */
assert(Conquest.MAX_BONUS === 0, "no conquest multiplier");
Prog.save(Prog.emptyState());
for (let i = 0; i < 20; i++) {
  Prog.recordCheckIn({
    placeId: "n" + i, playerKey: "walker", territoryId: "abakpa", now: tNow + i,
  });
}
let ncn = 0;
const award = Prog.tryHoodAward({
  playerKey: "walker", territoryId: "abakpa", now: tNow,
  creditNcn: function (n) { ncn += n; },
});
assert(award.ok && award.ncn === 5 && ncn === 5, "badge + 5 NCN once");
const again = Prog.tryHoodAward({ playerKey: "walker", territoryId: "abakpa" });
assert(!again.ok && again.reason === "already", "no double pay");

/* H) Rank unlocks */
assert(!Unlock.canUse("bookmark", 0).ok, "initiate no bookmark");
assert(Unlock.canUse("bookmark", 50).ok, "scout bookmark");
assert(Unlock.canUse("tips", 200).ok, "pathfinder tips");
assert(Unlock.canUse("challenges", 500).ok, "warden challenges");
assert(Unlock.canUse("sponsorship", 1000).ok, "marshal sponsorship");
const bm = Unlock.bookmark("me", "cafe", 50);
assert(bm.ok && bm.on && Unlock.isBookmarked("me", "cafe"), "bookmark on");
assert(Unlock.addTip({ playerId: "me", locationId: "cafe", text: "go at dusk", score: 200 }).ok, "tip");
assert(Unlock.hostChallenge({ playerId: "me", title: "best sunset in Enugu by Friday", city: "Enugu", deadline: "2026-09-19", score: 500 }).ok, "challenge");

/* I) Sponsorship: 50 unique + marshal apply; 30/10 split */
assert(Spon.splitAmount(100).platform === 30 && Spon.splitAmount(100).curator === 10, "30/10");
Prog.save(Prog.emptyState());
const locSt = Prog.load();
locSt.locations.shop = { locationId: "shop", visitCount: 60, uniqueVisitors: 50, visitors: {} };
Prog.save(locSt);
assert(Spon.eligible("shop").ok, "50 unique eligible");
const applied = Spon.apply({ locationId: "shop", businessId: "biz", amount: 100, curatorId: "ada", score: 1000, now: tNow });
assert(applied.ok && applied.split.platform === 30, "featured");
assert(Spon.isFeatured("shop", tNow + 1000), "featured live");

console.log("progression A–I ok");
