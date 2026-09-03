/* Resolve catalog/geojson URLs for:
   - python http.server from the lvfe repo root (/data, /geojson)
   - Android WebViewAssetLoader (https://appassets.androidplatform.net/assets/www/)
   - HTTPS PWA under https://iconiaglobal.com/lvfe/ (co-located data/) */
(function (g) {
  function isBundled() {
    return (
      location.hostname === "appassets.androidplatform.net" ||
      location.protocol === "file:" ||
      /(?:^|\/)(?:www|android_asset)\//.test(location.pathname || "")
    );
  }

  function pwaBase() {
    try {
      const path = location.pathname || "/";
      const m = path.match(/^(.*?\/lvfe)(?:\/|$)/);
      if (m) return m[1].replace(/\/+$/, "") + "/";
    } catch (err) { /* */ }
    return "";
  }

  function lvfeAsset(rel) {
    rel = String(rel || "").replace(/^\//, "");
    if (isBundled()) return new URL(rel, location.href).href;
    if (g.LVFE_ASSET_BASE) {
      return String(g.LVFE_ASSET_BASE).replace(/\/+$/, "") + "/" + rel;
    }
    const base = pwaBase();
    if (base) return base + rel;
    return "/" + rel;
  }

  /** Agents / ops: ?debug=1 or localStorage.lvfe.debug=1. Never for players. */
  function lvfeDebug() {
    try {
      if (/[?&]debug=1(?:&|$)/.test(String(g.location && g.location.search || ""))) return true;
      if (typeof localStorage !== "undefined" && localStorage.getItem("lvfe.debug") === "1") return true;
    } catch (err) { /* */ }
    return false;
  }

  function lvfeDebugLog() {
    if (!lvfeDebug()) return;
    try {
      const args = ["[lvfe]"].concat(Array.prototype.slice.call(arguments));
      if (typeof console !== "undefined" && console.info) console.info.apply(console, args);
    } catch (err) { /* */ }
  }

  /** Map sync/API failures to short game voice (raw stays in debug log). */
  function lvfeCloudPlayerMsg(res) {
    if (lvfeDebug() && res && res.error) {
      lvfeDebugLog("cloud", res.code || "", res.error, res.status || "");
    }
    if (!res) return "Cloud save failed — try again.";
    if (res.skipped) return "Cloud save needs Sign in with Google";
    if (res.code === "key_mismatch" || res.code === "oauth_not_configured" || res.code === "unauthorized") {
      return "Cloud save needs Sign in with Google";
    }
    if (res.offline || res.status === 0) return "Couldn't reach cloud save — try again";
    if (res.status === 403 || res.status === 401) return "Cloud save needs Sign in with Google";
    if (res.stale) return "Cloud save updated from another device.";
    return "Cloud save failed — try again.";
  }

  g.lvfeAsset = lvfeAsset;
  g.lvfePwaBase = pwaBase;
  g.lvfeDebug = lvfeDebug;
  g.lvfeDebugLog = lvfeDebugLog;
  g.lvfeCloudPlayerMsg = lvfeCloudPlayerMsg;
})(typeof window !== "undefined" ? window : globalThis);
