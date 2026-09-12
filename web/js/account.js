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
  const PURCHASES_KEY = "lvfe.purchases.v1";
  const RECEIPTS_KEY = "lvfe.receipts.v1";
  const PROGRESSION_KEY = "lvfe.progression.v1";
  const RATINGS_KEY = "lvfe.ratings.v1";
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

  /** Short game handle from Gmail local-part (sanitized). Keeps Slaze if already set. */
  function handleFromEmail(email) {
    const local = String(email || "").split("@")[0] || "";
    let s = local
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "")
      .replace(/^[._-]+|[._-]+$/g, "")
      .slice(0, 24);
    if (!s) return "Walker";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /** True when playerName was invented from the Google playerKey (boot bug). */
  function isPlaceholderGoogleName(name, playerKey) {
    const n = String(name || "").trim();
    const pk = String(playerKey || "").trim();
    if (!n || !pk) return false;
    return n === pk && /^g[0-9]{8,}$/.test(n);
  }

  function looksLikeGooglePlayerKey(pk) {
    return /^g[0-9]{8,}$/.test(String(pk || "").trim());
  }

  /** Guest/default/slug progress worth merging into g{sub}. */
  function hasLocalProgress(playerKey) {
    const pk = String(playerKey || "").slice(0, 32);
    if (!pk) return false;
    const idn = lsGet(IDENTITY_PREFIX + pk, null);
    if (idn && idn.playerName && !isPlaceholderGoogleName(idn.playerName, pk)) return true;
    const places = lsGet(PLACES_KEY, {});
    const ids = places && typeof places === "object" ? Object.keys(places) : [];
    for (let i = 0; i < ids.length; i++) {
      const rec = places[ids[i]];
      if (!rec || typeof rec !== "object") continue;
      if (rec.ownerId === pk) return true;
      if (rec.stakes && rec.stakes[pk]) return true;
    }
    const wallet = lsGet(walletKeys(pk), null);
    if (wallet && typeof wallet === "object") {
      try {
        const atomic = BigInt(String(wallet.atomic || "0"));
        if (atomic > 0n) return true;
      } catch (err) {
        const atomic = Number(wallet.atomic);
        if (Number.isFinite(atomic) && atomic > 0) return true;
      }
    }
    return false;
  }

  /**
   * One-shot move of local guest/slug progress onto canonical g{sub}.
   * Rewrites identity (if target empty/placeholder), wallet (max atomic), place stakes/ownerId.
   */
  function migrateLocalPlayer(fromPk, toPk, opts) {
    const from = String(fromPk || "").slice(0, 32);
    const to = String(toPk || "").slice(0, 32);
    const o = opts || {};
    if (!from || !to || from === to) return { ok: true, skipped: true };

    const fromId = lsGet(IDENTITY_PREFIX + from, null);
    let toId = lsGet(IDENTITY_PREFIX + to, null);
    const googleSub = String(o.googleSub || (fromId && fromId.googleSub) || (toId && toId.googleSub) || "").trim();
    const email = String(o.email || (fromId && fromId.email) || (toId && toId.email) || "").slice(0, 128);

    if (fromId && fromId.playerName && !isPlaceholderGoogleName(fromId.playerName, from)) {
      if (!toId || !toId.playerName || isPlaceholderGoogleName(toId.playerName, to)) {
        toId = lockIdentityFields(Object.assign({}, toId || {}, fromId, {
          googleSub: googleSub || fromId.googleSub || "",
          email: email || fromId.email || "",
        }));
        lsSet(IDENTITY_PREFIX + to, toId);
      } else if (googleSub || email) {
        toId = lockIdentityFields(Object.assign({}, toId, {
          googleSub: googleSub || toId.googleSub || "",
          email: email || toId.email || "",
        }));
        lsSet(IDENTITY_PREFIX + to, toId);
      }
    } else if (toId && (googleSub || email)) {
      lsSet(IDENTITY_PREFIX + to, lockIdentityFields(Object.assign({}, toId, {
        googleSub: googleSub || toId.googleSub || "",
        email: email || toId.email || "",
        playerName: isPlaceholderGoogleName(toId.playerName, to) ? (toId.playerName || "") : toId.playerName,
      })));
    }

    const fromW = lsGet(walletKeys(from), null);
    const toW = lsGet(walletKeys(to), null);
    if (fromW && typeof fromW === "object") {
      if (!toW) {
        lsSet(walletKeys(to), fromW);
      } else {
        let fa = 0n;
        let ta = 0n;
        try { fa = BigInt(String(fromW.atomic || "0")); } catch (e1) { fa = BigInt(Math.floor(Number(fromW.atomic) || 0)); }
        try { ta = BigInt(String(toW.atomic || "0")); } catch (e2) { ta = BigInt(Math.floor(Number(toW.atomic) || 0)); }
        lsSet(walletKeys(to), Object.assign({}, toW, {
          atomic: (fa > ta ? fa : ta).toString(),
          faucetGranted: Boolean(toW.faucetGranted || fromW.faucetGranted),
        }));
      }
    }

    const places = lsGet(PLACES_KEY, {});
    let placesChanged = false;
    if (places && typeof places === "object") {
      Object.keys(places).forEach(function (id) {
        const rec = places[id];
        if (!rec || typeof rec !== "object") return;
        if (rec.ownerId === from) {
          rec.ownerId = to;
          placesChanged = true;
        }
        if (rec.stakes && rec.stakes[from]) {
          const moved = rec.stakes[from];
          if (rec.stakes[to]) {
            rec.stakes[to] = Object.assign({}, rec.stakes[to], {
              amount: (Number(rec.stakes[to].amount) || 0) + (Number(moved.amount) || 0),
            });
          } else {
            rec.stakes[to] = moved;
          }
          delete rec.stakes[from];
          placesChanged = true;
        }
      });
      if (placesChanged) lsSet(PLACES_KEY, places);
    }

    if (googleSub) {
      bindGoogle(googleSub, email, to, o.photoUrl || "");
    }

    return { ok: true, from: from, to: to, migrated: true, placesChanged: placesChanged };
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

  /** Once a username is set it is permanent (migrate: any existing name → locked). */
  function isNameLocked(idn) {
    if (!idn || !normalizeName(idn.playerName)) return false;
    if (idn.nameLocked === false) return false;
    return true;
  }

  /**
   * Fail loud if renaming a locked profile.
   * Guest: still unique on device. Cloud permanence requires Google + save API.
   */
  function assertCanSetName(pk, newName, opts) {
    const o = opts || {};
    const next = normalizeName(newName);
    if (!next) {
      return { ok: false, code: "name_required", error: "A unique name is required." };
    }
    const cur = lsGet(IDENTITY_PREFIX + String(pk || "").slice(0, 32), null);
    if (cur && isNameLocked(cur)) {
      if (nameKey(cur.playerName) !== nameKey(next)) {
        return {
          ok: false,
          code: "username_locked",
          error: "Username is permanent and cannot be changed" +
            (cur.googleSub || o.googleSub
              ? " (bound to your Google account)."
              : ". Link Google + cloud save to lock it across devices."),
          lockedName: cur.playerName,
        };
      }
    }
    const except = o.creating ? "" : String(pk || "").slice(0, 32);
    if (nameTaken(next, except || undefined)) {
      return { ok: false, code: "username_taken", error: "That name is taken on this phone. Pick another." };
    }
    return { ok: true, name: next, locked: true };
  }

  function lockIdentityFields(idn) {
    const row = idn && typeof idn === "object" ? Object.assign({}, idn) : {};
    if (normalizeName(row.playerName)) {
      row.nameLocked = true;
      row.nameLockedAt = row.nameLockedAt || new Date().toISOString();
    }
    return row;
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
      purchases: lsGet(PURCHASES_KEY, {}),
      receipts: lsGet(RECEIPTS_KEY, {}),
      progression: lsGet(PROGRESSION_KEY, null),
      ratings: lsGet(RATINGS_KEY, null),
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
      lsSet(k, lockIdentityFields(ident[k]));
    });
    if (pack.places && typeof pack.places === "object") lsSet(PLACES_KEY, pack.places);
    if (pack.factionPool && typeof pack.factionPool === "object") lsSet(FACTION_POOL_KEY, pack.factionPool);
    if (pack.google && typeof pack.google === "object") lsSet(GOOGLE_MAP_KEY, pack.google);
    if (pack.field) lsSet(FIELD_KEY, pack.field);
    if (pack.marks && typeof pack.marks === "object") lsSet(MARKS_KEY, pack.marks);
    if (pack.tollState && typeof pack.tollState === "object") lsSet(TOLL_STATE_KEY, pack.tollState);
    if (pack.tollInbox && typeof pack.tollInbox === "object") lsSet(TOLL_INBOX_KEY, pack.tollInbox);
    if (pack.activity && typeof pack.activity === "object") lsSet(ACTIVITY_KEY, pack.activity);
    if (pack.purchases && typeof pack.purchases === "object") lsSet(PURCHASES_KEY, pack.purchases);
    if (pack.receipts && typeof pack.receipts === "object") lsSet(RECEIPTS_KEY, pack.receipts);
    if (pack.progression && typeof pack.progression === "object") lsSet(PROGRESSION_KEY, pack.progression);
    if (pack.ratings && typeof pack.ratings === "object") lsSet(RATINGS_KEY, pack.ratings);
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
    PURCHASES_KEY,
    RECEIPTS_KEY,
    PACK_KIND,
    playerKeyFromSub,
    handleFromEmail,
    isPlaceholderGoogleName,
    looksLikeGooglePlayerKey,
    hasLocalProgress,
    migrateLocalPlayer,
    normalizeName,
    nameKey,
    nameTaken,
    isNameLocked,
    assertCanSetName,
    lockIdentityFields,
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
