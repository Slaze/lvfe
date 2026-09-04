"use strict";
/**
 * Buy NCN — Paystack (primary) + Flutterwave (alternate).
 * Node parity with hosting/lvfe-save/buy.php.
 * 1 NCN = USD $1. Credits wallet atomic units in the save pack.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ATOMIC_PER_COIN = 100000000;
const MIN_NCN = 1;
const MAX_NCN = 500;
const PACK_KIND = "lvfe.save.v1";

function clampNcn(n) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < MIN_NCN) return MIN_NCN;
  if (v > MAX_NCN) return MAX_NCN;
  return v;
}

function normalizeProvider(raw) {
  const p = String(raw || "paystack").toLowerCase().trim();
  if (p === "flutterwave" || p === "flw") return "flutterwave";
  return "paystack";
}

function paystackStatus(env) {
  const pub = String(env.PAYSTACK_PUBLIC_KEY || "").trim();
  const sec = String(env.PAYSTACK_SECRET_KEY || "").trim();
  const testPub = /^pk_test_/i.test(pub);
  const livePub = /^pk_live_/i.test(pub);
  const testSec = /^sk_test_/i.test(sec);
  const liveSec = /^sk_live_/i.test(sec);
  const configured = Boolean(pub && sec && (testPub || livePub) && (testSec || liveSec));
  const liveMissing = (livePub && !liveSec) || (liveSec && !livePub);
  return {
    provider: "paystack",
    configured: configured && !liveMissing,
    sandbox: testPub && testSec,
    liveMissing,
    publicKey: configured && !liveMissing ? pub : "",
    currency: String(env.PAYSTACK_CURRENCY || "NGN").toUpperCase() || "NGN",
  };
}

function flutterwaveStatus(env) {
  const pub = String(env.FLW_PUBLIC_KEY || "").trim();
  const sec = String(env.FLW_SECRET_KEY || "").trim();
  const testPub = /FLWPUBK_TEST/i.test(pub);
  const livePub = Boolean(pub) && !testPub && /FLWPUBK_/i.test(pub);
  const testSec = /FLWSECK_TEST/i.test(sec);
  const liveSec = Boolean(sec) && !testSec && /FLWSECK_/i.test(sec);
  const configured = Boolean(pub && sec && (testPub || livePub) && (testSec || liveSec));
  const liveMissing = (livePub && !liveSec) || (liveSec && !livePub);
  return {
    provider: "flutterwave",
    configured: configured && !liveMissing,
    sandbox: testPub && testSec,
    liveMissing,
    publicKey: configured && !liveMissing ? pub : "",
    currency: String(env.FLW_CURRENCY || env.PAYSTACK_CURRENCY || "NGN").toUpperCase() || "NGN",
  };
}

function keysStatus(env) {
  const ps = paystackStatus(env);
  const flw = flutterwaveStatus(env);
  const ngnPerUsd = Math.max(1, Number(env.NGN_PER_USD) || 1500);
  let primary = "paystack";
  let configured = ps.configured || flw.configured;
  let sandbox = false;
  if (ps.configured) {
    sandbox = ps.sandbox;
  } else if (flw.configured) {
    primary = "flutterwave";
    sandbox = flw.sandbox;
  }
  return {
    provider: primary,
    configured,
    sandbox,
    liveMissing: ps.liveMissing || flw.liveMissing,
    publicKey: ps.publicKey,
    currency: ps.currency,
    ngnPerUsd,
    ncnPerUsd: 1,
    paystack: { configured: ps.configured, sandbox: ps.sandbox },
    flutterwave: { configured: flw.configured, sandbox: flw.sandbox },
  };
}

function blocker(code) {
  const isFlw = String(code || "").indexOf("flutterwave") >= 0 || String(code || "").indexOf("flw") >= 0;
  return {
    ok: false,
    code: code || "paystack_not_configured",
    title: "Buy NCN is not wired yet (sandbox or live keys missing).",
    error: isFlw
      ? "Set FLW_PUBLIC_KEY + FLW_SECRET_KEY in server/.env. See docs/BUY_NCN.md."
      : "Set PAYSTACK_PUBLIC_KEY + PAYSTACK_SECRET_KEY in server/.env (sk_test_ for sandbox). See docs/BUY_NCN.md.",
    steps: isFlw
      ? [
        "Flutterwave Dashboard → Settings → API Keys.",
        "Paste FLWPUBK_TEST_… into web/js/buy-ncn.config.js FLW_PUBLIC_KEY.",
        "Paste FLWSECK_TEST_… + FLWPUBK_TEST_… into server/.env (gitignored).",
        "Secret Hash → FLW_SECRET_HASH; webhook POST /v1/buy/flw-webhook.",
        "1 NCN = USD $1; NGN uses NGN_PER_USD (major units for Flutterwave).",
      ]
      : [
        "Create Paystack account → API Keys.",
        "Paste pk_test_ into web/js/buy-ncn.config.js PAYSTACK_PUBLIC_KEY.",
        "Paste sk_test_ + pk_test_ into server/.env (gitignored).",
        "Webhook: POST /v1/buy/webhook on this host.",
        "1 NCN = USD $1; NGN uses NGN_PER_USD for kobo.",
      ],
  };
}

/** Paystack = minor units; Flutterwave = major units. */
function amountForProvider(ncn, provider, env) {
  const ngnPerUsd = Math.max(1, Number(env.NGN_PER_USD) || 1500);
  if (provider === "flutterwave") {
    const currency = String(env.FLW_CURRENCY || env.PAYSTACK_CURRENCY || "NGN").toUpperCase() || "NGN";
    if (currency === "USD") {
      return { amount: ncn, currency: "USD", label: "$" + ncn + " USD" };
    }
    const naira = Math.max(1, Math.round(ncn * ngnPerUsd * 100) / 100);
    return {
      amount: naira,
      currency: "NGN",
      label: "₦" + naira.toFixed(2) + " NGN",
    };
  }
  const currency = String(env.PAYSTACK_CURRENCY || "NGN").toUpperCase() || "NGN";
  if (currency === "USD") {
    return { amount: ncn * 100, currency: "USD", label: "$" + ncn + " USD" };
  }
  const kobo = Math.max(100, Math.round(ncn * ngnPerUsd * 100));
  return {
    amount: kobo,
    currency: "NGN",
    label: "₦" + (kobo / 100).toFixed(2) + " NGN",
  };
}

