/* Location-based factions. Enugu keeps the canonical four; elsewhere
   Overpass builds a local chapter list from suburb/neighbourhood/quarter
   names (3–6). Chosen faction persists across travel — never silently wiped.
   Cloud/catalog permanence is separate; this is map/GPS region UI. */
(function (global) {
  const CACHE_KEY = "lvfe.localfactions.v1";
  const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  const UA = "LvfeXperience/0.3 (local factions; OSM ODbL)";
  const PAD_DEG = 0.04;
  const MIN_INTERVAL_MS = 45000;
  const CACHE_TTL_MS = 30 * 60 * 1000;
  const CELL = 0.05;
  const MIN_F = 3;
  const MAX_F = 6;

  const ENUGU_BBOX = { minLon: 7.45, minLat: 6.39, maxLon: 7.58, maxLat: 6.52 };
  const ENUGU_FACTIONS = [
    { id: "independence_layout", name: "Independence Layout", color: "#2ecc71", role: "playable_faction", city: "Enugu" },
    { id: "coal_camp", name: "Coal Camp", color: "#e74c3c", role: "playable_faction", city: "Enugu" },
    { id: "abakpa", name: "Abakpa", color: "#3498db", role: "playable_faction", city: "Enugu" },
    { id: "emene", name: "Emene", color: "#9b59b6", role: "playable_faction", city: "Enugu" },
  ];
  const GENERIC_FALLBACK = [
    { id: "local_north", name: "North Quarter", color: "#2ecc71", role: "playable_faction" },
    { id: "local_south", name: "South Quarter", color: "#e74c3c", role: "playable_faction" },
    { id: "local_east", name: "East Quarter", color: "#3498db", role: "playable_faction" },
    { id: "local_west", name: "West Quarter", color: "#9b59b6", role: "playable_faction" },
  ];
  const COLORS = ["#2ecc71", "#e74c3c", "#3498db", "#9b59b6", "#f39c12", "#1abc9c"];

  let lastFetchAt = 0;
  let inFlight = null;

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

  function isEnugu(lat, lon) {
    const Field = global.LvfeField;
    if (Field && typeof Field.outsideCatalog === "function") {
      return !Field.outsideCatalog(Number(lat), Number(lon), ENUGU_BBOX);
    }
    const b = ENUGU_BBOX;
    const la = Number(lat);
    const lo = Number(lon);
    return la >= b.minLat && la <= b.maxLat && lo >= b.minLon && lo <= b.maxLon;
  }

  function cellKey(lat, lon) {
    return Math.round(Number(lat) / CELL) + ":" + Math.round(Number(lon) / CELL);
  }

  function slugify(name) {
    const s = String(name || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40);
    return s || "local_area";
  }

  function uniqueId(base, used) {
    let id = "local_" + base;
    if (!used[id]) return id;
    for (let n = 2; n < 40; n++) {
      const cand = (id.slice(0, 36) + "_" + n).slice(0, 48);
      if (!used[cand]) return cand;
    }
    return (id.slice(0, 32) + "_" + Date.now().toString(36)).slice(0, 48);
  }

  function haversineM(lat1, lon1, lat2, lon2) {
    const Field = global.LvfeField;
    if (Field && typeof Field.haversineM === "function") {
      return Field.haversineM(lat1, lon1, lat2, lon2);
    }
    const r = 6371000;
    const toR = Math.PI / 180;
    const dLat = (lat2 - lat1) * toR;
    const dLon = (lon2 - lon1) * toR;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
    return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function overpassQl(lat, lon) {
    const s = (Number(lat) - PAD_DEG).toFixed(5);
    const w = (Number(lon) - PAD_DEG).toFixed(5);
    const n = (Number(lat) + PAD_DEG).toFixed(5);
    const e = (Number(lon) + PAD_DEG).toFixed(5);
    const bbox = "(" + s + "," + w + "," + n + "," + e + ")";
    return "[out:json][timeout:25];\n(\n" +
      "  node[\"place\"~\"^(suburb|neighbourhood|neighborhood|quarter|city_block|borough)$\"][\"name\"]" + bbox + ";\n" +
      "  way[\"place\"~\"^(suburb|neighbourhood|neighborhood|quarter|city_block|borough)$\"][\"name\"]" + bbox + ";\n" +
      "  relation[\"place\"~\"^(suburb|neighbourhood|neighborhood|quarter|city_block|borough)$\"][\"name\"]" + bbox + ";\n" +
      "  way[\"landuse\"=\"residential\"][\"name\"]" + bbox + ";\n" +
      "  relation[\"admin_level\"~\"^(8|9|10)$\"][\"name\"]" + bbox + ";\n" +
      ");\nout center tags;";
  }

  function elementCenter(el) {
    if (!el) return null;
    if (Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
      return { lat: el.lat, lon: el.lon };
    }
    if (el.center && Number.isFinite(el.center.lat) && Number.isFinite(el.center.lon)) {
      return { lat: el.center.lat, lon: el.center.lon };
    }
    return null;
  }

  function rankPlace(tags) {
    const p = String((tags && tags.place) || "");
    if (p === "suburb" || p === "borough") return 1;
    if (p === "neighbourhood" || p === "neighborhood" || p === "quarter") return 2;
    if (p === "city_block") return 3;
    if (tags && tags.admin_level) return 4;
    if (tags && tags.landuse === "residential") return 5;
    return 6;
  }

  function parseElements(payload, lat, lon) {
    const els = (payload && payload.elements) || [];
    const rows = [];
    const seenName = {};
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      const tags = el.tags || {};
      const name = String(tags.name || "").trim();
      if (!name || name.length < 2) continue;
      const nk = name.toLowerCase();
      if (seenName[nk]) continue;
      const c = elementCenter(el);
      if (!c) continue;
      const dist = haversineM(lat, lon, c.lat, c.lon);
      rows.push({
        name: name,
        dist: dist,
        rank: rankPlace(tags),
        place: tags.place || tags.landuse || ("admin" + (tags.admin_level || "")),
      });
      seenName[nk] = true;
    }
    rows.sort(function (a, b) {
      return (a.rank - b.rank) || (a.dist - b.dist) || a.name.localeCompare(b.name);
    });
    return rows;
  }

  function rowsToFactions(rows, cityHint) {
    const used = {};
    const out = [];
    const city = cityHint || "";
    for (let i = 0; i < rows.length && out.length < MAX_F; i++) {
      const row = rows[i];
      const base = slugify(row.name);
      const id = uniqueId(base, used);
      used[id] = true;
      out.push({
        id: id,
        name: row.name.slice(0, 48),
        color: COLORS[out.length % COLORS.length],
        role: out.length === 0 ? "prize_zone" : "playable_faction",
        city: city,
        distM: Math.round(row.dist),
        source: "osm",
      });
    }
    /* Closest named area is prize_zone analog (like Ogbete); rest playable. */
    if (out.length && out[0].role === "prize_zone" && out.length > 1) {
      /* Keep one prize + playable remainder — picker includes all for local chapters. */
    }
    while (out.length < MIN_F && out.length < GENERIC_FALLBACK.length) {
      const g = GENERIC_FALLBACK[out.length];
      if (used[g.id]) break;
      used[g.id] = true;
      out.push(Object.assign({}, g, { city: city || "local", source: "fallback" }));
    }
    return out;
  }

  function enuguResult() {
    return {
      ok: true,
      region: "enugu",
      city: "Enugu",
      canonical: true,
      factions: ENUGU_FACTIONS.slice(),
      message: "Enugu canonical factions.",
    };
  }

  function softFallback(lat, lon, errMsg) {
    const city = "Near " + Number(lat).toFixed(2) + "," + Number(lon).toFixed(2);
    return {
      ok: false,
      region: "local",
      city: city,
      canonical: false,
      factions: GENERIC_FALLBACK.map(function (g) {
        return Object.assign({}, g, { city: city, source: "fallback" });
      }),
      error: errMsg || "",
      message: "Sparse OSM map — using generic local quarters. Hinterland Unclaimed area still claimable.",
    };
  }

  function cacheGet(ck) {
    const all = lsGet(CACHE_KEY, {});
    const row = all[ck];
    if (!row || !Array.isArray(row.factions)) return null;
    if (Date.now() - (Number(row.at) || 0) > CACHE_TTL_MS) return null;
    return row;
  }

  function cacheSet(ck, payload) {
    const all = lsGet(CACHE_KEY, {});
    all[ck] = {
      at: Date.now(),
      city: payload.city,
      factions: payload.factions,
      region: payload.region,
    };
    lsSet(CACHE_KEY, all);
  }

  function namesMap(list) {
    const out = {};
    (list || []).forEach(function (f) {
      if (f && f.id) out[f.id] = f.name;
    });
    return out;
  }

  /**
   * Persist chapter: if player already has a factionId, keep it even when
   * the current region's list differs (travel). Re-pick only when unset.
   */
  function resolveChapter(identity, regionResult) {
    const idn = identity || {};
    const list = (regionResult && regionResult.factions) || [];
    const names = namesMap(list);
    const cur = String(idn.factionId || "");
    if (!cur) {
      return {
        factionId: "",
        lockedChapter: false,
        canPick: true,
        label: "",
        localList: list,
        note: "Pick a neighbourhood for this map region.",
      };
    }
    const inList = Boolean(names[cur]);
    const knownName = names[cur] || idn.factionName || cur;
    return {
      factionId: cur,
      lockedChapter: true,
      canPick: false,
      label: knownName,
      localList: list,
      inCurrentRegion: inList,
      note: inList
        ? ("Chapter: " + knownName)
        : ("Your chapter stays " + knownName + " while you travel. Local factions here are for new walkers only."),
    };
  }

  function forPositionSync(lat, lon) {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
      return enuguResult();
    }
    if (isEnugu(lat, lon)) return enuguResult();
    const ck = cellKey(lat, lon);
    const cached = cacheGet(ck);
    if (cached) {
      return {
        ok: true,
        cached: true,
        region: "local",
        city: cached.city || "",
        canonical: false,
        factions: cached.factions,
        message: "Cached local factions.",
      };
    }
    return softFallback(lat, lon, "awaiting_overpass");
  }

  function fetchNear(lat, lon, opts) {
    const o = opts || {};
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
      return Promise.resolve(enuguResult());
    }
    if (isEnugu(lat, lon)) {
      return Promise.resolve(enuguResult());
    }
    const force = Boolean(o.force);
    const ck = cellKey(lat, lon);
    const cached = cacheGet(ck);
    if (cached && !force) {
      return Promise.resolve({
        ok: true,
        cached: true,
        region: "local",
        city: cached.city || "",
        canonical: false,
        factions: cached.factions,
        message: "",
      });
    }
    const now = Date.now();
    if (!force && now - lastFetchAt < MIN_INTERVAL_MS && cached) {
      return Promise.resolve({
        ok: true,
        cached: true,
        rateLimited: true,
        region: "local",
        city: cached.city || "",
        canonical: false,
        factions: cached.factions,
        message: "",
      });
    }
    if (inFlight) return inFlight;

    lastFetchAt = now;
    const ql = overpassQl(lat, lon);

    function postOne(url) {
      const headers = {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "Accept": "application/json",
      };
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
        if (!res.ok) throw new Error("Overpass HTTP " + res.status);
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
      const rows = parseElements(payload, Number(lat), Number(lon));
      const cityHint = rows.length ? String(rows[0].name) : "";
      let factions = rowsToFactions(rows, cityHint);
      if (!factions.length) {
        const soft = softFallback(lat, lon, "sparse_osm");
        cacheSet(ck, soft);
        return soft;
      }
      /* Promote: first (closest high-rank) stays prize_zone; ensure ≥3 with fallback fill. */
      if (factions.length < MIN_F) {
        const filled = rowsToFactions(rows.concat(GENERIC_FALLBACK.map(function (g, idx) {
          return { name: g.name, dist: 1e9 + idx, rank: 99 };
        })), cityHint);
        factions = filled.slice(0, MAX_F);
      }
      const result = {
        ok: true,
        cached: false,
        region: "local",
        city: cityHint || ("Near " + Number(lat).toFixed(2) + "," + Number(lon).toFixed(2)),
        canonical: false,
        factions: factions.slice(0, MAX_F),
        message: "Local factions from OpenStreetMap neighbourhoods.",
      };
      cacheSet(ck, result);
      return result;
    }).catch(function (err) {
      const soft = softFallback(lat, lon, String(err && err.message || err));
      if (cached) {
        return {
          ok: false,
          fallbackCache: true,
          region: "local",
          city: cached.city || soft.city,
          canonical: false,
          factions: cached.factions,
          error: soft.error,
          message: soft.message,
        };
      }
      return soft;
    }).finally(function () {
      inFlight = null;
    });

    return inFlight;
  }

  /** Build factions from a mocked Overpass JSON (tests). */
  function fromOverpassPayload(payload, lat, lon) {
    if (isEnugu(lat, lon)) return enuguResult();
    const rows = parseElements(payload, Number(lat), Number(lon));
    if (!rows.length) return softFallback(lat, lon, "sparse_osm");
    const cityHint = rows[0].name;
    return {
      ok: true,
      region: "local",
      city: cityHint,
      canonical: false,
      factions: rowsToFactions(rows, cityHint).slice(0, MAX_F),
      message: "Local factions from OpenStreetMap neighbourhoods.",
    };
  }

  const api = {
    CACHE_KEY,
    ENUGU_BBOX,
    ENUGU_FACTIONS,
    GENERIC_FALLBACK,
    isEnugu,
    slugify,
    namesMap,
    resolveChapter,
    forPositionSync,
    fetchNear,
    fromOverpassPayload,
    parseElements,
    rowsToFactions,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfeLocalFactions = api;
})(typeof window !== "undefined" ? window : globalThis);
