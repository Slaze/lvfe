#!/usr/bin/env node
/**
 * Lvfe save sync — localhost Node server (zero npm deps).
 * Conflict: last-write-wins by pack.updatedAt (ISO string, lexical = chronological).
 * Auth:
 *   - Bearer lvfe-dev:<playerKey> when LVFE_ALLOW_DEV_AUTH=1 (default local)
 *   - Bearer <SAVE_SECRET> + X-Lvfe-Player-Key / accountKey in body
 *   - Bearer google:<id_token> when GOOGLE_WEB_CLIENT_ID is set (JWT aud check via Google)
 * Fail loud: production Gmail path without GOOGLE_WEB_CLIENT_ID returns 503 oauth_not_configured.
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { createBuyHandlers } = require("./buy.js");

const ROOT = __dirname;
loadEnv(path.join(ROOT, ".env"));

const PORT = Number(process.env.PORT) || 18787;
const SAVE_DIR = process.env.SAVE_DIR
  ? path.resolve(process.env.SAVE_DIR)
  : path.join(ROOT, "data", "saves");
const MAX_BODY = Number(process.env.MAX_BODY_BYTES) || 2621440;
const SAVE_SECRET = String(process.env.SAVE_SECRET || "").trim();
const ALLOW_DEV = String(process.env.LVFE_ALLOW_DEV_AUTH || "1") !== "0";
const GOOGLE_AUD = String(process.env.GOOGLE_WEB_CLIENT_ID || "").trim();
const PACK_KIND = "lvfe.save.v1";
const PHOTO_META_ONLY_OVER = 400000;
const MAX_PHOTOS = 8;

fs.mkdirSync(SAVE_DIR, { recursive: true });

function loadEnv(file) {
  try {
    const text = fs.readFileSync(file, "utf8");
    text.split(/\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) return;
      const k = m[1];
      let v = m[2].replace(/\s+#.*$/, "").trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[k] == null) process.env[k] = v;
    });
  } catch (err) {
    /* no .env */
  }
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Lvfe-Player-Key, X-Lvfe-Account-Key, X-Paystack-Signature");
}

function send(res, code, obj) {
  cors(res);
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function safeKey(raw) {
  const s = String(raw || "").trim().slice(0, 64);
  if (!/^[a-zA-Z0-9._:-]+$/.test(s)) return null;
  if (s.includes("..")) return null;
  return s;
}

function savePath(accountKey) {
  return path.join(SAVE_DIR, accountKey + ".json");
}

function readSave(accountKey) {
  const p = savePath(accountKey);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (err) {
    return null;
  }
}

function writeSave(accountKey, doc) {
  const p = savePath(accountKey);
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(doc, null, 2));
  fs.renameSync(tmp, p);
}

const buyHandlers = createBuyHandlers({
  ROOT,
  safeKey,
  readSave,
  writeSave,
});

function trimPhotos(pack) {
  if (!pack || !Array.isArray(pack.photos)) {
    if (pack) pack.photos = [];
    return pack;
  }
  const kept = [];
  for (let i = 0; i < pack.photos.length && kept.length < MAX_PHOTOS; i++) {
    const row = pack.photos[i];
    if (!row || !row.placeId) continue;
    const url = String(row.dataUrl || "");
    if (url.length > PHOTO_META_ONLY_OVER) {
      kept.push({
        playerKey: row.playerKey,
        placeId: row.placeId,
        type: row.type || "image/jpeg",
        metaOnly: true,
        sizeHint: url.length,
      });
    } else {
      kept.push(row);
    }
  }
  pack.photos = kept;
  return pack;
}