function paymentsDir(root) {
  const dir = path.join(root, "data", "payments");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function pendingPath(root, ref) {
  const safe = String(ref).replace(/[^a-zA-Z0-9._-]/g, "");
  return path.join(paymentsDir(root), safe + ".json");
}

function writePending(root, ref, doc) {
  const p = pendingPath(root, ref);
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(doc, null, 2));
  fs.renameSync(tmp, p);
}

function readPending(root, ref) {
  const p = pendingPath(root, ref);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (err) {
    return null;
  }
}

function makeRef(playerKey) {
  const pk = String(playerKey).replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
  return "lvfe_" + pk + "_" + crypto.randomBytes(6).toString("hex");
}

async function paystackVerify(ref, secret) {
  const url = "https://api.paystack.co/transaction/verify/" + encodeURIComponent(ref);
  const resp = await fetch(url, {
    headers: { Authorization: "Bearer " + secret, Accept: "application/json" },
  });
  if (!resp.ok) return null;
  return resp.json();
}

async function flwVerifyByRef(txRef, secret) {
  const url = "https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref="
    + encodeURIComponent(txRef);
  const resp = await fetch(url, {
    headers: { Authorization: "Bearer " + secret, Accept: "application/json" },
  });
  if (!resp.ok) return null;
  return resp.json();
}

async function flwVerifyById(transactionId, secret) {
  const id = encodeURIComponent(String(transactionId));
  const url = "https://api.flutterwave.com/v3/transactions/" + id + "/verify";
  const resp = await fetch(url, {
    headers: { Authorization: "Bearer " + secret, Accept: "application/json" },
  });
  if (!resp.ok) return null;
  return resp.json();
}

function appendActivity(pack, row) {
  if (!pack.activity || typeof pack.activity !== "object") pack.activity = { items: [] };
  if (!Array.isArray(pack.activity.items)) pack.activity.items = [];
  pack.activity.items.unshift(row);
  if (pack.activity.items.length > 80) pack.activity.items.length = 80;
}

function storeReceipt(pack, receipt) {
  if (!pack.receipts || typeof pack.receipts !== "object") pack.receipts = {};
  const ref = receipt && receipt.reference;
  if (!ref) return;
  pack.receipts[ref] = receipt;
}

