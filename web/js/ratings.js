/* 1–5 star ratings after check-in. Average on pin + place file. */
(function (global) {
  const STORE = "lvfe.ratings.v1";

  function storage() {
    if (typeof localStorage === "undefined") {
      if (!global.__lvfeRateMem) global.__lvfeRateMem = {};
      const mem = global.__lvfeRateMem;
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
        setItem: function (k, v) { mem[k] = String(v); },
      };
    }
    return localStorage;
  }

  function load() {
    try {
      const o = JSON.parse(storage().getItem(STORE) || "null");
      return o && typeof o === "object" ? o : {};
    } catch (err) {
      return {};
    }
  }

  function save(all) {
    storage().setItem(STORE, JSON.stringify(all));
  }

  function key(locationId, playerId) {
    return String(locationId || "") + "::" + String(playerId || "");
  }

  function rate(opts) {
    const o = opts || {};
    const lid = String(o.locationId || o.placeId || "");
    const pid = String(o.playerId || o.playerKey || "");
    const stars = Math.floor(Number(o.stars));
    const text = String(o.text || "").slice(0, 400);
    if (!lid || !pid) return { ok: false, reason: "missing_ids" };
    if (!(stars >= 1 && stars <= 5)) return { ok: false, reason: "stars_1_5" };
    const Prog = global.LvfeProgression;
    if (Prog) {
      const gate = Prog.canCheckIn({ playerId: pid, locationId: lid, now: o.now });
      const st = Prog.load();
      const last = (function () {
        const list = st.checkIns || [];
        for (let i = list.length - 1; i >= 0; i--) {
          if (list[i] && list[i].playerId === pid && list[i].locationId === lid) return list[i];
        }
        return null;
      })();
      if (!last) return { ok: false, reason: "check_in_required" };
    }
    const all = load();
    all[key(lid, pid)] = {
      locationId: lid,
      playerId: pid,
      stars: stars,
      text: text,
      createdAt: new Date(Number(o.now) || Date.now()).toISOString(),
    };
    save(all);
    const avg = average(lid);
    if (Prog) {
      const st = Prog.load();
      const loc = st.locations[lid];
      if (loc) {
        loc.avgRating = avg.avg;
        loc.ratingCount = avg.count;
        Prog.save(st);
      }
    }
    return { ok: true, stars: stars, average: avg };
  }

  function listFor(locationId) {
    const lid = String(locationId || "");
    const all = load();
    const out = [];
    Object.keys(all).forEach(function (k) {
      const row = all[k];
      if (row && row.locationId === lid) out.push(row);
    });
    out.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    return out;
  }

  function average(locationId) {
    const rows = listFor(locationId);
    if (!rows.length) return { avg: null, count: 0, high: false };
    let sum = 0;
    rows.forEach(function (r) { sum += Number(r.stars) || 0; });
    const avg = Math.round((sum / rows.length) * 10) / 10;
    return { avg: avg, count: rows.length, high: avg >= 4.5 };
  }

  function starsHtml(avg, count) {
    if (avg == null) return "No ratings yet";
    const n = Number(avg);
    const full = Math.round(n);
    let s = "";
    for (let i = 1; i <= 5; i++) s += i <= full ? "★" : "☆";
    return s + " " + n.toFixed(1) + (count ? " (" + count + ")" : "");
  }

  const api = {
    STORE: STORE,
    rate: rate,
    listFor: listFor,
    average: average,
    starsHtml: starsHtml,
    load: load,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.LvfeRatings = api;
})(typeof window !== "undefined" ? window : globalThis);
