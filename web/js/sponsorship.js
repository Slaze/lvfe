/* Partner-location sponsorship. Eligible at 50+ unique visitors (landmark).
   Monthly featured pin. Split: platform 30%, curator (top stakeholder) 10%. */
(function (global) {
  const STORE = "lvfe.sponsorships.v1";
  const cfg = {
    uniqueNeed: 50,
    platformPct: 0.3,
    curatorPct: 0.1,
    monthMs: 30 * 24 * 60 * 60 * 1000,
  };

  function storage() {
    if (typeof localStorage === "undefined") {
      if (!global.__lvfeSponMem) global.__lvfeSponMem = {};
      const mem = global.__lvfeSponMem;
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
      return o && Array.isArray(o.items) ? o : { items: [] };
    } catch (err) {
      return { items: [] };
    }
  }

  function save(doc) {
    storage().setItem(STORE, JSON.stringify(doc));
  }

  function eligible(locationId, opts) {
    const Prog = global.LvfeProgression;
    const st = (opts && opts.state) || (Prog ? Prog.load() : { locations: {} });
    const loc = st.locations[String(locationId || "")];
    const uniq = loc ? Number(loc.uniqueVisitors) || 0 : 0;
    const tier = loc && Prog ? Prog.locationTier(loc) : { landmark: uniq >= cfg.uniqueNeed };
    return {
      ok: uniq >= cfg.uniqueNeed && Boolean(tier.landmark || uniq >= cfg.uniqueNeed),
      uniqueVisitors: uniq,
      need: cfg.uniqueNeed,
    };
  }

  function splitAmount(amount) {
    const a = Math.max(0, Math.floor(Number(amount) || 0));
    const platform = Math.round(a * cfg.platformPct);
    const curator = Math.round(a * cfg.curatorPct);
    return { amount: a, platform: platform, curator: curator, remainder: a - platform - curator };
  }

  function apply(opts) {
    const o = opts || {};
    const Unlock = global.LvfeUnlocks;
    if (Unlock) {
      const gate = Unlock.canUse("sponsorship", o.score);
      if (!gate.ok) return gate;
    }
    const lid = String(o.locationId || o.placeId || "");
    const el = eligible(lid, o);
    if (!el.ok) return { ok: false, reason: "not_landmark", uniqueVisitors: el.uniqueVisitors, need: el.need };
    const amount = Math.max(0, Math.floor(Number(o.amount) || 0));
    const parts = splitAmount(amount);
    const now = Number(o.now) || Date.now();
    const start = new Date(now).toISOString();
    const end = new Date(now + cfg.monthMs).toISOString();
    const row = {
      locationId: lid,
      businessId: String(o.businessId || o.playerId || ""),
      amount: parts.amount,
      platformShare: parts.platform,
      curatorShare: parts.curator,
      curatorId: String(o.curatorId || o.ownerId || ""),
      startDate: start,
      endDate: end,
      createdAt: start,
    };
    const doc = load();
    doc.items.unshift(row);
    doc.items = doc.items.slice(0, 80);
    save(doc);
    const Prog = global.LvfeProgression;
    if (Prog) {
      const st = Prog.load();
      const loc = st.locations[lid];
      if (loc) {
        loc.sponsoredUntil = end;
        Prog.save(st);
      }
    }
    return { ok: true, sponsorship: row, split: parts };
  }

  function isFeatured(locationId, now) {
    const t = Number(now) || Date.now();
    const lid = String(locationId || "");
    const items = load().items;
    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      if (!row || row.locationId !== lid) continue;
      const end = Date.parse(row.endDate) || 0;
      if (end > t) return row;
    }
    return null;
  }

  const api = {
    STORE: STORE,
    eligible: eligible,
    splitAmount: splitAmount,
    apply: apply,
    isFeatured: isFeatured,
    load: load,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.LvfeSponsorship = api;
})(typeof window !== "undefined" ? window : globalThis);
