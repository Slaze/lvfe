/* Place endowment accounting. Incoming NCN stays on the pin (no visit cut).
   After every stake: place.value === sum(stake.amount). Visit XP is sibling
   LvfeProgression, not this ledger. */
(function (global) {
  const cfg = { yieldRate: 0, factionCut: 0 };

  function sumStakes(rec) {
    let n = 0;
    const stakes = (rec && rec.stakes) || {};
    for (const pid of Object.keys(stakes)) {
      n += Number(stakes[pid] && stakes[pid].amount) || 0;
    }
    return n;
  }

  function syncValue(rec) {
    rec.value = sumStakes(rec);
    return rec;
  }

  function yieldFromIncoming(amount) {
    const a = Math.floor(Number(amount));
    if (!(a > 0) || !(cfg.yieldRate > 0)) return 0;
    const y = Math.max(1, Math.round(a * cfg.yieldRate));
    return Math.min(y, a);
  }

  /**
   * Split an incoming whole-coin stake.
   * Default yieldRate 0: 100% of amount endows the pin. No owner NCN cut.
   */
  function splitIncomingStake(rec, visitorId, amount) {
    const a = Math.floor(Number(amount));
    const prevOwner = rec && rec.ownerId ? rec.ownerId : "";
    const payingOther = Boolean(prevOwner && prevOwner !== visitorId);
    let yieldPaid = 0;
    let factionPaid = 0;
    let ownerPaid = 0;
    if (payingOther) {
      yieldPaid = yieldFromIncoming(a);
      const fac = rec.factionId || "";
      if (fac) {
        factionPaid = Math.round(yieldPaid * cfg.factionCut);
        ownerPaid = yieldPaid - factionPaid;
      } else {
        ownerPaid = yieldPaid;
      }
    }
    return {
      intoPlace: a - yieldPaid,
      yieldPaid,
      ownerPaid,
      factionPaid,
      prevOwner,
      factionId: payingOther ? (rec.factionId || "") : "",
    };
  }

  function applyIncomingStake(rec, opts) {
    const amount = Math.floor(Number(opts.amount));
    const split = splitIncomingStake(rec, opts.visitorId, amount);
    const now = opts.now || new Date().toISOString();
    const mine = rec.stakes[opts.visitorId]
      ? Object.assign({}, rec.stakes[opts.visitorId])
      : { amount: 0, firstAt: now, photo: null, playerName: opts.visitorName };
    mine.amount = (Number(mine.amount) || 0) + split.intoPlace;
    mine.lastAt = now;
    mine.playerName = opts.visitorName;
    if (!mine.firstAt) mine.firstAt = now;
    if (opts.photo) mine.photo = opts.photo;
    rec.stakes[opts.visitorId] = mine;
    syncValue(rec);
    return split;
  }

  const api = {
    get YIELD_RATE() { return cfg.yieldRate; },
    get FACTION_CUT() { return cfg.factionCut; },
    sumStakes,
    syncValue,
    yieldFromIncoming,
    splitIncomingStake,
    applyIncomingStake,
    applyConfig: function (o) {
      if (!o) return;
      const y = Number(o.yieldRate);
      const f = Number(o.factionCut);
      if (Number.isFinite(y) && y >= 0) cfg.yieldRate = y;
      if (Number.isFinite(f) && f >= 0) cfg.factionCut = f;
    },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfePlaceLedger = api;
})(typeof window !== "undefined" ? window : globalThis);
