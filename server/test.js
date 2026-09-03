#!/usr/bin/env node
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { createServer, SAVE_DIR, PACK_KIND } = require("./index.js");

const PORT = 8799;
const KEY = "testplayer";

function req(method, urlPath, body, headers) {
  return new Promise((resolve, reject) => {
    const r = http.request(
      {
        hostname: "127.0.0.1",
        port: PORT,
        path: urlPath,
        method,
        headers: Object.assign(
          { "Content-Type": "application/json" },
          headers || {},
        ),
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try { json = JSON.parse(text); } catch (e) { /* */ }
          resolve({ status: res.statusCode, json, text });
        });
      },
    );
    r.on("error", reject);
    if (body != null) r.write(typeof body === "string" ? body : JSON.stringify(body));
    r.end();
  });
}

async function main() {
  const saveFile = path.join(SAVE_DIR, KEY + ".json");
  try { fs.unlinkSync(saveFile); } catch (e) { /* */ }

  const server = createServer();
  await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));

  const health = await req("GET", "/health");
  if (!health.json || !health.json.ok) throw new Error("health fail");

  const pack = {
    kind: PACK_KIND,
    v: 1,
    updatedAt: "2026-09-03T10:00:00.000Z",
    playerKey: KEY,
    identity: { ["lvfe.identity." + KEY]: { playerName: "Ada", factionId: "" } },
    places: { p1: { value: 10, stakes: { [KEY]: { amount: 10 } } } },
    factionPool: {},
    google: {},
    field: { type: "FeatureCollection", features: [] },
    wallets: {},
    photos: [],
  };

  const put1 = await req("PUT", "/v1/save/" + KEY, { pack }, {
    Authorization: "Bearer lvfe-dev:" + KEY,
  });
  if (put1.status !== 200 || !put1.json.ok) throw new Error("put1 " + put1.text);

  const get1 = await req("GET", "/v1/save/" + KEY, null, {
    Authorization: "Bearer lvfe-dev:" + KEY,
  });
  if (get1.status !== 200 || get1.json.pack.places.p1.value !== 10) {
    throw new Error("get1 " + get1.text);
  }

  const stale = Object.assign({}, pack, { updatedAt: "2026-09-03T09:00:00.000Z", places: { p1: { value: 1 } } });
  const putStale = await req("PUT", "/v1/save/" + KEY, { pack: stale }, {
    Authorization: "Bearer lvfe-dev:" + KEY,
  });
  if (putStale.status !== 409 || putStale.json.code !== "stale") {
    throw new Error("expected 409 stale, got " + putStale.status + " " + putStale.text);
  }

  const newer = Object.assign({}, pack, {
    updatedAt: "2026-09-03T11:00:00.000Z",
    places: { p1: { value: 42, stakes: { [KEY]: { amount: 42 } } } },
  });
  const put2 = await req("PUT", "/v1/save/" + KEY, { pack: newer }, {
    Authorization: "Bearer lvfe-dev:" + KEY,
  });
  if (put2.status !== 200) throw new Error("put2 " + put2.text);

  const get2 = await req("GET", "/v1/save/" + KEY, null, {
    Authorization: "Bearer lvfe-dev:" + KEY,
  });
  if (get2.json.pack.places.p1.value !== 42) throw new Error("LWW failed");

  server.close();
  try { fs.unlinkSync(saveFile); } catch (e) { /* */ }
  console.log("server/test.js ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
