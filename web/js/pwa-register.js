/* Register the Lvfe service worker only in real browsers.
   Skip Android WebView (LvfeNative) and appassets — SW can break the APK path. */
(function (global) {
  function shouldRegister() {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
    if (typeof global.LvfeNative !== "undefined") return false;
    try {
      const host = String(location.hostname || "");
      if (host === "appassets.androidplatform.net") return false;
      if (location.protocol === "file:") return false;
      if (/(?:^|\/)(?:www|android_asset)\//.test(location.pathname || "")) return false;
    } catch (err) {
      return false;
    }
    return true;
  }

  function register() {
    if (!shouldRegister()) return;
    const swUrl = new URL("sw.js", location.href).href;
    navigator.serviceWorker.register(swUrl, { scope: "./" }).catch(function (err) {
      try {
        console.warn("[lvfe-pwa] SW register failed:", err && err.message ? err.message : err);
      } catch (e) { /* */ }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", register);
  } else {
    register();
  }

  global.LvfePwa = { shouldRegister, register };
})(typeof window !== "undefined" ? window : globalThis);
