/* Local marks: watch places, threat players, takeover plans.
   Persists to lvfe.marks.v1; included in save pack when account wires marks. */
(function (global) {
  const MARKS_KEY = "lvfe.marks.v1";
  const SNAP_KEY = "lvfe.marks.snap.v1";

  function storage() {
    if (typeof localStorage === "undefined") {
      if (!global.__lvfeMarksMem) global.__lvfeMarksMem = {};
      const mem = global.__lvfeMarksMem;
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

  function empty() {
    return { watchPlaces: {}, threats: {}, takeovers: {} };
  }

  function load() {
    const o = lsGet(MARKS_KEY, null);
    const base = empty();
    if (!o || typeof o !== "object") return base;
    base.watchPlaces = o.watchPlaces && typeof o.watchPlaces === "object" ? o.watchPlaces : {};
    base.threats = o.threats && typeof o.threats === "object" ? o.threats : {};
    base.takeovers = o.takeovers && typeof o.takeovers === "object" ? o.takeovers : {};
    return base;
  }

  function save(marks) {
    const m = marks && typeof marks === "object" ? marks : empty();
    lsSet(MARKS_KEY, {
      watchPlaces: m.watchPlaces || {},
      threats: m.threats || {},
      takeovers: m.takeovers || {},
    });
    return load();
  }

  function markPlace(placeId, meta) {
    const m = load();
    const id = String(placeId || "");
    if (!id) return m;
    const prev = m.watchPlaces[id] || {};
    m.watchPlaces[id] = Object.assign({}, prev, {
      placeId: id,
      name: (meta && meta.name) || prev.name || id,
      lat: meta && Number.isFinite(Number(meta.lat)) ? Number(meta.lat) : prev.lat,
      lon: meta && Number.isFinite(Number(meta.lon)) ? Number(meta.lon) : prev.lon,
      lastValue: meta && meta.lastValue != null ? Number(meta.lastValue) : prev.lastValue,
      lastOwnerId: meta && meta.lastOwnerId != null ? String(meta.lastOwnerId) : prev.lastOwnerId,
      lastOwnerName: (meta && meta.lastOwnerName) || prev.lastOwnerName || "",
      at: (meta && meta.at) || new Date().toISOString(),
      notify: meta && meta.notify === false ? false : (prev.notify !== false),
    });
    return save(m);
  }

  function unmarkPlace(placeId) {
    const m = load();
    delete m.watchPlaces[String(placeId)];
    return save(m);
  }

  function isWatchingPlace(placeId) {
    return Boolean(load().watchPlaces[String(placeId)]);
  }

  function markThreat(playerId, meta) {
    const m = load();
    const id = String(playerId || "");
    if (!id) return m;
    const prev = m.threats[id] || {};
    m.threats[id] = Object.assign({}, prev, {
      playerId: id,
      name: (meta && meta.name) || prev.name || id,
      at: (meta && meta.at) || new Date().toISOString(),
      notify: meta && meta.notify === false ? false : (prev.notify !== false),
    });
    return save(m);
  }

  function unmarkThreat(playerId) {
    const m = load();
    delete m.threats[String(playerId)];
    return save(m);
  }

  function isThreat(playerId) {
    return Boolean(load().threats[String(playerId)]);
  }

  function planTakeover(placeId, meta) {
    const m = load();
    const id = String(placeId || "");
    if (!id) return m;
    const prev = m.takeovers[id] || {};
    m.takeovers[id] = Object.assign({}, prev, {
      placeId: id,
      name: (meta && meta.name) || prev.name || id,
      lat: meta && Number.isFinite(Number(meta.lat)) ? Number(meta.lat) : prev.lat,
      lon: meta && Number.isFinite(Number(meta.lon)) ? Number(meta.lon) : prev.lon,
      ownerName: (meta && meta.ownerName) || prev.ownerName || "",
      at: (meta && meta.at) || new Date().toISOString(),
    });
    return save(m);
  }

  function unplanTakeover(placeId) {
    const m = load();
    delete m.takeovers[String(placeId)];
    return save(m);
  }

  function isTakeover(placeId) {
    return Boolean(load().takeovers[String(placeId)]);
  }

  function watchList() {
    const m = load();
    return Object.keys(m.watchPlaces).map(function (k) { return m.watchPlaces[k]; })
      .sort(function (a, b) { return String(b.at || "").localeCompare(String(a.at || "")); });
  }

  function threatList() {
    const m = load();
    return Object.keys(m.threats).map(function (k) { return m.threats[k]; })
      .sort(function (a, b) { return String(b.at || "").localeCompare(String(a.at || "")); });
  }

  function takeoverList() {
    const m = load();
    return Object.keys(m.takeovers).map(function (k) { return m.takeovers[k]; })
      .sort(function (a, b) { return String(b.at || "").localeCompare(String(a.at || "")); });
  }

  function loadSnap() {
    return lsGet(SNAP_KEY, { places: {} }) || { places: {} };
  }

  function saveSnap(snap) {
    lsSet(SNAP_KEY, snap || { places: {} });
  }

  /**
   * Diff ledger against last snap for watched places + threat actors.
   * Returns notify-ready events; updates snap when dry=false.
   */
  function diffWatches(places, opts) {
    const o = opts || {};
    const all = places && typeof places === "object" ? places : {};
    const marks = load();
    const snap = loadSnap();
    const prev = snap.places && typeof snap.places === "object" ? snap.places : {};
    const events = [];
    const next = {};

    Object.keys(marks.watchPlaces).forEach(function (id) {
      const rec = all[id] || {};
      const value = Number(rec.value) || 0;
      const ownerId = rec.ownerId ? String(rec.ownerId) : "";
      const ownerName = rec.ownerName || ownerId || "";
      next[id] = { value: value, ownerId: ownerId, ownerName: ownerName };
      const before = prev[id];
      if (!before) return;
      const w = marks.watchPlaces[id];
      if (w && w.notify === false) return;
      if (Number(before.value) !== value) {
        events.push({
          kind: "watch_value",
          placeId: id,
          placeName: w.name || id,
          from: Number(before.value) || 0,
          to: value,
        });
      }
      if (String(before.ownerId || "") !== ownerId) {
        events.push({
          kind: "watch_owner",
          placeId: id,
          placeName: w.name || id,
          fromOwner: before.ownerName || before.ownerId || "",
          toOwner: ownerName || "open",
          toOwnerId: ownerId,
        });
      }
    });

    /* Threat acts on any place you own or watch / plan. */
    const careIds = {};
    Object.keys(marks.watchPlaces).forEach(function (id) { careIds[id] = true; });
    Object.keys(marks.takeovers).forEach(function (id) { careIds[id] = true; });
    const playerKey = String(o.playerKey || "");
    Object.keys(all).forEach(function (id) {
      const rec = all[id];
      if (!rec) return;
      if (rec.ownerId === playerKey) careIds[id] = true;
      const st = rec.stakes || {};
      Object.keys(marks.threats).forEach(function (tid) {
        if (!st[tid]) return;
        const before = prev[id];
        const amt = Number(st[tid].amount) || 0;
        const prevAmt = before && before.threatStakes && Number(before.threatStakes[tid]) || 0;
        if (!next[id]) {
          next[id] = {
            value: Number(rec.value) || 0,
            ownerId: rec.ownerId ? String(rec.ownerId) : "",
            ownerName: rec.ownerName || "",
            threatStakes: {},
          };
        }
        next[id].threatStakes = next[id].threatStakes || {};
        next[id].threatStakes[tid] = amt;
        if (!(careIds[id] || amt > prevAmt)) return;
        if (amt > prevAmt && marks.threats[tid] && marks.threats[tid].notify !== false) {
          events.push({
            kind: "threat_act",
            placeId: id,
            placeName: (marks.watchPlaces[id] && marks.watchPlaces[id].name) ||
              (marks.takeovers[id] && marks.takeovers[id].name) || id,
            threatId: tid,
            threatName: marks.threats[tid].name || tid,
            amount: amt,
            delta: amt - prevAmt,
          });
        }
      });
    });

    /* Keep threat stake snaps for cared places. */
    Object.keys(careIds).forEach(function (id) {
      const rec = all[id];
      if (!rec) return;
      if (!next[id]) {
        next[id] = {
          value: Number(rec.value) || 0,
          ownerId: rec.ownerId ? String(rec.ownerId) : "",
          ownerName: rec.ownerName || "",
          threatStakes: {},
        };
      }
      next[id].threatStakes = next[id].threatStakes || {};
      Object.keys(marks.threats).forEach(function (tid) {
        const amt = Number(rec.stakes && rec.stakes[tid] && rec.stakes[tid].amount) || 0;
        next[id].threatStakes[tid] = amt;
      });
    });

    if (!o.dry) saveSnap({ places: next });
    return events;
  }

  function enrichTakeovers(list, opts) {
    const o = opts || {};
    const lat = Number(o.lat);
    const lon = Number(o.lon);
    const N = global.LvfeGameNotify;
    const hav = N && N.haversineM ? N.haversineM.bind(N) : null;
    return (Array.isArray(list) ? list : []).map(function (row) {
      let dist = Infinity;
      if (hav && Number.isFinite(lat) && Number.isFinite(lon) &&
          Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lon))) {
        dist = hav(lat, lon, Number(row.lat), Number(row.lon));
      }
      return Object.assign({}, row, { dist: dist });
    }).sort(function (a, b) {
      if (Number.isFinite(a.dist) && Number.isFinite(b.dist) && a.dist !== b.dist) return a.dist - b.dist;
      return String(b.at || "").localeCompare(String(a.at || ""));
    });
  }

  const api = {
    MARKS_KEY,
    SNAP_KEY,
    load,
    save,
    empty,
    markPlace,
    unmarkPlace,
    isWatchingPlace,
    markThreat,
    unmarkThreat,
    isThreat,
    planTakeover,
    unplanTakeover,
    isTakeover,
    watchList,
    threatList,
    takeoverList,
    diffWatches,
    enrichTakeovers,
    loadSnap,
    saveSnap,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfeGameMarks = api;
})(typeof window !== "undefined" ? window : globalThis);
