<?php
/**
 * Lvfe public save API (PHP) — same contract as server/index.js + Netlify function.
 * Routes (via .htaccess):
 *   GET  /health
 *   GET  /v1/save/:playerKey
 *   PUT  /v1/save/:playerKey
 *
 * Auth: Bearer lvfe-dev:<playerKey> (when LVFE_ALLOW_DEV_AUTH=1),
 *       Bearer <SAVE_SECRET>,
 *       Bearer google:<id_token> (when GOOGLE_WEB_CLIENT_ID set).
 * Conflict: last-write-wins by pack.updatedAt.
 * Zero billed Google Maps SKUs.
 */
declare(strict_types=1);

const PACK_KIND = 'lvfe.save.v1';
const MAX_PHOTOS = 8;
const PHOTO_META_ONLY_OVER = 400000;
const MAX_BODY = 2621440;

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Lvfe-Player-Key, X-Lvfe-Account-Key');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$cfg = load_config();
$path = isset($_GET['_path']) ? (string)$_GET['_path'] : '';
$path = trim($path, '/');

if ($path === 'health' || $path === '') {
    if ($path === '' && !isset($_GET['key'])) {
        // Prefer explicit /health; root also reports ok for probes.
    }
    if ($path === 'health' || $path === '') {
        if ($path === 'health' || ($path === '' && ($_GET['probe'] ?? '') === '1')) {
            json_out(200, [
                'ok' => true,
                'service' => 'lvfe-save',
                'host' => 'php',
                'devAuth' => ($cfg['LVFE_ALLOW_DEV_AUTH'] ?? '0') !== '0',
                'googleConfigured' => ($cfg['GOOGLE_WEB_CLIENT_ID'] ?? '') !== '',
            ]);
        }
    }
}

$key = isset($_GET['key']) ? safe_key((string)$_GET['key']) : null;
if ($key === null && preg_match('#(?:^|/)v1/save/([^/]+)$#', $path, $m)) {
    $key = safe_key($m[1]);
}
if ($key === null && preg_match('#^save/([^/]+)$#', $path, $m)) {
    $key = safe_key($m[1]);
}

if ($key === null) {
    if ($path === '' || $path === 'health') {
        json_out(200, [
            'ok' => true,
            'service' => 'lvfe-save',
            'host' => 'php',
            'devAuth' => ($cfg['LVFE_ALLOW_DEV_AUTH'] ?? '0') !== '0',
            'googleConfigured' => ($cfg['GOOGLE_WEB_CLIENT_ID'] ?? '') !== '',
        ]);
    }
    json_out(400, ['ok' => false, 'error' => 'Missing account key']);
}

$auth = authorize($cfg, $key);
if (!$auth['ok']) {
    json_out((int)($auth['status'] ?? 401), [
        'ok' => false,
        'code' => $auth['code'] ?? 'unauthorized',
        'error' => $auth['error'] ?? ($auth['code'] ?? 'unauthorized'),
    ]);
}

$method = $_SERVER['REQUEST_METHOD'];
$saveDir = __DIR__ . '/data/saves';
if (!is_dir($saveDir)) {
    mkdir($saveDir, 0750, true);
}

if ($method === 'GET') {
    $doc = read_doc($saveDir, $key);
    if ($doc === null) {
        json_out(404, ['ok' => false, 'code' => 'not_found', 'error' => 'No save']);
    }
    json_out(200, [
        'ok' => true,
        'accountKey' => $key,
        'updatedAt' => $doc['updatedAt'] ?? null,
        'pack' => $doc['pack'] ?? null,
    ]);
}

if ($method === 'PUT') {
    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) > MAX_BODY) {
        json_out(413, ['ok' => false, 'error' => 'Body too large']);
    }
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        json_out(400, ['ok' => false, 'error' => 'Invalid JSON']);
    }
    $pack = $body['pack'] ?? $body;
    if (!is_array($pack) || ($pack['kind'] ?? '') !== PACK_KIND) {
        json_out(400, ['ok' => false, 'error' => 'pack.kind must be lvfe.save.v1']);
    }
    $updatedAt = (string)($pack['updatedAt'] ?? gmdate('c'));
    $pack['updatedAt'] = $updatedAt;
    trim_photos($pack);

    $existing = read_doc($saveDir, $key);
    if ($existing !== null) {
        $exAt = (string)($existing['updatedAt'] ?? '');
        if ($exAt !== '' && $exAt > $updatedAt) {
            json_out(409, [
                'ok' => false,
                'code' => 'stale',
                'updatedAt' => $exAt,
                'pack' => $existing['pack'] ?? null,
            ]);
        }
    }

    $doc = [
        'accountKey' => $key,
        'updatedAt' => $updatedAt,
        'pack' => $pack,
        'savedAt' => gmdate('c'),
    ];
    write_doc($saveDir, $key, $doc);
    json_out(200, ['ok' => true, 'accountKey' => $key, 'updatedAt' => $updatedAt]);
}

json_out(405, ['ok' => false, 'error' => 'GET or PUT only']);

/* --- helpers --- */

