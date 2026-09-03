/* Pass-by toll when GPS enters claim radius of an enemy-owned place.
   Formula (UI): toll = max(2, floor(ownerStake × 5%)).
   Empty wallet: partial charge + debtRemaining (fail soft).
   Escape: pay max(1, ceil(charged × 40%)) to refund this toll (net = escape fee).
   Cooldown: once per place per COOLDOWN_MS unless leave+return after cooldown. */
(function (global) {
  const STATE_KEY = "lvfe.toll.state.v1";
  const INBOX_KEY = "lvfe.toll.inbox.v1";
  const RADIUS_M = 80;
  const COOLDOWN_MS = 60 * 60 * 1000; /* 60 min */
  const FLOOR_NCN = 2;
  const STAKE_PCT = 0.05;
  const ESCAPE_PCT = 0.4;

  function storage() {
    if (typeof localStorage === "undefined") {
      if (!global.__lvfeTollMem) global.__lvfeTollMem = {};
      const mem = global.__lvfeTollMem;
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
        setItem: function (k, v) { mem[k] = String(v); },
        removeItem: function (k) { delete mem[k]; },
      };
    }
    return localStorage;
  }

  function lsGet(key, fallback) {
    try {
      const raw = storage().getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function lsSet(key, val) {
    storage().setItem(key, JSON.stringify(val));
  }

  function loadState() {
    const o = lsGet(STATE_KEY, null) || {};
    return {
      lastByPlace: o.lastByPlace && typeof o.lastByPlace === "object" ? o.lastByPlace : {},
      pending: o.pending && typeof o.pending === "object" ? o.pending : {},
      debtByPlace: o.debtByPlace && typeof o.debtByPlace === "object" ? o.debtByPlace : {},
    };
  }

  function saveState(st) {
    lsSet(STATE_KEY, st);
  }

  function loadInbox() {
    const o = lsGet(INBOX_KEY, { items: [] });
    return Array.isArray(o.items) ? o.items : [];
  }

  function saveInbox(items) {
    lsSet(INBOX_KEY, { items: Array.isArray(items) ? items.slice(0, 40) : [] });
  }

  /**
   * Toll formula — documented for players:
   * max(2 NCN, floor(5% of the owner's stake on that place)).
   * displayValue is unused in the charge (shown in UI only as context).
   */
  function computeToll(opts) {
    const o = opts || {};
    const ownerStake = Math.max(0, Math.floor(Number(o.ownerStake) || 0));
    const fromStake = Math.floor(ownerStake * STAKE_PCT);
    const toll = Math.max(FLOOR_NCN, fromStake);
    return {
      toll: toll,
      floor: FLOOR_NCN,
      stakePct: STAKE_PCT,
      ownerStake: ownerStake,
      displayValue: Math.max(0, Math.floor(Number(o.displayValue) || 0)),
      formula: "max(2, floor(ownerStake × 5%))",
    };
  }

  function escapeFeeFor(charged) {
    const c = Math.max(0, Math.floor(Number(charged) || 0));
    if (c <= 0) return 1;
    return Math.max(1, Math.ceil(c * ESCAPE_PCT));
  }

  function haversineM(lat1, lon1, lat2, lon2) {
    const N = global.LvfeGameNotify;
    if (N && typeof N.haversineM === "function") return N.haversineM(lat1, lon1, lat2, lon2);
    const R = 6371000;
    const toRad = Math.PI / 180;
    const dLat = (lat2 - lat1) * toRad;
    const dLon = (lon2 - lon1) * toRad;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function onCooldown(placeId, opts) {
    const o = opts || {};
    const now = Number(o.now) || Date.now();
    const st = o.state || loadState();
    const last = Number(st.lastByPlace[String(placeId)]) || 0;
    if (!last) return { cooled: false, remainingMs: 0 };
    const rem = COOLDOWN_MS - (now - last);
    if (rem > 0) return { cooled: true, remainingMs: rem, lastAt: last };
    return { cooled: false, remainingMs: 0, lastAt: last };
  }

  function markCooldown(placeId, opts) {
    const o = opts || {};
    const now = Number(o.now) || Date.now();
    const st = o.state || loadState();
    st.lastByPlace[String(placeId)] = now;
    if (!o.dry) saveState(st);
    return st;
  }

  /**
   * Apply toll against wallet hooks.
   * debitFn(amount) → { ok, charged } — may charge less than amount (partial).
   * creditOwnerFn(amount, meta) optional best-effort credit to owner on same device.
   */
  function applyToll(ctx, hooks) {
    const c = ctx || {};
    const h = hooks || {};
    const placeId = String(c.placeId || "");
    const playerKey = String(c.playerKey || "");
    const ownerId = String(c.ownerId || "");
    if (!placeId || !playerKey || !ownerId || ownerId === playerKey) {
      return { ok: false, reason: "not_enemy" };
    }
    if (c.bankOrAtm) return { ok: false, reason: "not_ownable" };
    if (!c.ownable) return { ok: false, reason: "not_ownable" };

    const cool = onCooldown(placeId, { now: c.now, state: c.state });
    if (cool.cooled) return { ok: false, reason: "cooldown", remainingMs: cool.remainingMs };

    const calc = computeToll({ ownerStake: c.ownerStake, displayValue: c.displayValue });
    const want = calc.toll;
    let charged = 0;
    let debt = 0;
    let walletBefore = Number(c.walletBefore);
    if (!Number.isFinite(walletBefore) && typeof h.getBalance === "function") {
      walletBefore = Number(h.getBalance(playerKey)) || 0;
    }
    if (!Number.isFinite(walletBefore)) walletBefore = 0;

    if (typeof h.debitFn === "function") {
      const res = h.debitFn(want, { placeId: placeId, kind: "pass_toll" });
      if (res && typeof res === "object") {
        charged = Math.max(0, Math.floor(Number(res.charged) || 0));
        if (res.ok === false && charged <= 0 && walletBefore <= 0) {
          debt = want;
        } else if (charged < want) {
          debt = want - charged;
        }
      } else if (res === true) {
        charged = want;
      } else if (res === false) {
        charged = Math.min(want, Math.max(0, Math.floor(walletBefore)));
        debt = want - charged;
        if (charged > 0 && typeof h.debitExact === "function") h.debitExact(charged);
      }
    } else if (typeof h.debitExact === "function") {
      charged = Math.min(want, Math.max(0, Math.floor(walletBefore)));
      if (charged > 0) {
        const ok = h.debitExact(charged);
        if (!ok) charged = 0;
      }
      debt = want - charged;
    } else {
      /* Pure calc mode (tests): pretend full charge when wallet covers. */
      charged = Math.min(want, Math.max(0, Math.floor(walletBefore)));
      debt = want - charged;
    }

    const st = c.state || loadState();
    const eventId = "toll_" + placeId + "_" + (Number(c.now) || Date.now());
    const pending = {
      eventId: eventId,
      placeId: placeId,
      placeName: c.placeName || placeId,
      playerKey: playerKey,
      passerName: c.passerName || playerKey,
      ownerId: ownerId,
      ownerName: c.ownerName || ownerId,
      toll: want,
      charged: charged,
      debt: debt,
      escapeFee: escapeFeeFor(charged > 0 ? charged : want),
      at: new Date(Number(c.now) || Date.now()).toISOString(),
      escaped: false,
      accepted: false,
    };
    st.pending[placeId] = pending;
    st.lastByPlace[placeId] = Number(c.now) || Date.now();
    if (debt > 0) {
      st.debtByPlace[placeId] = (Number(st.debtByPlace[placeId]) || 0) + debt;
    }
    if (!c.dry) saveState(st);

    /* Best-effort owner credit on same device (multiplayer cloud is separate). */
    if (charged > 0 && typeof h.creditOwnerFn === "function") {
      try { h.creditOwnerFn(charged, pending); } catch (err) { /* soft */ }
    }

    /* Owner inbox for cloud / next sync / same-device other profile. */
    if (!c.dry) {
      const items = loadInbox();
      items.unshift({
        eventId: eventId,
        placeId: placeId,
        placeName: pending.placeName,
        ownerId: ownerId,
        passerName: pending.passerName,
        charged: charged,
        toll: want,
        at: pending.at,
        seen: false,
      });
      saveInbox(items);
    }

    return {
      ok: true,
      reason: debt > 0 && charged === 0 ? "debt_only" : (debt > 0 ? "partial" : "charged"),
      calc: calc,
      pending: pending,
      charged: charged,
      debt: debt,
      escapeFee: pending.escapeFee,
    };
  }

  function getPending(placeId) {
    const st = loadState();
    return st.pending[String(placeId)] || null;
  }

  function clearPending(placeId, opts) {
    const st = (opts && opts.state) || loadState();
    delete st.pending[String(placeId)];
    if (!(opts && opts.dry)) saveState(st);
    return st;
  }

  /**
   * Escape: pay escapeFee, refund charged amount, clear debt for this event.
   * debitEscapeFn(fee) must succeed for full fee.
   * creditRefundFn(charged) refunds passer.
   */
  function escapeToll(placeId, hooks, opts) {
    const o = opts || {};
    const h = hooks || {};
    const st = o.state || loadState();
    const pending = st.pending[String(placeId)];
    if (!pending || pending.escaped || pending.accepted) {
      return { ok: false, reason: "no_pending" };
    }
    const fee = escapeFeeFor(pending.charged > 0 ? pending.charged : pending.toll);
    const wallet = typeof h.getBalance === "function"
      ? Number(h.getBalance()) || 0
      : Number(o.walletBefore) || 0;
    if (wallet < fee) return { ok: false, reason: "cannot_afford_escape", fee: fee, wallet: wallet };

    if (typeof h.debitEscapeFn === "function") {
      const ok = h.debitEscapeFn(fee);
      if (!ok) return { ok: false, reason: "debit_failed", fee: fee };
    }

    if (pending.charged > 0 && typeof h.creditRefundFn === "function") {
      h.creditRefundFn(pending.charged);
    }

    /* Undo debt recorded for this event. */
    if (pending.debt > 0) {
      const d = Number(st.debtByPlace[placeId]) || 0;
      st.debtByPlace[placeId] = Math.max(0, d - pending.debt);
      if (st.debtByPlace[placeId] === 0) delete st.debtByPlace[placeId];
    }
    pending.escaped = true;
    pending.escapePaid = fee;
    pending.accepted = false;
    delete st.pending[placeId];
    if (!o.dry) saveState(st);
    return { ok: true, fee: fee, refunded: pending.charged, pending: pending };
  }

  function acceptToll(placeId, opts) {
    const o = opts || {};
    const st = o.state || loadState();
    const pending = st.pending[String(placeId)];
    if (!pending) return { ok: false, reason: "no_pending" };
    pending.accepted = true;
    delete st.pending[placeId];
    if (!o.dry) saveState(st);
    return { ok: true, pending: pending };
  }

  /**
   * Scan GPS for enemy places inside claim radius.
   * rows: [{ id, name, lon, lat, ownable, bankOrAtm, ownerId, ownerName, ownerStake, displayValue }]
   */
  function scanPass(rows, opts) {
    const o = opts || {};
    const lat = Number(o.lat);
    const lon = Number(o.lon);
    const playerKey = String(o.playerKey || "");
    const radius = Number(o.radiusM) > 0 ? Number(o.radiusM) : RADIUS_M;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !playerKey) return [];

    const hits = [];
    const list = Array.isArray(rows) ? rows : [];
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (!r || !r.ownable || r.bankOrAtm) continue;
      if (!r.ownerId || r.ownerId === playerKey) continue;
      const dist = haversineM(lat, lon, Number(r.lat), Number(r.lon));
      if (!(dist <= radius)) continue;
      const cool = onCooldown(r.id, { now: o.now, state: o.state });
      hits.push({
        placeId: r.id,
        placeName: r.name,
        dist: dist,
        ownerId: r.ownerId,
        ownerName: r.ownerName || r.ownerId,
        ownerStake: Number(r.ownerStake) || 0,
        displayValue: Number(r.displayValue) || 0,
        cooled: cool.cooled,
        remainingMs: cool.remainingMs || 0,
      });
    }
    hits.sort(function (a, b) { return a.dist - b.dist; });
    return hits;
  }

  function formulaCopy() {
    return {
      short: "Pass-by toll = max(2 NCN, 5% of the owner’s stake), once per place per 60 min.",
      escape:
        "Escape the charge: pay 40% of what was taken (min 1 NCN) to get that toll refunded. Net cost = the escape fee.",
      empty:
        "If your wallet is empty or short, we take what you have and flag the rest as debt on that place (soft fail).",
      cooldown: "60 minutes per place after a toll (including escaped).",
    };
  }

  function takeOwnerInbox(ownerId, opts) {
    const oid = String(ownerId || "");
    const items = loadInbox();
    const mine = [];
    const rest = [];
    items.forEach(function (it) {
      if (it && it.ownerId === oid && !it.seen) mine.push(it);
      else rest.push(it);
    });
    if (!(opts && opts.dry) && mine.length) {
      mine.forEach(function (it) { it.seen = true; });
      saveInbox(rest.concat(mine));
    }
    return mine;
  }

  const api = {
    STATE_KEY,
    INBOX_KEY,
    RADIUS_M,
    COOLDOWN_MS,
    FLOOR_NCN,
    STAKE_PCT,
    ESCAPE_PCT,
    loadState,
    saveState,
    loadInbox,
    saveInbox,
    computeToll,
    escapeFeeFor,
    onCooldown,
    markCooldown,
    applyToll,
    getPending,
    clearPending,
    escapeToll,
    acceptToll,
    scanPass,
    formulaCopy,
    takeOwnerInbox,
    haversineM,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfePassToll = api;
})(typeof window !== "undefined" ? window : globalThis);
