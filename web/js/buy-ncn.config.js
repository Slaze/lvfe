/* Buy NCN — Paystack (primary) + Flutterwave (alternate). Public keys only.
   1 NCN = USD $1. Server verifies with secret keys then credits IOU.
   Paste pk_test_… / FLWPUBK_TEST_… for sandbox; live keys only after webhook works. */
(function (global) {
  const SaveCfg = global.LvfeSaveApiConfig;

  /** Paystack Dashboard → Settings → API Keys & Webhooks. Empty = soft-fail until set. */
  const PAYSTACK_PUBLIC_KEY = "";

  /** Flutterwave Dashboard → Settings → API Keys. Optional alternate. */
  const FLW_PUBLIC_KEY = "";

  /** Optional override; default = SAVE_API_BASE (Iconia lvfe-save). */
  const BUY_API_BASE = "";

  const DEFAULT_PROVIDER = "paystack";
  const NCN_PER_USD = 1;
  const MIN_NCN = 1;
  const MAX_NCN = 500;
  const PRESETS = [5, 10, 25, 50];

  const BLOCKER_CODE = "paystack_not_configured";
  const BLOCKER_TITLE = "Buy NCN isn’t available yet — try again later.";
  const BLOCKER_STEPS = [
    "Paystack (primary): Dashboard → Settings → API Keys & Webhooks.",
    "Copy Test Public Key (pk_test_…) into web/js/buy-ncn.config.js → PAYSTACK_PUBLIC_KEY.",
    "On the save host, set PAYSTACK_SECRET_KEY (sk_test_…) and PAYSTACK_PUBLIC_KEY in hosting/lvfe-save/config.local.php (never commit).",
    "Paystack webhook: https://iconiaglobal.com/lvfe-save/v1/buy/webhook",
    "Optional Flutterwave: Dashboard → Settings → API Keys → FLWPUBK_TEST_… + FLWSECK_TEST_… + Secret Hash.",
    "Flutterwave webhook: https://iconiaglobal.com/lvfe-save/v1/buy/flw-webhook",
    "Set NGN_PER_USD (default 1500). 1 NCN = USD $1. Settlement stays on each merchant dashboard — no OPay.",
  ];

  function resolveBuyBase() {
    const override = String(BUY_API_BASE || "").trim().replace(/\/+$/, "");
    if (override) return override;
    if (SaveCfg && typeof SaveCfg.resolveBase === "function") return SaveCfg.resolveBase();
    return "https://iconiaglobal.com/lvfe-save";
  }

  function cleanKey(k) {
    const s = String(k || "").trim();
    if (!s || /PASTE|YOUR_|xxx/i.test(s)) return "";
    return s;
  }

  function isPaystackConfigured() {
    const k = cleanKey(PAYSTACK_PUBLIC_KEY);
    return /^pk_(test|live)_/i.test(k);
  }

  function isFlutterwaveConfigured() {
    const k = cleanKey(FLW_PUBLIC_KEY);
    return /FLWPUBK_/i.test(k);
  }

  function isConfigured() {
    return isPaystackConfigured() || isFlutterwaveConfigured();
  }

  function isProviderConfigured(provider) {
    const p = String(provider || DEFAULT_PROVIDER).toLowerCase();
    if (p === "flutterwave" || p === "flw") return isFlutterwaveConfigured();
    return isPaystackConfigured();
  }

  function isTestKey(provider) {
    const p = String(provider || DEFAULT_PROVIDER).toLowerCase();
    if (p === "flutterwave" || p === "flw") {
      return /FLWPUBK_TEST/i.test(cleanKey(FLW_PUBLIC_KEY));
    }
    return /^pk_test_/i.test(cleanKey(PAYSTACK_PUBLIC_KEY));
  }

  function blockerMessage() {
    return BLOCKER_TITLE + "\n\n" + BLOCKER_STEPS.map(function (s, i) {
      return (i + 1) + ". " + s;
    }).join("\n");
  }

  const api = {
    DEFAULT_PROVIDER,
    PROVIDER: DEFAULT_PROVIDER,
    PAYSTACK_PUBLIC_KEY,
    FLW_PUBLIC_KEY,
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
    isPaystackConfigured,
    isFlutterwaveConfigured,
    isProviderConfigured,
    isTestKey,
    blockerMessage,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfeBuyNcnConfig = api;
})(typeof window !== "undefined" ? window : globalThis);
