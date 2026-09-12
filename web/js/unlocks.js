/* Rank-gated features: bookmarks (Scout), photo tips (Pathfinder),
   photo challenges (Warden), partner-location apply (Marshal+). */
(function (global) {
  const BOOK_KEY = "lvfe.bookmarks.v1";
  const TIPS_KEY = "lvfe.tips.v1";
  const CHAL_KEY = "lvfe.challenges.v1";

  const FEATURES = {
    bookmark: { minTier: "scout", label: "Bookmark locations" },
    tips: { minTier: "pathfinder", label: "Add photo tips" },
    challenges: { minTier: "warden", label: "Host photo challenges" },
    sponsorship: { minTier: "marshal", label: "Apply for partner location" },
  };

  const TIER_ORDER = ["initiate", "scout", "pathfinder", "warden", "marshal", "sovereign"];

  function storage() {
    if (typeof localStorage === "undefined") {
      if (!global.__lvfeUnlockMem) global.__lvfeUnlockMem = {};
      const mem = global.__lvfeUnlockMem;
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
        setItem: function (k, v) { mem[k] = String(v); },
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

  function tierIdFromScore(score) {
    const Sig = global.LvfeRankSigils;
    if (Sig && typeof Sig.tierForPoints === "function") {
      return Sig.tierForPoints(score).id;
    }
    const n = Math.max(0, Math.floor(Number(score) || 0));
    if (n >= 2500) return "sovereign";
    if (n >= 1000) return "marshal";
    if (n >= 500) return "warden";
    if (n >= 200) return "pathfinder";
    if (n >= 50) return "scout";
    return "initiate";
  }

  function tierIndex(id) {
    const i = TIER_ORDER.indexOf(String(id || "initiate"));
    return i < 0 ? 0 : i;
  }

  function canUse(feature, score) {
    const spec = FEATURES[feature];
    if (!spec) return { ok: false, reason: "unknown_feature" };
    const have = tierIdFromScore(score);
    if (tierIndex(have) >= tierIndex(spec.minTier)) {
      return { ok: true, tier: have, feature: feature };
    }
    return { ok: false, reason: "locked", need: spec.minTier, have: have, label: spec.label };
  }

  function bookmark(playerId, locationId, score) {
    const gate = canUse("bookmark", score);
    if (!gate.ok) return gate;
    const pid = String(playerId || "");
    const lid = String(locationId || "");
    if (!pid || !lid) return { ok: false, reason: "missing_ids" };
    const all = lsGet(BOOK_KEY, {});
    const mine = all[pid] && typeof all[pid] === "object" ? all[pid] : {};
    if (mine[lid]) {
      delete mine[lid];
      all[pid] = mine;
      lsSet(BOOK_KEY, all);
      return { ok: true, on: false, locationId: lid };
    }
    mine[lid] = { locationId: lid, at: new Date().toISOString() };
    all[pid] = mine;
    lsSet(BOOK_KEY, all);
    return { ok: true, on: true, locationId: lid };
  }

  function isBookmarked(playerId, locationId) {
    const all = lsGet(BOOK_KEY, {});
    const mine = all[String(playerId || "")] || {};
    return Boolean(mine[String(locationId || "")]);
  }

  function addTip(opts) {
    const o = opts || {};
    const gate = canUse("tips", o.score);
    if (!gate.ok) return gate;
    const text = String(o.text || "").trim().slice(0, 280);
    if (!text) return { ok: false, reason: "empty" };
    const lid = String(o.locationId || o.placeId || "");
    const pid = String(o.playerId || o.playerKey || "");
    if (!lid || !pid) return { ok: false, reason: "missing_ids" };
    const all = lsGet(TIPS_KEY, {});
    const list = Array.isArray(all[lid]) ? all[lid] : [];
    list.unshift({
      locationId: lid,
      playerId: pid,
      text: text,
      createdAt: new Date(Number(o.now) || Date.now()).toISOString(),
    });
    all[lid] = list.slice(0, 40);
    lsSet(TIPS_KEY, all);
    const Prog = global.LvfeProgression;
    if (Prog) {
      const st = Prog.load();
      const loc = st.locations[lid];
      if (loc && !loc.insight) {
        loc.insight = text;
        Prog.save(st);
      }
    }
    return { ok: true, tip: list[0] };
  }

  function tipsFor(locationId) {
    const all = lsGet(TIPS_KEY, {});
    return Array.isArray(all[String(locationId || "")]) ? all[String(locationId || "")] : [];
  }

  function hostChallenge(opts) {
    const o = opts || {};
    const gate = canUse("challenges", o.score);
    if (!gate.ok) return gate;
    const title = String(o.title || "").trim().slice(0, 120);
    if (!title) return { ok: false, reason: "empty" };
    const list = lsGet(CHAL_KEY, { items: [] });
    const items = Array.isArray(list.items) ? list.items : [];
    const row = {
      id: "ch_" + Date.now(),
      hostId: String(o.playerId || o.playerKey || ""),
      title: title,
      city: String(o.city || "").slice(0, 80),
      deadline: String(o.deadline || ""),
      createdAt: new Date(Number(o.now) || Date.now()).toISOString(),
    };
    items.unshift(row);
    lsSet(CHAL_KEY, { items: items.slice(0, 40) });
    return { ok: true, challenge: row };
  }

  function challenges() {
    const list = lsGet(CHAL_KEY, { items: [] });
    return Array.isArray(list.items) ? list.items : [];
  }

  const api = {
    FEATURES: FEATURES,
    canUse: canUse,
    tierIdFromScore: tierIdFromScore,
    bookmark: bookmark,
    isBookmarked: isBookmarked,
    addTip: addTip,
    tipsFor: tipsFor,
    hostChallenge: hostChallenge,
    challenges: challenges,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.LvfeUnlocks = api;
})(typeof window !== "undefined" ? window : globalThis);
