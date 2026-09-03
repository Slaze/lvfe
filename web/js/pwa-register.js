/* Register the Lvfe service worker only in real browsers.
   Skip Android WebView (LvfeNative) and appassets — SW can break the APK path.
   On update: skipWaiting + one reload so iOS PWAs pick up Nord CSS / menu fixes. */
(function (global) {
  var reloading = false;

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

  function askSkip(worker) {
    if (!worker) return;
    try {
      worker.postMessage({ type: "SKIP_WAITING" });
    } catch (err) { /* */ }
  }

  function watchWorker(worker) {
    if (!worker) return;
    worker.addEventListener("statechange", function () {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        askSkip(worker);
      }
    });
  }

  function register() {
    if (!shouldRegister()) return;
    const swUrl = new URL("sw.js", location.href).href;

    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (reloading) return;
      reloading = true;
      try {
        location.reload();
      } catch (err) { /* */ }
    });

    navigator.serviceWorker.register(swUrl, { scope: "./" }).then(function (reg) {
      if (reg.waiting) askSkip(reg.waiting);
      if (reg.installing) watchWorker(reg.installing);
      reg.addEventListener("updatefound", function () {
        watchWorker(reg.installing);
      });
      try {
        reg.update();
      } catch (err2) { /* */ }
    }).catch(function (err) {
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
