/* Buy NairaCoin via Paystack (primary) or Flutterwave → server verify → credit IOU.
   1 NCN = USD $1. Never trusts client-only success without /v1/buy/verify.
   OPay is deprioritized (not offered here). Settlement stays on merchant dashboards. */
(function (global) {
  const C = global.LvfeBuyNcnConfig;
  if (!C) throw new Error("buy-ncn.config.js must load first");

  let paystackReady = false;
  let flwReady = false;
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
    if (paystackReady && global.PaystackPop) {
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
        paystackReady = Boolean(global.PaystackPop);
        if (typeof cb === "function") cb(paystackReady);
      });
      return;
    }
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.async = true;
    s.setAttribute("data-lvfe-paystack", "1");
    s.onload = function () {
      paystackReady = Boolean(global.PaystackPop);
      if (typeof cb === "function") cb(paystackReady);
    };
    s.onerror = function () {
      if (typeof cb === "function") cb(false);
    };
    document.head.appendChild(s);
  }

  function loadFlutterwaveScript(cb) {
    if (flwReady && typeof global.FlutterwaveCheckout === "function") {
      if (typeof cb === "function") cb(true);
      return;
    }
    if (typeof document === "undefined") {
      if (typeof cb === "function") cb(false);
      return;
    }
    const existing = document.querySelector('script[data-lvfe-flw="1"]');
    if (existing) {
      existing.addEventListener("load", function () {
        flwReady = typeof global.FlutterwaveCheckout === "function";
        if (typeof cb === "function") cb(flwReady);
      });
      return;
    }
    const s = document.createElement("script");
    s.src = "https://checkout.flutterwave.com/v3.js";
    s.async = true;
    s.setAttribute("data-lvfe-flw", "1");
    s.onload = function () {
      flwReady = typeof global.FlutterwaveCheckout === "function";
      if (typeof cb === "function") cb(flwReady);
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

  function normalizeProvider(p) {
    const s = String(p || C.DEFAULT_PROVIDER || "paystack").toLowerCase();
    if (s === "flutterwave" || s === "flw") return "flutterwave";
    return "paystack";
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

  function storeLocalReceipt(playerKey, verified) {
    try {
      const ref = (verified && verified.reference) || "";
      if (!ref) return;
      const purchases = JSON.parse(localStorage.getItem("lvfe.purchases.v1") || "{}");
      purchases[ref] = {
        ncn: clampNcn(verified.ncnAmount),
        at: new Date().toISOString(),
        provider: (verified && verified.provider) || "paystack",
        playerKey: playerKey,
      };
      localStorage.setItem("lvfe.purchases.v1", JSON.stringify(purchases));
      const receipts = JSON.parse(localStorage.getItem("lvfe.receipts.v1") || "{}");
      receipts[ref] = verified.receipt || {
        reference: ref,
        ncn: clampNcn(verified.ncnAmount),
        provider: (verified && verified.provider) || "paystack",
        at: new Date().toISOString(),
      };
      localStorage.setItem("lvfe.receipts.v1", JSON.stringify(receipts));
    } catch (err) { /* */ }
  }

  function applyVerified(playerKey, verified) {
    const ncn = clampNcn(verified && verified.ncnAmount);
    creditLocal(playerKey, ncn);
    storeLocalReceipt(playerKey, verified);
    const Earn = global.LvfeWalletEarn;
    if (Earn && typeof Earn.appendActivity === "function") {
      const label = (verified && verified.provider) === "flutterwave" ? "Flutterwave" : "Paystack";
      Earn.appendActivity({
        kind: "buy_ncn",
        amount: ncn,
        text: "Bought " + ncn + " NCN (" + label + ")",
        ref: (verified && verified.reference) || "",
      });
    }
    return {
      ok: true,
      ncnAmount: ncn,
      reference: (verified && verified.reference) || "",
      provider: (verified && verified.provider) || "paystack",
      receipt: verified && verified.receipt,
    };
  }

  function notConfiguredCodes(provider) {
    if (provider === "flutterwave") {
      return ["flutterwave_not_configured", "flutterwave_live_keys_missing"];
    }
    return ["paystack_not_configured", "live_keys_missing"];
  }

  function openPaystack(d, opts, playerKey, ncnAmount, email, done) {
    loadPaystackScript(function (okScript) {
      if (!okScript || !global.PaystackPop) {
        inflight = false;
        return done(fail({
          code: "paystack_script",
          message: "Couldn't open checkout — try again.",
        }));
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
            provider: "paystack",
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
          if (typeof opts.onClose === "function") opts.onClose();
          done({ ok: false, code: "closed", message: "Checkout closed before payment finished." });
        },
      });
      handler.openIframe();
    });
  }

  function openFlutterwave(d, opts, playerKey, ncnAmount, email, done) {
    loadFlutterwaveScript(function (okScript) {
      if (!okScript || typeof global.FlutterwaveCheckout !== "function") {
        inflight = false;
        return done(fail({
          code: "flutterwave_script",
          message: "Couldn't open checkout — try again.",
        }));
      }
      let settled = false;
      global.FlutterwaveCheckout({
        public_key: d.publicKey || C.FLW_PUBLIC_KEY,
        tx_ref: d.reference,
        amount: d.amount,
        currency: d.currency || "NGN",
        payment_options: "card,ussd,banktransfer,account",
        customer: {
          email: d.email || email,
          name: playerKey,
        },
        customizations: {
          title: "Buy NCN",
          description: ncnAmount + " NCN (1 NCN = USD $1)",
          logo: "https://iconiaglobal.com/lvfe/assets/brand/lvfe-mark-512.png",
        },
        meta: {
          playerKey: playerKey,
          ncnAmount: ncnAmount,
          purpose: "buy_ncn",
        },
        callback: function (response) {
          if (settled) return;
          settled = true;
          const reference = (response && (response.tx_ref || response.txRef)) || d.reference;
          const transactionId = response && (response.transaction_id || response.id);
          apiPost("/v1/buy/verify", {
            reference: reference,
            playerKey: playerKey,
            provider: "flutterwave",
            transactionId: transactionId,
          }, playerKey).then(function (vres) {
            inflight = false;
            const vd = vres.data || {};
            if (!vd.ok) {
              if (typeof global.lvfeDebugLog === "function") {
                global.lvfeDebugLog("buy-verify-flw", vd.code || "", vd.error || vd.message || "");
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
            if (typeof global.lvfeDebugLog === "function") global.lvfeDebugLog("buy-verify-flw", err);
            done({
              ok: false,
              code: "verify_network",
              message: "Couldn't reach checkout — try again.",
            });
          });
        },
        onclose: function () {
          if (settled) return;
          inflight = false;
          if (typeof opts.onClose === "function") opts.onClose();
          done({ ok: false, code: "closed", message: "Checkout closed before payment finished." });
        },
      });
    });
  }

  /**
   * Start Checkout for whole NCN. cb(result).
   * opts: { playerKey, email, ncnAmount, provider, onClose }
   */
  function startCheckout(opts, cb) {
    const done = typeof cb === "function" ? cb : function () {};
    const o = opts || {};
    const playerKey = String(o.playerKey || "default").slice(0, 32);
    const ncnAmount = clampNcn(o.ncnAmount);
    const email = String(o.email || "").trim() || (playerKey + "@lvfe.local");
    const provider = normalizeProvider(o.provider || C.DEFAULT_PROVIDER);

    if (!C.isProviderConfigured(provider)) {
      return done(fail({
        code: provider === "flutterwave" ? "flutterwave_not_configured" : C.BLOCKER_CODE,
      }));
    }
    if (inflight) return done(fail({ code: "busy", message: "A purchase is already in progress." }));
    inflight = true;

    apiPost("/v1/buy/init", {
      playerKey: playerKey,
      ncnAmount: ncnAmount,
      email: email,
      provider: provider,
    }, playerKey).then(function (res) {
      const d = res.data || {};
      if (!d.ok) {
        inflight = false;
        const codes = notConfiguredCodes(provider);
        if (codes.indexOf(d.code) >= 0 || d.code === "paystack_not_configured") {
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

      const useProvider = normalizeProvider(d.provider || provider);
      if (useProvider === "flutterwave") {
        openFlutterwave(d, o, playerKey, ncnAmount, email, done);
      } else {
        openPaystack(d, o, playerKey, ncnAmount, email, done);
      }
    }).catch(function (err) {
      inflight = false;
      if (typeof global.lvfeDebugLog === "function") global.lvfeDebugLog("buy-init", err);
      done({
        ok: false,
        code: "init_network",
        message: "Couldn't reach checkout — try again.",
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
    return applyVerified(playerKey, {
      ncnAmount: ncnAmount,
      reference: "mock-" + Date.now(),
      provider: "mock",
    });
  }

  const api = {
    startCheckout,
    mockBuy,
    clampNcn,
    creditLocal,
    normalizeProvider,
    failLoud: function () { return fail(); },
    isConfigured: function () { return C.isConfigured(); },
    isProviderConfigured: function (p) { return C.isProviderConfigured(p); },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfeBuyNcn = api;
})(typeof window !== "undefined" ? window : globalThis);
