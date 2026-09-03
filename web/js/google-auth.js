/* Sign in with Google. Native Android WebView first; GIS only if a real
   Web client ID exists. Never pretends login worked. Identity, not Maps. */
(function (global) {
  const C = global.LvfeGoogleAuthConfig;
  if (!C) throw new Error("google-auth.config.js must load first");

  let inflight = false;
  let gisReady = false;
  let lastToken = "";
  let lastPhotoUrl = "";

  function nativeBridge() {
    return typeof global.LvfeNative !== "undefined" ? global.LvfeNative : null;
  }

  function hasNativeSignIn() {
    const n = nativeBridge();
    return Boolean(n && typeof n.signInWithGoogle === "function");
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

  function signInGis(cb) {
    if (!C.isConfigured()) return fail(cb);
    if (!gisReady || !global.google || !global.google.accounts || !global.google.accounts.id) {
      return fail(cb, {
        code: "gis_unavailable",
        message: "Google sign-in script did not load. On the phone, use the Lvfe app. On desktop, check the network, then paste a Web client ID.",
      });
    }
    try {
      global.google.accounts.id.initialize({
        client_id: C.WEB_CLIENT_ID,
        callback: function (resp) {
          inflight = false;
          const payload = decodeJwt(resp && resp.credential);
          if (!payload) return fail(cb, { code: "bad_token", message: "Google token did not parse." });
          cb(okPayload({
            sub: payload.sub,
            email: payload.email,
            idToken: resp.credential,
            picture: payload.picture || "",
          }));
        },
      });
      global.google.accounts.id.prompt(function (n) {
        if (n && n.isNotDisplayed && n.isNotDisplayed()) {
          inflight = false;
          fail(cb, {
            code: "gis_prompt_blocked",
            message: "Browser blocked the Google prompt. Use the Android app after the Web client ID is pasted, or Export save.",
          });
        }
      });
    } catch (err) {
      inflight = false;
      fail(cb, { code: "gis_error", message: String(err && err.message ? err.message : err) });
    }
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
    if (gisReady) {
      if (typeof cb === "function") cb(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = function () {
      gisReady = true;
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
    signIn,
    loadGis,
    okPayload,
    lastIdToken: function () { return lastToken || global.__lvfeGoogleIdToken || ""; },
    lastPhotoUrl: function () { return lastPhotoUrl; },
    failLoud: function (cb) { return fail(cb); },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfeGoogleAuth = api;
})(typeof window !== "undefined" ? window : globalThis);
