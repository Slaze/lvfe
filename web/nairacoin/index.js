"use strict";
/* Node barrel. Sibling scripts: const { ledger, protocol, rpc } = require("./web/nairacoin");
   Browser: script protocol.js, iou-ledger.js, rpc-stub.js — then window.LvfeNairaCoin. */
require("./protocol.js");
require("./iou-ledger.js");
require("./rpc-stub.js");

module.exports = {
  protocol: globalThis.NairaCoinProtocol,
  ledger: globalThis.LvfeNairaCoin,
  rpc: globalThis.NairaCoinRpc,
  NairaCoinProtocol: globalThis.NairaCoinProtocol,
  LvfeNairaCoin: globalThis.LvfeNairaCoin,
  NairaCoinRpc: globalThis.NairaCoinRpc,
};
