/* Shared GPS / catalog helpers. OSM + device GPS is the world.
   Banks/ATMs are not ownable. No extractive check-in payout. */
(function (global) {
  const CLAIM_RADIUS_M = 80;
  const NO_FARM = { bank: true, atm: true };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function qualityLabel(q) {
    if (q === "A") return "photo";
    if (q === "B") return "named";
    if (q === "C") return "needs a name";
    if (q === "D") return "unknown building";
    return String(q || "");
  }

  function qualityFilterLabel(q) {
    return q + " — " + qualityLabel(q);
  }

  function areaLabel(p) {
    if (!p) return "Unclaimed";
    const role = p.territory_role || p.role || "";
    const name = String(p.territory_name || "").trim();
    if (role === "prize_zone") return (name || "Ogbete") + " (prize)";
    if (p.territory_id === "unclaimed" || !name || name === "Unclaimed area") return "Unclaimed";
    return name;
  }

  function roleLabel(role) {
    if (role === "prize_zone") return "Ogbete (prize)";
    if (role === "playable_faction") return "neighbourhood";
    return "Unclaimed";
  }

  function haversineM(lat1, lon1, lat2, lon2) {
    const r = 6371000;
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dphi = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dphi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * r * Math.asin(Math.sqrt(a));
  }

  function isOwnable(p) {
    const t = (p && (p.catalog_type || p.type)) || "";
    return !NO_FARM[t];
  }

  function farmMsg() {
    return "Banks and ATMs cannot be owned.";
  }

  function bearingDeg(lat1, lon1, lat2, lon2) {
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dl) * Math.cos(p2);
    const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  const api = {
    CLAIM_RADIUS_M,
    NO_FARM,
    esc,
    qualityLabel,
    qualityFilterLabel,
    areaLabel,
    roleLabel,
    haversineM,
    isOwnable,
    farmMsg,
    bearingDeg,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfeRules = api;
})(typeof window !== "undefined" ? window : globalThis);
