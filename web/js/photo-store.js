/* Visit photos live on this device. Confirm = IndexedDB (or memory).
   Discard = sheet close / GPS fail / user cancel — bytes never committed.
   No Google Cloud upload. */
(function (global) {
  const DB_NAME = "lvfe.photos.v1";
  const STORE = "blobs";
  const MAX_BYTES = 2.5 * 1024 * 1024;
  const mem = Object.create(null);
  let pending = null;
  let dbp = null;
  let memoryOnly = typeof indexedDB === "undefined";

  function keyOf(placeId, playerKey) {
    return String(playerKey || "default") + "::" + String(placeId || "");
  }

  function validFile(file) {
    if (!file || !(file.size > 0)) return false;
    if (file.size > MAX_BYTES) return false;
    if (file.type && !/^image\//.test(file.type)) return false;
    return true;
  }

  function metaOf(file) {
    return {
      name: (file && file.name) || "photo",
      size: (file && file.size) || 0,
      type: (file && file.type) || "image/*",
      at: new Date().toISOString(),
      stored: true,
    };
  }

  function openDb() {
    if (memoryOnly || typeof indexedDB === "undefined") {
      return Promise.resolve(null);
    }
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

  function setPending(file, placeId, playerKey) {
    if (!validFile(file)) {
      pending = null;
      return false;
    }
    pending = {
      file: file,
      placeId: String(placeId || ""),
      playerKey: String(playerKey || "default"),
    };
    return true;
  }

  function getPending() {
    return pending;
  }

  function discardPending() {
    pending = null;
  }

  function putMem(k, file) {
    mem[k] = file;
  }

  function confirm(placeId, playerKey, file) {
    const f = file || (pending && pending.file);
    const pid = placeId || (pending && pending.placeId);
    const pk = playerKey || (pending && pending.playerKey) || "default";
    if (!validFile(f) || !pid) return Promise.resolve(null);
    const k = keyOf(pid, pk);
    putMem(k, f);
    pending = null;
    return openDb().then(function (db) {
      if (!db) return metaOf(f);
      return new Promise(function (resolve) {
        try {
          const tx = db.transaction(STORE, "readwrite");
          tx.objectStore(STORE).put(f, k);
          tx.oncomplete = function () { resolve(metaOf(f)); };
          tx.onerror = function () { resolve(metaOf(f)); };
        } catch (err) {
          resolve(metaOf(f));
        }
      });
    });
  }

  function get(placeId, playerKey) {
    const k = keyOf(placeId, playerKey);
    if (mem[k]) return Promise.resolve(mem[k]);
    return openDb().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          const tx = db.transaction(STORE, "readonly");
          const req = tx.objectStore(STORE).get(k);
          req.onsuccess = function () {
            const v = req.result || null;
            if (v) mem[k] = v;
            resolve(v);
          };
          req.onerror = function () { resolve(null); };
        } catch (err) {
          resolve(null);
        }
      });
    });
  }

  function objectUrl(placeId, playerKey) {
    return get(placeId, playerKey).then(function (blob) {
      if (!blob) return "";
      try {
        return URL.createObjectURL(blob);
      } catch (err) {
        return "";
      }
    });
  }

  function blobToDataUrl(blob) {
    if (!blob) return Promise.resolve("");
    if (typeof FileReader === "undefined") return Promise.resolve("");
    return new Promise(function (resolve) {
      const r = new FileReader();
      r.onload = function () { resolve(String(r.result || "")); };
      r.onerror = function () { resolve(""); };
      r.readAsDataURL(blob);
    });
  }

  function exportPhotos(limit) {
    const cap = Number(limit) > 0 ? Number(limit) : 8;
    const keys = Object.keys(mem).slice(0, cap);
    const out = [];
    let chain = Promise.resolve();
    keys.forEach(function (k) {
      chain = chain.then(function () {
        const blob = mem[k];
        if (!blob || blob.size > 400000) return;
        return blobToDataUrl(blob).then(function (dataUrl) {
          if (!dataUrl) return;
          const parts = k.split("::");
          out.push({
            playerKey: parts[0],
            placeId: parts.slice(1).join("::"),
            type: blob.type || "image/jpeg",
            dataUrl: dataUrl,
          });
        });
      });
    });
    return chain.then(function () { return out; });
  }

  function importPhotos(rows) {
    const list = Array.isArray(rows) ? rows : [];
    list.forEach(function (row) {
      if (!row || !row.dataUrl || !row.placeId) return;
      const k = keyOf(row.placeId, row.playerKey);
      mem[k] = { name: "photo", type: row.type || "image/jpeg", size: row.dataUrl.length, _dataUrl: row.dataUrl };
    });
    return list.length;
  }

  function useMemoryOnly() {
    memoryOnly = true;
  }

  const api = {
    DB_NAME,
    MAX_BYTES,
    keyOf,
    validFile,
    metaOf,
    setPending,
    getPending,
    discardPending,
    confirm,
    get,
    objectUrl,
    exportPhotos,
    importPhotos,
    useMemoryOnly,
    _mem: mem,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfePhotoStore = api;
})(typeof window !== "undefined" ? window : globalThis);
