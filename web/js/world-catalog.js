/* Viewport Overpass ingest when the player is outside the Enugu catalog bbox.
   Does not download the planet. Rate-limited. Banks/ATMs stay not ownable.
   Fail loud with a message; hinterland Unclaimed area remains as fallback. */
(function (global) {
  const CACHE_KEY = "lvfe.world.overpass.v1";
  const PREFIX = "world-";
  const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  const OVERPASS = OVERPASS_ENDPOINTS[0];
  const UA = "LvfeXperience/0.3 (world viewport; OSM ODbL)";
  const PAD_DEG = 0.012;
  const MAX_FEATURES = 80;
  const MIN_INTERVAL_MS = 45000;
  const CACHE_TTL_MS = 30 * 60 * 1000;
  const CELL = 0.02;

  const SKIP_AMENITY = {
    parking: 1, toilets: 1, bicycle_parking: 1, mortuary: 1, veterinary: 1,
  };
  const FOOD = { restaurant: 1, bar: 1, cafe: 1, fast_food: 1, food_court: 1 };
  const SCHOOL = { school: 1, college: 1, university: 1, kindergarten: 1, driving_school: 1 };
  const HOSPITAL_A = { hospital: 1, clinic: 1, doctors: 1, dentist: 1 };
  const HOSPITAL_H = { hospital: 1, clinic: 1, laboratory: 1 };
  const PARK = { park: 1, garden: 1 };
  const PITCH = { pitch: 1, sports_centre: 1, stadium: 1, golf_course: 1, swimming_pool: 1 };
  const HOTEL = { hotel: 1, guest_house: 1, hostel: 1, apartment: 1, camp_site: 1, resort: 1 };
  const LANDMARK = { museum: 1, artwork: 1, attraction: 1 };
  const CIVIC_A = {
    police: 1, fire_station: 1, post_office: 1, library: 1, community_centre: 1,
    events_venue: 1, townhall: 1, courthouse: 1,
  };
  const CIVIC_O = { government: 1, ngo: 1, lawyer: 1, political_party: 1, water_utility: 1 };

  const BASE = {
    market: 50, shop: 35, mall: 45, food: 40, bank: 25, atm: 10, pharmacy: 30,
    fuel: 20, transit: 15, park: 20, pitch: 35, worship: 25, school: 20,
    hospital: 20, civic: 30, civic_unknown: 15, hotel: 30, landmark: 50,
    ruin: 40, unmapped: 12,
  };
  const QUALITY_M = { A: 1.25, B: 1.0, C: 0.7, D: 1.6 };

  let lastFetchAt = 0;
  let inFlight = null;
  let lastError = "";

  function lsGet(key, fallback) {
    try {
      if (typeof localStorage === "undefined") return fallback;
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function lsSet(key, val) {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(key, JSON.stringify(val));
    } catch (err) { /* quota */ }
  }

  function cellKey(lat, lon) {
    const la = Math.round(Number(lat) / CELL);
    const lo = Math.round(Number(lon) / CELL);
    return la + ":" + lo;
  }

  function bboxAround(lat, lon) {
    return {
      s: Number(lat) - PAD_DEG,
      w: Number(lon) - PAD_DEG,
      n: Number(lat) + PAD_DEG,
      e: Number(lon) + PAD_DEG,
    };
  }

  function overpassQl(b) {
    const bbox = "(" + b.s.toFixed(5) + "," + b.w.toFixed(5) + "," + b.n.toFixed(5) + "," + b.e.toFixed(5) + ")";
    return "[out:json][timeout:25];\n(\n" +
      "  node[\"amenity\"]" + bbox + ";\n" +
      "  way[\"amenity\"]" + bbox + ";\n" +
      "  node[\"shop\"]" + bbox + ";\n" +
      "  way[\"shop\"]" + bbox + ";\n" +
      "  node[\"leisure\"]" + bbox + ";\n" +
      "  way[\"leisure\"]" + bbox + ";\n" +
      "  node[\"tourism\"]" + bbox + ";\n" +
      "  way[\"tourism\"]" + bbox + ";\n" +
      "  node[\"office\"]" + bbox + ";\n" +
      "  way[\"office\"]" + bbox + ";\n" +
      "  node[\"healthcare\"]" + bbox + ";\n" +
      "  way[\"healthcare\"]" + bbox + ";\n" +
      "  node[\"highway\"=\"bus_stop\"]" + bbox + ";\n" +
      ");\nout center tags;";
  }

  function isRuin(tags) {
    if (tags.shop === "vacant") return true;
    if (tags.opening_hours === "closed") return true;
    for (const k of Object.keys(tags)) {
      if (k.indexOf("disused:") === 0 || k.indexOf("abandoned:") === 0) return true;
      if ((k === "disused" || k === "abandoned") && (tags[k] === "yes" || tags[k] === "true")) return true;
    }
    return false;
  }

  function classify(tags) {
    if (isRuin(tags)) return "ruin";
    const amenity = tags.amenity;
    if (amenity && SKIP_AMENITY[amenity]) return null;
    const shop = tags.shop;
    const leisure = tags.leisure;
    const tourism = tags.tourism;
    const office = tags.office;
    const healthcare = tags.healthcare;
    const highway = tags.highway;
    if (amenity === "marketplace") return "market";
    if (shop === "mall") return "mall";
    if (shop && shop !== "mall") return "shop";
    if (amenity && FOOD[amenity]) return "food";
    if (amenity === "atm") return "atm";
    if (amenity === "bank") return "bank";
    if (amenity === "pharmacy" || healthcare === "pharmacy") return "pharmacy";
    if (amenity === "fuel") return "fuel";
    if (highway === "bus_stop" || amenity === "bus_station" || amenity === "taxi") return "transit";
    if (leisure && PARK[leisure]) return "park";
    if (leisure && PITCH[leisure]) return "pitch";
    if (amenity === "place_of_worship") return "worship";
    if (amenity && SCHOOL[amenity]) return "school";
    if ((amenity && HOSPITAL_A[amenity]) || (healthcare && HOSPITAL_H[healthcare])) return "hospital";
    if (tourism && LANDMARK[tourism]) return "landmark";
    if ((tourism && HOTEL[tourism]) || leisure === "resort") return "hotel";
    if ((amenity && CIVIC_A[amenity]) || (office && CIVIC_O[office])) {
      return tags.name ? "civic" : "civic_unknown";
    }
    if (amenity === "public_building" || office === "yes" || office === "sitout") {
      return tags.name ? "civic" : "civic_unknown";
    }
    if (amenity === "studio") return "shop";
    return null;
  }

  function qualityOf(ctype, hasName) {
    if (ctype === "civic_unknown") return "D";
    if (!hasName) return "C";
    return "B";
  }

  function claimPts(ctype, q) {
    const base = BASE[ctype] != null ? BASE[ctype] : 20;
    const qm = QUALITY_M[q] != null ? QUALITY_M[q] : 1;
    return Math.max(1, Math.round(base * qm * 1.2));
  }

  function coords(el) {
    if (el.lat != null && el.lon != null) return { lat: +el.lat, lon: +el.lon };
    const c = el.center;
    if (c && c.lat != null && c.lon != null) return { lat: +c.lat, lon: +c.lon };
    return null;
  }

  function placeId(osmType, osmId) {
    return PREFIX + String(osmType).charAt(0) + "_" + osmId;
  }

  function labelOf(ctype) {
    const R = global.LvfeRules;
    if (R && R.TYPE_LABEL && R.TYPE_LABEL[ctype]) return R.TYPE_LABEL[ctype];
    return ctype || "Place";
  }

  function toFeature(row) {
    const hasName = Boolean(row.name && String(row.name).trim());
    const q = qualityOf(row.catalog_type, hasName);
    const pts = claimPts(row.catalog_type, q);
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [row.lon, row.lat] },
      properties: {
        id: row.id,
        name: hasName ? String(row.name).slice(0, 80) : "",
        catalog_type: row.catalog_type,
        catalog_label: labelOf(row.catalog_type),
        quality: q,
        territory_id: "unclaimed",
        territory_name: "Unclaimed area",
        territory_role: "unclaimed",
        claim_points: pts,
        claim_nairacoin: pts,
        has_photo: 0,
        world: 1,
        field: 1,
      },
    };
  }

  function extract(payload) {
    const out = [];
    const seen = {};
    const els = (payload && payload.elements) || [];
    for (let i = 0; i < els.length && out.length < MAX_FEATURES; i++) {
      const el = els[i];
      const tags = el.tags || {};
      const xy = coords(el);
      if (!xy) continue;
      const ctype = classify(tags);
      if (!ctype) continue;
      const id = placeId(el.type, el.id);
      if (seen[id]) continue;
      seen[id] = true;
      out.push({
        id: id,
        lat: xy.lat,
        lon: xy.lon,
        name: tags.name || "",
        catalog_type: ctype,
      });
    }
    return out;
  }

  function cacheGet(ck) {
    const all = lsGet(CACHE_KEY, {});
    const row = all[ck];
    if (!row || !row.at || !Array.isArray(row.features)) return null;
    if (Date.now() - row.at > CACHE_TTL_MS) return null;
    return row;
  }

  function cacheSet(ck, features) {
    const all = lsGet(CACHE_KEY, {});
    all[ck] = { at: Date.now(), features: features };
    const keys = Object.keys(all);
    if (keys.length > 24) {
      keys.sort(function (a, b) { return (all[a].at || 0) - (all[b].at || 0); });
      for (let i = 0; i < keys.length - 16; i++) delete all[keys[i]];
    }
    lsSet(CACHE_KEY, all);
  }

  function isWorldId(id) {
    return String(id || "").indexOf(PREFIX) === 0;
  }

  function fetchNear(lat, lon, opts) {
    const o = opts || {};
    const force = Boolean(o.force);
    const ck = cellKey(lat, lon);
    const cached = cacheGet(ck);
    if (cached && !force) {
      lastError = "";
      return Promise.resolve({
        ok: true,
        cached: true,
        cell: ck,
        features: cached.features,
        message: "",
      });
    }
    const now = Date.now();
    if (!force && now - lastFetchAt < MIN_INTERVAL_MS && cached) {
      return Promise.resolve({
        ok: true,
        cached: true,
        rateLimited: true,
        cell: ck,
        features: cached.features,
        message: "",
      });
    }
    if (inFlight) return inFlight;

    const b = bboxAround(lat, lon);
    const ql = overpassQl(b);
    lastFetchAt = now;

    function postOne(url) {
      const headers = {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "Accept": "application/json",
      };
      /* Node may set a forbidden UA; Overpass returns 406 without a real one. */
      try {
        if (typeof process !== "undefined" && process.versions && process.versions.node) {
          headers["User-Agent"] = UA;
        }
      } catch (err) { /* browser */ }
      return fetch(url, {
        method: "POST",
        headers: headers,
        body: "data=" + encodeURIComponent(ql),
      }).then(function (res) {
        if (!res.ok) throw new Error("Overpass HTTP " + res.status + " @ " + url);
        return res.json();
      });
    }

    inFlight = (function tryAll(i) {
      if (i >= OVERPASS_ENDPOINTS.length) {
        return Promise.reject(new Error("All Overpass mirrors failed"));
      }
      return postOne(OVERPASS_ENDPOINTS[i]).catch(function (err) {
        if (i + 1 < OVERPASS_ENDPOINTS.length) return tryAll(i + 1);
        throw err;
      });
    })(0).then(function (payload) {
      const rows = extract(payload);
      const features = rows.map(toFeature);
      cacheSet(ck, features);
      lastError = "";
      return {
        ok: true,
        cached: false,
        cell: ck,
        features: features,
        message: features.length
          ? ("Loaded " + features.length + " named places near you from OpenStreetMap.")
          : "No named POIs in this viewport — hinterland Unclaimed area still works.",
      };
    }).catch(function (err) {
      lastError = String(err && err.message || err);
      const stale = lsGet(CACHE_KEY, {})[ck];
      if (stale && Array.isArray(stale.features) && stale.features.length) {
        return {
          ok: false,
          fallbackCache: true,
          cell: ck,
          features: stale.features,
          error: lastError,
          message: "Overpass is down (" + lastError + "). Showing cached pins; hinterland still claimable.",
        };
      }
      return {
        ok: false,
        cell: ck,
        features: [],
        error: lastError,
        message: "Overpass is down (" + lastError + "). Falling back to Unclaimed area hinterland.",
      };
    }).finally(function () {
      inFlight = null;
    });

    return inFlight;
  }

  const api = {
    CACHE_KEY,
    PREFIX,
    OVERPASS,
    PAD_DEG,
    MIN_INTERVAL_MS,
    isWorldId,
    cellKey,
    bboxAround,
    classify,
    qualityOf,
    claimPts,
    extract,
    toFeature,
    fetchNear,
    lastError: function () { return lastError; },
    _test: { overpassQl, placeId },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfeWorldCatalog = api;
})(typeof window !== "undefined" ? window : globalThis);
