/* Buy NCN (Paystack Checkout). Public key only here — never secret keys.
   1 NCN = USD $1. Server verifies with PAYSTACK_SECRET_KEY then credits IOU.
   Paste pk_test_… for sandbox; pk_live_… only after webhook works. */
(function (global) {
  const SaveCfg = global.LvfeSaveApiConfig;

  /** Public key from Paystack Dashboard → Settings → API Keys & Webhooks. Empty = blocker. */
  const PAYSTACK_PUBLIC_KEY = "";

  /** Optional override; default = SAVE_API_BASE (Iconia lvfe-save). */
  const BUY_API_BASE = "";

  const PROVIDER = "paystack";
  const NCN_PER_USD = 1;
  const MIN_NCN = 1;
  const MAX_NCN = 500;
  const PRESETS = [5, 10, 25, 50];

  const BLOCKER_CODE = "paystack_not_configured";
  const BLOCKER_TITLE = "Buy NCN is not wired yet (sandbox or live keys missing).";
  const BLOCKER_STEPS = [
    "Create a Paystack account (https://dashboard.paystack.com) — Nigeria-friendly, Checkout/Popup.",
    "Copy the Test Public Key (pk_test_…) into web/js/buy-ncn.config.js → PAYSTACK_PUBLIC_KEY.",
    "On the save host, set PAYSTACK_SECRET_KEY (sk_test_…) and PAYSTACK_PUBLIC_KEY in hosting/lvfe-save/config.local.php (never commit).",
    "Set PAYSTACK_WEBHOOK_SECRET (or use the secret key HMAC) and point Paystack webhook to https://iconiaglobal.com/lvfe-save/v1/buy/webhook.",
    "Optional: PAYSTACK_CURRENCY=NGN and NGN_PER_USD (kobo = NCN * NGN_PER_USD * 100) because 1 NCN = USD $1.",
    "For live: replace with pk_live_ / sk_live_ only after sandbox verify + credit works. Flutterwave is optional later — same credit path.",
  ];

  function resolveBuyBase() {
    const override = String(BUY_API_BASE || "").trim().replace(/\/+$/, "");
    if (override) return override;
    if (SaveCfg && typeof SaveCfg.resolveBase === "function") return SaveCfg.resolveBase();
    return "https://iconiaglobal.com/lvfe-save";
  }

  function isConfigured() {
    const k = String(PAYSTACK_PUBLIC_KEY || "").trim();
    if (!k) return false;
    if (/PASTE|YOUR_|xxx/i.test(k)) return false;
    return /^pk_(test|live)_/i.test(k);
  }

  function isTestKey() {
    return /^pk_test_/i.test(String(PAYSTACK_PUBLIC_KEY || "").trim());
  }

  function blockerMessage() {
    return BLOCKER_TITLE + "\n\n" + BLOCKER_STEPS.map(function (s, i) {
      return (i + 1) + ". " + s;
    }).join("\n");
  }

  const api = {
    PROVIDER,
    PAYSTACK_PUBLIC_KEY,
    BUY_API_BASE,
    NCN_PER_USD,
    MIN_NCN,
    MAX_NCN,
    PRESETS,
    BLOCKER_CODE,
    BLOCKER_TITLE,
    BLOCKER_STEPS,
    resolveBuyBase,
    isConfigured,
    isTestKey,
    blockerMessage,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfeBuyNcnConfig = api;
})(typeof window !== "undefined" ? window : globalThis);
