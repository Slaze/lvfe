/* Save sync API base. Empty = offline-only (localStorage + Export/Import).
   Local verify: start `node server/index.js` then set SAVE_API_BASE to
   http://127.0.0.1:18787 (desktop) or http://<lan-ip>:18787 (Nord WebView).
   Override: ?saveApi=http://… or localStorage lvfe.saveApiBase.
   Never put production secrets here. */
(function (global) {
  const SAVE_API_BASE = "";
  const DEV_AUTH_PREFIX = "lvfe-dev:";
  const QUEUE_KEY = "lvfe.save.queue.v1";
  const LAST_SYNC_KEY = "lvfe.save.lastSync.v1";
  const MAX_PHOTO_SYNC = 8;
  const PHOTO_BYTES_SOFT = 400000;

  function resolveBase() {
    try {
      const q = new URLSearchParams(location.search).get("saveApi");
      if (q) return String(q).replace(/\/+$/, "");
    } catch (err) { /* */ }
    try {
      const ls = localStorage.getItem("lvfe.saveApiBase");
      if (ls) return String(ls).replace(/\/+$/, "");
    } catch (err) { /* */ }
    const cfg = String(SAVE_API_BASE || "").trim().replace(/\/+$/, "");
    return cfg;
  }

  const api = {
    SAVE_API_BASE,
    DEV_AUTH_PREFIX,
    QUEUE_KEY,
    LAST_SYNC_KEY,
    MAX_PHOTO_SYNC,
    PHOTO_BYTES_SOFT,
    resolveBase,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfeSaveApiConfig = api;
})(typeof window !== "undefined" ? window : globalThis);
