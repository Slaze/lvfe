/* Client for save-host progression routes. Offline: local modules still work. */
(function (global) {
  function base() {
    const C = global.LvfeSaveApiConfig;
    if (C && typeof C.resolveBase === "function") return C.resolveBase();
    return "";
  }

  function authHeader(playerKey) {
    const Sync = global.LvfeSaveSync;
    if (Sync && typeof Sync.authHeader === "function") return Sync.authHeader(playerKey);
    const Cfg = global.LvfeSaveApiConfig || {};
    const prefix = Cfg.DEV_AUTH_PREFIX || "lvfe-dev:";
    return "Bearer " + prefix + String(playerKey || "default").slice(0, 32);
  }

  function post(path, body, playerKey) {
    const root = String(base() || "").replace(/\/+$/, "");
    if (!root) return Promise.resolve({ ok: false, reason: "no_save_host" });
    return fetch(root + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(playerKey),
        "X-Lvfe-Player-Key": String(playerKey || ""),
      },
      body: JSON.stringify(body || {}),
    }).then(function (r) { return r.json(); }).catch(function (err) {
      return { ok: false, reason: "network", error: String(err && err.message || err) };
    });
  }

  function checkIn(opts) {
    const o = opts || {};
    return post("/v1/check-in", {
      locationId: o.locationId || o.placeId,
      playerKey: o.playerKey,
      playerName: o.playerName,
      ownerId: o.ownerId,
      ownerName: o.ownerName,
      territoryId: o.territoryId,
    }, o.playerKey);
  }

  function rate(opts) {
    const o = opts || {};
    return post("/v1/ratings", {
      locationId: o.locationId || o.placeId,
      playerKey: o.playerKey,
      stars: o.stars,
      text: o.text,
    }, o.playerKey);
  }

  const api = { checkIn: checkIn, rate: rate, post: post };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.LvfeProgressionApi = api;
})(typeof window !== "undefined" ? window : globalThis);
