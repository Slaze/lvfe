/* Place dossier thumbs — confirmed ground photos only.
   Priority: visit photo (IndexedDB / save pack) → OSM tags (image /
   wikimedia_commons / mapillary) → Wikipedia/Wikimedia Commons photo →
   optional Mapillary API if token present → clear placeholder.
   Never Esri World Imagery / map canvas / Google photo SKUs. */
(function (global) {
  const DB_NAME = "lvfe.place-thumbs.v2";
  const STORE = "urls";
  const PH_NONE = "No photo yet — visit to confirm";
  const PH_LOOK = "Looking up place…";
  const WIKI_GEO =
    "https://en.wikipedia.org/w/api.php?action=query&list=geosearch" +
    "&gsradius=800&gslimit=5&format=json&origin=*&gscoord=";
  const WIKI_IMG =
    "https://en.wikipedia.org/w/api.php?action=query&prop=pageimages|info" +
    "&piprop=thumbnail&pithumbsize=640&inprop=url&format=json&origin=*&pageids=";
  const WIKI_SEARCH =
    "https://en.wikipedia.org/w/api.php?action=query&list=search" +
    "&srlimit=3&format=json&origin=*&srsearch=";
  const COMMONS_GEO =
    "https://commons.wikimedia.org/w/api.php?action=query&list=geosearch" +
    "&gsradius=600&gslimit=5&gsnamespace=6&format=json&origin=*&gscoord=";
  const COMMONS_INFO =
    "https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo" +
    "&iiprop=url|mime|extmetadata&iiurlwidth=640&format=json&origin=*&titles=";
  const AERIAL_RE =
    /satellite|aerial|orthophoto|ortho.?photo|from.?above|planet.?earth|world.?imagery|map.?raster|landsat|sentinel/i;
  const mem = Object.create(null);
  const inflight = Object.create(null);
  let dbp = null;
  let memoryOnly = typeof indexedDB === "undefined";

  function placeholderHtml(text) {
    return '<span class="dossier-photo-ph">' + String(text || PH_NONE) + "</span>";
  }

  function showPlaceholder(box, text) {
    if (!box || box.getAttribute("data-visit-photo") === "1") return;
    if (box.querySelector("img[data-thumb-source]")) return;
    box.innerHTML = placeholderHtml(text || PH_NONE);
    box.classList.remove("has-thumb");
    box.removeAttribute("data-thumb-source");
  }

  function isAerialish(title, url) {
    const s = String(title || "") + " " + String(url || "");
    return AERIAL_RE.test(s);
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
            if (v && v.url && v.source && v.source !== "esri") {
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
    if (!entry || !entry.url || entry.source === "esri") return Promise.resolve();
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
    }, ms || 2800);
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

  function mediaFromProps(p) {
    const o = p || {};
    const tags = o.tags && typeof o.tags === "object" ? o.tags : o;
    return {
      image: o.image || tags.image || tags["image:url"] || "",
      wikimedia_commons: o.wikimedia_commons || tags.wikimedia_commons || "",
      mapillary: o.mapillary || tags.mapillary || "",
      wikipedia: o.wikipedia || tags.wikipedia || "",
    };
  }

  function commonsFileTitle(raw) {
    let s = String(raw || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) {
      const m = s.match(/\/(?:wiki\/|File:|Special:FilePath\/)(.+)$/i);
      if (m) s = decodeURIComponent(m[1].replace(/_/g, " "));
      else return "";
    }
    s = s.replace(/^File:/i, "").trim();
    if (!s || /^Category:/i.test(s)) return "";
    return "File:" + s;
  }

  function httpImageUrl(raw) {
    const s = String(raw || "").trim();
    if (!/^https?:\/\//i.test(s)) return "";
    if (/arcgisonline|World_Imagery|googleusercontent\.com\/maps|streetview|maps\.googleapis/i.test(s)) {
      return "";
    }
    return s;
  }

  function mapillaryToken() {
    try {
      const cfg = global.LvfeMapillaryConfig;
      if (cfg && cfg.ACCESS_TOKEN) return String(cfg.ACCESS_TOKEN).trim();
    } catch (e) { /* */ }
    try {
      if (typeof localStorage !== "undefined") {
        const t = localStorage.getItem("lvfe.mapillaryToken");
        if (t) return String(t).trim();
      }
    } catch (e2) { /* */ }
    return "";
  }

  function setImg(box, url, alt, source) {
    if (!box || !url) return;
    if (box.getAttribute("data-visit-photo") === "1") return;
    if (source === "esri" || /World_Imagery|arcgisonline/i.test(url)) return;
    const token = String(box.getAttribute("data-place-id") || "") + "|" +
      String(box.getAttribute("data-lat") || "") + "|" +
      String(box.getAttribute("data-lon") || "");
    const prev = box.querySelector("img[data-thumb-source]");
    if (prev && prev.getAttribute("src") === url && prev.getAttribute("data-thumb-source") === source) {
      return;
    }
    const img = document.createElement("img");
    img.alt = alt || "Place photo";
    img.decoding = "async";
    img.loading = "eager";
    img.setAttribute("data-thumb-source", source || "photo");
    img.onerror = function () {
      if (!box.isConnected) return;
      if (img.parentNode === box) {
        img.remove();
        if (!box.querySelector("img") && box.getAttribute("data-visit-photo") !== "1") {
          showPlaceholder(box, PH_NONE);
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
    if (box.getAttribute("data-visit-photo") === "1") return;
    box.innerHTML = "";
    box.appendChild(img);
    box.classList.add("has-thumb");
    box.setAttribute("data-thumb-source", source || "photo");
  }

  function visitPhotoUrl(placeId, playerKey) {
    const Photos = global.LvfePhotoStore;
    if (!Photos || !placeId) return Promise.resolve("");
    const pk = playerKey ||
      (global.LvfeCatalogWallet && global.LvfeCatalogWallet.playerKey && global.LvfeCatalogWallet.playerKey()) ||
      "default";
    return Photos.objectUrl(placeId, pk).then(function (url) {
      if (url) return url;
      /* Imported save-pack rows may live as dataURL blobs in mem. */
      try {
        const k = Photos.keyOf(placeId, pk);
        const row = Photos._mem && Photos._mem[k];
        if (row && row._dataUrl) return row._dataUrl;
      } catch (e) { /* */ }
      return "";
    }).catch(function () { return ""; });
  }

  function commonsThumb(title) {
    const file = commonsFileTitle(title);
    if (!file) return Promise.resolve(null);
    return fetchJson(COMMONS_INFO + encodeURIComponent(file), 2800).then(function (data) {
      const pages = data && data.query && data.query.pages;
      if (!pages) return null;
      const keys = Object.keys(pages);
      for (let i = 0; i < keys.length; i++) {
        const page = pages[keys[i]];
        if (!page || page.missing != null) continue;
        const ii = page.imageinfo && page.imageinfo[0];
        if (!ii) continue;
        const url = ii.thumburl || ii.url;
        if (!url || !/^image\//i.test(String(ii.mime || "image/jpeg"))) continue;
        if (isAerialish(page.title, url)) continue;
        return { url: url, source: "wikimedia", title: page.title || file };
      }
      return null;
    }).catch(function () { return null; });
  }

  function wikiPageThumb(pageid) {
    if (!pageid) return Promise.resolve(null);
    return fetchJson(WIKI_IMG + pageid, 2800).then(function (imgData) {
      const pages = imgData && imgData.query && imgData.query.pages;
      const page = pages && pages[pageid];
      const src = page && page.thumbnail && page.thumbnail.source;
      if (!src || isAerialish(page.title, src)) return null;
      return { url: src, source: "wikipedia", title: (page && page.title) || "" };
    }).catch(function () { return null; });
  }

  function wikiTitleMatch(title) {
    const q = String(title || "").trim();
    if (q.length < 3) return Promise.resolve(null);
    return fetchJson(WIKI_SEARCH + encodeURIComponent(q), 2800).then(function (data) {
      const hits = data && data.query && data.query.search;
      if (!hits || !hits.length) return null;
      let chain = Promise.resolve(null);
      hits.forEach(function (hit) {
        chain = chain.then(function (found) {
          if (found) return found;
          if (!hit || !hit.pageid || isAerialish(hit.title)) return null;
          return wikiPageThumb(hit.pageid);
        });
      });
      return chain;
    }).catch(function () { return null; });
  }

  function wikiGeoThumb(lat, lon, title) {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
      return Promise.resolve(null);
    }
    const geo = WIKI_GEO + encodeURIComponent(Number(lat) + "|" + Number(lon));
    const want = String(title || "").toLowerCase();
    return fetchJson(geo, 2800).then(function (data) {
      const hits = (data && data.query && data.query.geosearch) || [];
      const ordered = hits.slice().sort(function (a, b) {
        const an = want && String(a.title || "").toLowerCase().indexOf(want) >= 0 ? 0 : 1;
        const bn = want && String(b.title || "").toLowerCase().indexOf(want) >= 0 ? 0 : 1;
        if (an !== bn) return an - bn;
        return (a.dist || 0) - (b.dist || 0);
      });
      let chain = Promise.resolve(null);
      ordered.forEach(function (hit) {
        chain = chain.then(function (found) {
          if (found) return found;
          if (!hit || !hit.pageid || isAerialish(hit.title)) return null;
          return wikiPageThumb(hit.pageid);
        });
      });
      return chain;
    }).catch(function () { return null; });
  }

  function commonsGeoThumb(lat, lon) {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
      return Promise.resolve(null);
    }
    const geo = COMMONS_GEO + encodeURIComponent(Number(lat) + "|" + Number(lon));
    return fetchJson(geo, 2800).then(function (data) {
      const hits = (data && data.query && data.query.geosearch) || [];
      let chain = Promise.resolve(null);
      hits.forEach(function (hit) {
        chain = chain.then(function (found) {
          if (found) return found;
          if (!hit || !hit.title || isAerialish(hit.title)) return null;
          return commonsThumb(hit.title);
        });
      });
      return chain;
    }).catch(function () { return null; });
  }

  function osmTagThumb(media) {
    const m = media || {};
    const direct = httpImageUrl(m.image);
    if (direct) {
      return Promise.resolve({ url: direct, source: "osm-image", title: "" });
    }
    if (m.wikimedia_commons) {
      return commonsThumb(m.wikimedia_commons);
    }
    if (m.wikipedia) {
      const wp = String(m.wikipedia);
      const parts = wp.split(":");
      let title = wp;
      if (parts.length >= 2 && parts[0].length <= 8) {
        title = parts.slice(1).join(":");
      }
      return wikiTitleMatch(title);
    }
    if (m.mapillary && !mapillaryToken()) {
      /* Tag alone is not a displayable URL without API. */
      return Promise.resolve(null);
    }
    return Promise.resolve(null);
  }

  function mapillaryThumb(lat, lon) {
    const token = mapillaryToken();
    if (!token || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
      return Promise.resolve(null);
    }
    const d = 0.0006;
    const bbox = [
      Number(lon) - d, Number(lat) - d, Number(lon) + d, Number(lat) + d,
    ].join(",");
    const url = "https://graph.mapillary.com/images?access_token=" +
      encodeURIComponent(token) +
      "&fields=id,thumb_1024_url,compass_angle&bbox=" + encodeURIComponent(bbox) +
      "&limit=1";
    return fetchJson(url, 3000).then(function (data) {
      const row = data && data.data && data.data[0];
      const src = row && row.thumb_1024_url;
      if (!src) return null;
      return { url: src, source: "mapillary", title: "" };
    }).catch(function () { return null; });
  }

  function resolveRemote(opts) {
    const o = opts || {};
    const lat = Number(o.lat);
    const lon = Number(o.lon);
    const title = o.title || "";
    const media = mediaFromProps(o);
    return osmTagThumb(media).then(function (hit) {
      if (hit && hit.url) return hit;
      return wikiGeoThumb(lat, lon, title).then(function (wiki) {
        if (wiki && wiki.url) return wiki;
        return wikiTitleMatch(title).then(function (byTitle) {
          if (byTitle && byTitle.url) return byTitle;
          return commonsGeoThumb(lat, lon).then(function (commons) {
            if (commons && commons.url) return commons;
            return mapillaryThumb(lat, lon);
          });
        });
      });
    });
  }

  function fill(box, opts) {
    if (!box) return Promise.resolve(null);
    const o = opts || {};
    const placeId = o.placeId || box.getAttribute("data-place-id") || "";
    const lat = Number(o.lat != null ? o.lat : box.getAttribute("data-lat"));
    const lon = Number(o.lon != null ? o.lon : box.getAttribute("data-lon"));
    const title = o.title || box.getAttribute("data-title") || "Place";
    const playerKey = o.playerKey || "";
    if (placeId) box.setAttribute("data-place-id", placeId);
    if (Number.isFinite(lat)) box.setAttribute("data-lat", String(lat));
    if (Number.isFinite(lon)) box.setAttribute("data-lon", String(lon));
    if (title) box.setAttribute("data-title", title);

    if (box.getAttribute("data-visit-photo") === "1" && box.querySelector("img")) {
      return Promise.resolve({ source: "visit" });
    }

    if (!box.querySelector("img") && !box.querySelector(".dossier-photo-ph")) {
      showPlaceholder(box, PH_LOOK);
    } else if (!box.querySelector("img")) {
      showPlaceholder(box, PH_LOOK);
    }

    const key = cacheKey(placeId, lat, lon);
    if (inflight[key]) return inflight[key];

    inflight[key] = visitPhotoUrl(placeId, playerKey).then(function (visitUrl) {
      if (visitUrl) {
        box.setAttribute("data-visit-photo", "1");
        setImg(box, visitUrl, "Visit photo", "visit");
        return { url: visitUrl, source: "visit" };
      }
      return readCache(key).then(function (cached) {
        if (cached && cached.url && cached.source !== "esri") {
          setImg(box, cached.url, title, cached.source);
          return cached;
        }
        return resolveRemote({
          lat: lat,
          lon: lon,
          title: title,
          image: o.image,
          wikimedia_commons: o.wikimedia_commons,
          mapillary: o.mapillary,
          wikipedia: o.wikipedia,
          tags: o.tags,
        }).then(function (hit) {
          if (hit && hit.url && hit.source !== "esri") {
            const entry = {
              url: hit.url,
              source: hit.source,
              title: hit.title || "",
              at: new Date().toISOString(),
            };
            writeCache(key, entry);
            setImg(box, hit.url, title, hit.source);
            return entry;
          }
          showPlaceholder(box, PH_NONE);
          return null;
        });
      });
    }).then(function (v) {
      delete inflight[key];
      return v;
    }, function () {
      delete inflight[key];
      if (box.getAttribute("data-visit-photo") !== "1") showPlaceholder(box, PH_NONE);
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
    const media = mediaFromProps(place || {});
    return fill(box, {
      placeId: box.getAttribute("data-place-id") || (place && place.id) || "",
      lat: c.lat,
      lon: c.lon,
      title: box.getAttribute("data-title") || (place && place.name) || "",
      image: media.image,
      wikimedia_commons: media.wikimedia_commons,
      mapillary: media.mapillary,
      wikipedia: media.wikipedia,
      tags: place && place.tags,
    });
  }

  function chipHtml(p, escFn) {
    const esc = escFn || function (s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    };
    const media = mediaFromProps(p || {});
    const url = httpImageUrl(media.image);
    if (!url) {
      return `<span class="cat-thumb cat-thumb-empty" aria-hidden="true"></span>`;
    }
    return `<span class="cat-thumb" aria-hidden="true">` +
      `<img src="${esc(url)}" alt="" loading="lazy" decoding="async" data-thumb-source="osm-image" />` +
      `</span>`;
  }

  global.LvfePlaceThumb = {
    fill,
    fillFromRoot,
    chipHtml,
    resolveCoords,
    mediaFromProps,
    commonsFileTitle,
    httpImageUrl,
    isAerialish,
    PH_NONE,
  };
})(typeof window !== "undefined" ? window : globalThis);
