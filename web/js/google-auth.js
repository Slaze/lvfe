/* Sign in with Google. Native Android WebView first; GIS on browsers with a real
   Web client ID. Never pretends login worked. Identity, not Maps. */
(function (global) {
  const C = global.LvfeGoogleAuthConfig;
  if (!C) throw new Error("google-auth.config.js must load first");

  let inflight = false;
  let gisReady = false;
  let lastToken = "";
  let lastPhotoUrl = "";
  let pendingCb = null;

  function nativeBridge() {
    return typeof global.LvfeNative !== "undefined" ? global.LvfeNative : null;
  }

  function hasNativeSignIn() {
    const n = nativeBridge();
    return Boolean(n && typeof n.signInWithGoogle === "function");
  }

  function isWebBrowser() {
    if (hasNativeSignIn()) return false;
    try {
      if (location.hostname === "appassets.androidplatform.net") return false;
      if (location.protocol === "file:") return false;
    } catch (err) { /* */ }
    return true;
  }

  function configured() {
    if (C.isConfigured()) return true;
    const n = nativeBridge();
    if (n && typeof n.googleSignInReady === "function") {
      try {
        const v = n.googleSignInReady();
        return v === true || v === 1 || v === "true" || v === "1";
      } catch (err) {
        return false;
      }
    }
    return false;
  }

  function fail(cb, extra) {
    const err = Object.assign({
      ok: false,
      code: C.BLOCKER_CODE,
      title: C.BLOCKER_TITLE,
      steps: C.BLOCKER_STEPS.slice(),
      message: C.blockerMessage(),
    }, extra || {});
    if (typeof cb === "function") cb(err);
    return err;
  }

  function okPayload(data) {
    const sub = String((data && (data.sub || data.userId)) || "").trim();
    const email = String((data && data.email) || "").trim();
    if (!sub) {
      return {
        ok: false,
        code: "no_sub",
        message: "Google returned no account id. Try again or use Export save.",
      };
    }
    const photoUrl = String((data && (data.photoUrl || data.picture)) || "").trim();
    const idToken = (data && data.idToken) || "";
    if (idToken) {
      lastToken = idToken;
      try { global.__lvfeGoogleIdToken = idToken; } catch (err) { /* */ }
      try {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem("lvfe.googleIdToken", idToken);
        }
      } catch (err) { /* */ }
    }
    if (photoUrl) lastPhotoUrl = photoUrl;
    const Acc = global.LvfeAccount;
    const playerKey = Acc ? Acc.playerKeyFromSub(sub) : ("g" + sub.replace(/[^a-zA-Z0-9]/g, "")).slice(0, 32);
    if (Acc) Acc.bindGoogle(sub, email, playerKey, photoUrl);
    return {
      ok: true,
      sub: sub,
      email: email,
      playerKey: playerKey,
      idToken: idToken,
      photoUrl: photoUrl || (Acc && Acc.photoUrlFor ? Acc.photoUrlFor(sub) : "") || lastPhotoUrl,
    };
  }

  function decodeJwt(token) {
    try {
      const parts = String(token || "").split(".");
      if (parts.length < 2) return null;
      const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
      return JSON.parse(json);
    } catch (err) {
      return null;
    }
  }

  function onCredential(resp, cb) {
    inflight = false;
    pendingCb = null;
    const payload = decodeJwt(resp && resp.credential);
    if (!payload) return fail(cb, { code: "bad_token", message: "Google token did not parse." });
    const done = typeof cb === "function" ? cb : function () {};
    done(okPayload({
      sub: payload.sub,
      email: payload.email,
      idToken: resp.credential,
      picture: payload.picture || "",
    }));
  }

  function ensureGisInit(cb) {
    if (!C.isConfigured()) return fail(cb);
    if (!gisReady || !global.google || !global.google.accounts || !global.google.accounts.id) {
      return fail(cb, {
        code: "gis_unavailable",
        message: "Google sign-in script did not load. Check the network, confirm this origin is listed under Authorized JavaScript origins in Google Cloud Console, then retry.",
      });
    }
    try {
      global.google.accounts.id.initialize({
        client_id: C.WEB_CLIENT_ID,
        callback: function (resp) {
          const target = pendingCb || cb;
          onCredential(resp, target);
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      return true;
    } catch (err) {
      fail(cb, { code: "gis_error", message: String(err && err.message ? err.message : err) });
      return false;
    }
  }

  function renderButtons() {
    if (!gisReady || !global.google || !global.google.accounts || !global.google.accounts.id) return;
    if (!C.isConfigured()) return;
    try {
      global.google.accounts.id.initialize({
        client_id: C.WEB_CLIENT_ID,
        callback: function (resp) {
          onCredential(resp, pendingCb);
        },
        auto_select: false,
      });
    } catch (err) { /* */ }
    const hosts = typeof document !== "undefined"
      ? document.querySelectorAll("[data-gis-btn]")
      : [];
    for (let i = 0; i < hosts.length; i++) {
      const host = hosts[i];
      if (host.getAttribute("data-gis-mounted") === "1") continue;
      try {
        host.innerHTML = "";
        global.google.accounts.id.renderButton(host, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: Math.min(320, Math.max(240, host.clientWidth || 280)),
        });
        host.setAttribute("data-gis-mounted", "1");
        host.hidden = false;
      } catch (err) { /* */ }
    }
  }

  function signInGis(cb) {
    pendingCb = typeof cb === "function" ? cb : null;
    if (!ensureGisInit(cb)) return;
    inflight = true;
    try {
      global.google.accounts.id.prompt(function (n) {
        if (!n) return;
        const blocked = (n.isNotDisplayed && n.isNotDisplayed()) ||
          (n.isSkippedMoment && n.isSkippedMoment()) ||
          (n.isDismissedMoment && n.isDismissedMoment());
        if (blocked) {
          inflight = false;
          renderButtons();
          fail(cb, {
            code: "gis_prompt_blocked",
            message: "One Tap was blocked. Use the Google button below (or check Authorized JavaScript origins includes this site’s HTTPS origin).",
          });
        }
      });
    } catch (err) {
      inflight = false;
      fail(cb, { code: "gis_error", message: String(err && err.message ? err.message : err) });
    }
  }

  function signIn(cb) {
    const done = typeof cb === "function" ? cb : function () {};
    if (inflight) return fail(done, { code: "busy", message: "Sign-in already in progress." });
    if (!configured()) return fail(done);
    inflight = true;
    global.lvfeOnGoogleSignIn = function (raw) {
      inflight = false;
      if (!raw || !raw.ok) {
        if (raw && raw.code === C.BLOCKER_CODE) return fail(done, raw);
        return fail(done, {
          code: (raw && raw.code) || "native_fail",
          message: (raw && raw.message) || C.blockerMessage(),
          steps: (raw && raw.steps) || C.BLOCKER_STEPS.slice(),
        });
      }
      done(okPayload(raw));
    };
    if (hasNativeSignIn()) {
      try {
        nativeBridge().signInWithGoogle();
        return;
      } catch (err) {
        inflight = false;
        return fail(done, { code: "native_throw", message: String(err && err.message ? err.message : err) });
      }
    }
    inflight = false;
    signInGis(done);
  }

  function loadGis(cb) {
    if (!C.isConfigured() || typeof document === "undefined") {
      if (typeof cb === "function") cb(false);
      return;
    }
    if (!isWebBrowser()) {
      if (typeof cb === "function") cb(false);
      return;
    }
    if (gisReady) {
      renderButtons();
      if (typeof cb === "function") cb(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = function () {
      gisReady = true;
      renderButtons();
      if (typeof cb === "function") cb(true);
    };
    s.onerror = function () {
      if (typeof cb === "function") cb(false);
    };
    document.head.appendChild(s);
  }

  const api = {
    configured,
    hasNativeSignIn,
    isWebBrowser,
    signIn,
    loadGis,
    renderButtons,
    okPayload,
    lastIdToken: function () {
      if (lastToken) return lastToken;
      if (global.__lvfeGoogleIdToken) return global.__lvfeGoogleIdToken;
      try {
        if (typeof sessionStorage !== "undefined") {
          return sessionStorage.getItem("lvfe.googleIdToken") || "";
        }
      } catch (err) { /* */ }
      return "";
    },
    clearIdToken: function () {
      lastToken = "";
      try { delete global.__lvfeGoogleIdToken; } catch (err) { /* */ }
      try {
        if (typeof sessionStorage !== "undefined") sessionStorage.removeItem("lvfe.googleIdToken");
      } catch (err) { /* */ }
    },
    lastPhotoUrl: function () { return lastPhotoUrl; },
    failLoud: function (cb) { return fail(cb); },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfeGoogleAuth = api;

  if (typeof document !== "undefined" && isWebBrowser() && C.isConfigured()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { loadGis(); });
    } else {
      loadGis();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
