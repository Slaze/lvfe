#!/usr/bin/env node
/* Atomic IOU ledger: getBalance/credit/debit, 8 decimals, demo faucet, stub RPC. */
const { ledger, protocol, rpc } = require("../web/nairacoin");

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

ledger.resetMemoryStore();

assert(protocol.CRYPTONOTE_NAME === "nairacoin", "name");
assert(protocol.PLAYER_FACING_NAME === "NairaCoin", "player name");
assert(protocol.CRYPTONOTE_DISPLAY_DECIMAL_POINT === 8, "decimals");
assert(protocol.ATOMIC_PER_COIN === 100000000, "atomic");
assert(protocol.GENESIS_COINBASE_TX_HEX === "", "empty genesis");
assert(protocol.CHAIN_LAUNCHED === false, "not launched");
assert(protocol.ADDRESS_PREFIX_HINT === "f", "prefix f");

const addr = ledger.accountAddress("ada");
assert(addr.charAt(0) === "f", "stub starts with f");
assert(protocol.isIouStubAddress(addr), "stub checksum shape");
assert(addr !== ledger.accountAddress("chidi"), "addresses differ");

assert(ledger.getBalance("ada") === 0, "no implicit faucet");
ledger.ensureFaucet("ada");
assert(ledger.getBalance("ada") === 100 * protocol.ATOMIC_PER_COIN, "demo faucet 100 whole");
assert(ledger.FAUCET_LABEL === "demo faucet", "labelled faucet");
ledger.ensureFaucet("ada");
assert(ledger.getBalance("ada") === 100 * protocol.ATOMIC_PER_COIN, "faucet once");

assert(ledger.debit("ada", 42 * protocol.ATOMIC_PER_COIN) === true, "debit 42 whole as atomic");
assert(ledger.getBalance("ada") === 58 * protocol.ATOMIC_PER_COIN, "58 left");
assert(ledger.debit("ada", 59 * protocol.ATOMIC_PER_COIN) === false, "insufficient");
assert(ledger.credit("ada", 4 * protocol.ATOMIC_PER_COIN) === true, "credit yield atomic");
assert(ledger.balanceWhole("ada") === 62, "whole alias");
assert(ledger.debitWhole("ada", 2) === true, "whole debit");
assert(ledger.getBalance("ada") === 60 * protocol.ATOMIC_PER_COIN, "after whole debit");

const keys = JSON.stringify(ledger.loadWallet("ada"));
assert(!/spend|seed|private|secret|mnemonic/i.test(keys), "no keys in wallet blob");

assert(rpc.getBalance().ok === false && rpc.getBalance().stub === true, "rpc stub");
assert(rpc.transfer().stub === true, "transfer stub");
assert(rpc.redeemIou().stub === true, "redeem stub");

const { spawnSync } = require("child_process");
const py = spawnSync("python3", ["-c",
  "from scripts.nairacoin_units import account_address, ATOMIC_PER_COIN, CHAIN_LAUNCHED\n" +
  "print(account_address('ada'))\nprint(ATOMIC_PER_COIN)\nprint(int(CHAIN_LAUNCHED))"
], { cwd: require("path").join(__dirname, ".."), encoding: "utf8" });
assert(py.status === 0, "python units: " + py.stderr);
const [pyAddr, pyAtomic, pyLaunched] = py.stdout.trim().split("\n");
assert(pyAddr === addr, "js/py stub address mismatch " + pyAddr + " vs " + addr);
assert(pyAtomic === "100000000" && pyLaunched === "0", "python units");

console.log("nairacoin ledger ok: atomic", ledger.getBalance("ada"), "addr", addr, "rpc stub");
