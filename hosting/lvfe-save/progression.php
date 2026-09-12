<?php
/**
 * Check-ins, XP, ratings, sponsorships. SQLite at data/lvfe-game.sqlite.
 * Rolling 24h check-in is enforced here (not only on the client).
 */
declare(strict_types=1);

function prog_db_path(): string
{
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }
    return $dir . '/lvfe-game.sqlite';
}

function prog_pdo(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $pdo = new PDO('sqlite:' . prog_db_path(), null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $schema = file_get_contents(dirname(__DIR__, 2) . '/schema/progression.sql');
    if ($schema === false) {
        $schema = file_get_contents(__DIR__ . '/schema.progression.sql');
    }
    if ($schema === false) {
        /* Bundled fallback so cPanel deploy without repo schema still boots. */
        $schema = <<<SQL
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
  owner_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_check_ins_player_place_at
  ON check_ins (player_id, location_id, checked_at DESC);
CREATE TABLE IF NOT EXISTS ratings (
  location_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  stars INTEGER NOT NULL,
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
CREATE TABLE IF NOT EXISTS hood_awards (
  player_id TEXT NOT NULL,
  territory_id TEXT NOT NULL,
  awarded_at TEXT NOT NULL,
  ncn_bonus INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, territory_id)
);
SQL;
    }
    $pdo->exec($schema);
    return $pdo;
}

function prog_now(): string
{
    return gmdate('c');
}

function prog_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $o = json_decode($raw, true);
    return is_array($o) ? $o : [];
}

function prog_player_key(array $body): ?string
{
    $fromHeader = $_SERVER['HTTP_X_LVFE_PLAYER_KEY'] ?? '';
    $raw = (string)($body['playerKey'] ?? $body['player_id'] ?? $fromHeader);
    return safe_key($raw);
}

function prog_auth(array $cfg, string $playerKey): void
{
    $auth = authorize($cfg, $playerKey);
    if (!($auth['ok'] ?? false)) {
        json_out((int)($auth['status'] ?? 401), [
            'ok' => false,
            'code' => $auth['code'] ?? 'unauthorized',
            'error' => $auth['error'] ?? 'unauthorized',
        ]);
    }
}

function prog_tier(int $visits, int $unique): string
{
    if ($unique >= 50) {
        return 't4';
    }
    if ($visits >= 11) {
        return 't3';
    }
    if ($visits >= 4) {
        return 't2';
    }
    return 't1';
}

function prog_refresh_player_window(PDO $db, string $playerId): array
{
    $since = gmdate('c', time() - 30 * 24 * 60 * 60);
    $st = $db->prepare('SELECT COUNT(*) AS n, MAX(checked_at) AS last_at FROM check_ins WHERE player_id = ? AND checked_at >= ?');
    $st->execute([$playerId, $since]);
    $row = $st->fetch() ?: ['n' => 0, 'last_at' => null];
    $n = (int)($row['n'] ?? 0);
    $last = $row['last_at'] ?? null;
    $up = $db->prepare('UPDATE players SET check_ins_30d = ?, last_checkin_at = COALESCE(?, last_checkin_at), updated_at = ? WHERE player_id = ?');
    $up->execute([$n, $last, prog_now(), $playerId]);
    return ['check_ins_30d' => $n, 'last_checkin_at' => $last];
}

