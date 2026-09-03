"use strict";
/**
 * Buy NCN via Paystack — Node parity with hosting/lvfe-save/buy.php.
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

function keysStatus(env) {
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
    ngnPerUsd: Math.max(1, Number(env.NGN_PER_USD) || 1500),
    ncnPerUsd: 1,
  };
}

function blocker(code) {
  return {
    ok: false,
    code: code || "paystack_not_configured",
    title: "Buy NCN is not wired yet (sandbox or live keys missing).",
    error: "Set PAYSTACK_PUBLIC_KEY + PAYSTACK_SECRET_KEY in server/.env (sk_test_ for sandbox). See docs/BUY_NCN.md.",
    steps: [
      "Create Paystack account → API Keys.",
      "Paste pk_test_ into web/js/buy-ncn.config.js PAYSTACK_PUBLIC_KEY.",
      "Paste sk_test_ + pk_test_ into server/.env (gitignored).",
      "Webhook: POST /v1/buy/webhook on this host.",
      "1 NCN = USD $1; NGN uses NGN_PER_USD for kobo.",
    ],
  };
}

function amountMinor(ncn, env) {
  const st = keysStatus(env);
  if (st.currency === "USD") return { amount: ncn * 100, currency: "USD" };
  const kobo = Math.max(100, Math.round(ncn * st.ngnPerUsd * 100));
  return { amount: kobo, currency: "NGN" };
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

function creditSave(deps, playerKey, ncn, ref) {
  const { safeKey, readSave, writeSave } = deps;
  const key = safeKey(playerKey);
  if (!key) return { ok: false, error: "bad_player" };
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
    };
  }
  w.atomic = Math.floor(Number(w.atomic) || 0) + atomicAdd;
  pack.wallets[walletKey] = w;
  pack.purchases[ref] = { ncn, at: new Date().toISOString(), provider: "paystack" };
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
  };
}

function createBuyHandlers(deps) {
  const root = deps.ROOT;
  const env = process.env;

  async function handleInit(req, res, send, authorize, rawBody) {
    const st = keysStatus(env);
    if (st.liveMissing) return send(res, 503, blocker("live_keys_missing"));
    if (!st.configured) return send(res, 503, blocker());
    let body;
    try {
      body = JSON.parse(rawBody || "{}");
    } catch (err) {
      return send(res, 400, { ok: false, error: "Invalid JSON" });
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
    const priced = amountMinor(ncn, env);
    const reference = makeRef(playerKey);
    writePending(root, reference, {
      reference,
      playerKey,
      ncnAmount: ncn,
      amount: priced.amount,
      currency: priced.currency,
      email,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    return send(res, 200, {
      ok: true,
      provider: "paystack",
      publicKey: st.publicKey,
      reference,
      ncnAmount: ncn,
      amount: priced.amount,
      currency: priced.currency,
      email,
      sandbox: st.sandbox,
      ncnPerUsd: 1,
      usd: ncn,
    });
  }

  async function handleVerify(req, res, send, authorize, rawBody) {
    const st = keysStatus(env);
    if (!st.configured) return send(res, 503, blocker());
    let body;
    try {
      body = JSON.parse(rawBody || "{}");
    } catch (err) {
      return send(res, 400, { ok: false, error: "Invalid JSON" });
    }
    const reference = String(body.reference || "").replace(/[^a-zA-Z0-9._-]/g, "");
    if (!reference) return send(res, 400, { ok: false, error: "reference required" });
    const pending = readPending(root, reference);
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
    const secret = String(env.PAYSTACK_SECRET_KEY || "").trim();
    const ps = await paystackVerify(reference, secret);
    if (!ps || !ps.status || !ps.data) {
      return send(res, 502, { ok: false, code: "paystack_unreachable", error: "Paystack verify failed" });
    }
    if (String(ps.data.status || "").toLowerCase() !== "success") {
      return send(res, 402, {
        ok: false,
        code: "not_paid",
        error: "Payment not successful",
        status: ps.data.status || "",
      });
    }
    if (pending && String(pending.playerKey) !== playerKey) {
      return send(res, 403, { ok: false, code: "player_mismatch", error: "Reference belongs to another player" });
    }
    const ncn = clampNcn(
      (pending && pending.ncnAmount) ||
      (ps.data.metadata && ps.data.metadata.ncnAmount) ||
      1,
    );
    const credit = creditSave(deps, playerKey, ncn, reference);
    if (pending) {
      pending.status = "credited";
      pending.creditedAt = new Date().toISOString();
      writePending(root, reference, pending);
    }
    return send(res, 200, Object.assign({}, credit, { provider: "paystack", playerKey }));
  }

  async function handleWebhook(req, res, send, rawBody) {
    const st = keysStatus(env);
    if (!st.configured) return send(res, 503, blocker());
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
    const credit = creditSave(deps, playerKey, ncn, reference);
    if (pending) {
      pending.status = "credited";
      pending.creditedAt = new Date().toISOString();
      pending.via = "webhook";
      writePending(root, reference, pending);
    }
    return send(res, 200, { ok: true, credited: credit });
  }

  return { handleInit, handleVerify, handleWebhook, keysStatus: () => keysStatus(env) };
}

module.exports = {
  createBuyHandlers,
  keysStatus,
  clampNcn,
  creditSave,
  ATOMIC_PER_COIN,
};
