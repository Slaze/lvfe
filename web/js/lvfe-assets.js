/* Resolve catalog/geojson URLs for both:
   - python http.server from the lvfe repo root (/data, /geojson)
   - Android WebViewAssetLoader (https://appassets.androidplatform.net/assets/www/) */
(function (g) {
  function lvfeAsset(rel) {
    rel = String(rel || "").replace(/^\//, "");
    var bundled =
      location.hostname === "appassets.androidplatform.net" ||
      location.protocol === "file:" ||
      /(?:^|\/)(?:www|android_asset)\//.test(location.pathname || "");
    if (bundled) return new URL(rel, location.href).href;
    return "/" + rel;
  }
  g.lvfeAsset = lvfeAsset;
})(typeof window !== "undefined" ? window : globalThis);
