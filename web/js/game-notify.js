/* Occasional game-activity notifications. Throttle so they feel rare, not spammy.
   Android: LvfeNative.showGameNotification(JSON). Web: in-app banner fallback. */
(function (global) {
  const PREFS_KEY = "lvfe.notify.prefs.v1";
  const STATE_KEY = "lvfe.notify.state.v1";
  const TYPES = {
    CLAIM_SELF: "claim_self",
    CLAIM_RIVAL: "claim_rival",
    NEARBY_CLAIMABLE: "nearby_claimable",
    ENEMY_NEARBY: "enemy_nearby",
    PASS_TOLL: "pass_toll",
    TOLL_OWNER: "toll_owner",
    WATCH_CHANGE: "watch_change",
    THREAT_ACT: "threat_act",
    TEST: "test",
  };

  /** Global gap between any notification (ms). */
  const GLOBAL_GAP_MS = 12 * 60 * 1000;
  /** Per-type cooldowns. */
  const TYPE_GAP_MS = {
    claim_self: 2 * 60 * 1000,
    claim_rival: 8 * 60 * 1000,
    nearby_claimable: 25 * 60 * 1000,
    enemy_nearby: 18 * 60 * 1000,
    pass_toll: 0, /* place cooldown lives in LvfePassToll */
    toll_owner: 2 * 60 * 1000,
    watch_change: 10 * 60 * 1000,
    threat_act: 8 * 60 * 1000,
    test: 0,
  };
  /** Same place + type not again for this long. */
  const PLACE_GAP_MS = 90 * 60 * 1000;
  const MAX_PER_DAY = 8;
  const NEARBY_RADIUS_M = 400;

  function storage() {
    if (typeof localStorage === "undefined") {
      if (!global.__lvfeNotifyMem) global.__lvfeNotifyMem = {};
      const mem = global.__lvfeNotifyMem;
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

  function defaultPrefs() {
    return {
      muted: false,
      muteTypes: {},
      allowClaims: true,
      allowNearby: true,
      allowEnemy: true,
      allowToll: true,
      allowWatch: true,
      allowThreat: true,
    };
  }

  function loadPrefs() {
    const o = lsGet(PREFS_KEY, null);
    return Object.assign(defaultPrefs(), o && typeof o === "object" ? o : {});
  }

  function savePrefs(prefs) {
    lsSet(PREFS_KEY, Object.assign(defaultPrefs(), prefs || {}));
    return loadPrefs();
  }

  function dayKey(now) {
    const d = new Date(now || Date.now());
    return d.getUTCFullYear() + "-" + (d.getUTCMonth() + 1) + "-" + d.getUTCDate();
  }

  function loadState() {
    const o = lsGet(STATE_KEY, null) || {};
    return {
      lastAnyAt: Number(o.lastAnyAt) || 0,
      lastByType: o.lastByType && typeof o.lastByType === "object" ? o.lastByType : {},
      lastByPlace: o.lastByPlace && typeof o.lastByPlace === "object" ? o.lastByPlace : {},
      day: o.day || "",
      dayCount: Number(o.dayCount) || 0,
    };
  }

  function saveState(st) {
    lsSet(STATE_KEY, st);
  }

  function typeAllowed(prefs, type) {
    if (prefs.muted) return false;
    if (prefs.muteTypes && prefs.muteTypes[type]) return false;
    if (type === TYPES.CLAIM_SELF || type === TYPES.CLAIM_RIVAL) return prefs.allowClaims !== false;
    if (type === TYPES.NEARBY_CLAIMABLE) return prefs.allowNearby !== false;
    if (type === TYPES.ENEMY_NEARBY) return prefs.allowEnemy !== false;
    if (type === TYPES.PASS_TOLL || type === TYPES.TOLL_OWNER) return prefs.allowToll !== false;
    if (type === TYPES.WATCH_CHANGE) return prefs.allowWatch !== false;
    if (type === TYPES.THREAT_ACT) return prefs.allowThreat !== false;
    if (type === TYPES.TEST) return true;
    return true;
  }

  /**
   * Pure throttle gate. Returns { ok, reason } without mutating when dry=true.
   */
  function canNotify(evt, opts) {
    const o = opts || {};
    const now = Number(o.now) || Date.now();
    const prefs = o.prefs || loadPrefs();
    const st = o.state || loadState();
    const type = String((evt && evt.type) || "");
    if (!type) return { ok: false, reason: "no_type" };
    if (!typeAllowed(prefs, type)) return { ok: false, reason: "muted" };
    if (type === TYPES.TEST && o.force) return { ok: true, reason: "force" };

    const day = dayKey(now);
    let dayCount = st.dayCount || 0;
    if (st.day !== day) dayCount = 0;
    /* Pass-toll is gameplay-critical — skip day cap / global gap (place cooldown in PassToll). */
    const bypassThrottle = type === TYPES.PASS_TOLL || type === TYPES.TEST;
    if (!bypassThrottle && dayCount >= MAX_PER_DAY) return { ok: false, reason: "day_cap" };

    const gapType = TYPE_GAP_MS[type] != null ? TYPE_GAP_MS[type] : GLOBAL_GAP_MS;
    if (!bypassThrottle && st.lastAnyAt && now - st.lastAnyAt < GLOBAL_GAP_MS) {
      return { ok: false, reason: "global_gap" };
    }
    const lastT = Number(st.lastByType[type]) || 0;
    if (type !== TYPES.TEST && type !== TYPES.PASS_TOLL && lastT && now - lastT < gapType) {
      return { ok: false, reason: "type_gap" };
    }
    const placeId = evt && evt.placeId ? String(evt.placeId) : "";
    if (placeId && type !== TYPES.TEST && type !== TYPES.PASS_TOLL) {
      const pk = type + ":" + placeId;
      const lastP = Number(st.lastByPlace[pk]) || 0;
      if (lastP && now - lastP < PLACE_GAP_MS) return { ok: false, reason: "place_gap" };
    }
    return { ok: true, reason: "ok" };
  }

  function markSent(evt, opts) {
    const o = opts || {};
    const now = Number(o.now) || Date.now();
    const st = o.state || loadState();
    const type = String((evt && evt.type) || "");
    const day = dayKey(now);
    if (st.day !== day) {
      st.day = day;
      st.dayCount = 0;
    }
    if (type !== TYPES.TEST && type !== TYPES.PASS_TOLL) st.dayCount = (st.dayCount || 0) + 1;
    if (type !== TYPES.PASS_TOLL) st.lastAnyAt = now;
    st.lastByType = st.lastByType || {};
    st.lastByType[type] = now;
    const placeId = evt && evt.placeId ? String(evt.placeId) : "";
    if (placeId) {
      st.lastByPlace = st.lastByPlace || {};
      st.lastByPlace[type + ":" + placeId] = now;
    }
    if (!o.dry) saveState(st);
    return st;
  }

  function titleFor(evt) {
    const t = evt && evt.type;
    if (t === TYPES.CLAIM_SELF) return "Place claimed";
    if (t === TYPES.CLAIM_RIVAL) return "Rival claim";
    if (t === TYPES.NEARBY_CLAIMABLE) return "Place nearby";
    if (t === TYPES.ENEMY_NEARBY) return "Enemy asset nearby";
    if (t === TYPES.PASS_TOLL) return "Pass-by toll";
    if (t === TYPES.TOLL_OWNER) return "Toll on your place";
    if (t === TYPES.WATCH_CHANGE) return "Watchlist update";
    if (t === TYPES.THREAT_ACT) return "Threat moved";
    if (t === TYPES.TEST) return "Lvfe test";
    return "Lvfe";
  }

  function bodyFor(evt) {
    if (evt && evt.body) return String(evt.body);
    const name = (evt && evt.placeName) || "a place";
    const t = evt && evt.type;
    if (t === TYPES.CLAIM_SELF) return "You claimed " + name + ".";
    if (t === TYPES.CLAIM_RIVAL) return (evt.rivalName || "Someone") + " claimed " + name + ".";
    if (t === TYPES.NEARBY_CLAIMABLE) return name + " is open to claim near you.";
    if (t === TYPES.ENEMY_NEARBY) {
      return name + " is held by another side. Bid more NCN to contest, or ignore.";
    }
    if (t === TYPES.PASS_TOLL) {
      const amt = evt.charged != null ? evt.charged : evt.toll;
      return "Charged " + amt + " NCN at " + name + ". Outpay to contest, Escape (fee) to refund, or Accept.";
    }
    if (t === TYPES.TOLL_OWNER) {
      return (evt.passerName || "Someone") + " paid " + (evt.charged != null ? evt.charged : "?") +
        " NCN toll at " + name + ".";
    }
    if (t === TYPES.WATCH_CHANGE) return name + " changed on your watchlist.";
    if (t === TYPES.THREAT_ACT) {
      return (evt.threatName || "Threat") + " staked at " + name + ".";
    }
    if (t === TYPES.TEST) return evt.body || "Test notification.";
    return String(evt && evt.body || "Game update");
  }

  /** Payload for Android NotificationCompat / JS deep link. */
  function buildPayload(evt) {
    const type = String((evt && evt.type) || TYPES.TEST);
    const placeId = evt && evt.placeId ? String(evt.placeId) : "";
    const actions = [];
    if (type === TYPES.PASS_TOLL && placeId) {
      actions.push({ id: "bid", label: "Outpay" });
      actions.push({ id: "escape", label: "Escape" });
      actions.push({ id: "ignore", label: "Accept" });
    } else if (type === TYPES.ENEMY_NEARBY && placeId) {
      actions.push({ id: "bid", label: "Bid" });
      actions.push({ id: "ignore", label: "Ignore" });
    } else if (placeId) {
      actions.push({ id: "open", label: "Open" });
    }
    return {
      id: Math.abs(hashCode(type + ":" + placeId + ":" + (evt && evt.now || Date.now()))) % 100000,
      channel: channelFor(type),
      type: type,
      title: titleFor(evt),
      body: bodyFor(evt),
      placeId: placeId,
      action: evt && evt.action ? String(evt.action) : "open",
      actions: actions,
    };
  }

  function channelFor(type) {
    if (type === TYPES.CLAIM_SELF || type === TYPES.CLAIM_RIVAL) return "claims";
    if (type === TYPES.NEARBY_CLAIMABLE || type === TYPES.WATCH_CHANGE) return "nearby";
    if (type === TYPES.ENEMY_NEARBY || type === TYPES.PASS_TOLL || type === TYPES.THREAT_ACT) return "enemy";
    if (type === TYPES.TOLL_OWNER) return "claims";
    return "game";
  }

  function hashCode(s) {
    let h = 0;
    const str = String(s || "");
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return h;
  }

  function haversineM(lat1, lon1, lat2, lon2) {
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

  /**
   * Scan GPS neighbourhood for claimable / enemy assets.
   * rows: [{ id, name, lon, lat, ownable, ownerId, factionId }]
   */
  function scanNearby(rows, opts) {
    const o = opts || {};
    const lat = Number(o.lat);
    const lon = Number(o.lon);
    const playerKey = String(o.playerKey || "");
    const playerFaction = String(o.factionId || "");
    const radius = Number(o.radiusM) > 0 ? Number(o.radiusM) : NEARBY_RADIUS_M;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { claimable: null, enemy: null };

    let claimable = null;
    let enemy = null;
    const list = Array.isArray(rows) ? rows : [];
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (!r || !r.ownable) continue;
      const dist = haversineM(lat, lon, Number(r.lat), Number(r.lon));
      if (!(dist <= radius)) continue;
      if (!r.ownerId) {
        if (!claimable || dist < claimable.dist) {
          claimable = { placeId: r.id, placeName: r.name, dist: dist, type: TYPES.NEARBY_CLAIMABLE };
        }
      } else if (r.ownerId !== playerKey) {
        const rivalFac = String(r.factionId || "");
        const isEnemy = !playerFaction || !rivalFac || rivalFac !== playerFaction;
        if (isEnemy && (!enemy || dist < enemy.dist)) {
          enemy = {
            placeId: r.id,
            placeName: r.name,
            dist: dist,
            type: TYPES.ENEMY_NEARBY,
            rivalName: r.ownerName || "Rival",
          };
        }
      }
    }
    return { claimable: claimable, enemy: enemy };
  }

  /** Diff ownership maps: { placeId: ownerId } → rival claim events for this player. */
  function rivalClaimsFromDiff(before, after, opts) {
    const o = opts || {};
    const playerKey = String(o.playerKey || "");
    const names = o.names || {};
    const out = [];
    const a = after && typeof after === "object" ? after : {};
    const b = before && typeof before === "object" ? before : {};
    Object.keys(a).forEach(function (id) {
      const next = a[id];
      const prev = b[id] || "";
      if (!next || next === prev) return;
      if (next === playerKey) return;
      if (prev === playerKey || !prev) {
        out.push({
          type: TYPES.CLAIM_RIVAL,
          placeId: id,
          placeName: names[id] || id,
          rivalName: o.ownerNames && o.ownerNames[id] ? o.ownerNames[id] : "Rival",
        });
      }
    });
    return out;
  }

  const api = {
    PREFS_KEY,
    STATE_KEY,
    TYPES,
    GLOBAL_GAP_MS,
    TYPE_GAP_MS,
    PLACE_GAP_MS,
    MAX_PER_DAY,
    NEARBY_RADIUS_M,
    loadPrefs,
    savePrefs,
    loadState,
    saveState,
    canNotify,
    markSent,
    titleFor,
    bodyFor,
    buildPayload,
    channelFor,
    scanNearby,
    rivalClaimsFromDiff,
    haversineM,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfeGameNotify = api;
})(typeof window !== "undefined" ? window : globalThis);
