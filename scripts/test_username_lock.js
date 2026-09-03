/* Username permanent lock (client) + server reject rename/reuse. */
require("../web/js/account.js");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { createServer, SAVE_DIR, PACK_KIND, usernameLock } = require("../server/index.js");

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const Acc = global.LvfeAccount;

global.__lvfeAccountMem = {};

/* --- client lock --- */
assert(Acc.isNameLocked({ playerName: "Ada" }) === true, "existing name migrates to locked");
assert(Acc.isNameLocked({ playerName: "" }) === false, "empty not locked");
assert(Acc.isNameLocked(null) === false, "null");

const lockOk = Acc.assertCanSetName("ada", "Ada", {});
assert(lockOk.ok, "first name ok");

Acc.unpackSave({
  kind: Acc.PACK_KIND,
  identity: {
    "lvfe.identity.ada": {
      playerName: "Ada",
      factionId: "independence_layout",
      googleSub: "sub-ada",
      nameLocked: true,
    },
  },
  places: {},
  wallets: {},
  factionPool: {},
  google: { "sub-ada": { playerKey: "ada", email: "a@x.com" } },
  field: { type: "FeatureCollection", features: [] },
});

const rename = Acc.assertCanSetName("ada", "Chidi", { googleSub: "sub-ada" });
assert(rename.ok === false && rename.code === "username_locked", "client rejects rename: " + JSON.stringify(rename));

const keep = Acc.assertCanSetName("ada", "Ada", {});
assert(keep.ok === true, "same name still ok");

const taken = Acc.assertCanSetName("chidi", "Ada", { creating: true });
assert(taken.ok === false && taken.code === "username_taken", "unique on device");

/* --- server lock --- */
const mapFile = usernameLock.mapPath(SAVE_DIR);
try { fs.unlinkSync(mapFile); } catch (e) { /* */ }

const KEY = "gsubada1";
const KEY2 = "gsubchidi2";
const save1 = path.join(SAVE_DIR, KEY + ".json");
const save2 = path.join(SAVE_DIR, KEY2 + ".json");
try { fs.unlinkSync(save1); } catch (e) { /* */ }
try { fs.unlinkSync(save2); } catch (e) { /* */ }

function req(port, method, urlPath, body, headers) {
  return new Promise((resolve, reject) => {
    const r = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: urlPath,
        method,
        headers: Object.assign({ "Content-Type": "application/json" }, headers || {}),
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
    if (body != null) r.write(JSON.stringify(body));
    r.end();
  });
}

async function runServer() {
  const PORT = 8801;
  const server = createServer();
  await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));

  const packAda = {
    kind: PACK_KIND,
    v: 1,
    updatedAt: "2026-09-03T12:00:00.000Z",
    playerKey: KEY,
    googleSub: "111",
    identity: {
      ["lvfe.identity." + KEY]: {
        playerName: "Ada",
        factionId: "independence_layout",
        googleSub: "111",
        nameLocked: true,
      },
    },
    places: {},
    factionPool: {},
    google: {},
    field: { type: "FeatureCollection", features: [] },
    wallets: {},
    photos: [],
  };

  /* Dev auth without googleSub skips cloud lock */
  const guestKey = "guestlocal";
  const guestFile = path.join(SAVE_DIR, guestKey + ".json");
  try { fs.unlinkSync(guestFile); } catch (e) { /* */ }
  const guestPack = Object.assign({}, packAda, {
    playerKey: guestKey,
    googleSub: "",
    updatedAt: "2026-09-03T12:00:01.000Z",
    identity: {
      ["lvfe.identity." + guestKey]: { playerName: "GuestOne", factionId: "", googleSub: "" },
    },
  });
  const gPut = await req(PORT, "PUT", "/v1/save/" + guestKey, { pack: guestPack }, {
    Authorization: "Bearer lvfe-dev:" + guestKey,
  });
  assert(gPut.status === 200, "guest put without google ok: " + gPut.text);

  /* Simulate lock with enforceUsernameLock directly (google path) */
  const lock1 = usernameLock.enforceUsernameLock(packAda, KEY, { sub: "111" }, SAVE_DIR);
  assert(lock1.ok && lock1.locked, "first lock registers Ada↔111");

  const renamePack = JSON.parse(JSON.stringify(packAda));
  renamePack.identity["lvfe.identity." + KEY].playerName = "Chidi";
  renamePack.updatedAt = "2026-09-03T12:01:00.000Z";
  const lockRename = usernameLock.enforceUsernameLock(renamePack, KEY, { sub: "111" }, SAVE_DIR);
  assert(lockRename.ok === false && lockRename.code === "username_locked", "server rejects rename");

  const otherPack = {
    kind: PACK_KIND,
    updatedAt: "2026-09-03T12:02:00.000Z",
    playerKey: KEY2,
    googleSub: "222",
    identity: {
      ["lvfe.identity." + KEY2]: {
        playerName: "Ada",
        googleSub: "222",
        nameLocked: true,
      },
    },
  };
  const lockTaken = usernameLock.enforceUsernameLock(otherPack, KEY2, { sub: "222" }, SAVE_DIR);
  assert(lockTaken.ok === false && lockTaken.code === "username_taken", "server rejects reuse by other Google");

  const same = usernameLock.enforceUsernameLock(packAda, KEY, { sub: "111" }, SAVE_DIR);
  assert(same.ok === true, "idempotent same name");

  /* PUT via HTTP with googleSub in pack (dev auth) still enforces when sub present via pack */
  const putRename = await req(PORT, "PUT", "/v1/save/" + KEY, {
    pack: Object.assign({}, renamePack, {
      updatedAt: "2026-09-03T13:00:00.000Z",
      identity: {
        ["lvfe.identity." + KEY]: {
          playerName: "Ada",
          googleSub: "111",
          nameLocked: true,
        },
      },
    }),
  }, { Authorization: "Bearer lvfe-dev:" + KEY });
  /* First register via put — pack has googleSub so lock applies */
  assert(putRename.status === 200 || putRename.status === 409, "put registers or locks: " + putRename.text);

  const putBad = await req(PORT, "PUT", "/v1/save/" + KEY, {
    pack: Object.assign({}, renamePack, { updatedAt: "2026-09-03T14:00:00.000Z" }),
  }, { Authorization: "Bearer lvfe-dev:" + KEY });
  assert(putBad.status === 409 && putBad.json && putBad.json.code === "username_locked",
    "HTTP put rejects rename: " + putBad.text);

  server.close();
  try { fs.unlinkSync(save1); } catch (e) { /* */ }
  try { fs.unlinkSync(save2); } catch (e) { /* */ }
  try { fs.unlinkSync(guestFile); } catch (e) { /* */ }
  try { fs.unlinkSync(mapFile); } catch (e) { /* */ }
}

runServer().then(function () {
  console.log("username lock (client + server) ok");
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
