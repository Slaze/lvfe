/* Rank sigils / emblems — visual hierarchy for global + faction who’s-who.
   Points = staked NCN + owned places × 10 (same as faction who’s-who). */
(function (global) {
  const TIERS = [
    { id: "initiate", min: 0, label: "Initiate", hue: "#9aa0a6" },
    { id: "scout", min: 50, label: "Scout", hue: "#34c759" },
    { id: "pathfinder", min: 200, label: "Pathfinder", hue: "#1d8cff" },
    { id: "warden", min: 500, label: "Warden", hue: "#ff7a1a" },
    { id: "marshal", min: 1000, label: "Marshal", hue: "#b8893a" },
    { id: "sovereign", min: 2500, label: "Sovereign", hue: "#e8c36a" },
  ];

  const ROLES = {
    banner_lord: { id: "banner_lord", label: "Banner Lord", minRank: 1, maxRank: 1 },
    vanguard: { id: "vanguard", label: "Vanguard", minRank: 2, maxRank: 3 },
    kin: { id: "kin", label: "Kin", minRank: 4, maxRank: 9999 },
  };

  function pointsFrom(row) {
    if (!row) return 0;
    if (row.points != null && Number.isFinite(Number(row.points))) return Math.max(0, Math.floor(Number(row.points)));
    const staked = Math.floor(Number(row.staked) || 0);
    const owned = Math.floor(Number(row.owned) || 0);
    return staked + owned * 10;
  }

  function tierForPoints(pts) {
    const p = Math.max(0, Math.floor(Number(pts) || 0));
    let found = TIERS[0];
    for (let i = 0; i < TIERS.length; i++) {
      if (p >= TIERS[i].min) found = TIERS[i];
    }
    return found;
  }

  function roleForFactionRank(rank) {
    const r = Math.floor(Number(rank) || 0);
    if (r <= 0) return ROLES.kin;
    if (r === 1) return ROLES.banner_lord;
    if (r <= 3) return ROLES.vanguard;
    return ROLES.kin;
  }

  function classify(row, opts) {
    const o = opts || {};
    const pts = pointsFrom(row);
    const tier = tierForPoints(pts);
    const factionRank = o.factionRank != null ? o.factionRank : row && row.rank;
    const role = roleForFactionRank(factionRank);
    return {
      points: pts,
      tier: tier,
      role: role,
      label: tier.label + (role.id !== "kin" ? " · " + role.label : ""),
    };
  }

  function svgRing(hue) {
    return `<circle cx="16" cy="16" r="12" fill="none" stroke="${hue}" stroke-width="2.5"/>` +
      `<circle cx="16" cy="16" r="4" fill="${hue}"/>`;
  }

  function svgScout(hue) {
    return `<path d="M16 4 L26 24 L16 20 L6 24 Z" fill="${hue}" stroke="#0e1116" stroke-width="1"/>`;
  }

  function svgPathfinder(hue) {
    return `<circle cx="16" cy="16" r="11" fill="none" stroke="${hue}" stroke-width="2"/>` +
      `<path d="M16 6 V26 M6 16 H26" stroke="${hue}" stroke-width="1.6"/>` +
      `<circle cx="16" cy="16" r="2.5" fill="${hue}"/>`;
  }

  function svgWarden(hue) {
    return `<path d="M16 4 L26 9 V16 C26 22 20 26 16 28 C12 26 6 22 6 16 V9 Z" fill="${hue}" opacity=".9" stroke="#0e1116" stroke-width="1"/>` +
      `<path d="M16 10 V20 M12 14 H20" stroke="#0e1116" stroke-width="1.4" stroke-linecap="round"/>`;
  }

  function svgMarshal(hue) {
    return `<path d="M8 8 H24 V20 L16 26 L8 20 Z" fill="${hue}" stroke="#0e1116" stroke-width="1"/>` +
      `<path d="M12 8 V5 H20 V8" fill="none" stroke="${hue}" stroke-width="2"/>` +
      `<circle cx="16" cy="15" r="3" fill="#0e1116"/>`;
  }

  function svgSovereign(hue) {
    return `<path d="M6 12 L10 8 L16 12 L22 8 L26 12 L24 22 H8 Z" fill="${hue}" stroke="#0e1116" stroke-width="1"/>` +
      `<circle cx="10" cy="8" r="2" fill="${hue}"/><circle cx="16" cy="6" r="2.2" fill="${hue}"/><circle cx="22" cy="8" r="2" fill="${hue}"/>`;
  }

  function tierGlyph(tierId, hue) {
    const h = hue || "#b8893a";
    switch (tierId) {
      case "scout": return svgScout(h);
      case "pathfinder": return svgPathfinder(h);
      case "warden": return svgWarden(h);
      case "marshal": return svgMarshal(h);
      case "sovereign": return svgSovereign(h);
      default: return svgRing(h);
    }
  }

  function roleMark(roleId) {
    if (roleId === "banner_lord") {
      return `<path d="M4 4 V28 M4 4 H14 L12 8 L14 12 H4" fill="#ff7a1a" stroke="#0e1116" stroke-width=".5"/>`;
    }
    if (roleId === "vanguard") {
      return `<path d="M4 16 L10 10 L10 22 Z" fill="#1d8cff"/>`;
    }
    return "";
  }

  function emblemHtml(row, opts) {
    const c = classify(row, opts);
    const title = c.label + " · " + c.points + " pts";
    return (
      `<span class="sigil" data-tier="${c.tier.id}" data-role="${c.role.id}" title="${title}" aria-label="${title}">` +
      `<svg class="sigil-svg" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">` +
      tierGlyph(c.tier.id, c.tier.hue) +
      roleMark(c.role.id) +
      `</svg></span>`
    );
  }

  function compactMeta(row, opts) {
    const c = classify(row, opts);
    return {
      html: emblemHtml(row, opts),
      tierId: c.tier.id,
      tierLabel: c.tier.label,
      roleId: c.role.id,
      roleLabel: c.role.label,
      points: c.points,
      hue: c.tier.hue,
      label: c.label,
    };
  }

  const api = {
    TIERS,
    ROLES,
    pointsFrom,
    tierForPoints,
    roleForFactionRank,
    classify,
    emblemHtml,
    compactMeta,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfeRankSigils = api;
})(typeof window !== "undefined" ? window : globalThis);
