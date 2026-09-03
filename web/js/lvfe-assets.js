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

  g.lvfeAsset = lvfeAsset;
  g.lvfePwaBase = pwaBase;
})(typeof window !== "undefined" ? window : globalThis);
