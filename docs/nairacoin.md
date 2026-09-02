# NairaCoin in Lvfe

Source: [Slaze/nairacoin](https://github.com/Slaze/nairacoin) (`CRYPTONOTE_NAME` = `"nairacoin"`). Fetched master `6ac59523227a03414e6af60a979fd31577dd15d0` (2026-08-29). Header license MIT/X11 (The Cryptonote developers); upstream has no `COPYING` file. Constants vendored in `web/nairacoin/protocol.js` and `scripts/nairacoin_units.py`.

Player-facing name: **NairaCoin**.

## What the chain actually is

| Fact | Value |
| --- | --- |
| Protocol | CryptoNote (2016 reference fork) |
| Display decimals | 8 (`1` coin = `10^8` atomic) |
| Address prefix | `0x2` (real chain addresses start with `f`) |
| P2P / RPC | 17356 / 18357 |
| Daemon binary | `nairacoind` |
| Genesis | `GENESIS_COINBASE_TX_HEX` is **empty** (GitHub master and `~/nairacoin`) |
| Intended seed | `nairacoin.iconiaglobal.com:17356` + `127.0.0.1:17356` (operator tree; GitHub master still has commented placeholders) |
| DNS | Grey-cloud A **`198.54.120.94`**. TCP **17356 TIMEOUT**. Origin 80/443 is Apache, not `nairacoind`. |
| `CHAIN_LAUNCHED` | **false** |

Empty genesis + no listening daemon means **the chain is not launched**. Do not show a HUD “NairaCoin” on a random integer as if it were that chain. A private protocol tree elsewhere is not this game’s backend.

## Address format

- **Real CryptoNote address:** base58 of prefix `0x2` + public spend key + public view key + checksum. Starts with `f`. Requires keys. **Never generated in the frontend.**
- **Lvfe IOU account (live):** stub `f` + 8 hex FNV-1a body + 4 hex checksum, e.g. `f` + 12 hex chars. `ADDRESS_KIND = "iou-stub"`. Same `f` prefix as the chain so it is recognizable; it is **not** spendable on a daemon. `LvfeNairaCoin.accountAddress(playerId)` / `NairaCoinProtocol.formatIouAddress(playerId)`.

## Live vs stub

| Piece | Status |
| --- | --- |
| Browser IOU ledger (`getBalance` / `credit` / `debit` in atomic units) | **Live** (this origin’s localStorage, not a shared world) |
| Demo faucet (100 whole coins = `100 * 10^8` atomic) | **Live**, labelled **demo faucet** — not earned, not mined |
| Whole-coin stake aliases (`balanceWhole` / `creditWhole` / `debitWhole`) | **Live** (game UI still shows whole coins) |
| `schema/nairacoin.sql` | **Stub** (future server / hot wallet; not wired; no place owners) |
| RPC (`web/nairacoin/rpc-stub.js`) after GPS | **Stub** until genesis exists (`NairaCoinRpc.*` → `{ ok: false, stub: true }`) |
| On-chain mint / transfer / redeem | **Stub** — empty genesis |

## Module API (sibling: import this, not a third wallet)

Canonical coin layer: `web/nairacoin/`. Global `window.LvfeNairaCoin` (alias `window.NairaCoin`). `web/js/nairacoin.js` is catalog/AR **place** helpers; its `getBalance`/`credit`/`debit` are **whole-coin wrappers** and must not define `LvfeNairaCoin`.

### Browser

```html
<script src="nairacoin/protocol.js"></script>
<script src="nairacoin/iou-ledger.js"></script>
<script src="nairacoin/rpc-stub.js"></script>
```

```js
const NC = window.LvfeNairaCoin;       // or window.NairaCoin
const P  = window.NairaCoinProtocol;
const Rpc = window.NairaCoinRpc;       // always stub while genesis is empty

NC.ensureFaucet(playerId);             // one-time demo faucet
const atomic = NC.getBalance(playerId); // integer atomic units
NC.debit(playerId, atomicAmount);      // false if insufficient
NC.credit(playerId, atomicAmount);     // false if amount <= 0
NC.accountAddress(playerId);           // f + checksum stub

// Game stakes may still use whole coins:
NC.balanceWhole(playerId);
NC.debitWhole(playerId, 42);
NC.creditWhole(playerId, 4);
// 1 whole = P.ATOMIC_PER_COIN (100000000) atomic
```

### Node (sibling scripts)

```js
const { ledger, protocol, rpc } = require("./web/nairacoin");
// or: require("./scripts/nairacoin")
ledger.ensureFaucet("ada");
ledger.getBalance("ada"); // 100 * 10^8 after faucet
```

| Function | Unit | Notes |
| --- | --- | --- |
| `getBalance(playerId)` | atomic | Does **not** grant faucet |
| `credit(playerId, atomic)` | atomic | Fails if `atomic <= 0` or missing player |
| `debit(playerId, atomic)` | atomic | Fails if insufficient |
| `ATOMIC_PER_COIN` | `100000000` | 8 decimals |
| `ensureFaucet(playerId)` | — | Labels grant as **demo faucet** (100 whole). Legacy `lvfe.nairacoin.{player}` whole-coin grants (e.g. 250) migrate once and stay labelled faucet, not earned |
| `accountAddress(playerId)` | stub `f…` | Not a spend key |
| `NairaCoinRpc.getBalance/transfer/redeemIou` | — | Stub until `CHAIN_LAUNCHED` |

Storage key: `lvfe.nc.iou.v1.{player}`. No private keys. Place owners are **not** in this module (`lvfe.places.v1` / place-ledger).

## How game credits map 1:1 to atomic units

A stake of `N` whole NairaCoin IOU is `N * 10^8` atomic. When a daemon exists, redeem IOU **1:1**: debit the same atomic amount from the off-chain account and send that many atomic units on RPC 18357 to a real `f…` address from the **server** hot wallet.

Invariant for endowment (place-ledger, not this module): `place.value === sum(stakes.amount)` in **whole** coins. Owner yield is sliced from the incoming stake, never minted.

## Accounting (endowment, not a printer)

Visitor pays `A` whole coins from wallet (`debitWhole` / `debit(A * 10^8)`).

- No other owner: `A` endows the pin as the visitor’s stake.
- Other owner: `yield = min(A, max(1, round(A * 0.1)))` comes **from that stake**. 20% of yield → owner’s faction pool; rest → owner wallet via `credit`. Remainder `A - yield` is the visitor’s stake on the pin.

## Persistence

v0 is **this browser’s localStorage**. **Not a shared world.** `schema/nairacoin.sql` is the future server ledger (`nairacoin_accounts.atomic`, `nairacoin_transfers` credit/debit, `nairacoin_redeem_queue`) and is **not wired**. Place owners are not in sqlite.

## How to run a node **when** genesis exists

GitHub master and `~/nairacoin` still have `GENESIS_COINBASE_TX_HEX = ""`. Upstream `Currency.cpp` uses genesis timestamp `0` / nonce `70` until you print a real coinbase. Until that hex is filled **and** `nairacoind` listens on 17356, a public chain cannot sync.

1. On Ubuntu (cmake + Boost 1.55+, GCC): `cd ~/nairacoin && make -j"$(nproc)"` → `build/release/src/nairacoind`.
2. First boot with blank genesis: `./build/release/src/nairacoind --print-genesis-tx`. Paste the printed tx into `GENESIS_COINBASE_TX_HEX`. Recompile. Anyone else’s printed tx is a **different coin**.
3. Seed host is **`nairacoin.iconiaglobal.com`** (not the apex). Grey-cloud DNS A must be the box that can run the daemon. Current A `198.54.120.94` is Namecheap web hosting + Apache — **17356 is not listening**; that IP may be unable to run `nairacoind`. Keep `127.0.0.1:17356` for local-dev only.
4. Firewall TCP **17356** (P2P). Daemon RPC **18357** is for the daemon, not player transfers. Hot wallet: `simplewallet --rpc-bind-port` on the **game server**. Transfers are **not** mint RPC. GPS stake stays endowment; redeem is server `transfer` of the same atomic amount.
5. Frontend never sees spend keys. `NairaCoinRpc` stays stub until `CHAIN_LAUNCHED`. Mine ≥61 blocks into the server wallet before redeeming (unlock window).

Do not expose unauthenticated RPC to the internet. Orange-cloud (Cloudflare proxy) on the seed hostname blocks P2P — grey-cloud only.
