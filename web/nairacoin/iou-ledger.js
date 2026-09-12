/* Dev IOU ledger. Single source for Lvfe NairaCoin balances.
   Player-facing name: NairaCoin. Internally CryptoNote atomic units (8 decimals).
   Canonical API: getBalance / credit / debit (atomic integers).
   Whole-coin aliases: balanceWhole / creditWhole / debitWhole (map stakes).
   One-time demo faucet is labelled — not earned chain coins.
   No spend keys, no seeds. Does not mint. Does not write lvfe.claims.v1. */
(function (global) {
  if (typeof require === "function" && !global.NairaCoinProtocol) {
    global.NairaCoinProtocol = require("./protocol.js");
  }
  const P = global.NairaCoinProtocol;
  if (!P) throw new Error("nairacoin/protocol.js must load first");

  const STORE_PREFIX = "lvfe.nc.iou.v1.";
  const LEGACY_WHOLE_PREFIX = "lvfe.nairacoin.";
  const FAUCET_LABEL = "demo faucet";
  let FAUCET_WHOLE = 100;
  let FAUCET_ATOMIC = FAUCET_WHOLE * P.ATOMIC_PER_COIN;
  const mem = Object.create(null);

  function memoryStore() {
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; },
    };
  }

  function storage() {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return memoryStore();
    try {
      localStorage.getItem(STORE_PREFIX);
      return localStorage;
    } catch (err) {
      return memoryStore();
    }
  }

  function playerId(pk) {
    return String(pk || "default").slice(0, 32);
  }

  function walletKey(pk) {
    return STORE_PREFIX + playerId(pk);
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

  function emptyWallet(pk) {
    return {
      atomic: 0n,
      faucetGranted: false,
      unit: "atomic",
      protocol: P.CRYPTONOTE_NAME,
      address: P.formatIouAddress(pk),
    };
  }

  function loadWallet(pk) {
    const id = playerId(pk);
    const o = lsGet(walletKey(id), null);
    if (!o || typeof o !== "object") return migrateLegacy(id);
    return {
      atomic: P.toAtomicBig(o.atomic),
      faucetGranted: Boolean(o.faucetGranted),
      unit: "atomic",
      protocol: P.CRYPTONOTE_NAME,
      address: o.address && P.isIouStubAddress(o.address) ? o.address : P.formatIouAddress(id),
    };
  }

  function migrateLegacy(id) {
    const w = emptyWallet(id);
    try {
      const raw = storage().getItem(LEGACY_WHOLE_PREFIX + id);
      if (raw == null) return w;
      const n = Math.floor(Number(JSON.parse(raw)));
      if (!(n > 0)) return w;
      w.atomic = P.wholeToAtomic(n);
      w.faucetGranted = true;
      saveWallet(w, id);
    } catch (err) {
      /* leave empty */
    }
    return w;
  }

  function saveWallet(w, pk) {
    const id = playerId(pk);
    const atomic = P.toAtomicBig(w && w.atomic);
    lsSet(walletKey(id), {
      atomic: atomic.toString(),
      faucetGranted: Boolean(w.faucetGranted),
      unit: "atomic",
      protocol: P.CRYPTONOTE_NAME,
      address: w.address || P.formatIouAddress(id),
    });
  }

  function wholeOf(w) {
    return P.atomicToWhole(w && w.atomic);
  }

  function getBalance(pk) {
    return loadWallet(pk).atomic;
  }

  function credit(pk, atomic) {
    const n = P.toAtomicBig(atomic);
    if (!(n > 0n) || !pk) return false;
    const w = loadWallet(pk);
    w.atomic = P.toAtomicBig(w.atomic) + n;
    saveWallet(w, pk);
    return true;
  }

  function debit(pk, atomic) {
    const n = P.toAtomicBig(atomic);
    if (!(n > 0n)) return false;
    const w = loadWallet(pk);
    const have = P.toAtomicBig(w.atomic);
    if (have < n) return false;
    w.atomic = have - n;
    saveWallet(w, pk);
    return true;
  }

  function ensureFaucet(pk) {
    const w = loadWallet(pk);
    if (w.faucetGranted) return w;
    w.atomic = P.toAtomicBig(w.atomic) + P.toAtomicBig(FAUCET_ATOMIC);
    w.faucetGranted = true;
    saveWallet(w, pk);
    return w;
  }

  function debitWhole(pk, whole) {
    return debit(pk, P.wholeToAtomic(whole));
  }

  function creditWhole(pk, whole) {
    return credit(pk, P.wholeToAtomic(whole));
  }

  function formatWhole(n) {
    return String(Math.floor(Number(n) || 0)) + " NairaCoin";
  }

  function formatAtomic(atomic) {
    return formatWhole(P.atomicToWhole(atomic));
  }

  function resetMemoryStore() {
    Object.keys(mem).forEach(function (k) { delete mem[k]; });
  }

  const api = {
    STORE_PREFIX,
    LEGACY_WHOLE_PREFIX,
    get FAUCET_WHOLE() { return FAUCET_WHOLE; },
    get FAUCET_ATOMIC() { return FAUCET_ATOMIC; },
    FAUCET_LABEL,
    ATOMIC_PER_COIN: P.ATOMIC_PER_COIN,
    protocol: P,
    walletKey,
    playerId,
    loadWallet,
    saveWallet,
    wholeOf,
    ensureFaucet,
    accountAddress: P.formatIouAddress,
    getBalance,
    credit,
    debit,
    getBalanceAtomic: getBalance,
    creditAtomic: credit,
    debitAtomic: debit,
    debitWhole,
    creditWhole,
    balanceWhole: function (pk) { return wholeOf(loadWallet(pk)); },
    formatWhole,
    formatAtomic,
    resetMemoryStore,
    applyConfig: function (o) {
      const n = Number(o && o.faucetWhole);
      if (Number.isFinite(n) && n >= 0) {
        FAUCET_WHOLE = Math.floor(n);
        FAUCET_ATOMIC = FAUCET_WHOLE * P.ATOMIC_PER_COIN;
      }
    },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfeNairaCoin = api;
  global.NairaCoin = api;
})(typeof window !== "undefined" ? window : globalThis);
