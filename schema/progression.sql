-- Lvfe progression (check-ins, XP, ratings, sponsorships).
-- Server of record: hosting/lvfe-save/data/lvfe-game.sqlite
-- 24h check-in is rolling (application), not calendar-day unique.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS players (
  player_id TEXT PRIMARY KEY,
  player_name TEXT NOT NULL DEFAULT '',
  total_xp INTEGER NOT NULL DEFAULT 0,
  check_ins_30d INTEGER NOT NULL DEFAULT 0,
  places_claimed INTEGER NOT NULL DEFAULT 0,
  last_checkin_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
  location_id TEXT PRIMARY KEY,
  visit_count INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  avg_rating REAL,
  rating_count INTEGER NOT NULL DEFAULT 0,
  tier_status TEXT NOT NULL DEFAULT 't1',
  sponsored_until TEXT,
  insight TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS check_ins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  visitor_xp INTEGER NOT NULL DEFAULT 0,
  owner_xp INTEGER NOT NULL DEFAULT 0,
  owner_id TEXT,
  UNIQUE (location_id, player_id, checked_at)
);

CREATE INDEX IF NOT EXISTS idx_check_ins_player_place_at
  ON check_ins (player_id, location_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_ins_at ON check_ins (checked_at);
CREATE INDEX IF NOT EXISTS idx_check_ins_place ON check_ins (location_id);

CREATE TABLE IF NOT EXISTS ratings (
  location_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  PRIMARY KEY (location_id, player_id)
);

CREATE TABLE IF NOT EXISTS sponsorships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  platform_share INTEGER NOT NULL DEFAULT 0,
  curator_share INTEGER NOT NULL DEFAULT 0,
  curator_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sponsorships_loc_end
  ON sponsorships (location_id, end_date);

CREATE TABLE IF NOT EXISTS bookmarks (
  player_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (player_id, location_id)
);

CREATE TABLE IF NOT EXISTS tips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS photo_challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  host_id TEXT NOT NULL,
  title TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  deadline TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hood_awards (
  player_id TEXT NOT NULL,
  territory_id TEXT NOT NULL,
  awarded_at TEXT NOT NULL,
  ncn_bonus INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, territory_id)
);