function load_config(): array
{
    $defaults = [
        'SAVE_SECRET' => '',
        'LVFE_ALLOW_DEV_AUTH' => '1',
        'GOOGLE_WEB_CLIENT_ID' => '',
    ];
    $local = __DIR__ . '/config.local.php';
    if (is_file($local)) {
        $loaded = include $local;
        if (is_array($loaded)) {
            return array_merge($defaults, $loaded);
        }
    }
    // Env fallbacks (cPanel / Apache SetEnv)
    foreach (array_keys($defaults) as $k) {
        $v = getenv($k);
        if ($v !== false && $v !== '') {
            $defaults[$k] = $v;
        }
    }
    return $defaults;
}

function json_out(int $code, array $obj): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($obj, JSON_UNESCAPED_SLASHES);
    exit;
}

function safe_key(string $raw): ?string
{
    $s = substr(trim($raw), 0, 64);
    if ($s === '' || !preg_match('/^[a-zA-Z0-9._:-]+$/', $s)) {
        return null;
    }
    if (strpos($s, '..') !== false) {
        return null;
    }
    return $s;
}

function bearer_token(): string
{
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($h === '' && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        foreach ($headers as $k => $v) {
            if (strcasecmp($k, 'Authorization') === 0) {
                $h = $v;
                break;
            }
        }
    }
    if (preg_match('/^Bearer\s+(.+)$/i', $h, $m)) {
        return trim($m[1]);
    }
    return '';
}

function authorize(array $cfg, string $accountKey): array
{
    $token = bearer_token();
    $allowDev = ($cfg['LVFE_ALLOW_DEV_AUTH'] ?? '0') !== '0';
    $secret = trim((string)($cfg['SAVE_SECRET'] ?? ''));
    $googleAud = trim((string)($cfg['GOOGLE_WEB_CLIENT_ID'] ?? ''));

    if (strpos($token, 'lvfe-dev:') === 0) {
        if (!$allowDev) {
            return ['ok' => false, 'code' => 'dev_auth_disabled', 'status' => 401];
        }
        $pk = safe_key(substr($token, 9));
        if ($pk === null || ($accountKey !== '' && $pk !== $accountKey)) {
            return ['ok' => false, 'code' => 'key_mismatch', 'status' => 401];
        }
        return ['ok' => true];
    }
    if ($secret !== '' && hash_equals($secret, $token)) {
        return ['ok' => true];
    }
    if (strpos($token, 'google:') === 0) {
        if ($googleAud === '') {
            return [
                'ok' => false,
                'code' => 'oauth_not_configured',
                'status' => 503,
                'error' => 'GOOGLE_WEB_CLIENT_ID empty',
            ];
        }
        $idToken = substr($token, 7);
        $info = google_tokeninfo($idToken);
        if ($info === null) {
            return ['ok' => false, 'code' => 'invalid_google_token', 'status' => 401];
        }
        if (($info['aud'] ?? '') !== $googleAud) {
            return ['ok' => false, 'code' => 'aud_mismatch', 'status' => 401];
        }
        return ['ok' => true, 'sub' => $info['sub'] ?? null];
    }
    if ($googleAud === '' && $secret === '') {
        return [
            'ok' => false,
            'code' => 'oauth_not_configured',
            'status' => 503,
            'error' => 'Configure SAVE_SECRET or GOOGLE_WEB_CLIENT_ID',
        ];
    }
    return ['ok' => false, 'code' => 'unauthorized', 'status' => 401];
}

function google_tokeninfo(string $idToken): ?array
{
    $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($idToken);
    $ctx = stream_context_create([
        'http' => [
            'timeout' => 8,
            'ignore_errors' => true,
        ],
    ]);
    $raw = @file_get_contents($url, false, $ctx);
    if ($raw === false) {
        return null;
    }
    $info = json_decode($raw, true);
    return is_array($info) ? $info : null;
}

function trim_photos(array &$pack): void
{
    if (!isset($pack['photos']) || !is_array($pack['photos'])) {
        $pack['photos'] = [];
        return;
    }
    $kept = [];
    foreach ($pack['photos'] as $row) {
        if (count($kept) >= MAX_PHOTOS) {
            break;
        }
        if (!is_array($row) || empty($row['placeId'])) {
            continue;
        }
        $url = (string)($row['dataUrl'] ?? '');
        if (strlen($url) > PHOTO_META_ONLY_OVER) {
            $kept[] = [
                'playerKey' => $row['playerKey'] ?? null,
                'placeId' => $row['placeId'],
                'type' => $row['type'] ?? 'image/jpeg',
                'metaOnly' => true,
                'sizeHint' => strlen($url),
            ];
        } else {
            $kept[] = $row;
        }
    }
    $pack['photos'] = $kept;
}

function read_doc(string $dir, string $key): ?array
{
    $path = $dir . '/' . $key . '.json';
    if (!is_file($path)) {
        return null;
    }
    $raw = file_get_contents($path);
    if ($raw === false) {
        return null;
    }
    $doc = json_decode($raw, true);
    return is_array($doc) ? $doc : null;
}

function write_doc(string $dir, string $key, array $doc): void
{
    $path = $dir . '/' . $key . '.json';
    $tmp = $path . '.tmp';
    $json = json_encode($doc, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false) {
        json_out(500, ['ok' => false, 'error' => 'Encode failed']);
    }
    if (file_put_contents($tmp, $json) === false) {
        json_out(500, ['ok' => false, 'error' => 'Write failed']);
    }
    if (!rename($tmp, $path)) {
        @unlink($tmp);
        json_out(500, ['ok' => false, 'error' => 'Rename failed']);
    }
}
