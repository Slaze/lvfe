/* Buy NairaCoin via Paystack Popup → server verify → credit IOU wallet.
   1 NCN = USD $1. Never trusts client-only success without /v1/buy/verify. */
(function (global) {
  const C = global.LvfeBuyNcnConfig;
  if (!C) throw new Error("buy-ncn.config.js must load first");

  let scriptReady = false;
  let inflight = false;

  function fail(extra) {
    return Object.assign({
      ok: false,
      code: C.BLOCKER_CODE,
      title: C.BLOCKER_TITLE,
      steps: C.BLOCKER_STEPS.slice(),
      message: C.BLOCKER_TITLE,
    }, extra || {});
  }

  function authHeader(playerKey) {
    const Sync = global.LvfeSaveSync;
    if (Sync && typeof Sync.authHeader === "function") {
      try {
        return Sync.authHeader(playerKey);
      } catch (err) { /* fall through */ }
    }
    const Acc = global.LvfeAccount;
    const g = Acc && Acc.googleSessionFor ? Acc.googleSessionFor(playerKey) : null;
    if (g && g.idToken) return "Bearer google:" + g.idToken;
    const prefix = (global.LvfeSaveApiConfig && global.LvfeSaveApiConfig.DEV_AUTH_PREFIX) || "lvfe-dev:";
    return "Bearer " + prefix + String(playerKey || "default").slice(0, 32);
  }

  function loadPaystackScript(cb) {
    if (scriptReady && global.PaystackPop) {
      if (typeof cb === "function") cb(true);
      return;
    }
    if (typeof document === "undefined") {
      if (typeof cb === "function") cb(false);
      return;
    }
    const existing = document.querySelector('script[data-lvfe-paystack="1"]');
    if (existing) {
      existing.addEventListener("load", function () {
        scriptReady = Boolean(global.PaystackPop);
        if (typeof cb === "function") cb(scriptReady);
      });
      return;
    }
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.async = true;
    s.setAttribute("data-lvfe-paystack", "1");
    s.onload = function () {
      scriptReady = Boolean(global.PaystackPop);
      if (typeof cb === "function") cb(scriptReady);
    };
    s.onerror = function () {
      if (typeof cb === "function") cb(false);
    };
    document.head.appendChild(s);
  }

  function clampNcn(n) {
    const v = Math.floor(Number(n));
    if (!Number.isFinite(v)) return C.MIN_NCN;
    return Math.max(C.MIN_NCN, Math.min(C.MAX_NCN, v));
  }

  async function apiPost(path, body, playerKey) {
    const base = C.resolveBuyBase();
    const url = base.replace(/\/+$/, "") + path;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(playerKey),
        "X-Lvfe-Player-Key": String(playerKey || "").slice(0, 32),
      },
      body: JSON.stringify(body || {}),
    });
    let data = null;
    try {
      data = await resp.json();
    } catch (err) {
      data = null;
    }
    return { status: resp.status, data: data || { ok: false, error: "bad_json" } };
  }

  function creditLocal(playerKey, ncnAmount) {
    const W = global.LvfeCatalogWallet || global.LvfeNairaCoin;
    const n = clampNcn(ncnAmount);
    if (W && typeof W.credit === "function") {
      W.credit(playerKey, n);
      return n;
    }
    if (W && typeof W.creditWhole === "function") {
      W.creditWhole(playerKey, n);
      return n;
    }
    return 0;
  }

  function applyVerified(playerKey, verified) {
    const ncn = clampNcn(verified && verified.ncnAmount);
    creditLocal(playerKey, ncn);
    const Earn = global.LvfeWalletEarn;
    if (Earn && typeof Earn.appendActivity === "function") {
      Earn.appendActivity({
        kind: "buy_ncn",
        amount: ncn,
        text: "Bought " + ncn + " NCN",
        ref: (verified && verified.reference) || "",
      });
    }
    return { ok: true, ncnAmount: ncn, reference: (verified && verified.reference) || "" };
  }

  /**
   * Start Paystack Checkout for whole NCN. cb(result).
   * opts: { playerKey, email, ncnAmount, onClose }
   */
  function startCheckout(opts, cb) {
    const done = typeof cb === "function" ? cb : function () {};
    const o = opts || {};
    const playerKey = String(o.playerKey || "default").slice(0, 32);
    const ncnAmount = clampNcn(o.ncnAmount);
    const email = String(o.email || "").trim() || (playerKey + "@lvfe.local");

    if (!C.isConfigured()) return done(fail());
    if (inflight) return done(fail({ code: "busy", message: "A purchase is already in progress." }));
    inflight = true;

    loadPaystackScript(function (okScript) {
      if (!okScript || !global.PaystackPop) {
        inflight = false;
        return done(fail({
          code: "paystack_script",
          message: "Couldn't open checkout — try again.",
        }));
      }

      apiPost("/v1/buy/init", {
        playerKey: playerKey,
        ncnAmount: ncnAmount,
        email: email,
        provider: "paystack",
      }, playerKey).then(function (res) {
        const d = res.data || {};
        if (!d.ok) {
          inflight = false;
          if (d.code === "paystack_not_configured" || d.code === "live_keys_missing") {
            return done(fail({
              code: d.code,
              title: C.BLOCKER_TITLE,
              message: C.BLOCKER_TITLE,
              steps: d.steps || C.BLOCKER_STEPS.slice(),
            }));
          }
          if (typeof global.lvfeDebugLog === "function") {
            global.lvfeDebugLog("buy-init", d.code || "", d.error || d.message || res.status);
          }
          return done({
            ok: false,
            code: d.code || "init_failed",
            message: "Couldn't start purchase — try again.",
          });
        }

        const handler = global.PaystackPop.setup({
          key: d.publicKey || C.PAYSTACK_PUBLIC_KEY,
          email: d.email || email,
          amount: d.amount,
          currency: d.currency || "NGN",
          ref: d.reference,
          metadata: {
            custom_fields: [
              { display_name: "NCN", variable_name: "ncn", value: String(ncnAmount) },
              { display_name: "Player", variable_name: "player_key", value: playerKey },
            ],
            playerKey: playerKey,
            ncnAmount: ncnAmount,
            purpose: "buy_ncn",
          },
          callback: function (response) {
            const reference = (response && response.reference) || d.reference;
            apiPost("/v1/buy/verify", {
              reference: reference,
              playerKey: playerKey,
            }, playerKey).then(function (vres) {
              inflight = false;
              const vd = vres.data || {};
              if (!vd.ok) {
                if (typeof global.lvfeDebugLog === "function") {
                  global.lvfeDebugLog("buy-verify", vd.code || "", vd.error || vd.message || "");
                }
                return done({
                  ok: false,
                  code: vd.code || "verify_failed",
                  message: "Payment couldn’t be confirmed — try again.",
                });
              }
              done(applyVerified(playerKey, vd));
            }).catch(function (err) {
              inflight = false;
              if (typeof global.lvfeDebugLog === "function") global.lvfeDebugLog("buy-verify", err);
              done({
                ok: false,
                code: "verify_network",
                message: "Couldn't reach checkout — try again.",
              });
            });
          },
          onClose: function () {
            inflight = false;
            if (typeof o.onClose === "function") o.onClose();
            done({ ok: false, code: "closed", message: "Checkout closed before payment finished." });
          },
        });
        handler.openIframe();
      }).catch(function (err) {
        inflight = false;
        if (typeof global.lvfeDebugLog === "function") global.lvfeDebugLog("buy-init", err);
        done({
          ok: false,
          code: "init_network",
          message: "Couldn't reach checkout — try again.",
        });
      });
    });
  }

  /** Dev-only local credit when mockBuy=1 and keys missing (never for live). */
  function mockBuy(opts) {
    const o = opts || {};
    const playerKey = String(o.playerKey || "default").slice(0, 32);
    const ncnAmount = clampNcn(o.ncnAmount);
    let allow = false;
    try {
      allow = new URLSearchParams(location.search).get("mockBuy") === "1"
        || localStorage.getItem("lvfe.mockBuy") === "1";
    } catch (err) { /* */ }
    if (!allow) {
      return fail({ code: "mock_disabled", message: "mockBuy not enabled." });
    }
    return applyVerified(playerKey, { ncnAmount: ncnAmount, reference: "mock-" + Date.now() });
  }

  const api = {
    startCheckout,
    mockBuy,
    clampNcn,
    creditLocal,
    failLoud: function () { return fail(); },
    isConfigured: function () { return C.isConfigured(); },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfeBuyNcn = api;
})(typeof window !== "undefined" ? window : globalThis);
