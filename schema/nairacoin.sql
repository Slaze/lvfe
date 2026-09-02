-- NairaCoin off-chain credit/debit (not live, not a shared world).
-- Units match Slaze/nairacoin: CRYPTONOTE_DISPLAY_DECIMAL_POINT = 8,
-- so 1 coin = 100000000 atomic. Player v0 is localStorage IOU
-- (web/nairacoin/). This sqlite is the future game-server / hot-wallet path.
-- It is NOT wired. Place owners stay in localStorage lvfe.places.v1 —
-- do not invent sqlite owners for places.
-- Spend keys never belong here. Genesis on GitHub master is empty.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS nairacoin_accounts (
  player_id      TEXT PRIMARY KEY,
  atomic         INTEGER NOT NULL DEFAULT 0,  -- CryptoNote atomic units
  faucet_granted INTEGER NOT NULL DEFAULT 0, -- one-time demo faucet (not earned)
  iou_address    TEXT NOT NULL DEFAULT '',   -- stub f+checksum, not a spend address
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Transfers only. No extractive credit from visiting a pin.
-- credit/debit = generic atomic moves; stake/yield/faction = game; redeem_out = future chain.
CREATE TABLE IF NOT EXISTS nairacoin_transfers (
  id          TEXT PRIMARY KEY,
  player_id   TEXT NOT NULL REFERENCES nairacoin_accounts(player_id),
  kind        TEXT NOT NULL CHECK (kind IN (
    'faucet', 'credit', 'debit', 'stake_out', 'yield_in', 'faction_in', 'redeem_out'
  )),
  atomic      INTEGER NOT NULL,
  place_id    TEXT,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_nairacoin_transfers_player ON nairacoin_transfers(player_id, created_at);

-- Future hot-wallet redeem queue. Dest is a player-supplied CryptoNote f-address.
-- Status stays pending until a daemon exists. No keys in this table.
CREATE TABLE IF NOT EXISTS nairacoin_redeem_queue (
  id           TEXT PRIMARY KEY,
  player_id    TEXT NOT NULL REFERENCES nairacoin_accounts(player_id),
  atomic       INTEGER NOT NULL,
  dest_address TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  rpc_txid     TEXT,
  note         TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
