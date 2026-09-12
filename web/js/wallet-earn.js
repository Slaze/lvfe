/* Wallet summary, earn missions, activity log, territory analytics.
   Uses place-ledger yield rules + conquest cost scaling. */
(function (global) {
  const ACTIVITY_KEY = "lvfe.activity.v1";
  const MAX_ACTIVITY = 40;

  function storage() {
    if (typeof localStorage === "undefined") {
      if (!global.__lvfeWalletMem) global.__lvfeWalletMem = {};
      const mem = global.__lvfeWalletMem;
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

  function ncn(n) {
    const R = global.LvfeRules;
    if (R && typeof R.ncn === "function") return R.ncn(n);
    const v = Math.round(Number(n));
    return (Number.isFinite(v) ? v : 0) + " NCN";
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

  /**
   * Min additional NCN to deposit so player becomes (or stays) highest stake.
   * Highest total stake owns. Banks/ATMs should be filtered by caller (not ownable).
   */
  function bidToOwn(rec, playerKey, minStakeBase) {
    const minBase = Math.max(1, Math.floor(Number(minStakeBase)) || 1);
    const mine = Number(rec && rec.stakes && rec.stakes[playerKey] && rec.stakes[playerKey].amount) || 0;
    const ownerId = rec && rec.ownerId ? String(rec.ownerId) : "";
    if (!ownerId || ownerId === playerKey) {
      if (mine > 0) return { add: 1, targetTotal: mine + 1, ownerStake: mine, overturn: false };
      return { add: minBase, targetTotal: minBase, ownerStake: 0, overturn: false };
    }
    const ownerStake = Number(rec.stakes[ownerId] && rec.stakes[ownerId].amount) || 0;
    const targetTotal = ownerStake + 1;
    const add = Math.max(minBase, targetTotal - mine);
    return {
      add: add,
      targetTotal: mine + add,
      ownerStake: ownerStake,
      overturn: true,
      ownerId: ownerId,
      ownerName: rec.ownerName || ownerId,
    };
  }

  function stakesOut(playerKey, places) {
    const pk = String(playerKey || "");
    const all = places && typeof places === "object" ? places : {};
    let total = 0;
    let owned = 0;
    let backed = 0;
    const rows = [];
    Object.keys(all).forEach(function (id) {
      const rec = all[id];
      const st = rec && rec.stakes && rec.stakes[pk];
      const amt = Number(st && st.amount) || 0;
      if (!(amt > 0)) return;
      const isOwner = rec.ownerId === pk;
      if (isOwner) owned += 1;
      else backed += 1;
      total += amt;
      rows.push({
        placeId: id,
        amount: amt,
        owned: isOwner,
        ownerName: rec.ownerName || "",
        value: Number(rec.value) || 0,
      });
    });
    rows.sort(function (a, b) { return b.amount - a.amount; });
    return { total: total, owned: owned, backed: backed, rows: rows };
  }

  function loadActivity() {
    const o = lsGet(ACTIVITY_KEY, { items: [] });
    return Array.isArray(o.items) ? o.items : [];
  }

  function appendActivity(entry) {
    const items = loadActivity();
    const row = Object.assign({
      at: new Date().toISOString(),
      kind: "stake",
    }, entry || {});
    items.unshift(row);
    while (items.length > MAX_ACTIVITY) items.pop();
    lsSet(ACTIVITY_KEY, { items: items });
    return items;
  }

  function clearActivity() {
    lsSet(ACTIVITY_KEY, { items: [] });
  }

  /** Estimated owner earn when someone else backs with `visitAmount`. */
  function visitYieldExample(visitAmount) {
    const L = global.LvfePlaceLedger;
    const a = Math.floor(Number(visitAmount)) || 0;
    if (!(a > 0)) return { yieldPaid: 0, ownerPaid: 0, factionPaid: 0 };
    if (L && typeof L.splitIncomingStake === "function") {
      const split = L.splitIncomingStake(
        { ownerId: "other", factionId: "x", stakes: {} },
        "visitor",
        a,
      );
      return {
        yieldPaid: split.yieldPaid,
        ownerPaid: split.ownerPaid,
        factionPaid: split.factionPaid,
        intoPlace: split.intoPlace,
      };
    }
    const y = Math.max(1, Math.round(a * 0.1));
    const fac = Math.round(y * 0.2);
    return { yieldPaid: y, ownerPaid: y - fac, factionPaid: fac, intoPlace: a - y };
  }

  function howEarnCopy() {
    return {
      short:
        "Claim with NCN. Highest stake owns. Check in for XP — you get 100%, the owner gets 20% referral XP. No walk-through tolls.",
      long:
        "Real map places. Banks/ATMs are landmarks only. Track → walk inside 80 m → photo (first time) → Claim / Bid. Highest NCN stake owns. Check-in grants XP (visitor 100%, owner 20% referral). One check-in per place per 24 h. Neighbourhoods are exploration badges (20 unique pins), not a tax. Rank = places×10 + XP + check-ins last 30 days×5.",
    };
  }

  /**
   * Missions near GPS: claimable / overturnable ownable places.
   * features: GeoJSON features or props with id, name, lon/lat or geometry, catalog_type, claim_points
   */
  function earnMissions(features, places, opts) {
    const o = opts || {};
    const lat = Number(o.lat);
    const lon = Number(o.lon);
    const playerKey = String(o.playerKey || "");
    const radius = Number(o.radiusM) > 0 ? Number(o.radiusM) : 500;
    const R = global.LvfeRules;
    const W = global.LvfeCatalogWallet;
    const C = global.LvfeConquest;
    const all = places && typeof places === "object" ? places : {};
    const list = Array.isArray(features)
      ? features
      : (features && features.features) || [];
    const out = [];

    for (let i = 0; i < list.length; i++) {
      const feat = list[i];
      const p = feat.properties || feat;
      if (R && typeof R.isOwnable === "function" && !R.isOwnable(p)) continue;
      if (!R && (p.catalog_type === "bank" || p.catalog_type === "atm")) continue;
      let plat = Number(p.lat);
      let plon = Number(p.lon);
      if (feat.geometry && feat.geometry.coordinates) {
        plon = Number(feat.geometry.coordinates[0]);
        plat = Number(feat.geometry.coordinates[1]);
      }
      if (!Number.isFinite(plat) || !Number.isFinite(plon)) continue;
      let dist = Infinity;
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        dist = haversineM(lat, lon, plat, plon);
        if (dist > radius) continue;
      }
      const rec = all[p.id] || { stakes: {}, value: 0, ownerId: "" };
      const pts = p.claim_points != null ? p.claim_points : p.claim_nairacoin;
      let min = W ? W.minStake(pts, p.catalog_type) : Math.max(5, Number(pts) || 5);
      if (C && min > 0) min = C.costToBack(min, p, o.conquest || (C.get && C.get()));
      const bid = bidToOwn(rec, playerKey, min);
      const y = visitYieldExample(min);
      out.push({
        placeId: p.id,
        name: (R && R.placeTitle) ? R.placeTitle(p) : (p.name || p.id),
        dist: dist,
        cost: bid.add,
        overturn: bid.overturn,
        ownerName: bid.ownerName || "",
        estOwnerEarnOnVisit: y.ownerPaid,
        minStake: min,
        lat: plat,
        lon: plon,
      });
    }
    out.sort(function (a, b) {
      if (Number.isFinite(a.dist) && Number.isFinite(b.dist) && a.dist !== b.dist) return a.dist - b.dist;
      return a.cost - b.cost;
    });
    return out;
  }

  function territoryControl(features, places, factionNames) {
    const Rank = global.LvfeRankings;
    if (Rank && typeof Rank.cityByTerritory === "function") {
      return Rank.cityByTerritory(features, places, factionNames);
    }
    return [];
  }

  function rivalPressure(features, places, opts) {
    const o = opts || {};
    const lat = Number(o.lat);
    const lon = Number(o.lon);
    const playerKey = String(o.playerKey || "");
    const radius = Number(o.radiusM) > 0 ? Number(o.radiusM) : 400;
    const R = global.LvfeRules;
    const all = places && typeof places === "object" ? places : {};
    const list = Array.isArray(features) ? features : (features && features.features) || [];
    const out = [];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return out;
    for (let i = 0; i < list.length; i++) {
      const feat = list[i];
      const p = feat.properties || feat;
      if (R && R.isOwnable && !R.isOwnable(p)) continue;
      const coords = feat.geometry && feat.geometry.coordinates;
      const plon = coords ? Number(coords[0]) : Number(p.lon);
      const plat = coords ? Number(coords[1]) : Number(p.lat);
      const dist = haversineM(lat, lon, plat, plon);
      if (!(dist <= radius)) continue;
      const rec = all[p.id];
      if (!rec || !rec.ownerId || rec.ownerId === playerKey) continue;
      out.push({
        placeId: p.id,
        name: (R && R.placeTitle) ? R.placeTitle(p) : (p.name || p.id),
        dist: dist,
        ownerName: rec.ownerName || rec.ownerId,
        factionId: rec.factionId || "",
        value: Number(rec.value) || 0,
      });
    }
    out.sort(function (a, b) { return a.dist - b.dist; });
    return out;
  }

  function yourClaims(playerKey, places, features) {
    const so = stakesOut(playerKey, places);
    const names = {};
    const list = Array.isArray(features) ? features : (features && features.features) || [];
    for (let i = 0; i < list.length; i++) {
      const p = list[i].properties || list[i];
      if (p && p.id) names[p.id] = p.name || p.id;
    }
    return so.rows.map(function (r) {
      return Object.assign({}, r, { name: names[r.placeId] || r.placeId });
    });
  }

  const api = {
    ACTIVITY_KEY,
    ncn,
    bidToOwn,
    stakesOut,
    loadActivity,
    appendActivity,
    clearActivity,
    visitYieldExample,
    howEarnCopy,
    earnMissions,
    territoryControl,
    rivalPressure,
    yourClaims,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfeWalletEarn = api;
})(typeof window !== "undefined" ? window : globalThis);
