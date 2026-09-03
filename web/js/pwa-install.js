/* In-app PWA install / Add to Home Screen prompt.
   Real Chromium beforeinstallprompt when available; iOS Safari gets a Share guide.
   Skipped in Android APK WebView (LvfeNative / appassets) and when already installed. */
(function (global) {
  var DISMISS_KEY = "lvfe.pwa.install.dismissedAt";
  var NEVER_KEY = "lvfe.pwa.install.never";
  var SESSION_KEY = "lvfe.pwa.install.sessionShown";
  var COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
  var deferredPrompt = null;
  var bannerBound = false;
  var pendingShow = false;

  function isNativeApk() {
    if (typeof global.LvfeNative !== "undefined") return true;
    try {
      var host = String(location.hostname || "");
      if (host === "appassets.androidplatform.net") return true;
      if (location.protocol === "file:") return true;
      if (/(?:^|\/)(?:www|android_asset)\//.test(location.pathname || "")) return true;
    } catch (err) { /* */ }
    return false;
  }

  function isStandalone() {
    try {
      if (global.matchMedia && matchMedia("(display-mode: standalone)").matches) return true;
      if (global.matchMedia && matchMedia("(display-mode: fullscreen)").matches) return true;
      if (typeof navigator !== "undefined" && navigator.standalone === true) return true;
    } catch (err) { /* */ }
    return false;
  }

  function isIosSafari() {
    try {
      var ua = String(navigator.userAgent || "");
      var iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (!iOS) return false;
      /* Chrome/Firefox/Edge on iOS still use WebKit but lack A2HS UX like Safari. */
      if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return false;
      return /Safari/i.test(ua) || !/Chrome|Android/i.test(ua);
    } catch (err) {
      return false;
    }
  }

  function guideUrl(hash) {
    try {
      var u = new URL("install.html", location.href);
      if (hash) u.hash = hash.replace(/^#/, "");
      return u.href;
    } catch (err) {
      return "install.html" + (hash ? "#" + hash.replace(/^#/, "") : "");
    }
  }

  function canAutoPrompt() {
    if (isNativeApk() || isStandalone()) return false;
    try {
      if (localStorage.getItem(NEVER_KEY) === "1") return false;
      var raw = localStorage.getItem(DISMISS_KEY);
      if (raw) {
        var t = Number(raw);
        if (isFinite(t) && Date.now() - t < COOLDOWN_MS) return false;
      }
      if (sessionStorage.getItem(SESSION_KEY) === "1") return false;
    } catch (err) { /* */ }
    return true;
  }

  function markSessionShown() {
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (err) { /* */ }
  }

  function dismissLater() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch (err) { /* */ }
    hideBanner();
  }

  function dismissNever() {
    try {
      localStorage.setItem(NEVER_KEY, "1");
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch (err) { /* */ }
    hideBanner();
  }

  function bannerEl() {
    return document.getElementById("pwaInstallBanner");
  }

  function hideBanner() {
    var el = bannerEl();
    if (el) el.hidden = true;
  }

  function platformCopy() {
    if (deferredPrompt) {
      return {
        title: "Install Lvfe on this device",
        body: "Add the game to your home screen for a full-screen app — not an App Store fake. Sign in with Google after install to sync saves.",
        primary: "Install",
        primaryAct: "install",
        howHash: isIosSafari() ? "ios" : (/Android/i.test(navigator.userAgent || "") ? "android" : "desktop"),
      };
    }
    if (isIosSafari()) {
      return {
        title: "Add Lvfe to your Home Screen",
        body: "On iPhone or iPad: tap Share, then Add to Home Screen. Opens like an app. Sign in with Google to sync across devices.",
        primary: "Show me how",
        primaryAct: "how",
        howHash: "ios",
      };
    }
    if (/Android/i.test(navigator.userAgent || "")) {
      return {
        title: "Install Lvfe",
        body: "In Chrome: menu → Install app or Add to Home screen. Full-screen game icon. Sign in with Google to sync saves.",
        primary: "Show me how",
        primaryAct: "how",
        howHash: "android",
      };
    }
    return {
      title: "Install Lvfe as an app",
      body: "In Chrome or Edge: use Install app from the address bar or the browser menu. Sign in with Google after install to sync.",
      primary: "Show me how",
      primaryAct: "how",
      howHash: "desktop",
    };
  }

  function bindBanner() {
    if (bannerBound) return;
    bannerBound = true;
    var el = bannerEl();
    if (!el) return;
    el.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      var act = t.getAttribute("data-pwa-act");
      if (!act) return;
      e.preventDefault();
      if (act === "later") {
        dismissLater();
        return;
      }
      if (act === "never") {
        dismissNever();
        return;
      }
      if (act === "how") {
        var copy = platformCopy();
        hideBanner();
        markSessionShown();
        location.href = guideUrl(copy.howHash);
        return;
      }
      if (act === "install") {
        triggerInstall().then(function (ok) {
          if (ok) {
            hideBanner();
            markSessionShown();
          } else {
            location.href = guideUrl(platformCopy().howHash);
          }
        });
      }
    });
  }

  function showBanner(force) {
    if (isNativeApk() || isStandalone()) return false;
    if (!force && !canAutoPrompt()) return false;
    var el = bannerEl();
    if (!el) {
      pendingShow = true;
      return false;
    }
    bindBanner();
    var copy = platformCopy();
    var howLabel = copy.primaryAct === "install" ? "Show me how" : copy.primary;
    var primaryHtml = copy.primaryAct === "install"
      ? '<button type="button" class="primary" data-pwa-act="install">' + copy.primary + "</button>" +
        '<button type="button" class="ghost" data-pwa-act="how">' + howLabel + "</button>"
      : '<button type="button" class="primary" data-pwa-act="how">' + copy.primary + "</button>";
    el.innerHTML =
      "<strong>" + copy.title + "</strong>" +
      "<p>" + copy.body + "</p>" +
      '<div class="ban-acts">' + primaryHtml +
      '<button type="button" class="ghost" data-pwa-act="later">Maybe later</button>' +
      "</div>";
    el.hidden = false;
    if (!force) markSessionShown();
    pendingShow = false;
    return true;
  }

  function triggerInstall() {
    if (!deferredPrompt) return Promise.resolve(false);
    var ev = deferredPrompt;
    deferredPrompt = null;
    return ev.prompt().then(function () {
      return ev.userChoice;
    }).then(function (choice) {
      var accepted = choice && choice.outcome === "accepted";
      if (accepted) {
        try { localStorage.setItem(NEVER_KEY, "1"); } catch (err) { /* */ }
      }
      return !!accepted;
    }).catch(function () {
      return false;
    });
  }

  function maybeAfterSplashOrPlay(opts) {
    opts = opts || {};
    if (!canAutoPrompt()) return;
    var delay = typeof opts.delayMs === "number" ? opts.delayMs : 1600;
    window.setTimeout(function () {
      showBanner(false);
    }, delay);
  }

  function openGuide(hash) {
    location.href = guideUrl(hash || platformCopy().howHash);
  }

  function onBeforeInstall(e) {
    e.preventDefault();
    deferredPrompt = e;
    if (pendingShow) showBanner(true);
  }

  function init() {
    if (isNativeApk()) return;
    try {
      global.addEventListener("beforeinstallprompt", onBeforeInstall);
      global.addEventListener("appinstalled", function () {
        deferredPrompt = null;
        hideBanner();
        try { localStorage.setItem(NEVER_KEY, "1"); } catch (err) { /* */ }
      });
    } catch (err) { /* */ }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        bindBanner();
        if (pendingShow) showBanner(true);
      });
    } else {
      bindBanner();
    }
  }

  init();

  global.LvfePwaInstall = {
    showBanner: showBanner,
    hideBanner: hideBanner,
    maybeAfterSplashOrPlay: maybeAfterSplashOrPlay,
    openGuide: openGuide,
    triggerInstall: triggerInstall,
    isStandalone: isStandalone,
    isNativeApk: isNativeApk,
    isIosSafari: isIosSafari,
    guideUrl: guideUrl,
    canAutoPrompt: canAutoPrompt,
  };
})(typeof window !== "undefined" ? window : globalThis);
