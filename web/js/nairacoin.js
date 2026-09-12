/* Catalog / AR helper around the single NairaCoin IOU ledger.
   Do not define LvfeNairaCoin here — that global is web/nairacoin/iou-ledger.js.
   Ledger getBalance/credit/debit are ATOMIC. This helper's getBalance/credit/debit
   stay whole-coin for catalog HUD and min-stake UI. */
(function (global) {
  const PLACES_KEY = "lvfe.places.v1";
  const cfg = { minStakeFloor: 5 };
  const NO_FARM = { bank: true, atm: true };

  function nc() {
    const L = global.LvfeNairaCoin;
    if (!L) throw new Error("nairacoin/iou-ledger.js must load first");
    return L;
  }

  let overrideKey = null;

  function playerKey() {
    if (overrideKey) return overrideKey;
    const q = new URLSearchParams(location.search);
    return ((q.get("player") || "").trim() || "default").slice(0, 32);
  }

  function setPlayerKey(pk) {
    overrideKey = ((pk || "").trim() || "default").slice(0, 32);
    return overrideKey;
  }

  function places() {
    try {
      const o = JSON.parse(localStorage.getItem(PLACES_KEY) || "{}");
      return o && typeof o === "object" ? o : {};
    } catch (err) {
      return {};
    }
  }

  function iOwn(id) {
    const rec = places()[id];
    return Boolean(rec && rec.ownerId === playerKey());
  }

  function myStake(id) {
    const rec = places()[id];
    const st = rec && rec.stakes && rec.stakes[playerKey()];
    return st ? Number(st.amount) || 0 : 0;
  }

  function placeValue(id) {
    const rec = places()[id];
    return rec ? Number(rec.value) || 0 : 0;
  }

  function ownable(type) {
    return !NO_FARM[type];
  }

  function minStake(claimNaira, type) {
    if (type && NO_FARM[type]) return 0;
    return Math.max(cfg.minStakeFloor, Number(claimNaira) || cfg.minStakeFloor);
  }

  function getBalance(pk) {
    const L = nc();
    const key = pk || playerKey();
    L.ensureFaucet(key);
    return L.balanceWhole(key);
  }

  function credit(pk, whole) {
    return nc().creditWhole(pk, whole);
  }

  function debit(pk, whole) {
    return nc().debitWhole(pk, whole);
  }

  function faucetNote() {
    const L = nc();
    return L.FAUCET_LABEL + " " + L.FAUCET_WHOLE + " · not earned · not on-chain";
  }

  function balanceLabel() {
    const L = nc();
    return L.formatWhole(getBalance());
  }

  global.LvfeCatalogWallet = {
    playerKey,
    setPlayerKey,
    owned: iOwn,
    iOwn,
    myStake,
    placeValue,
    ownable,
    minStake,
    getBalance,
    credit,
    debit,
    faucetNote,
    balanceLabel,
    NO_FARM,
    get MIN_STAKE_FLOOR() { return cfg.minStakeFloor; },
    STORE_PREFIX: function () { return nc().STORE_PREFIX; },
    applyConfig: function (o) {
      const n = Number(o && o.minStakeFloor);
      if (Number.isFinite(n) && n >= 0) cfg.minStakeFloor = n;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