function creditSave(deps, playerKey, ncn, ref, meta) {
  const { safeKey, readSave, writeSave } = deps;
  const key = safeKey(playerKey);
  if (!key) return { ok: false, error: "bad_player" };
  const provider = normalizeProvider((meta && meta.provider) || "paystack");
  const walletKey = "lvfe.nc.iou.v1." + key;
  const atomicAdd = ncn * ATOMIC_PER_COIN;
  const existing = readSave(key);
  const pack = (existing && existing.pack && typeof existing.pack === "object")
    ? existing.pack
    : {
      kind: PACK_KIND,
      v: 1,
      playerKey: key,
      wallets: {},
      places: {},
      identity: {},
      factionPool: {},
      google: {},
      activity: { items: [] },
      receipts: {},
      purchases: {},
      photos: [],
    };
  pack.kind = PACK_KIND;
  if (!pack.wallets || typeof pack.wallets !== "object") pack.wallets = {};
  if (!pack.purchases || typeof pack.purchases !== "object") pack.purchases = {};
  const w = pack.wallets[walletKey] && typeof pack.wallets[walletKey] === "object"
    ? pack.wallets[walletKey]
    : { atomic: 0, faucetGranted: false, unit: "atomic" };
  if (pack.purchases[ref]) {
    return {
      ok: true,
      idempotent: true,
      ncnAmount: ncn,
      reference: ref,
      atomic: Math.floor(Number(w.atomic) || 0),
      receipt: pack.receipts && pack.receipts[ref] ? pack.receipts[ref] : null,
    };
  }
  w.atomic = Math.floor(Number(w.atomic) || 0) + atomicAdd;
  pack.wallets[walletKey] = w;
  const label = provider === "flutterwave" ? "Flutterwave" : "Paystack";
  pack.purchases[ref] = {
    ncn,
    at: new Date().toISOString(),
    provider,
  };
  appendActivity(pack, {
    at: new Date().toISOString(),
    kind: "buy_ncn",
    text: "Bought " + ncn + " NCN (" + label + ")",
    amount: ncn,
    ref,
  });
  const receipt = {
    reference: ref,
    ncn,
    payerEmail: String((meta && meta.email) || ""),
    paidLabel: String((meta && meta.paidLabel) || ""),
    provider,
    at: new Date().toISOString(),
  };
  storeReceipt(pack, receipt);
  pack.updatedAt = new Date().toISOString();
  pack.playerKey = key;
  writeSave(key, {
    accountKey: key,
    updatedAt: pack.updatedAt,
    pack,
    savedAt: new Date().toISOString(),
  });
  return {
    ok: true,
    idempotent: false,
    ncnAmount: ncn,
    reference: ref,
    atomic: w.atomic,
    receipt,
  };
}

