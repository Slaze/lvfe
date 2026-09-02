-- Lvfe places catalog v0.2
-- SQLite now; types stay Postgres-friendly.
-- Geometry lives in geojson/enugu-factions.geojson (ODbL).
-- This schema is the player-facing catalog. OSM stays a pointer.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Territories (faction / prize / unclaimed polygons)
-- ---------------------------------------------------------------------------

CREATE TABLE territories (
  id                TEXT PRIMARY KEY,          -- independence_layout
  name              TEXT NOT NULL,
  code              TEXT NOT NULL UNIQUE,    -- IND
  role              TEXT NOT NULL CHECK (role IN (
                      'playable_faction',
                      'prize_zone',
                      'unclaimed'
                    )),
  parent_id         TEXT REFERENCES territories(id),
  osm_way_id        INTEGER,
  color             TEXT NOT NULL,
  war_allowed       INTEGER NOT NULL DEFAULT 1 CHECK (war_allowed IN (0, 1)),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_territories_role ON territories(role);
CREATE INDEX idx_territories_parent ON territories(parent_id);

-- ---------------------------------------------------------------------------
-- Catalog types (normalized OSM → one type players see)
-- ---------------------------------------------------------------------------

CREATE TABLE catalog_types (
  id                TEXT PRIMARY KEY,         -- market, shop, food, ...
  label             TEXT NOT NULL,
  primary_profile    TEXT NOT NULL CHECK (primary_profile IN (
                      'explorer', 'collector', 'merchant', 'warrior',
                      'diplomat', 'historian', 'streaker', 'hybrid'
                    )),
  war_multiplier    INTEGER NOT NULL DEFAULT 1 CHECK (war_multiplier IN (0, 1)),
  daily_cap_per_player INTEGER,                 -- NULL = no cap; ATM = 1
  notes             TEXT
);

-- ---------------------------------------------------------------------------
-- Places (canonical row the map shows)
-- ---------------------------------------------------------------------------

CREATE TABLE places (
  id                TEXT PRIMARY KEY,          -- ulid / uuid
  display_name      TEXT,                      -- NULL => player sees "Unnamed {type}"
  catalog_type      TEXT NOT NULL REFERENCES catalog_types(id),
  quality           TEXT NOT NULL CHECK (quality IN ('A', 'B', 'C', 'D')),
  -- A named+typed+photo  B named, weak type  C unnamed  D unidentified civic
  locked            INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0, 1)),
  locked_by         TEXT,                       -- player id or 'architect'
  locked_at         TEXT,
  territory_id      TEXT REFERENCES territories(id),  -- smallest containing poly; overridable if locked
  territory_locked  INTEGER NOT NULL DEFAULT 0 CHECK (territory_locked IN (0, 1)),
  lat               REAL NOT NULL,
  lon               REAL NOT NULL,
  osm_type          TEXT CHECK (osm_type IN ('node', 'way', 'relation')),
  osm_id            INTEGER,                    -- primary OSM object; cluster extras in place_osm_links
  source            TEXT NOT NULL DEFAULT 'osm' CHECK (source IN (
                      'osm', 'player', 'architect'
                    )),
  has_name          INTEGER NOT NULL DEFAULT 0 CHECK (has_name IN (0, 1)),
  has_type          INTEGER NOT NULL DEFAULT 0 CHECK (has_type IN (0, 1)),
  has_photo         INTEGER NOT NULL DEFAULT 0 CHECK (has_photo IN (0, 1)),
  opening_hours     TEXT,                      -- raw OSM; empty = treat as always open
  historian_note    TEXT,
  cluster_radius_m  INTEGER NOT NULL DEFAULT 80,
  claim_points       INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (osm_type, osm_id)
);

CREATE INDEX idx_places_territory ON places(territory_id);
CREATE INDEX idx_places_type_quality ON places(catalog_type, quality);
CREATE INDEX idx_places_locked ON places(locked);
CREATE INDEX idx_places_geo ON places(lat, lon);

-- Extra OSM members fused into this catalog row (duplicate names within 80 m).
CREATE TABLE place_osm_links (
  place_id          TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  osm_type          TEXT NOT NULL CHECK (osm_type IN ('node', 'way', 'relation')),
  osm_id            INTEGER NOT NULL,
  osm_name          TEXT,
  osm_tags_json     TEXT,                      -- original tags, JSON object
  is_primary        INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  PRIMARY KEY (osm_type, osm_id)
);

CREATE INDEX idx_place_osm_links_place ON place_osm_links(place_id);

