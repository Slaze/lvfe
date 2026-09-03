/* Claim outside the Enugu catalog. MapLibre+OSM is global; the bundled
   pin catalog is Enugu. Players elsewhere fly to GPS and get a local
   hinterland pin (plus nearby OSM footprints already on screen).
   Does not download the planet. Does not set pin colors (sibling owns X/circles). */
(function (global) {
  const FIELD_KEY = "lvfe.field.v1";
  const HERE_PREFIX = "field-here-";
  const OSM_PREFIX = "field-osm-";
  const WORLD_PREFIX = "world-";
  const PAD_DEG = 0.03;
  const MAX_FIELD = 48;
  const MAX_OSM = 8;
  const CLAIM_N = 5;

  function haversineM(lat1, lon1, lat2, lon2) {
    const R = global.LvfeRules;
    if (R && typeof R.haversineM === "function") return R.haversineM(lat1, lon1, lat2, lon2);
    const r = 6371000;
    const toR = Math.PI / 180;
    const dLat = (lat2 - lat1) * toR;
    const dLon = (lon2 - lon1) * toR;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
    return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
  }

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

  function catalogBbox(fc) {
    const feats = (fc && fc.features) || [];
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;
    let n = 0;
    for (let i = 0; i < feats.length; i++) {
      if (isFieldId(feats[i].properties && feats[i].properties.id)) continue;
      const c = feats[i].geometry && feats[i].geometry.coordinates;
      if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
      n += 1;
      if (c[0] < minLon) minLon = c[0];
      if (c[0] > maxLon) maxLon = c[0];
      if (c[1] < minLat) minLat = c[1];
      if (c[1] > maxLat) maxLat = c[1];
    }
    if (!n) {
      return { minLon: 7.45, minLat: 6.39, maxLon: 7.58, maxLat: 6.52, empty: true };
    }
    return { minLon, minLat, maxLon, maxLat, empty: false };
  }

  function outsideCatalog(lat, lon, bbox) {
    const b = bbox || { minLon: 7.45, minLat: 6.39, maxLon: 7.58, maxLat: 6.52 };
    return lat < b.minLat - PAD_DEG || lat > b.maxLat + PAD_DEG ||
      lon < b.minLon - PAD_DEG || lon > b.maxLon + PAD_DEG;
  }

  function isFieldId(id) {
    const s = String(id || "");
    return s.indexOf(HERE_PREFIX) === 0 || s.indexOf(OSM_PREFIX) === 0 || s.indexOf(WORLD_PREFIX) === 0;
  }

  function hereId(lat, lon) {
    return HERE_PREFIX + Math.round(Number(lat) * 2000) + "-" + Math.round(Number(lon) * 2000);
  }

  function hinterlandFeature(id, lat, lon, name, extra) {
    const p = extra && typeof extra === "object" ? extra : {};
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [Number(lon), Number(lat)] },
      properties: Object.assign({
        id: String(id),
        name: name || "Unclaimed area",
        catalog_type: "unmapped",
        catalog_label: "Unmapped",
        quality: "D",
        territory_id: "unclaimed",
        territory_name: "Unclaimed area",
        territory_role: "unclaimed",
        claim_points: CLAIM_N,
        claim_nairacoin: CLAIM_N,
        has_photo: 0,
        field: 1,
      }, p),
    };
  }

  function loadField() {
    const o = lsGet(FIELD_KEY, { type: "FeatureCollection", features: [] });
    if (!o || !Array.isArray(o.features)) return { type: "FeatureCollection", features: [] };
    return o;
  }

  function saveField(fc) {
    const raw = (fc && fc.features) || [];
    const have = {};
    const feats = [];
    for (let i = 0; i < raw.length; i++) {
      const id = raw[i] && raw[i].properties && raw[i].properties.id;
      if (!id) continue;
      if (have[id] != null) feats[have[id]] = raw[i];
      else {
        have[id] = feats.length;
        feats.push(raw[i]);
      }
    }
    const keep = feats.slice(-MAX_FIELD);
    lsSet(FIELD_KEY, { type: "FeatureCollection", features: keep });
    return keep;
  }

  function mergeInto(placesFc, extras) {
    if (!placesFc || !Array.isArray(placesFc.features)) {
      placesFc = { type: "FeatureCollection", features: [] };
    }
    const have = {};
    for (let i = 0; i < placesFc.features.length; i++) {
      const id = placesFc.features[i].properties && placesFc.features[i].properties.id;
      if (id) have[id] = i;
    }
    const add = extras || [];
    for (let i = 0; i < add.length; i++) {
      const f = add[i];
      const id = f && f.properties && f.properties.id;
      if (!id) continue;
      if (have[id] != null) placesFc.features[have[id]] = f;
      else {
        have[id] = placesFc.features.length;
        placesFc.features.push(f);
      }
    }
    return placesFc;
  }

  function centroid(geom) {
    if (!geom) return null;
    if (geom.type === "Point" && geom.coordinates) {
      return { lon: geom.coordinates[0], lat: geom.coordinates[1] };
    }
    const rings = geom.type === "Polygon" ? geom.coordinates
      : geom.type === "MultiPolygon" ? (geom.coordinates[0] || [])
        : null;
    const ring = rings && rings[0];
    if (!ring || !ring.length) return null;
    let x = 0;
    let y = 0;
    let n = 0;
    for (let i = 0; i < ring.length; i++) {
      if (!Number.isFinite(ring[i][0]) || !Number.isFinite(ring[i][1])) continue;
      x += ring[i][0];
      y += ring[i][1];
      n += 1;
    }
    if (!n) return null;
    return { lon: x / n, lat: y / n };
  }

  function harvestOsm(map, userPos) {
    if (!map || !userPos || typeof map.queryRenderedFeatures !== "function") return [];
    const layers = [];
    try {
      if (map.getLayer && map.getLayer("building")) layers.push("building");
      if (map.getLayer && map.getLayer("building-3d")) layers.push("building-3d");
    } catch (err) { /* */ }
    if (!layers.length) return [];
    let pt;
    try {
      pt = map.project([userPos.lon, userPos.lat]);
    } catch (err) {
      return [];
    }
    const r = 90;
    let hits = [];
    try {
      hits = map.queryRenderedFeatures([[pt.x - r, pt.y - r], [pt.x + r, pt.y + r]], { layers: layers });
    } catch (err) {
      return [];
    }
    const out = [];
    const seen = {};
    for (let i = 0; i < hits.length && out.length < MAX_OSM; i++) {
      const h = hits[i];
      const c = centroid(h.geometry);
      if (!c) continue;
      const dist = haversineM(userPos.lat, userPos.lon, c.lat, c.lon);
      if (dist > 80) continue;
      const props = h.properties || {};
      const osmId = props.id || props.osm_id || Math.round(c.lat * 1e5) + "-" + Math.round(c.lon * 1e5);
      const id = OSM_PREFIX + String(osmId);
      if (seen[id]) continue;
      seen[id] = true;
      const rawName = String(props.name || "").trim();
      const named = rawName && rawName !== "-" && rawName.toLowerCase() !== "undefined";
      out.push(hinterlandFeature(id, c.lat, c.lon, named ? rawName : "Unclaimed area", {
        catalog_type: named ? "civic" : "civic_unknown",
        quality: named ? "C" : "D",
        osm: 1,
      }));
    }
    return out;
  }

  function ensureHere(userPos, placesFc) {
    if (!userPos) return null;
    const id = hereId(userPos.lat, userPos.lon);
    const stored = lsGet("lvfe.places.v1", {}) || {};
    const rec = stored[id];
    if (rec && rec.stakes && Object.keys(rec.stakes).length) {
      return hinterlandFeature(id, userPos.lat, userPos.lon, "Unclaimed area");
    }
    return hinterlandFeature(id, userPos.lat, userPos.lon, "Unclaimed area");
  }

  function onLocated(map, userPos, placesFc) {
    const bbox = catalogBbox(placesFc);
    const away = Boolean(userPos) && outsideCatalog(userPos.lat, userPos.lon, bbox);
    const field = loadField();
    if (!away) {
      return {
        away: false,
        bbox: bbox,
        added: [],
        places: mergeInto(placesFc, field.features),
        message: "",
        worldPromise: null,
      };
    }
    const extras = field.features.slice();
    const here = ensureHere(userPos, placesFc);
    if (here) extras.push(here);
    const osm = harvestOsm(map, userPos);
    for (let i = 0; i < osm.length; i++) extras.push(osm[i]);
    saveField({ type: "FeatureCollection", features: extras });
    const places = mergeInto(placesFc, extras);

    let worldPromise = null;
    const World = global.LvfeWorldCatalog;
    if (World && typeof World.fetchNear === "function" && userPos) {
      worldPromise = World.fetchNear(userPos.lat, userPos.lon).then(function (res) {
        const feats = (res && res.features) || [];
        const mergedField = loadField();
        const next = mergedField.features.slice();
        for (let i = 0; i < feats.length; i++) next.push(feats[i]);
        if (here) next.push(here);
        for (let i = 0; i < osm.length; i++) next.push(osm[i]);
        saveField({ type: "FeatureCollection", features: next });
        return {
          away: true,
          bbox: bbox,
          added: feats,
          places: mergeInto(placesFc, next),
          message: (res && res.message) || "",
          worldOk: Boolean(res && res.ok),
          worldError: (res && res.error) || "",
        };
      });
    }

    return {
      away: true,
      bbox: bbox,
      added: extras.filter(function (f) { return f && f.properties && isFieldId(f.properties.id); }),
      places: places,
      message: worldPromise
        ? "You're outside the Enugu catalog. Loading named places near you…"
        : "You're outside the Enugu catalog. Unclaimed area at your GPS is claimable.",
      worldPromise: worldPromise,
    };
  }

  function shouldFly(map, userPos, minM) {
    if (!map || !userPos || typeof map.getCenter !== "function") return Boolean(userPos);
    try {
      const c = map.getCenter();
      const d = haversineM(c.lat, c.lng, userPos.lat, userPos.lon);
      return d > (Number(minM) > 0 ? Number(minM) : 400);
    } catch (err) {
      return true;
    }
  }

  const api = {
    FIELD_KEY,
    HERE_PREFIX,
    OSM_PREFIX,
    WORLD_PREFIX,
    PAD_DEG,
    catalogBbox,
    outsideCatalog,
    isFieldId,
    hereId,
    hinterlandFeature,
    loadField,
    saveField,
    mergeInto,
    harvestOsm,
    ensureHere,
    onLocated,
    shouldFly,
    haversineM,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfeField = api;
})(typeof window !== "undefined" ? window : globalThis);