function createBuyHandlers(deps) {
  const root = deps.ROOT;
  const env = process.env;

  async function handleInit(req, res, send, authorize, rawBody) {
    let body;
    try {
      body = JSON.parse(rawBody || "{}");
    } catch (err) {
      return send(res, 400, { ok: false, error: "Invalid JSON" });
    }
    const provider = normalizeProvider(body.provider);
    const ps = paystackStatus(env);
    const flw = flutterwaveStatus(env);
    if (provider === "flutterwave") {
      if (flw.liveMissing) return send(res, 503, blocker("flutterwave_live_keys_missing"));
      if (!flw.configured) return send(res, 503, blocker("flutterwave_not_configured"));
    } else {
      if (ps.liveMissing) return send(res, 503, blocker("live_keys_missing"));
      if (!ps.configured) return send(res, 503, blocker());
    }
    const playerKey = deps.safeKey(body.playerKey || "");
    if (!playerKey) return send(res, 400, { ok: false, error: "playerKey required" });
    const auth = await authorize(req, playerKey);
    if (!auth.ok) {
      return send(res, auth.code === "oauth_not_configured" ? 503 : 401, {
        ok: false,
        code: auth.code,
        error: auth.error,
      });
    }
    const ncn = clampNcn(body.ncnAmount);
    let email = String(body.email || "").trim();
    if (!email || !email.includes("@")) email = playerKey + "@lvfe.local";
    const priced = amountForProvider(ncn, provider, env);
    const reference = makeRef(playerKey);
    const status = provider === "flutterwave" ? flw : ps;
    writePending(root, reference, {
      reference,
      playerKey,
      ncnAmount: ncn,
      amount: priced.amount,
      currency: priced.currency,
      paidLabel: priced.label,
      email,
      provider,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    return send(res, 200, {
      ok: true,
      provider,
      publicKey: status.publicKey,
      reference,
      ncnAmount: ncn,
      amount: priced.amount,
      currency: priced.currency,
      paidLabel: priced.label,
      email,
      sandbox: status.sandbox,
      ncnPerUsd: 1,
      usd: ncn,
      ngnPerUsd: Math.max(1, Number(env.NGN_PER_USD) || 1500),
    });
  }

  async function handleVerify(req, res, send, authorize, rawBody) {
    let body;
    try {
      body = JSON.parse(rawBody || "{}");
    } catch (err) {
      return send(res, 400, { ok: false, error: "Invalid JSON" });
    }
    const reference = String(body.reference || "").replace(/[^a-zA-Z0-9._-]/g, "");
    if (!reference) return send(res, 400, { ok: false, error: "reference required" });
    const pending = readPending(root, reference);
    const provider = normalizeProvider(body.provider || (pending && pending.provider) || "paystack");
    const playerKey = deps.safeKey(body.playerKey || (pending && pending.playerKey) || "");
    if (!playerKey) return send(res, 400, { ok: false, error: "playerKey required" });
    const auth = await authorize(req, playerKey);
    if (!auth.ok) {
      return send(res, auth.code === "oauth_not_configured" ? 503 : 401, {
        ok: false,
        code: auth.code,
        error: auth.error,
      });
    }
    if (pending && String(pending.playerKey) !== playerKey) {
      return send(res, 403, { ok: false, code: "player_mismatch", error: "Reference belongs to another player" });
    }

    let ncn = clampNcn((pending && pending.ncnAmount) || 1);
    const paidLabel = String((pending && pending.paidLabel) || "");
    const email = String((pending && pending.email) || body.email || "");

    if (provider === "flutterwave") {
      const flw = flutterwaveStatus(env);
      if (!flw.configured) return send(res, 503, blocker("flutterwave_not_configured"));
      const secret = String(env.FLW_SECRET_KEY || "").trim();
      const txId = body.transactionId || body.transaction_id;
      let flwResp = null;
      if (txId != null && txId !== "") {
        flwResp = await flwVerifyById(txId, secret);
      }
      if (!flwResp) flwResp = await flwVerifyByRef(reference, secret);
      if (!flwResp || String(flwResp.status || "") !== "success") {
        return send(res, 502, { ok: false, code: "flutterwave_unreachable", error: "Flutterwave verify failed" });
      }
      const data = flwResp.data || {};
      const txStatus = String(data.status || "").toLowerCase();
      if (txStatus !== "successful" && txStatus !== "success") {
        return send(res, 402, {
          ok: false,
          code: "not_paid",
          error: "Payment not successful",
          status: data.status || "",
        });
      }
      const meta = data.meta || {};
      ncn = clampNcn((pending && pending.ncnAmount) || meta.ncnAmount || 1);
    } else {
      const ps = paystackStatus(env);
      if (!ps.configured) return send(res, 503, blocker());
      const secret = String(env.PAYSTACK_SECRET_KEY || "").trim();
      const psResp = await paystackVerify(reference, secret);
      if (!psResp || !psResp.status || !psResp.data) {
        return send(res, 502, { ok: false, code: "paystack_unreachable", error: "Paystack verify failed" });
      }
      if (String(psResp.data.status || "").toLowerCase() !== "success") {
        return send(res, 402, {
          ok: false,
          code: "not_paid",
          error: "Payment not successful",
          status: psResp.data.status || "",
        });
      }
      const meta = psResp.data.metadata || {};
      ncn = clampNcn((pending && pending.ncnAmount) || meta.ncnAmount || 1);
    }

    const credit = creditSave(deps, playerKey, ncn, reference, {
      provider,
      email,
      paidLabel,
    });
    if (pending) {
      pending.status = "credited";
      pending.creditedAt = new Date().toISOString();
      writePending(root, reference, pending);
    }
    return send(res, 200, Object.assign({}, credit, { provider, playerKey }));
  }

  async function handleWebhook(req, res, send, rawBody) {
    const ps = paystackStatus(env);
    if (!ps.configured) return send(res, 503, blocker());
    const raw = rawBody || "";
    const secret = String(env.PAYSTACK_SECRET_KEY || "").trim();
    const wh = String(env.PAYSTACK_WEBHOOK_SECRET || "").trim() || secret;
    const sig = String(req.headers["x-paystack-signature"] || "");
    const calc = crypto.createHmac("sha512", wh).update(raw).digest("hex");
    if (!sig || sig !== calc) {
      return send(res, 401, { ok: false, code: "bad_signature", error: "Invalid Paystack signature" });
    }
    let evt;
    try {
      evt = JSON.parse(raw);
    } catch (err) {
      return send(res, 400, { ok: false, error: "Invalid JSON" });
    }
    if (evt.event !== "charge.success") {
      return send(res, 200, { ok: true, ignored: true, event: evt.event || "" });
    }
    const data = evt.data || {};
    const reference = String(data.reference || "").replace(/[^a-zA-Z0-9._-]/g, "");
    const pending = reference ? readPending(root, reference) : null;
    const meta = data.metadata || {};
    const playerKey = deps.safeKey((pending && pending.playerKey) || meta.playerKey || "");
    const ncn = clampNcn((pending && pending.ncnAmount) || meta.ncnAmount || 0);
    if (!playerKey || !reference || ncn < 1) {
      return send(res, 400, { ok: false, error: "missing playerKey/reference/ncn" });
    }
    const credit = creditSave(deps, playerKey, ncn, reference, {
      provider: "paystack",
      email: String((pending && pending.email) || (data.customer && data.customer.email) || ""),
      paidLabel: String((pending && pending.paidLabel) || ""),
    });
    if (pending) {
      pending.status = "credited";
      pending.creditedAt = new Date().toISOString();
      pending.via = "webhook";
      writePending(root, reference, pending);
    }
    return send(res, 200, { ok: true, credited: credit });
  }

  async function handleFlwWebhook(req, res, send, rawBody) {
    const flw = flutterwaveStatus(env);
    if (!flw.configured) return send(res, 503, blocker("flutterwave_not_configured"));
    const raw = rawBody || "";
    const expected = String(env.FLW_SECRET_HASH || "").trim();
    const hash = String(req.headers["verif-hash"] || "");
    if (!expected || !hash || hash !== expected) {
      return send(res, 401, { ok: false, code: "bad_signature", error: "Invalid Flutterwave verif-hash" });
    }
    let evt;
    try {
      evt = JSON.parse(raw);
    } catch (err) {
      return send(res, 400, { ok: false, error: "Invalid JSON" });
    }
    const data = evt.data || {};
    const status = String(data.status || evt.status || "").toLowerCase();
    if (status !== "successful" && status !== "success") {
      return send(res, 200, { ok: true, ignored: true, status });
    }
    const reference = String(data.tx_ref || data.txRef || "").replace(/[^a-zA-Z0-9._-]/g, "");
    const pending = reference ? readPending(root, reference) : null;
    const meta = data.meta || {};
    const playerKey = deps.safeKey((pending && pending.playerKey) || meta.playerKey || "");
    const ncn = clampNcn((pending && pending.ncnAmount) || meta.ncnAmount || 0);
    if (!playerKey || !reference || ncn < 1) {
      return send(res, 400, { ok: false, error: "missing playerKey/reference/ncn" });
    }
    const credit = creditSave(deps, playerKey, ncn, reference, {
      provider: "flutterwave",
      email: String((pending && pending.email) || (data.customer && data.customer.email) || ""),
      paidLabel: String((pending && pending.paidLabel) || ""),
    });
    if (pending) {
      pending.status = "credited";
      pending.creditedAt = new Date().toISOString();
      pending.via = "flw_webhook";
      writePending(root, reference, pending);
    }
    return send(res, 200, { ok: true, credited: credit });
  }

  return {
    handleInit,
    handleVerify,
    handleWebhook,
    handleFlwWebhook,
    keysStatus: () => keysStatus(env),
  };
}

module.exports = {
  createBuyHandlers,
  keysStatus,
  clampNcn,
  creditSave,
  normalizeProvider,
  ATOMIC_PER_COIN,
};
