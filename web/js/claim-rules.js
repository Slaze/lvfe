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

  const TYPE_LABELS = {
    market: "Market",
    shop: "Shop",
    mall: "Mall",
    food: "Food",
    bank: "Bank",
    atm: "ATM",
    pharmacy: "Pharmacy",
    fuel: "Fuel station",
    transit: "Transit",
    park: "Park",
    pitch: "Pitch",
    worship: "Worship",
    school: "School",
    hospital: "Hospital",
    civic: "Civic",
    civic_unknown: "Unidentified building",
    hotel: "Hotel",
    landmark: "Landmark",
    ruin: "Ruin",
    unmapped: "Unmapped",
  };

  function qualityLabel(q) {
    if (q === "A") return "photo";
    if (q === "B") return "named";
    if (q === "C") return "needs a name";
    if (q === "D") return "unknown building";
    return String(q || "");
  }

  function qualityWords(q) {
    if (q === "A") return "Has a photo";
    if (q === "B") return "Named";
    if (q === "D") return "Unknown building";
    return "Needs a name";
  }

  /** Quality D / unidentified / unmapped — not a named catalog shop. */
  function isUnknownPlace(p) {
    if (!p) return false;
    const q = String(p.quality || "");
    const t = String(p.catalog_type || p.type || "");
    return q === "D" || t === "civic_unknown" || t === "unmapped";
  }

  /** Player copy: never show "-" / empty / undefined. */
  function wordOr(v, fallback) {
    const s = v == null ? "" : String(v).trim();
    if (!s || s === "-" || s === "—" || s === "–" || s === "undefined" || s === "null") {
      return fallback;
    }
    return s;
  }

  function noOwnerYet() {
    return "No owner yet";
  }

  function walkMinutes(distM) {
    const m = Number(distM);
    if (!Number.isFinite(m) || m < 0) return 0;
    return Math.max(1, Math.round(m / 5000 * 60));
  }

  function walkEtaText(distM, minutes) {
    const mins = Number.isFinite(minutes) ? Math.max(1, Math.round(minutes)) : walkMinutes(distM);
    if (mins < 1) return "Under a minute walk";
    if (mins === 1) return "1 min walk";
    return mins + " min walk";
  }

  /** Player-facing coin amount. Prefer "12 NCN" in UI; ledger keys stay NairaCoin. */
  function ncn(amount) {
    const n = Math.round(Number(amount));
    if (!Number.isFinite(n)) return "0 NCN";
    return n + " NCN";
  }

  function headingWords(deviceHeading, bearing) {
    if (!Number.isFinite(deviceHeading) || !Number.isFinite(bearing)) return "Walk toward it";
    const delta = ((bearing - deviceHeading + 540) % 360) - 180;
    const abs = Math.abs(delta);
    if (abs <= 22) return "Ahead";
    if (abs >= 158) return "Behind you";
    if (delta > 0) return abs > 70 ? "Turn right" : "Slight right";
    return abs > 70 ? "Turn left" : "Slight left";
  }

  function typeLabel(p) {
    const t = p && typeof p === "object"
      ? String(p.catalog_type || p.type || "").trim()
      : String(p || "").trim();
    if (TYPE_LABELS[t]) return TYPE_LABELS[t];
    if (!t) return "Place";
    return t.replace(/_/g, " ");
  }

  /** One title helper for catalog, nearby, AR, search, dossier. */
  function placeTitle(p) {
    const type = typeLabel(p);
    const raw = p && typeof p === "object" ? (p.name != null ? p.name : p.title) : p;
    const s = raw == null ? "" : String(raw).trim();
    if (!s || s === "-" || s === "—" || s === "–" || /^undefined$/i.test(s) || /^null$/i.test(s)) {
      return type;
    }
    if (TYPE_LABELS[s]) return TYPE_LABELS[s];
    const unnamed = s.match(/^unnamed(?:\s+|_)(.+)$/i);
    if (unnamed) {
      const rest = unnamed[1].trim();
      if (TYPE_LABELS[rest]) return TYPE_LABELS[rest];
      return type;
    }
    if (/^unnamed$/i.test(s)) return type;
    return s;
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
    TYPE_LABELS,
    qualityLabel,
    qualityWords,
    isUnknownPlace,
    wordOr,
    noOwnerYet,
    walkMinutes,
    walkEtaText,
    ncn,
    headingWords,
    typeLabel,
    placeTitle,
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