function parseAuth(req) {
  const h = String(req.headers.authorization || "");
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

async function verifyGoogleIdToken(token) {
  if (!GOOGLE_AUD) {
    return { ok: false, code: "oauth_not_configured", error: "GOOGLE_WEB_CLIENT_ID empty — Gmail production path blocked." };
  }
  const url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token);
  const resp = await fetch(url);
  if (!resp.ok) {
    return { ok: false, code: "invalid_google_token", error: "Google id_token rejected." };
  }
  const info = await resp.json();
  if (String(info.aud || "") !== GOOGLE_AUD) {
    return { ok: false, code: "aud_mismatch", error: "id_token aud does not match GOOGLE_WEB_CLIENT_ID." };
  }
  if (!info.sub) {
    return { ok: false, code: "no_sub", error: "id_token missing sub." };
  }
  return { ok: true, sub: String(info.sub), email: String(info.email || "") };
}

async function authorize(req, accountKey) {
  const token = parseAuth(req);
  const headerKey = safeKey(req.headers["x-lvfe-player-key"] || req.headers["x-lvfe-account-key"] || "");

  if (token.startsWith("google:")) {
    const v = await verifyGoogleIdToken(token.slice(7));
    if (!v.ok) return v;
    const pk = ("g" + v.sub.replace(/[^a-zA-Z0-9]/g, "")).slice(0, 32);
    if (accountKey && accountKey !== pk && accountKey !== v.sub) {
      return { ok: false, code: "key_mismatch", error: "Google sub does not match account key." };
    }
    return { ok: true, accountKey: accountKey || pk, via: "google", email: v.email };
  }

  if (token.startsWith("lvfe-dev:")) {
    if (!ALLOW_DEV) {
      return { ok: false, code: "dev_auth_disabled", error: "LVFE_ALLOW_DEV_AUTH=0 — use SAVE_SECRET or Google token." };
    }
    const pk = safeKey(token.slice("lvfe-dev:".length));
    if (!pk) return { ok: false, code: "bad_dev_key", error: "Bad lvfe-dev player key." };
    if (accountKey && accountKey !== pk) {
      return { ok: false, code: "key_mismatch", error: "Dev token playerKey mismatch." };
    }
    return { ok: true, accountKey: accountKey || pk, via: "dev" };
  }

  if (SAVE_SECRET && token === SAVE_SECRET) {
    const pk = accountKey || headerKey;
    if (!pk) return { ok: false, code: "missing_key", error: "X-Lvfe-Player-Key required with SAVE_SECRET." };
    return { ok: true, accountKey: pk, via: "secret" };
  }

  if (!token && ALLOW_DEV && (accountKey || headerKey)) {
    return { ok: true, accountKey: accountKey || headerKey, via: "dev-open" };
  }

  if (!GOOGLE_AUD && token && !token.startsWith("lvfe-dev:") && !SAVE_SECRET) {
    return {
      ok: false,
      code: "oauth_not_configured",
      error: "Production Gmail save needs GOOGLE_WEB_CLIENT_ID (or use lvfe-dev: until OAuth is wired).",
    };
  }

  return { ok: false, code: "unauthorized", error: "Missing or invalid Authorization." };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("body_too_large"), { code: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function cmpUpdated(a, b) {
  const sa = String((a && a.updatedAt) || "");
  const sb = String((b && b.updatedAt) || "");
  if (sa === sb) return 0;
  return sa < sb ? -1 : 1;
}

async function handle(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const u = new URL(req.url || "/", "http://127.0.0.1");
  const parts = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);

  if (req.method === "GET" && parts.length === 1 && parts[0] === "health") {
    const buy = buyHandlers.keysStatus();
    send(res, 200, {
      ok: true,
      service: "lvfe-save",
      allowDevAuth: ALLOW_DEV,
      googleConfigured: Boolean(GOOGLE_AUD),
      conflict: "last-write-wins by updatedAt",
      photoCap: { maxPhotos: MAX_PHOTOS, metaOnlyOverBytes: PHOTO_META_ONLY_OVER, maxBodyBytes: MAX_BODY },
      buyNcn: {
        provider: "paystack",
        configured: buy.configured,
        sandbox: buy.sandbox,
        ncnPerUsd: 1,
      },
    });
    return;
  }

  // POST /v1/buy/init|verify|webhook
  if (parts[0] === "v1" && parts[1] === "buy" && parts[2] && req.method === "POST") {
    let raw;
    try {
      raw = await readBody(req);
    } catch (err) {
      send(res, err.code === 413 ? 413 : 400, { ok: false, error: err.message || "Bad body" });
      return;
    }
    if (parts[2] === "init") {
      await buyHandlers.handleInit(req, res, send, authorize, raw);
      return;
    }
    if (parts[2] === "verify") {
      await buyHandlers.handleVerify(req, res, send, authorize, raw);
      return;
    }
    if (parts[2] === "webhook") {
      await buyHandlers.handleWebhook(req, res, send, raw);
      return;
    }
  }

  // GET /v1/save/:accountKey
  // PUT /v1/save/:accountKey
  if (parts[0] === "v1" && parts[1] === "save" && parts[2]) {
    const accountKey = safeKey(parts[2]);
    if (!accountKey) {
      send(res, 400, { ok: false, error: "Invalid account key." });
      return;
    }

    const auth = await authorize(req, accountKey);
    if (!auth.ok) {
      const code = auth.code === "oauth_not_configured" ? 503 : 401;
      send(res, code, { ok: false, code: auth.code, error: auth.error });
      return;
    }

    if (req.method === "GET") {
      const doc = readSave(accountKey);
      if (!doc) {
        send(res, 404, { ok: false, code: "not_found", error: "No save for this account yet." });
        return;
      }
      send(res, 200, { ok: true, accountKey, updatedAt: doc.updatedAt, pack: doc.pack });
      return;
    }

    if (req.method === "PUT") {
      let raw;
      try {
        raw = await readBody(req);
      } catch (err) {
        send(res, err.code === 413 ? 413 : 400, { ok: false, error: err.message || "Bad body" });
        return;
      }
      let body;
      try {
        body = JSON.parse(raw || "{}");
      } catch (err) {
        send(res, 400, { ok: false, error: "JSON required." });
        return;
      }
      const pack = body.pack || body;
      if (!pack || pack.kind !== PACK_KIND) {
        send(res, 400, { ok: false, error: "pack.kind must be lvfe.save.v1" });
        return;
      }
      const updatedAt = String(pack.updatedAt || body.updatedAt || new Date().toISOString());
      pack.updatedAt = updatedAt;
      trimPhotos(pack);

      const existing = readSave(accountKey);
      if (existing && cmpUpdated(pack, existing) < 0) {
        send(res, 409, {
          ok: false,
          code: "stale",
          error: "Server has a newer save (last-write-wins).",
          accountKey,
          updatedAt: existing.updatedAt,
          pack: existing.pack,
        });
        return;
      }

      const doc = {
        accountKey,
        updatedAt,
        via: auth.via,
        savedAt: new Date().toISOString(),
        pack,
      };
      writeSave(accountKey, doc);
      send(res, 200, { ok: true, accountKey, updatedAt, photos: (pack.photos || []).length });
      return;
    }
  }

  send(res, 404, { ok: false, error: "Not found. Try GET /health or /v1/save/:key" });
}

function createServer() {
  return http.createServer((req, res) => {
    Promise.resolve(handle(req, res)).catch((err) => {
      console.error(err);
      try {
        send(res, 500, { ok: false, error: "Internal error" });
      } catch (e) { /* */ }
    });
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, "0.0.0.0", () => {
    console.log("lvfe-save listening on http://0.0.0.0:" + PORT);
    console.log("  health: GET /health");
    console.log("  pull:   GET /v1/save/:playerKey");
    console.log("  push:   PUT /v1/save/:playerKey  Authorization: Bearer lvfe-dev:<playerKey>");
    console.log("  conflict: last-write-wins by updatedAt");
    console.log("  saves → " + SAVE_DIR);
    if (!GOOGLE_AUD) console.log("  BLOCKER: GOOGLE_WEB_CLIENT_ID empty — production Gmail sync fails loud");
  });
}

module.exports = {
  createServer,
  safeKey,
  trimPhotos,
  cmpUpdated,
  PACK_KIND,
  SAVE_DIR,
  readSave,
  writeSave,
  authorize,
};
