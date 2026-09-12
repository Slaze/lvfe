/* Neighbourhood conquest bonus. Ownership stays highest NairaCoin in that
   place (unchanged ledger). Display / cost / visit-interest example scale
   with how many places in that neighbourhood already have an owner.
   hinterland (territory_id unclaimed) gets no extra.
   Unknown (quality D / civic_unknown / unmapped) is the top quality tier:
   black X, intrinsic base above A/B/C. rec.value stays sum(stakes). */
(function (global) {
  const cfg = { maxBonus: 0, unknownIntrinsic: 100 };
  const HINTERLAND_ID = "unclaimed";
  const STORE = "lvfe.places.v1";
  const SELF_COLOR = "#1d8cff";
  const OTHER_COLOR = "#c0392b";
  const X_COLOR = "#ff3b30";
  const UNKNOWN_COLOR = "#111111";

  let cached = { byId: {}, max: 0 };

  function isHinterland(territoryId) {
    const id = String(territoryId || "");
    return !id || id === HINTERLAND_ID;
  }

  function rowProps(row) {
    if (!row) return {};
    if (row.properties && typeof row.properties === "object") return row.properties;
    return row;
  }

  function loadStored(stored) {
    if (stored && typeof stored === "object") return stored;
    try {
      const o = JSON.parse((typeof localStorage !== "undefined" && localStorage.getItem(STORE)) || "{}");
      return o && typeof o === "object" ? o : {};
    } catch (err) {
      return {};
    }
  }

  function listOf(rows) {
    if (!rows) return [];
    if (Array.isArray(rows.features)) return rows.features;
    if (Array.isArray(rows)) return rows;
    return [];
  }

  function ownedCounts(rows, stored) {
    const all = loadStored(stored);
    const byId = {};
    const list = listOf(rows);
    for (let i = 0; i < list.length; i++) {
      const p = rowProps(list[i]);
      const rec = all[p.id];
      if (!rec || !rec.ownerId) continue;
      const tid = p.territory_id || "";
      if (isHinterland(tid)) continue;
      byId[tid] = (byId[tid] || 0) + 1;
    }
    let max = 0;
    const keys = Object.keys(byId);
    for (let i = 0; i < keys.length; i++) {
      if (byId[keys[i]] > max) max = byId[keys[i]];
    }
    return { byId: byId, max: max };
  }

  function refresh(rows, stored) {
    cached = ownedCounts(rows, stored);
    return cached;
  }

  function get() {
    return cached;
  }

  function bonus(territoryId, counts) {
    const c = counts || cached;
    if (isHinterland(territoryId)) return 0;
    if (!c || !(c.max > 0)) return 0;
    const n = (c.byId && c.byId[territoryId]) || 0;
    return cfg.maxBonus * (n / c.max);
  }

  function scale(base, territoryId, counts) {
    const b = bonus(territoryId, counts);
    const n = Number(base);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n * (1 + b));
  }

  function isUnknownPlace(p) {
    const R = global.LvfeRules;
    if (R && typeof R.isUnknownPlace === "function") return R.isUnknownPlace(p);
    if (!p) return false;
    const q = String(p.quality || "");
    const t = String(p.catalog_type || p.type || "");
    return q === "D" || t === "civic_unknown" || t === "unmapped";
  }

  /** Ledger is rec.value (sum of stakes). Unknown unstaked still has a top-tier base. */
  function baseValue(rec, p) {
    const ledger = rec ? Number(rec.value) || 0 : 0;
    if (!isUnknownPlace(p)) return ledger;
    return Math.max(ledger, cfg.unknownIntrinsic);
  }

  function displayValue(rec, p, counts) {
    return scale(baseValue(rec, p), p && p.territory_id, counts);
  }

  function costToBack(baseMin, p, counts) {
    let base = Math.max(0, Number(baseMin) || 0);
    if (isUnknownPlace(p)) base = Math.max(base, cfg.unknownIntrinsic);
    if (!(base > 0)) return 0;
    const scaled = scale(base, p && p.territory_id, counts);
    return Math.max(1, scaled);
  }

  function markKind(rec, playerKey, p) {
    if (rec && rec.ownerId) {
      if (rec.ownerId === playerKey) return "self";
      return "other";
    }
    if (isUnknownPlace(p)) return "unknown";
    return "x";
  }

  function markColor(rec, playerKey, factionColors, p) {
    const kind = markKind(rec, playerKey, p);
    if (kind === "unknown") return UNKNOWN_COLOR;
    if (kind === "x") return X_COLOR;
    if (kind === "self") return SELF_COLOR;
    const fac = rec && rec.factionId;
    if (fac && factionColors && factionColors[fac]) return factionColors[fac];
    return OTHER_COLOR;
  }

  function stampFeature(feat, rec, playerKey, factionColors) {
    if (!feat || !feat.properties) return feat;
    const p = feat.properties;
    p.owner_mark = markKind(rec, playerKey, p);
    p.mark_color = markColor(rec, playerKey, factionColors, p);
    return feat;
  }

  const api = {
    get MAX_BONUS() { return cfg.maxBonus; },
    HINTERLAND_ID,
    SELF_COLOR,
    OTHER_COLOR,
    X_COLOR,
    UNKNOWN_COLOR,
    get UNKNOWN_INTRINSIC() { return cfg.unknownIntrinsic; },
    isUnknownPlace,
    isHinterland,
    ownedCounts,
    refresh,
    get,
    bonus,
    scale,
    baseValue,
    displayValue,
    costToBack,
    markKind,
    markColor,
    stampFeature,
    applyConfig: function (o) {
      if (!o) return;
      const b = Number(o.maxBonus);
      const u = Number(o.unknownFloor);
      if (Number.isFinite(b) && b >= 0) cfg.maxBonus = b;
      if (Number.isFinite(u) && u >= 0) cfg.unknownIntrinsic = u;
    },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfeConquest = api;
})(typeof window !== "undefined" ? window : globalThis);
