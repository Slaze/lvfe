/* NairaCoin protocol constants from Slaze/nairacoin src/CryptoNoteConfig.h
   (GitHub master 6ac59523227a03414e6af60a979fd31577dd15d0, 2026-08-29).
   Header license MIT/X11 — The Cryptonote developers. COPYING is missing
   upstream; see http://www.opensource.org/licenses/mit-license.php.

   GENESIS_COINBASE_TX_HEX is empty. CHAIN_LAUNCHED is false. Intended seed
   hostname is documented; GitHub master still has commented placeholders.
   Do not generate spend keys in the browser. */
(function (global) {
  const CRYPTONOTE_DISPLAY_DECIMAL_POINT = 8;
  const ATOMIC_PER_COIN = 100000000; // 10 ** 8
  const ATOMIC_PER_COIN_BI = BigInt(ATOMIC_PER_COIN);
  const GENESIS_COINBASE_TX_HEX = "";

  function toAtomicBig(v) {
    if (typeof v === "bigint") return v < 0n ? 0n : v;
    if (typeof v === "string" && /^-?\d+$/.test(v)) {
      try {
        const b = BigInt(v);
        return b < 0n ? 0n : b;
      } catch (err) {
        return 0n;
      }
    }
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n < 0) return 0n;
    return BigInt(n);
  }

  function wholeToAtomic(whole) {
    const n = Math.floor(Number(whole));
    if (!Number.isFinite(n) || n < 0) return 0n;
    return BigInt(n) * ATOMIC_PER_COIN_BI;
  }

  function atomicToWhole(atomic) {
    const a = toAtomicBig(atomic);
    return Number(a / ATOMIC_PER_COIN_BI);
  }

  /* FNV-1a 32-bit over JS UTF-16 code units (player ids are ASCII). */
  function fnv1a32(str) {
    let h = 0x811c9dc5;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  /**
   * Local IOU account label. NOT a CryptoNote spend address.
   * Real chain addresses are base58(prefix 0x2 + public spend + public view
   * + checksum) and start with "f". This stub is "f" + 8 hex body + 4 hex
   * checksum so HUDs can show an f-address without keys.
   */
  function formatIouAddress(playerId) {
    const id = String(playerId || "default").slice(0, 32);
    const body = fnv1a32("lvfe-iou|" + id).toString(16).padStart(8, "0");
    const chk = fnv1a32("f" + body).toString(16).padStart(8, "0").slice(0, 4);
    return "f" + body + chk;
  }

  function isIouStubAddress(addr) {
    return /^f[0-9a-f]{12}$/.test(String(addr || ""));
  }

  const protocol = {
    CRYPTONOTE_NAME: "nairacoin",
    PLAYER_FACING_NAME: "NairaCoin",
    CRYPTONOTE_DISPLAY_DECIMAL_POINT,
    ATOMIC_PER_COIN,
    CRYPTONOTE_PUBLIC_ADDRESS_BASE58_PREFIX: 0x2,
    ADDRESS_PREFIX_HINT: "f",
    ADDRESS_KIND: "iou-stub",
    MINIMUM_FEE_ATOMIC: 100000,
    DIFFICULTY_TARGET: 120,
    P2P_DEFAULT_PORT: 17356,
    RPC_DEFAULT_PORT: 18357,
    DAEMON_BIN: "nairacoind",
    GENESIS_COINBASE_TX_HEX,
    CHAIN_LAUNCHED: GENESIS_COINBASE_TX_HEX.length > 0,
    SEED_HOST: "nairacoin.iconiaglobal.com",
    SEED_NODES: ["nairacoin.iconiaglobal.com:17356", "127.0.0.1:17356"],
    SEED_ORIGIN_A: "198.54.120.94",
    P2P_LISTENING: false,
    UPSTREAM: "https://github.com/Slaze/nairacoin",
    UPSTREAM_COMMIT: "6ac59523227a03414e6af60a979fd31577dd15d0",
    wholeToAtomic,
    atomicToWhole,
    toAtomicBig,
    formatIouAddress,
    isIouStubAddress,
    fnv1a32,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = protocol;
  }
  global.NairaCoinProtocol = protocol;
})(typeof window !== "undefined" ? window : globalThis);