function prog_handle_check_in(array $cfg): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_out(405, ['ok' => false, 'error' => 'POST only']);
    }
    $body = prog_body();
    $playerKey = prog_player_key($body);
    if ($playerKey === null) {
        json_out(400, ['ok' => false, 'error' => 'Missing player key']);
    }
    prog_auth($cfg, $playerKey);
    $locationId = safe_key((string)($body['locationId'] ?? $body['placeId'] ?? ''));
    if ($locationId === null) {
        json_out(400, ['ok' => false, 'error' => 'Missing locationId']);
    }
    $ownerId = safe_key((string)($body['ownerId'] ?? '')) ?? '';
    $playerName = substr(trim((string)($body['playerName'] ?? '')), 0, 80);
    $now = prog_now();
    $nowTs = time();
    $db = prog_pdo();
    $db->beginTransaction();
    try {
        $last = $db->prepare('SELECT checked_at FROM check_ins WHERE player_id = ? AND location_id = ? ORDER BY checked_at DESC LIMIT 1');
        $last->execute([$playerKey, $locationId]);
        $prev = $last->fetch();
        if ($prev) {
            $prevTs = strtotime((string)$prev['checked_at']) ?: 0;
            if ($prevTs && ($nowTs - $prevTs) < 86400) {
                $db->rollBack();
                json_out(429, [
                    'ok' => false,
                    'reason' => 'cooldown_24h',
                    'remainingMs' => (86400 - ($nowTs - $prevTs)) * 1000,
                ]);
            }
        }
        $locSt = $db->prepare('SELECT * FROM locations WHERE location_id = ?');
        $locSt->execute([$locationId]);
        $loc = $locSt->fetch();
        if (!$loc) {
            $db->prepare('INSERT INTO locations (location_id, visit_count, unique_visitors, tier_status, updated_at) VALUES (?, 0, 0, ?, ?)')
                ->execute([$locationId, 't1', $now]);
            $loc = ['visit_count' => 0, 'unique_visitors' => 0];
        }
        $uniqSt = $db->prepare('SELECT COUNT(*) FROM check_ins WHERE location_id = ? AND player_id = ?');
        $uniqSt->execute([$locationId, $playerKey]);
        $already = (int)$uniqSt->fetchColumn() > 0;
        $visits = (int)$loc['visit_count'] + 1;
        $unique = (int)$loc['unique_visitors'] + ($already ? 0 : 1);
        $tier = prog_tier($visits, $unique);
        $visitorXp = 10;
        $ownerXp = ($ownerId !== '' && $ownerId !== $playerKey) ? (int)round($visitorXp * 0.2) : 0;
        $db->prepare('INSERT INTO check_ins (location_id, player_id, checked_at, visitor_xp, owner_xp, owner_id) VALUES (?,?,?,?,?,?)')
            ->execute([$locationId, $playerKey, $now, $visitorXp, $ownerXp, $ownerId !== '' ? $ownerId : null]);
        $db->prepare('UPDATE locations SET visit_count = ?, unique_visitors = ?, tier_status = ?, updated_at = ? WHERE location_id = ?')
            ->execute([$visits, $unique, $tier, $now, $locationId]);
        $db->prepare(
            'INSERT INTO players (player_id, player_name, total_xp, check_ins_30d, places_claimed, last_checkin_at, updated_at)
             VALUES (?, ?, ?, 0, 0, ?, ?)
             ON CONFLICT(player_id) DO UPDATE SET
               player_name = CASE WHEN excluded.player_name != "" THEN excluded.player_name ELSE players.player_name END,
               total_xp = players.total_xp + excluded.total_xp,
               last_checkin_at = excluded.last_checkin_at,
               updated_at = excluded.updated_at'
        )->execute([$playerKey, $playerName, $visitorXp, $now, $now]);
        if ($ownerXp > 0) {
            $db->prepare(
                'INSERT INTO players (player_id, player_name, total_xp, check_ins_30d, places_claimed, last_checkin_at, updated_at)
                 VALUES (?, ?, ?, 0, 0, NULL, ?)
                 ON CONFLICT(player_id) DO UPDATE SET
                   total_xp = players.total_xp + excluded.total_xp,
                   updated_at = excluded.updated_at'
            )->execute([$ownerId, (string)($body['ownerName'] ?? ''), $ownerXp, $now]);
        }
        prog_refresh_player_window($db, $playerKey);
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        json_out(500, ['ok' => false, 'error' => 'check_in_failed']);
    }
    json_out(200, [
        'ok' => true,
        'visitorXp' => 10,
        'ownerXp' => $ownerXp ?? 0,
        'visitCount' => $visits ?? 0,
        'uniqueVisitors' => $unique ?? 0,
        'tier' => $tier ?? 't1',
        'checkedAt' => $now,
    ]);
}

function prog_handle_rating(array $cfg): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_out(405, ['ok' => false, 'error' => 'POST only']);
    }
    $body = prog_body();
    $playerKey = prog_player_key($body);
    if ($playerKey === null) {
        json_out(400, ['ok' => false, 'error' => 'Missing player key']);
    }
    prog_auth($cfg, $playerKey);
    $locationId = safe_key((string)($body['locationId'] ?? $body['placeId'] ?? ''));
    $stars = (int)($body['stars'] ?? 0);
    $text = substr(trim((string)($body['text'] ?? '')), 0, 400);
    if ($locationId === null || $stars < 1 || $stars > 5) {
        json_out(400, ['ok' => false, 'error' => 'stars 1–5 and locationId required']);
    }
    $db = prog_pdo();
    $seen = $db->prepare('SELECT 1 FROM check_ins WHERE player_id = ? AND location_id = ? LIMIT 1');
    $seen->execute([$playerKey, $locationId]);
    if (!$seen->fetch()) {
        json_out(403, ['ok' => false, 'reason' => 'check_in_required']);
    }
    $now = prog_now();
    $db->prepare(
        'INSERT INTO ratings (location_id, player_id, stars, text, created_at) VALUES (?,?,?,?,?)
         ON CONFLICT(location_id, player_id) DO UPDATE SET stars = excluded.stars, text = excluded.text, created_at = excluded.created_at'
    )->execute([$locationId, $playerKey, $stars, $text, $now]);
    $avgSt = $db->prepare('SELECT AVG(stars) AS avg, COUNT(*) AS n FROM ratings WHERE location_id = ?');
    $avgSt->execute([$locationId]);
    $avg = $avgSt->fetch() ?: ['avg' => null, 'n' => 0];
    $avgVal = $avg['avg'] !== null ? round((float)$avg['avg'], 1) : null;
    $db->prepare('UPDATE locations SET avg_rating = ?, rating_count = ?, updated_at = ? WHERE location_id = ?')
        ->execute([$avgVal, (int)$avg['n'], $now, $locationId]);
    json_out(200, ['ok' => true, 'stars' => $stars, 'avg' => $avgVal, 'count' => (int)$avg['n']]);
}

function prog_handle_location_get(): void
{
    $id = safe_key((string)($_GET['locationId'] ?? $_GET['id'] ?? ''));
    if ($id === null) {
        json_out(400, ['ok' => false, 'error' => 'Missing locationId']);
    }
    $db = prog_pdo();
    $st = $db->prepare('SELECT * FROM locations WHERE location_id = ?');
    $st->execute([$id]);
    $loc = $st->fetch();
    json_out(200, ['ok' => true, 'location' => $loc]);
}

function prog_handle_request(array $cfg, string $path): bool
{
    if ($path === 'v1/check-in') {
        prog_handle_check_in($cfg);
        return true;
    }
    if ($path === 'v1/ratings') {
        prog_handle_rating($cfg);
        return true;
    }
    if ($path === 'v1/locations' || preg_match('#^v1/locations/#', $path)) {
        prog_handle_location_get();
        return true;
    }
    return false;
}
