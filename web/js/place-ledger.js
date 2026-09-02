/* Place endowment accounting. Owner yield is sliced from the incoming
   stake (or would come from place.value). After every payout:
   place.value === sum(stake.amount). No minting. */
(function (global) {
  const YIELD_RATE = 0.1;
  const FACTION_CUT = 0.2;

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
    if (!(a > 0)) return 0;
    const y = Math.max(1, Math.round(a * YIELD_RATE));
    return Math.min(y, a);
  }

  /**
   * Split an incoming whole-coin stake.
   * Visitor pays `amount` from wallet.
   * If a different owner exists: yield = 10% of amount (from the stake).
   *   20% of that yield → faction pool when the pin has a faction; rest → owner wallet.
   * Remainder endows the pin as the visitor's stake.
   * If no other owner: 100% of amount endows the pin.
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
        factionPaid = Math.round(yieldPaid * FACTION_CUT);
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
    YIELD_RATE,
    FACTION_CUT,
    sumStakes,
    syncValue,
    yieldFromIncoming,
    splitIncomingStake,
    applyIncomingStake,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfePlaceLedger = api;
})(typeof window !== "undefined" ? window : globalThis);
