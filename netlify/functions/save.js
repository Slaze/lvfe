/**
 * Optional Netlify Functions deploy of the same /v1/save API.
 * Uses Netlify Blobs when available; falls back to in-memory (dev only).
 *
 * Env (Netlify site):
 *   SAVE_SECRET — required for public deploys
 *   LVFE_ALLOW_DEV_AUTH — set "0" on production
 *   GOOGLE_WEB_CLIENT_ID — Identity OAuth Web client (not Maps)
 *
 * Routes via netlify.toml redirects: /v1/save/* → /.netlify/functions/save
 */
"use strict";

const PACK_KIND = "lvfe.save.v1";
const MAX_PHOTOS = 8;
const PHOTO_META_ONLY_OVER = 400000;

function env(name, fallback) {
  try {
    if (typeof Netlify !== "undefined" && Netlify.env && typeof Netlify.env.get === "function") {
      const v = Netlify.env.get(name);
      if (v != null && v !== "") return v;
    }
  } catch (err) { /* */ }
  if (process.env[name] != null && process.env[name] !== "") return process.env[name];
  return fallback;
}

const mem = globalThis.__lvfeNetlifySaves || (globalThis.__lvfeNetlifySaves = new Map());

async function blobStore() {
  try {
    const { getStore } = await import("@netlify/blobs");
    return getStore("lvfe-saves");
  } catch (err) {
    return null;
  }
}

async function readDoc(key) {
  const store = await blobStore();
  if (store) {
    const raw = await store.get(key);
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }
  return mem.get(key) || null;
}

async function writeDoc(key, doc) {
  const store = await blobStore();
  if (store) {
    await store.setJSON(key, doc);
    return;
  }
  mem.set(key, doc);
}

function safeKey(raw) {
  const s = String(raw || "").trim().slice(0, 64);
  if (!/^[a-zA-Z0-9._:-]+$/.test(s)) return null;
  return s;
}

function trimPhotos(pack) {
  if (!pack || !Array.isArray(pack.photos)) {
    if (pack) pack.photos = [];
    return;
  }
  const kept = [];
  for (let i = 0; i < pack.photos.length && kept.length < MAX_PHOTOS; i++) {
    const row = pack.photos[i];
    if (!row || !row.placeId) continue;
    const url = String(row.dataUrl || "");
    if (url.length > PHOTO_META_ONLY_OVER) {
      kept.push({ playerKey: row.playerKey, placeId: row.placeId, type: row.type, metaOnly: true });
    } else kept.push(row);
  }
  pack.photos = kept;
}

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Lvfe-Player-Key",
      "Cache-Control": "no-store",
    },
  });
}

async function authorize(req, accountKey) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1].trim() : "";
  const allowDev = env("LVFE_ALLOW_DEV_AUTH", "0") !== "0";
  const secret = env("SAVE_SECRET", "");
  const googleAud = env("GOOGLE_WEB_CLIENT_ID", "");

  if (token.startsWith("lvfe-dev:")) {
    if (!allowDev) return { ok: false, code: "dev_auth_disabled", status: 401 };
    const pk = safeKey(token.slice(9));
    if (!pk || (accountKey && pk !== accountKey)) return { ok: false, code: "key_mismatch", status: 401 };
    return { ok: true };
  }
  if (secret && token === secret) return { ok: true };
  if (token.startsWith("google:")) {
    if (!googleAud) {
      return { ok: false, code: "oauth_not_configured", status: 503, error: "GOOGLE_WEB_CLIENT_ID empty" };
    }
    const infoRes = await fetch(
      "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token.slice(7)),
    );
    if (!infoRes.ok) return { ok: false, code: "invalid_google_token", status: 401 };
    const info = await infoRes.json();
    if (String(info.aud) !== googleAud) return { ok: false, code: "aud_mismatch", status: 401 };
    return { ok: true, sub: info.sub };
  }
  if (!googleAud && !secret) {
    return { ok: false, code: "oauth_not_configured", status: 503, error: "Configure SAVE_SECRET or GOOGLE_WEB_CLIENT_ID" };
  }
  return { ok: false, code: "unauthorized", status: 401 };
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Lvfe-Player-Key",
      },
    });
  }

  const url = new URL(req.url);
  let key = url.searchParams.get("key");
  if (!key) {
    const parts = url.pathname.split("/").filter(Boolean);
    const i = parts.lastIndexOf("save");
    if (i >= 0 && parts[i + 1]) key = parts[i + 1];
  }
  key = safeKey(key);
  if (!key) return json(400, { ok: false, error: "Missing account key" });

  const auth = await authorize(req, key);
  if (!auth.ok) {
    return json(auth.status || 401, { ok: false, code: auth.code, error: auth.error || auth.code });
  }

  if (req.method === "GET") {
    const doc = await readDoc(key);
    if (!doc) return json(404, { ok: false, code: "not_found", error: "No save" });
    return json(200, { ok: true, accountKey: key, updatedAt: doc.updatedAt, pack: doc.pack });
  }

  if (req.method === "PUT") {
    const body = await req.json().catch(() => null);
    const pack = body && (body.pack || body);
    if (!pack || pack.kind !== PACK_KIND) {
      return json(400, { ok: false, error: "pack.kind must be lvfe.save.v1" });
    }
    const updatedAt = String(pack.updatedAt || new Date().toISOString());
    pack.updatedAt = updatedAt;
    trimPhotos(pack);
    const existing = await readDoc(key);
    if (existing && String(existing.updatedAt || "") > updatedAt) {
      return json(409, {
        ok: false,
        code: "stale",
        updatedAt: existing.updatedAt,
        pack: existing.pack,
      });
    }
    await writeDoc(key, { accountKey: key, updatedAt, pack, savedAt: new Date().toISOString() });
    return json(200, { ok: true, accountKey: key, updatedAt });
  }

  return json(405, { ok: false, error: "GET or PUT only" });
};

export const config = {
  path: ["/v1/save/:key", "/.netlify/functions/save"],
};
