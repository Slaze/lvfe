/* RPC stub. Call after GPS only when a daemon exists.
   Every method returns { ok: false, stub: true } until CHAIN_LAUNCHED and a
   server-side wallet exists. Spend keys never in this file. */
(function (global) {
  if (typeof require === "function" && !global.NairaCoinProtocol) {
    global.NairaCoinProtocol = require("./protocol.js");
  }
  const P = global.NairaCoinProtocol;
  if (!P) throw new Error("nairacoin/protocol.js must load first");

  function notLaunched(op) {
    return {
      ok: false,
      stub: true,
      chainLaunched: Boolean(P.CHAIN_LAUNCHED),
      op: op,
      rpcPort: P.RPC_DEFAULT_PORT,
      reason:
        "No live daemon from this browser. Seed name is nairacoin.iconiaglobal.com:" +
        P.P2P_DEFAULT_PORT +
        " (plus 127.0.0.1 local-dev). Create a DNS A record to the nairacoind host, " +
        "open TCP " + P.P2P_DEFAULT_PORT + ", start nairacoind there. Redeem IOU 1:1 " +
        "(atomic = whole * 10^8) via a server-side wallet on RPC " + P.RPC_DEFAULT_PORT +
        ". Never put spend keys in the frontend.",
    };
  }

  const rpc = {
    CHAIN_LAUNCHED: P.CHAIN_LAUNCHED,
    RPC_DEFAULT_PORT: P.RPC_DEFAULT_PORT,
    getInfo: function () { return notLaunched("get_info"); },
    getBalance: function () { return notLaunched("getbalance"); },
    transfer: function () { return notLaunched("transfer"); },
    redeemIou: function () { return notLaunched("redeem_iou"); },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = rpc;
  }
  global.NairaCoinRpc = rpc;
})(typeof window !== "undefined" ? window : globalThis);
