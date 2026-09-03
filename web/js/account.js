/* Device-local player records. No server. Reinstall wipes WebView storage
   unless the player exported a pack (or Android backup restored it).
   Google sub is the durable account key once OAuth is configured. */
(function (global) {
  const IDENTITY_PREFIX = "lvfe.identity.";
  const PLACES_KEY = "lvfe.places.v1";
  const FACTION_POOL_KEY = "lvfe.factionpool.v1";
  const GOOGLE_MAP_KEY = "lvfe.google.v1";
  const FIELD_KEY = "lvfe.field.v1";
  const WALLET_PREFIX = "lvfe.nc.iou.v1.";
  const MARKS_KEY = "lvfe.marks.v1";
  const TOLL_STATE_KEY = "lvfe.toll.state.v1";
  const TOLL_INBOX_KEY = "lvfe.toll.inbox.v1";
  const ACTIVITY_KEY = "lvfe.activity.v1";
  const PACK_KIND = "lvfe.save.v1";

  function storage() {
    if (typeof localStorage === "undefined") {
      if (!global.__lvfeAccountMem) global.__lvfeAccountMem = {};
      const mem = global.__lvfeAccountMem;
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
        setItem: function (k, v) { mem[k] = String(v); },
        removeItem: function (k) { delete mem[k]; },
        get length() { return Object.keys(mem).length; },
        key: function (i) { return Object.keys(mem)[i] || null; },
      };
    }
    return localStorage;
  }

  function lsGet(key, fallback) {
    try {
      const raw = storage().getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function lsSet(key, val) {
    storage().setItem(key, JSON.stringify(val));
  }

  function playerKeyFromSub(sub) {
    const s = String(sub || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 31);
    return ("g" + (s || "user")).slice(0, 32);
  }

  function normalizeName(name) {
    return String(name || "").trim().slice(0, 32);
  }

  function nameKey(name) {
    return normalizeName(name).toLowerCase();
  }

  function listIdentities() {
    const out = [];
    const store = storage();
    const n = store.length || 0;
    for (let i = 0; i < n; i++) {
      const k = store.key(i);
      if (!k || k.indexOf(IDENTITY_PREFIX) !== 0) continue;
      const pk = k.slice(IDENTITY_PREFIX.length);
      const idn = lsGet(k, null);
      if (!idn || !idn.playerName) continue;
      out.push({
        pk: pk,
        playerName: String(idn.playerName).slice(0, 32),
        factionId: idn.factionId || "",
        googleSub: idn.googleSub || "",
        email: idn.email || "",
      });
    }
    return out;
  }

  function nameTaken(name, exceptPk) {
    const want = nameKey(name);
    if (!want) return false;
    const rows = listIdentities();
    for (let i = 0; i < rows.length; i++) {
      if (exceptPk && rows[i].pk === exceptPk) continue;
      if (nameKey(rows[i].playerName) === want) return true;
    }
    return false;
  }

  function slugFromName(name) {
    const s = normalizeName(name).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 32);
    return s || "player";
  }

  function uniquePlayerKey(name) {
    let base = slugFromName(name);
    if (!lsGet(IDENTITY_PREFIX + base, null)) return base;
    for (let n = 2; n < 99; n++) {
      const pk = (base.slice(0, 30) + n).slice(0, 32);
      if (!lsGet(IDENTITY_PREFIX + pk, null)) return pk;
    }
    return (base.slice(0, 24) + String(Date.now()).slice(-8)).slice(0, 32);
  }

  function googleMap() {
    const o = lsGet(GOOGLE_MAP_KEY, {});
    return o && typeof o === "object" ? o : {};
  }

  function bindGoogle(sub, email, playerKey, photoUrl) {
    const id = String(sub || "").trim();
    if (!id) return null;
    const all = googleMap();
    const prev = all[id] || {};
    all[id] = {
      playerKey: String(playerKey || playerKeyFromSub(id)).slice(0, 32),
      email: String(email || "").slice(0, 128),
      photoUrl: String(photoUrl || prev.photoUrl || "").slice(0, 512),
      at: new Date().toISOString(),
    };
    lsSet(GOOGLE_MAP_KEY, all);
    return all[id];
  }

  function photoUrlFor(sub) {
    const id = String(sub || "").trim();
    if (!id) return "";
    const row = googleMap()[id];
    return row && row.photoUrl ? String(row.photoUrl).slice(0, 512) : "";
  }

  function photoUrlForPlayer(playerKey) {
    const sess = googleSessionFor(playerKey);
    if (!sess || !sess.sub) return "";
    return photoUrlFor(sess.sub) || String(sess.photoUrl || "").slice(0, 512);
  }

  function lookupGoogle(sub) {
    const id = String(sub || "").trim();
    if (!id) return null;
    const row = googleMap()[id];
    if (!row || !row.playerKey) return null;
    return row;
  }

  function unbindGoogle(sub) {
    const id = String(sub || "").trim();
    if (!id) return false;
    const all = googleMap();
    if (!all[id]) return false;
    delete all[id];
    lsSet(GOOGLE_MAP_KEY, all);
    return true;
  }

  /** Active Google session for a player key (or any bound sub). */
  function googleSessionFor(playerKey) {
    const want = String(playerKey || "").slice(0, 32);
    const all = googleMap();
    const keys = Object.keys(all);
    for (let i = 0; i < keys.length; i++) {
      const row = all[keys[i]];
      if (!row || !row.playerKey) continue;
      if (want && row.playerKey !== want) continue;
      return {
        sub: keys[i],
        email: String(row.email || "").slice(0, 128),
        playerKey: String(row.playerKey).slice(0, 32),
        photoUrl: String(row.photoUrl || "").slice(0, 512),
      };
    }
    return null;
  }

  function walletKeys(playerKey) {
    const L = global.LvfeNairaCoin;
    const prefix = (L && L.STORE_PREFIX) || WALLET_PREFIX;
    return prefix + String(playerKey || "default").slice(0, 32);
  }

  function collectWallets() {
    const out = {};
    const store = storage();
    const L = global.LvfeNairaCoin;
    const prefix = (L && L.STORE_PREFIX) || WALLET_PREFIX;
    const n = store.length || 0;
    for (let i = 0; i < n; i++) {
      const k = store.key(i);
      if (!k || k.indexOf(prefix) !== 0) continue;
      out[k] = lsGet(k, null);
    }
    return out;
  }

  function collectIdentitiesRaw() {
    const out = {};
    const store = storage();
    const n = store.length || 0;
    for (let i = 0; i < n; i++) {
      const k = store.key(i);
      if (!k || k.indexOf(IDENTITY_PREFIX) !== 0) continue;
      out[k] = lsGet(k, null);
    }
    return out;
  }

  function packSave(opts) {
    const o = opts || {};
    const exportedAt = new Date().toISOString();
    return {
      kind: PACK_KIND,
      v: 1,
      exportedAt: exportedAt,
      updatedAt: o.updatedAt || exportedAt,
      playerKey: o.playerKey || "default",
      googleSub: o.googleSub || "",
      email: o.email || "",
      identity: collectIdentitiesRaw(),
      places: lsGet(PLACES_KEY, {}),
      factionPool: lsGet(FACTION_POOL_KEY, {}),
      google: googleMap(),
      field: lsGet(FIELD_KEY, { type: "FeatureCollection", features: [] }),
      wallets: collectWallets(),
      marks: lsGet(MARKS_KEY, { watchPlaces: {}, threats: {}, takeovers: {} }),
      tollState: lsGet(TOLL_STATE_KEY, { lastByPlace: {}, pending: {}, debtByPlace: {} }),
      tollInbox: lsGet(TOLL_INBOX_KEY, { items: [] }),
      activity: lsGet(ACTIVITY_KEY, { items: [] }),
      photos: Array.isArray(o.photos) ? o.photos : [],
      note: "Lvfe save pack. Prefer cloud sync when SAVE_API_BASE is set; Export/Import remains the offline backup. Photos may be meta-only if over ~400KB.",
    };
  }

  function unpackSave(pack) {
    if (!pack || pack.kind !== PACK_KIND) {
      return { ok: false, error: "Not an Lvfe save file." };
    }
    const ident = pack.identity && typeof pack.identity === "object" ? pack.identity : {};
    Object.keys(ident).forEach(function (k) {
      if (k.indexOf(IDENTITY_PREFIX) !== 0) return;
      lsSet(k, ident[k]);
    });
    if (pack.places && typeof pack.places === "object") lsSet(PLACES_KEY, pack.places);
    if (pack.factionPool && typeof pack.factionPool === "object") lsSet(FACTION_POOL_KEY, pack.factionPool);
    if (pack.google && typeof pack.google === "object") lsSet(GOOGLE_MAP_KEY, pack.google);
    if (pack.field) lsSet(FIELD_KEY, pack.field);
    if (pack.marks && typeof pack.marks === "object") lsSet(MARKS_KEY, pack.marks);
    if (pack.tollState && typeof pack.tollState === "object") lsSet(TOLL_STATE_KEY, pack.tollState);
    if (pack.tollInbox && typeof pack.tollInbox === "object") lsSet(TOLL_INBOX_KEY, pack.tollInbox);
    if (pack.activity && typeof pack.activity === "object") lsSet(ACTIVITY_KEY, pack.activity);
    const wallets = pack.wallets && typeof pack.wallets === "object" ? pack.wallets : {};
    Object.keys(wallets).forEach(function (k) {
      if (k.indexOf("lvfe.nc.iou.v1.") !== 0 && k.indexOf("lvfe.nairacoin.") !== 0) return;
      lsSet(k, wallets[k]);
    });
    return {
      ok: true,
      playerKey: pack.playerKey || "default",
      photos: Array.isArray(pack.photos) ? pack.photos : [],
    };
  }

  const api = {
    IDENTITY_PREFIX,
    PLACES_KEY,
    FACTION_POOL_KEY,
    GOOGLE_MAP_KEY,
    FIELD_KEY,
    MARKS_KEY,
    TOLL_STATE_KEY,
    TOLL_INBOX_KEY,
    ACTIVITY_KEY,
    PACK_KIND,
    playerKeyFromSub,
    normalizeName,
    nameTaken,
    slugFromName,
    uniquePlayerKey,
    listIdentities,
    bindGoogle,
    lookupGoogle,
    unbindGoogle,
    googleSessionFor,
    googleMap,
    photoUrlFor,
    photoUrlForPlayer,
    packSave,
    unpackSave,
    walletKeys,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfeAccount = api;
})(typeof window !== "undefined" ? window : globalThis);
