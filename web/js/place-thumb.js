/* Place snapshot thumbs: free online media only (no Google Maps/Places SKUs).
   Primary: Esri World Imagery tile at lon/lat (same ArcGIS tiles as SAT).
   Upgrade: Wikipedia/Wikimedia geosearch page image when nearby.
   Cache: IndexedDB URL map. Fail soft; never block dossier open. */
(function (global) {
  const DB_NAME = "lvfe.place-thumbs.v1";
  const STORE = "urls";
  const ESRI_Z = 16;
  const ESRI_TMPL =
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const WIKI_GEO =
    "https://en.wikipedia.org/w/api.php?action=query&list=geosearch" +
    "&gsradius=1200&gslimit=1&format=json&origin=*&gscoord=";
  const WIKI_IMG =
    "https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=thumbnail" +
    "&pithumbsize=480&format=json&origin=*&pageids=";
  const mem = Object.create(null);
  const inflight = Object.create(null);
  let dbp = null;
  let memoryOnly = typeof indexedDB === "undefined";

  function lonLatToTile(lat, lon, z) {
    const n = Math.pow(2, z);
    const latRad = Number(lat) * Math.PI / 180;
    const x = Math.floor((Number(lon) + 180) / 360 * n);
    const y = Math.floor(
      (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n
    );
    return { x: x, y: y, z: z };
  }

  function esriUrl(lat, lon, z) {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return "";
    const t = lonLatToTile(lat, lon, z == null ? ESRI_Z : z);
    return ESRI_TMPL
      .replace("{z}", String(t.z))
      .replace("{x}", String(t.x))
      .replace("{y}", String(t.y));
  }

  function cacheKey(placeId, lat, lon) {
    if (placeId) return "id:" + String(placeId);
    const a = Math.round(Number(lat) * 1e4);
    const o = Math.round(Number(lon) * 1e4);
    return "ll:" + a + "," + o;
  }

  function openDb() {
    if (memoryOnly || typeof indexedDB === "undefined") return Promise.resolve(null);
    if (dbp) return dbp;
    dbp = new Promise(function (resolve) {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function () {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () {
          memoryOnly = true;
          dbp = null;
          resolve(null);
        };
      } catch (err) {
        memoryOnly = true;
        dbp = null;
        resolve(null);
      }
    });
    return dbp;
  }

  function readCache(key) {
    if (mem[key]) return Promise.resolve(mem[key]);
    return openDb().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          const tx = db.transaction(STORE, "readonly");
          const req = tx.objectStore(STORE).get(key);
          req.onsuccess = function () {
            const v = req.result;
            if (v && v.url) {
              mem[key] = v;
              resolve(v);
            } else resolve(null);
          };
          req.onerror = function () { resolve(null); };
        } catch (err) { resolve(null); }
      });
    });
  }

  function writeCache(key, entry) {
    mem[key] = entry;
    return openDb().then(function (db) {
      if (!db) return;
      try {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(entry, key);
      } catch (err) { /* soft */ }
    });
  }

  function fetchJson(url, ms) {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const t = setTimeout(function () {
      if (ctrl) try { ctrl.abort(); } catch (e) { /* */ }
    }, ms || 2500);
    return fetch(url, {
      signal: ctrl ? ctrl.signal : undefined,
      credentials: "omit",
      mode: "cors",
    }).then(function (res) {
      clearTimeout(t);
      if (!res.ok) throw new Error("http");
      return res.json();
    }).catch(function (err) {
      clearTimeout(t);
      throw err;
    });
  }

  function wikiThumb(lat, lon) {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
      return Promise.resolve(null);
    }
    const geo = WIKI_GEO + encodeURIComponent(Number(lat) + "|" + Number(lon));
    return fetchJson(geo, 2500).then(function (data) {
      const hit = data && data.query && data.query.geosearch && data.query.geosearch[0];
      if (!hit || !hit.pageid) return null;
      return fetchJson(WIKI_IMG + hit.pageid, 2500).then(function (imgData) {
        const pages = imgData && imgData.query && imgData.query.pages;
        const page = pages && pages[hit.pageid];
        const src = page && page.thumbnail && page.thumbnail.source;
        if (!src) return null;
        return { url: src, source: "wikipedia", title: hit.title || "" };
      });
    }).catch(function () { return null; });
  }

  function resolveCoords(p, opts) {
    const o = opts || {};
    let lat = Number(o.lat != null ? o.lat : (p && p.lat));
    let lon = Number(o.lon != null ? o.lon : (p && (p.lon != null ? p.lon : p.lng)));
    if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && p && p.geometry && p.geometry.coordinates) {
      lon = Number(p.geometry.coordinates[0]);
      lat = Number(p.geometry.coordinates[1]);
    }
    return { lat: lat, lon: lon };
  }

  function setImg(box, url, alt, source) {
    if (!box || !url) return;
    if (box.getAttribute("data-visit-photo") === "1") return;
    const token = String(box.getAttribute("data-place-id") || "") + "|" +
      String(box.getAttribute("data-lat") || "") + "|" +
      String(box.getAttribute("data-lon") || "");
    const prev = box.querySelector("img[data-thumb-source]");
    if (prev && prev.getAttribute("src") === url && prev.getAttribute("data-thumb-source") === (source || "esri")) {
      return;
    }
    const img = document.createElement("img");
    img.alt = alt || "Place snapshot";
    img.decoding = "async";
    img.loading = "eager";
    img.setAttribute("data-thumb-source", source || "esri");
    img.onerror = function () {
      if (!box.isConnected) return;
      if (img.parentNode === box) {
        img.remove();
        if (!box.querySelector("img") && !box.querySelector(".dossier-photo-ph")) {
          box.innerHTML = '<span class="dossier-photo-ph">No snapshot yet</span>';
          box.classList.remove("has-thumb");
        }
      }
    };
    img.onload = function () {
      if (!box.isConnected) return;
      const still = String(box.getAttribute("data-place-id") || "") + "|" +
        String(box.getAttribute("data-lat") || "") + "|" +
        String(box.getAttribute("data-lon") || "");
      if (still !== token || box.getAttribute("data-visit-photo") === "1") return;
      box.classList.add("has-thumb");
    };
    img.src = url;
    // Append immediately — some WebViews never fire onload for detached imgs.
    if (box.getAttribute("data-visit-photo") === "1") return;
    box.innerHTML = "";
    box.appendChild(img);
    box.classList.add("has-thumb");
    box.setAttribute("data-thumb-source", source || "esri");
  }

  function fill(box, opts) {
    if (!box) return Promise.resolve(null);
    const o = opts || {};
    const placeId = o.placeId || box.getAttribute("data-place-id") || "";
    const lat = Number(o.lat != null ? o.lat : box.getAttribute("data-lat"));
    const lon = Number(o.lon != null ? o.lon : box.getAttribute("data-lon"));
    const title = o.title || box.getAttribute("data-title") || "Place";
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      if (!box.querySelector("img")) {
        box.innerHTML = '<span class="dossier-photo-ph">No map snapshot</span>';
      }
      return Promise.resolve(null);
    }
    box.setAttribute("data-lat", String(lat));
    box.setAttribute("data-lon", String(lon));
    if (placeId) box.setAttribute("data-place-id", placeId);

    const key = cacheKey(placeId, lat, lon);
    const esri = esriUrl(lat, lon);
    if (esri && !box.querySelector("img")) {
      setImg(box, esri, title + " — satellite", "esri");
    } else if (!box.querySelector("img") && !box.querySelector(".dossier-photo-ph")) {
      box.innerHTML = '<span class="dossier-photo-ph">Looking up place…</span>';
    }

    if (inflight[key]) return inflight[key];

    inflight[key] = readCache(key).then(function (cached) {
      if (cached && cached.url && cached.source === "wikipedia") {
        setImg(box, cached.url, title, "wikipedia");
        return cached;
      }
      if (cached && cached.url && esri && cached.url === esri) {
        setImg(box, esri, title + " — satellite", "esri");
      }
      return wikiThumb(lat, lon).then(function (wiki) {
        if (wiki && wiki.url) {
          const entry = {
            url: wiki.url,
            source: "wikipedia",
            title: wiki.title || "",
            at: new Date().toISOString(),
          };
          writeCache(key, entry);
          setImg(box, wiki.url, title, "wikipedia");
          return entry;
        }
        if (esri) {
          const entry = {
            url: esri,
            source: "esri",
            title: "",
            at: new Date().toISOString(),
          };
          writeCache(key, entry);
          setImg(box, esri, title + " — satellite", "esri");
          return entry;
        }
        if (!box.querySelector("img")) {
          box.innerHTML = '<span class="dossier-photo-ph">No snapshot yet</span>';
        }
        return null;
      });
    }).then(function (v) {
      delete inflight[key];
      return v;
    }, function () {
      delete inflight[key];
      if (esri) setImg(box, esri, title + " — satellite", "esri");
      return null;
    });

    return inflight[key];
  }

  function fillFromRoot(root, place) {
    const box = root && root.querySelector
      ? root.querySelector(".dossier-photo")
      : document.querySelector(".dossier-photo");
    if (!box) return Promise.resolve(null);
    const c = resolveCoords(place || {}, {
      lat: box.getAttribute("data-lat"),
      lon: box.getAttribute("data-lon"),
    });
    return fill(box, {
      placeId: box.getAttribute("data-place-id") || (place && place.id) || "",
      lat: c.lat,
      lon: c.lon,
      title: box.getAttribute("data-title") || "",
    });
  }

  function chipHtml(p, escFn) {
    const esc = escFn || function (s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    };
    const c = resolveCoords(p || {});
    const esri = esriUrl(c.lat, c.lon);
    if (!esri) return "";
    return `<span class="cat-thumb" aria-hidden="true">` +
      `<img src="${esc(esri)}" alt="" loading="lazy" decoding="async" />` +
      `</span>`;
  }

  global.LvfePlaceThumb = {
    esriUrl,
    fill,
    fillFromRoot,
    chipHtml,
    resolveCoords,
  };
})(typeof window !== "undefined" ? window : globalThis);