CREATE TABLE place_photos (
  id                TEXT PRIMARY KEY,
  place_id          TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  player_id         TEXT,
  path              TEXT NOT NULL,            -- local / object storage path
  taken_at          TEXT,
  lat               REAL,
  lon               REAL,
  qualifies_for_a   INTEGER NOT NULL DEFAULT 0 CHECK (qualifies_for_a IN (0, 1)),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_place_photos_place ON place_photos(place_id);

-- Collector / Historian edits. NairaCoin attaches to this row, not to OSM.
-- locked_by may be the username architect (internal; not player lore).
CREATE TABLE place_edits (
  id                TEXT PRIMARY KEY,
  place_id          TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  player_id         TEXT,
  field             TEXT NOT NULL CHECK (field IN (
                      'display_name', 'catalog_type', 'territory_id',
                      'opening_hours', 'historian_note', 'lock', 'photo', 'quality'
                    )),
  old_value         TEXT,
  new_value         TEXT,
  status            TEXT NOT NULL DEFAULT 'applied' CHECK (status IN (
                      'applied', 'pending', 'rejected'
                    )),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_place_edits_place ON place_edits(place_id, created_at);

-- ---------------------------------------------------------------------------
-- Quality is derived. Recompute after name/type/photo/lock changes.
-- A: has_name + has_type + has_photo
-- B: has_name, missing photo or weak type
-- C: no name
-- D: catalog_type = civic_unknown (office=yes / public_building)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Seed catalog types (Enugu OSM census)
-- ---------------------------------------------------------------------------

INSERT INTO catalog_types (id, label, primary_profile, war_multiplier, daily_cap_per_player, notes) VALUES
  ('market',         'Market',              'merchant',  1, NULL, 'amenity=marketplace; cluster by name+80m'),
  ('shop',           'Shop',                'merchant',  1, NULL, 'shop=* except malls treated as shop'),
  ('mall',           'Mall',                'merchant',  1, NULL, 'shop=mall'),
  ('food',           'Food',                'merchant',  1, NULL, 'restaurant/bar/cafe/fast_food/food_court'),
  ('bank',           'Bank',                'merchant',  1, 1,    'amenity=bank; not ownable, not farmable'),
  ('atm',            'ATM',                 'merchant',  0, 1,    'amenity=atm; not ownable, not farmable'),
  ('pharmacy',       'Pharmacy',             'merchant',  1, NULL, 'amenity=pharmacy / healthcare=pharmacy'),
  ('fuel',           'Fuel station',        'explorer',  0, NULL, 'waypoint, not a raid target'),
  ('transit',        'Transit',              'explorer',  0, NULL, 'bus_stop / bus_station / taxi'),
  ('park',           'Park',                'diplomat', 0, NULL, 'park/garden; no war bonus'),
  ('pitch',          'Pitch',               'warrior',  1, NULL, 'pitch/sports_centre/stadium'),
  ('worship',        'Worship',             'diplomat', 0, NULL, 'place_of_worship; facade photo only'),
  ('school',         'School',              'diplomat', 0, NULL, 'school/college/university/kindergarten; gate only'),
  ('hospital',       'Hospital',            'diplomat', 0, NULL, 'hospital/clinic/doctors; no raid multiplier'),
  ('civic',          'Civic',               'historian',0, NULL, 'named government/police/post/library'),
  ('civic_unknown',  'Unidentified building', 'historian',0, NULL, 'public_building / office=yes → quality D'),
  ('hotel',          'Hotel',               'diplomat', 0, NULL, 'hotel/guest_house/hostel'),
  ('landmark',       'Landmark',            'historian',0, NULL, 'museum/artwork/attraction'),
  ('ruin',           'Ruin',                'historian',0, NULL, 'vacant/disused/abandoned/closed'),
  ('unmapped',       'Unmapped',             'collector',0, NULL, 'GPS with no OSM object within 30m');

-- ---------------------------------------------------------------------------
-- Seed territories (ids must match geojson feature ids)
-- ---------------------------------------------------------------------------

INSERT INTO territories (id, name, code, role, parent_id, osm_way_id, color, war_allowed) VALUES
  ('independence_layout',    'Independence Layout', 'IND', 'playable_faction', NULL,          273509964, '#2ecc71', 1),
  ('coal_camp',               'Coal Camp',            'COAL','playable_faction', NULL,          273509948, '#e67e22', 1),
  ('ogbete',                  'Ogbete',               'OGB', 'prize_zone',       NULL,          273509971, '#f1c40f', 1),
  ('abakpa',                  'Abakpa',               'ABK', 'playable_faction', NULL,          273509909, '#9b59b6', 1),
  ('emene',                   'Emene',                'EMN', 'playable_faction', NULL,          273509958, '#3498db', 1),
  ('new_haven',               'New Haven',            'NHV', 'unclaimed',        NULL,          273509966, '#1abc9c', 1),
  ('new_haven_extension',      'New Haven Extension',   'NHX', 'unclaimed',        'new_haven',   273509967, '#16a085', 1),
  ('trans_ekulu',             'Trans-Ekulu',         'TEK', 'unclaimed',        NULL,          273510006, '#e74c3c', 1),
  ('trans_ekulu_extension',    'Trans-Ekulu Extension', 'TEX', 'unclaimed',        'trans_ekulu', 259885129, '#c0392b', 1),
  ('uwani',                   'Uwani',                'UWA', 'unclaimed',        NULL,          273510010, '#34495e', 1),
  ('ogui',                    'Ogui',                 'OGI', 'unclaimed',        NULL,          273509976, '#e91e63', 1),
  ('thinkers_corner',          'Thinkers Corner',      'THK', 'unclaimed',        NULL,          273509994, '#00bcd4', 1),
  ('unclaimed',               'Unclaimed area',      'UNC', 'unclaimed',        NULL,          NULL,       '#7f8c8d', 1);
