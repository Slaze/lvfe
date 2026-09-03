/* Server save pull/push. Local cache stays authoritative offline.
   Conflict: last-write-wins by pack.updatedAt. Queue pushes when offline.
   Auth: Bearer lvfe-dev:<playerKey> until Google Web client ID exists;
   production Gmail without OAuth config fails loud from the server. */
(function (global) {
  const Acc = () => global.LvfeAccount;
  const Cfg = () => global.LvfeSaveApiConfig || {};

  function storage() {
    if (typeof localStorage === "undefined") {
      if (!global.__lvfeSyncMem) global.__lvfeSyncMem = {};
      const mem = global.__lvfeSyncMem;
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
        setItem: function (k, v) { mem[k] = String(v); },
        removeItem: function (k) { delete mem[k]; },
      };
    }
    return localStorage;
  }

  function lsGet(key, fallback) {
    try {
      const raw = storage().getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function lsSet(key, val) {
    storage().setItem(key, JSON.stringify(val));
  }

  function base() {
    return (Cfg().resolveBase && Cfg().resolveBase()) || "";
  }

  function enabled() {
    return Boolean(base());
  }

  function authHeader(playerKey) {
    const pk = String(playerKey || "default").slice(0, 32);
    const prefix = Cfg().DEV_AUTH_PREFIX || "lvfe-dev:";
    const g = global.LvfeGoogleAuth;
    if (g && typeof g.lastIdToken === "function") {
      const tok = g.lastIdToken();
      if (tok) return "Bearer google:" + tok;
    }
    if (global.__lvfeGoogleIdToken) {
      return "Bearer google:" + global.__lvfeGoogleIdToken;
    }
    return "Bearer " + prefix + pk;
  }

  function bumpUpdated(pack) {
    if (!pack) return pack;
    pack.updatedAt = new Date().toISOString();
    return pack;
  }

  function buildPack(opts) {
    const A = Acc();
    if (!A) return null;
    const o = opts || {};
    const pack = A.packSave({
      playerKey: o.playerKey || "default",
      googleSub: o.googleSub || "",
      email: o.email || "",
      photos: Array.isArray(o.photos) ? o.photos : [],
    });
    return bumpUpdated(pack);
  }

  function queuePush(playerKey) {
    const key = Cfg().QUEUE_KEY || "lvfe.save.queue.v1";
    const q = lsGet(key, { pending: false, playerKey: "" });
    q.pending = true;
    q.playerKey = String(playerKey || q.playerKey || "default");
    q.at = new Date().toISOString();
    lsSet(key, q);
  }

  function clearQueue() {
    const key = Cfg().QUEUE_KEY || "lvfe.save.queue.v1";
    lsSet(key, { pending: false, playerKey: "" });
  }

  function queueState() {
    return lsGet(Cfg().QUEUE_KEY || "lvfe.save.queue.v1", { pending: false });
  }

  function lastSync() {
    return lsGet(Cfg().LAST_SYNC_KEY || "lvfe.save.lastSync.v1", null);
  }

  function setLastSync(row) {
    lsSet(Cfg().LAST_SYNC_KEY || "lvfe.save.lastSync.v1", row);
  }

  function fetchJson(url, init) {
    return fetch(url, init).then(function (res) {
      return res.text().then(function (text) {
        let json = null;
        try { json = JSON.parse(text || "null"); } catch (err) { /* */ }
        return { ok: res.ok, status: res.status, json: json, text: text };
      });
    });
  }

  function pull(playerKey) {
    const b = base();
    if (!b) {
      return Promise.resolve({ ok: false, skipped: true, error: "SAVE_API_BASE empty — local only." });
    }
    const pk = String(playerKey || "default").slice(0, 32);
    const url = b + "/v1/save/" + encodeURIComponent(pk);
    return fetchJson(url, {
      method: "GET",
      headers: {
        Authorization: authHeader(pk),
        "X-Lvfe-Player-Key": pk,
      },
    }).then(function (res) {
      if (res.status === 404) {
        return { ok: true, empty: true, accountKey: pk };
      }
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          code: res.json && res.json.code,
          error: (res.json && res.json.error) || res.text || "Pull failed",
        };
      }
      return {
        ok: true,
        accountKey: pk,
        updatedAt: res.json.updatedAt,
        pack: res.json.pack,
      };
    }).catch(function (err) {
      return { ok: false, offline: true, error: String(err && err.message || err) };
    });
  }

  function push(playerKey, packOpts) {
    const b = base();
    if (!b) {
      return Promise.resolve({ ok: false, skipped: true, error: "SAVE_API_BASE empty — local only." });
    }
    const pk = String(playerKey || "default").slice(0, 32);
    const finish = function (photos) {
      const pack = buildPack(Object.assign({}, packOpts || {}, { playerKey: pk, photos: photos || [] }));
      if (!pack) return Promise.resolve({ ok: false, error: "LvfeAccount missing" });
      const url = b + "/v1/save/" + encodeURIComponent(pk);
      return fetchJson(url, {
        method: "PUT",
        headers: {
          Authorization: authHeader(pk),
          "Content-Type": "application/json",
          "X-Lvfe-Player-Key": pk,
        },
        body: JSON.stringify({ pack: pack }),
      }).then(function (res) {
        if (res.status === 409 && res.json && res.json.pack) {
          return {
            ok: false,
            stale: true,
            status: 409,
            pack: res.json.pack,
            updatedAt: res.json.updatedAt,
            error: res.json.error || "stale",
          };
        }
        if (!res.ok) {
          queuePush(pk);
          return {
            ok: false,
            status: res.status,
            code: res.json && res.json.code,
            error: (res.json && res.json.error) || res.text || "Push failed",
          };
        }
        clearQueue();
        setLastSync({ at: new Date().toISOString(), playerKey: pk, updatedAt: pack.updatedAt, dir: "push" });
        return { ok: true, updatedAt: pack.updatedAt, accountKey: pk };
      }).catch(function (err) {
        queuePush(pk);
        return { ok: false, offline: true, error: String(err && err.message || err) };
      });
    };

    const Photos = global.LvfePhotoStore;
    const cap = Cfg().MAX_PHOTO_SYNC || 8;
    if (Photos && Photos.exportPhotos) {
      return Photos.exportPhotos(cap).then(finish).catch(function () { return finish([]); });
    }
    return finish([]);
  }

  function applyPack(pack, hooks) {
    const A = Acc();
    if (!A || !pack) return { ok: false, error: "No pack" };
    const res = A.unpackSave(pack);
    if (!res.ok) return res;
    if (global.LvfePhotoStore && res.photos && res.photos.length) {
      global.LvfePhotoStore.importPhotos(res.photos);
    }
    if (hooks && typeof hooks.afterImport === "function") {
      hooks.afterImport(res, pack);
    }
    setLastSync({
      at: new Date().toISOString(),
      playerKey: res.playerKey,
      updatedAt: pack.updatedAt || "",
      dir: "pull",
    });
    return res;
  }

  function pullAndMerge(playerKey, hooks) {
    return pull(playerKey).then(function (res) {
      if (res.skipped || res.empty) return res;
      if (!res.ok) return res;
      const local = buildPack({ playerKey: playerKey });
      const remote = res.pack;
      if (local && remote && local.updatedAt && remote.updatedAt && local.updatedAt > remote.updatedAt) {
        return push(playerKey, hooks && hooks.packOpts).then(function (p) {
          return Object.assign({ pulled: false, pushedLocal: true }, p);
        });
      }
      const applied = applyPack(remote, hooks);
      return Object.assign({ pulled: true }, res, { applied: applied });
    });
  }

  function flushQueue(playerKey, packOpts) {
    const q = queueState();
    if (!q.pending && navigator && navigator.onLine === false) {
      return Promise.resolve({ ok: false, queued: true });
    }
    const pk = playerKey || q.playerKey || "default";
    if (!enabled()) return Promise.resolve({ ok: false, skipped: true });
    if (!q.pending && !packOpts) return Promise.resolve({ ok: true, idle: true });
    return push(pk, packOpts);
  }

  function statusLine() {
    if (!enabled()) return "Cloud save needs Sign in with Google";
    const last = lastSync();
    const q = queueState();
    if (q.pending) return "Cloud save pending…";
    if (last && last.at) {
      const when = String(last.at).slice(0, 16).replace("T", " ");
      if (last.dir === "pull") return "Cloud save loaded · " + when;
      if (last.dir === "push") return "Cloud save uploaded · " + when;
      return "Cloud save · " + when;
    }
    return "Cloud save ready";
  }

  const api = {
    enabled,
    base,
    authHeader,
    buildPack,
    bumpUpdated,
    pull,
    push,
    pullAndMerge,
    applyPack,
    queuePush,
    flushQueue,
    queueState,
    lastSync,
    statusLine,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfeSaveSync = api;
})(typeof window !== "undefined" ? window : globalThis);
