/* Visit XP, 24h check-in, location tiers, composite rank, hood completion.
   No NCN sliced from stakes. Toll is a sibling (disabled). */
(function (global) {
  const STORE = "lvfe.progression.v1";
  const DAY_MS = 24 * 60 * 60 * 1000;
  const WINDOW_MS = 30 * DAY_MS;
  const cfg = {
    baseXp: 10,
    visitorRate: 1,
    ownerReferralRate: 0.2,
    checkInMs: DAY_MS,
    rankWindowMs: WINDOW_MS,
    hoodPinGoal: 20,
    hoodNcnBonus: 5,
    placesClaimedWeight: 10,
    xpWeight: 1,
    checkInWeight: 5,
    highRating: 4.5,
  };

  const LOCATION_TIERS = [
    { id: "t1", minVisits: 0, label: "New", insight: false, trending: false, landmark: false },
    { id: "t2", minVisits: 4, label: "Insight", insight: true, trending: false, landmark: false },
    { id: "t3", minVisits: 11, label: "Trending", insight: true, trending: true, landmark: false },
    { id: "t4", minUnique: 50, label: "Landmark", insight: true, trending: true, landmark: true },
  ];

  function storage() {
    if (typeof localStorage === "undefined") {
      if (!global.__lvfeProgMem) global.__lvfeProgMem = {};
      const mem = global.__lvfeProgMem;
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
        setItem: function (k, v) { mem[k] = String(v); },
        removeItem: function (k) { delete mem[k]; },
      };
    }
    return localStorage;
  }

  function load() {
    try {
      const raw = storage().getItem(STORE);
      const o = raw ? JSON.parse(raw) : null;
      if (!o || typeof o !== "object") return emptyState();
      return {
        players: o.players && typeof o.players === "object" ? o.players : {},
        checkIns: Array.isArray(o.checkIns) ? o.checkIns : [],
        locations: o.locations && typeof o.locations === "object" ? o.locations : {},
        hoodAwards: o.hoodAwards && typeof o.hoodAwards === "object" ? o.hoodAwards : {},
      };
    } catch (err) {
      return emptyState();
    }
  }

  function emptyState() {
    return { players: {}, checkIns: [], locations: {}, hoodAwards: {} };
  }

  function save(st) {
    storage().setItem(STORE, JSON.stringify(st));
    return st;
  }

  function ensurePlayer(st, playerId, name) {
    const id = String(playerId || "");
    if (!id) return null;
    if (!st.players[id]) {
      st.players[id] = {
        playerId: id,
        playerName: name || id,
        totalXp: 0,
        lastCheckInAt: "",
      };
    }
    if (name && st.players[id].playerName === id) st.players[id].playerName = name;
    return st.players[id];
  }

  function ensureLoc(st, locationId) {
    const id = String(locationId || "");
    if (!id) return null;
    if (!st.locations[id]) {
      st.locations[id] = {
        locationId: id,
        visitCount: 0,
        uniqueVisitors: 0,
        visitors: {},
        avgRating: null,
        ratingCount: 0,
        tierStatus: "t1",
        sponsoredUntil: "",
        insight: "",
      };
    }
    return st.locations[id];
  }

  function locationTier(loc) {
    const visits = Number(loc && loc.visitCount) || 0;
    const uniq = Number(loc && loc.uniqueVisitors) || 0;
    if (uniq >= 50) return LOCATION_TIERS[3];
    if (visits >= 11) return LOCATION_TIERS[2];
    if (visits >= 4) return LOCATION_TIERS[1];
    return LOCATION_TIERS[0];
  }

  function visitXp(loc) {
    const base = cfg.baseXp;
    const visitorXp = Math.max(0, Math.round(base * cfg.visitorRate));
    const ownerXp = Math.max(0, Math.round(visitorXp * cfg.ownerReferralRate));
    const tier = locationTier(loc);
    return { visitorXp: visitorXp, ownerXp: ownerXp, tier: tier };
  }

  function lastCheckIn(st, playerId, locationId) {
    const pid = String(playerId || "");
    const lid = String(locationId || "");
    let latest = 0;
    const list = st.checkIns;
    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      if (!row || row.playerId !== pid || row.locationId !== lid) continue;
      const t = Date.parse(row.checkedAt) || 0;
      if (t > latest) latest = t;
    }
    return latest;
  }

  function canCheckIn(opts) {
    const o = opts || {};
    const st = o.state || load();
    const pid = String(o.playerId || o.playerKey || "");
    const lid = String(o.locationId || o.placeId || "");
    const now = Number(o.now) || Date.now();
    if (!pid || !lid) return { ok: false, reason: "missing_ids" };
    const last = lastCheckIn(st, pid, lid);
    if (last && now - last < cfg.checkInMs) {
      return {
        ok: false,
        reason: "cooldown_24h",
        remainingMs: cfg.checkInMs - (now - last),
        lastAt: last,
      };
    }
    return { ok: true, remainingMs: 0, lastAt: last || 0 };
  }

  /**
   * Record a visit. Visitor gets 100% XP. Owner (if different) gets 20% referral XP.
   * Enforces 1 check-in / player / location / rolling 24h.
   */
  function recordCheckIn(opts) {
    const o = opts || {};
    const st = o.state || load();
    const pid = String(o.playerId || o.playerKey || "");
    const lid = String(o.locationId || o.placeId || "");
    const now = Number(o.now) || Date.now();
    const gate = canCheckIn({ state: st, playerId: pid, locationId: lid, now: now });
    if (!gate.ok) return { ok: false, reason: gate.reason, remainingMs: gate.remainingMs };
    const loc = ensureLoc(st, lid);
    const player = ensurePlayer(st, pid, o.playerName);
    const ownerId = String(o.ownerId || "");
    const xp = visitXp(loc);
    const at = new Date(now).toISOString();
    const wasUnique = !loc.visitors[pid];
    loc.visitCount += 1;
    loc.visitors[pid] = true;
    loc.uniqueVisitors = Object.keys(loc.visitors).length;
    const tier = locationTier(loc);
    loc.tierStatus = tier.id;
    player.totalXp += xp.visitorXp;
    player.lastCheckInAt = at;
    let ownerXpPaid = 0;
    if (ownerId && ownerId !== pid) {
      const owner = ensurePlayer(st, ownerId, o.ownerName);
      owner.totalXp += xp.ownerXp;
      ownerXpPaid = xp.ownerXp;
    }
    st.checkIns.push({
      locationId: lid,
      playerId: pid,
      checkedAt: at,
      visitorXp: xp.visitorXp,
      ownerXp: ownerXpPaid,
      ownerId: ownerId || "",
      territoryId: String(o.territoryId || ""),
    });
    if (st.checkIns.length > 8000) st.checkIns = st.checkIns.slice(-6000);
    if (!o.dry) save(st);
    return {
      ok: true,
      visitorXp: xp.visitorXp,
      ownerXp: ownerXpPaid,
      ownerId: ownerId,
      visitCount: loc.visitCount,
      uniqueVisitors: loc.uniqueVisitors,
      unique: wasUnique,
      tier: tier,
      location: loc,
      player: player,
      checkedAt: at,
    };
  }

  function checkInsInWindow(st, playerId, now) {
    const pid = String(playerId || "");
    const t1 = (Number(now) || Date.now()) - cfg.rankWindowMs;
    let n = 0;
    let last = 0;
    for (let i = 0; i < st.checkIns.length; i++) {
      const row = st.checkIns[i];
      if (!row || row.playerId !== pid) continue;
      const t = Date.parse(row.checkedAt) || 0;
      if (t >= t1) n += 1;
      if (t > last) last = t;
    }
    return { count: n, lastAt: last };
  }

  function uniquePinsInHood(st, playerId, territoryId) {
    const pid = String(playerId || "");
    const tid = String(territoryId || "");
    const seen = {};
    for (let i = 0; i < st.checkIns.length; i++) {
      const row = st.checkIns[i];
      if (!row || row.playerId !== pid) continue;
      if (tid && row.territoryId !== tid) continue;
      if (!row.locationId) continue;
      seen[row.locationId] = true;
    }
    return Object.keys(seen);
  }

  function tryHoodAward(opts) {
    const o = opts || {};
    const st = o.state || load();
    const pid = String(o.playerId || o.playerKey || "");
    const tid = String(o.territoryId || "");
    if (!pid || !tid || tid === "unclaimed") {
      return { ok: false, reason: "no_hood" };
    }
    const pins = uniquePinsInHood(st, pid, tid);
    const key = pid + "::" + tid;
    if (pins.length < cfg.hoodPinGoal) {
      return { ok: false, reason: "short", count: pins.length, goal: cfg.hoodPinGoal };
    }
    if (st.hoodAwards[key]) {
      return { ok: false, reason: "already", count: pins.length, badge: st.hoodAwards[key].badge };
    }
    const award = {
      playerId: pid,
      territoryId: tid,
      ncn: cfg.hoodNcnBonus,
      badge: "hood_explorer_" + tid,
      awardedAt: new Date(Number(o.now) || Date.now()).toISOString(),
      count: pins.length,
    };
    st.hoodAwards[key] = award;
    if (!o.dry) save(st);
    if (typeof o.creditNcn === "function") o.creditNcn(cfg.hoodNcnBonus);
    return { ok: true, awarded: true, ncn: cfg.hoodNcnBonus, badge: award.badge, count: pins.length, goal: cfg.hoodPinGoal };
  }

  function rankScore(parts) {
    const claimed = Math.max(0, Math.floor(Number(parts && parts.placesClaimed) || 0));
    const xp = Math.max(0, Math.floor(Number(parts && parts.totalXp) || 0));
    const cin = Math.max(0, Math.floor(Number(parts && parts.checkIns30d) || 0));
    return claimed * cfg.placesClaimedWeight + xp * cfg.xpWeight + cin * cfg.checkInWeight;
  }

  /**
   * Composite rank: (Places Claimed × 10) + (Total Points × 1) + (Check-ins Last 30 Days × 5)
   * Total Points = total XP. Tie-breaker: most recent check-in wins.
   */
  function playerRankRow(playerId, places, opts) {
    const o = opts || {};
    const st = o.state || load();
    const pid = String(playerId || "");
    const now = Number(o.now) || Date.now();
    const all = places && typeof places === "object" ? places : {};
    let claimed = 0;
    Object.keys(all).forEach(function (id) {
      if (all[id] && all[id].ownerId === pid) claimed += 1;
    });
    const p = st.players[pid] || { totalXp: 0, playerName: pid, lastCheckInAt: "" };
    const win = checkInsInWindow(st, pid, now);
    const totalXp = Math.max(0, Math.floor(Number(p.totalXp) || 0));
    return {
      playerKey: pid,
      playerName: p.playerName || (o.playerName) || pid,
      placesClaimed: claimed,
      totalXp: totalXp,
      totalPoints: totalXp,
      checkIns30d: win.count,
      lastCheckInAt: win.lastAt || (p.lastCheckInAt ? Date.parse(p.lastCheckInAt) : 0) || 0,
      score: rankScore({ placesClaimed: claimed, totalXp: totalXp, checkIns30d: win.count }),
    };
  }

  function rankPlayers(places, opts) {
    const o = opts || {};
    const st = o.state || load();
    const ids = {};
    const all = places && typeof places === "object" ? places : {};
    Object.keys(all).forEach(function (id) {
      const rec = all[id];
      if (rec && rec.ownerId) ids[rec.ownerId] = true;
    });
    Object.keys(st.players).forEach(function (pid) { ids[pid] = true; });
    if (o.identities) {
      Object.keys(o.identities).forEach(function (pid) { ids[pid] = true; });
    }
    const rows = Object.keys(ids).map(function (pid) {
      const idn = (o.identities && o.identities[pid]) || {};
      return playerRankRow(pid, places, {
        state: st,
        now: o.now,
        playerName: idn.playerName || idn.name,
      });
    });
    rows.sort(function (a, b) {
      const d = b.score - a.score;
      if (d) return d;
      const t = (Number(b.lastCheckInAt) || 0) - (Number(a.lastCheckInAt) || 0);
      if (t) return t;
      return String(a.playerName || "").localeCompare(String(b.playerName || ""));
    });
    return rows.map(function (r, i) {
      return Object.assign({}, r, { rank: i + 1 });
    });
  }

  function searchBoost(locationId, opts) {
    const st = (opts && opts.state) || load();
    const loc = st.locations[String(locationId || "")];
    if (!loc) return 0;
    let n = 0;
    const tier = locationTier(loc);
    if (tier.trending) n += 20;
    if (tier.landmark) n += 40;
    if (loc.sponsoredUntil && Date.parse(loc.sponsoredUntil) > Date.now()) n += 80;
    if (Number(loc.avgRating) >= cfg.highRating) n += 30;
    return n;
  }

  function applyConfig(o) {
    if (!o) return;
    const keys = [
      "baseXp", "visitorRate", "ownerReferralRate", "checkInMs", "rankWindowMs",
      "hoodPinGoal", "hoodNcnBonus", "placesClaimedWeight", "xpWeight", "checkInWeight", "highRating",
    ];
    keys.forEach(function (k) {
      if (o[k] == null) return;
      const n = Number(o[k]);
      if (Number.isFinite(n) && n >= 0) cfg[k] = n;
    });
    if (o.checkInHours != null) {
      const h = Number(o.checkInHours);
      if (Number.isFinite(h) && h > 0) cfg.checkInMs = h * 60 * 60 * 1000;
    }
  }

  const api = {
    STORE: STORE,
    LOCATION_TIERS: LOCATION_TIERS,
    get BASE_XP() { return cfg.baseXp; },
    get OWNER_REFERRAL_RATE() { return cfg.ownerReferralRate; },
    get CHECK_IN_MS() { return cfg.checkInMs; },
    get RANK_WINDOW_MS() { return cfg.rankWindowMs; },
    get HOOD_PIN_GOAL() { return cfg.hoodPinGoal; },
    get HOOD_NCN_BONUS() { return cfg.hoodNcnBonus; },
    load: load,
    save: save,
    emptyState: emptyState,
    locationTier: locationTier,
    visitXp: visitXp,
    canCheckIn: canCheckIn,
    recordCheckIn: recordCheckIn,
    checkInsInWindow: checkInsInWindow,
    uniquePinsInHood: uniquePinsInHood,
    tryHoodAward: tryHoodAward,
    rankScore: rankScore,
    playerRankRow: playerRankRow,
    rankPlayers: rankPlayers,
    searchBoost: searchBoost,
    applyConfig: applyConfig,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.LvfeProgression = api;
})(typeof window !== "undefined" ? window : globalThis);
