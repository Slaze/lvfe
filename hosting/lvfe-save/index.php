<?php
/**
 * Lvfe public save API (PHP) — same contract as server/index.js + Netlify function.
 * Routes (via .htaccess):
 *   GET  /health
 *   GET  /v1/save/:playerKey
 *   PUT  /v1/save/:playerKey
 *   POST /v1/buy/init|verify|webhook  (Paystack primary; 1 NCN = USD $1)
 *   POST /v1/buy/flw-webhook          (Flutterwave alternate)
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
header('Access-Control-Allow-Methods: GET, PUT, POST, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Lvfe-Player-Key, X-Lvfe-Account-Key, X-Paystack-Signature, verif-hash');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/buy.php';
require_once __DIR__ . '/opay.php';
require_once __DIR__ . '/p2p.php';

$cfg = load_config();
$path = isset($_GET['_path']) ? (string)$_GET['_path'] : '';
$path = trim($path, '/');
$saveDir = __DIR__ . '/data/saves';
if (!is_dir($saveDir)) {
    mkdir($saveDir, 0750, true);
}

if ($path === 'health' || $path === '') {
    if ($path === '' && !isset($_GET['key'])) {
        // Prefer explicit /health; root also reports ok for probes.
    }
    if ($path === 'health' || $path === '') {
        if ($path === 'health' || ($path === '' && ($_GET['probe'] ?? '') === '1')) {
            $buy = buy_keys_status($cfg);
            $opay = opay_keys_status($cfg);
            json_out(200, [
                'ok' => true,
                'service' => 'lvfe-save',
                'host' => 'php',
                'devAuth' => ($cfg['LVFE_ALLOW_DEV_AUTH'] ?? '0') !== '0',
                'googleConfigured' => ($cfg['GOOGLE_WEB_CLIENT_ID'] ?? '') !== '',
                'buyNcn' => [
                    'provider' => $buy['provider'],
                    'configured' => $buy['configured'],
                    'sandbox' => $buy['sandbox'],
                    'ncnPerUsd' => 1,
                    'paystack' => $buy['paystack'],
                    'flutterwave' => $buy['flutterwave'],
                ],
                'opayNcn' => [
                    'provider' => 'opay',
                    'configured' => $opay['configured'],
                    'sandbox' => $opay['sandbox'],
                    'ncnPerUsd' => 1,
                    'note' => 'deprioritized — use Paystack/Flutterwave',
                ],
            ]);
        }
    }
}

/* Buy NCN (Paystack primary / Flutterwave alternate) — before save-key gate */
if ($path === 'v1/buy/init' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    buy_handle_init($cfg, $saveDir);
}
if ($path === 'v1/buy/verify' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    buy_handle_verify($cfg, $saveDir);
}
if ($path === 'v1/buy/webhook' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    buy_handle_webhook($cfg, $saveDir);
}
if ($path === 'v1/buy/flw-webhook' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    buy_handle_flw_webhook($cfg, $saveDir);
}

/* OPay Buy NCN */
if ($path === 'v1/opay/init' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    opay_handle_init($cfg, $saveDir);
}
if ($path === 'v1/opay/verify' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    opay_handle_verify($cfg, $saveDir);
}
if ($path === 'v1/opay/webhook' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    opay_handle_webhook($cfg, $saveDir);
}

/* P2P NCN */
if ($path === 'v1/p2p/transfer' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    p2p_handle_transfer($cfg, $saveDir);
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
        $buy = buy_keys_status($cfg);
        $opay = opay_keys_status($cfg);
        json_out(200, [
            'ok' => true,
            'service' => 'lvfe-save',
            'host' => 'php',
            'devAuth' => ($cfg['LVFE_ALLOW_DEV_AUTH'] ?? '0') !== '0',
            'googleConfigured' => ($cfg['GOOGLE_WEB_CLIENT_ID'] ?? '') !== '',
            'buyNcn' => [
                'provider' => $buy['provider'],
                'configured' => $buy['configured'],
                'sandbox' => $buy['sandbox'],
                'ncnPerUsd' => 1,
                'paystack' => $buy['paystack'],
                'flutterwave' => $buy['flutterwave'],
            ],
            'opayNcn' => [
                'provider' => 'opay',
                'configured' => $opay['configured'],
                'sandbox' => $opay['sandbox'],
                'ncnPerUsd' => 1,
                'note' => 'deprioritized — use Paystack/Flutterwave',
            ],
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

    $lock = enforce_username_lock($pack, $key, $auth, $saveDir);
    if (!($lock['ok'] ?? false)) {
        json_out((int)($lock['status'] ?? 409), [
            'ok' => false,
            'code' => $lock['code'] ?? 'username_locked',
            'error' => $lock['error'] ?? 'Username lock rejected',
            'lockedName' => $lock['lockedName'] ?? null,
        ]);
    }

    $doc = [
        'accountKey' => $key,
        'updatedAt' => $updatedAt,
        'pack' => $pack,
        'savedAt' => gmdate('c'),
    ];
    write_doc($saveDir, $key, $doc);
    json_out(200, [
        'ok' => true,
        'accountKey' => $key,
        'updatedAt' => $updatedAt,
        'usernameLocked' => !empty($lock['locked']),
    ]);
}

json_out(405, ['ok' => false, 'error' => 'GET, PUT, or POST /v1/buy/*']);

/* --- helpers --- */

function load_config(): array
{
    $defaults = [
        'SAVE_SECRET' => '',
        'LVFE_ALLOW_DEV_AUTH' => '1',
        'GOOGLE_WEB_CLIENT_ID' => '',
        'PAYSTACK_PUBLIC_KEY' => '',
        'PAYSTACK_SECRET_KEY' => '',
        'PAYSTACK_WEBHOOK_SECRET' => '',
        'PAYSTACK_CURRENCY' => 'NGN',
        'NGN_PER_USD' => '1500',
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
        $sub = trim((string)($info['sub'] ?? ''));
        if ($sub === '') {
            return ['ok' => false, 'code' => 'no_sub', 'status' => 401, 'error' => 'id_token missing sub'];
        }
        /* Same canonical key as web/js/account.js playerKeyFromSub */
        $pk = substr('g' . preg_replace('/[^a-zA-Z0-9]/', '', $sub), 0, 32);
        if ($accountKey !== '' && $accountKey !== $pk && $accountKey !== $sub) {
            return [
                'ok' => false,
                'code' => 'key_mismatch',
                'status' => 401,
                'error' => 'Google sub does not match account key. Use playerKey g{sub}.',
            ];
        }
        return ['ok' => true, 'sub' => $sub, 'email' => $info['email'] ?? null];
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

/** Permanent username ↔ Google sub map (same rules as server/username-lock.js). */
function username_map_path(string $saveDir): string
{
    return dirname($saveDir) . '/username-map.json';
}

function load_username_map(string $saveDir): array
{
    $path = username_map_path($saveDir);
    if (!is_file($path)) {
        return ['byName' => [], 'bySub' => []];
    }
    $raw = file_get_contents($path);
    $o = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($o)) {
        return ['byName' => [], 'bySub' => []];
    }
    return [
        'byName' => is_array($o['byName'] ?? null) ? $o['byName'] : [],
        'bySub' => is_array($o['bySub'] ?? null) ? $o['bySub'] : [],
    ];
}

function save_username_map(string $saveDir, array $map): void
{
    $path = username_map_path($saveDir);
    $tmp = $path . '.tmp';
    $json = json_encode($map, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false) {
        return;
    }
    file_put_contents($tmp, $json);
    rename($tmp, $path);
}

function extract_username_claim(array $pack, string $accountKey): ?array
{
    $ident = is_array($pack['identity'] ?? null) ? $pack['identity'] : [];
    $want = 'lvfe.identity.' . $accountKey;
    $row = is_array($ident[$want] ?? null) ? $ident[$want] : null;
    $packSub = trim((string)($pack['googleSub'] ?? ''));
    if ($row === null && $packSub !== '') {
        foreach ($ident as $r) {
            if (!is_array($r)) {
                continue;
            }
            if (trim((string)($r['googleSub'] ?? '')) === $packSub && !empty($r['playerName'])) {
                $row = $r;
                break;
            }
        }
    }
    if ($row === null || empty($row['playerName'])) {
        return null;
    }
    $name = substr(trim((string)$row['playerName']), 0, 32);
    if ($name === '') {
        return null;
    }
    $googleSub = trim((string)($row['googleSub'] ?? $pack['googleSub'] ?? ''));
    return [
        'name' => $name,
        'nameKey' => strtolower($name),
        'googleSub' => $googleSub,
        'playerKey' => substr($accountKey, 0, 32),
    ];
}

function enforce_username_lock(array $pack, string $accountKey, array $auth, string $saveDir): array
{
    $claim = extract_username_claim($pack, $accountKey);
    $authSub = trim((string)($auth['sub'] ?? ''));
    $googleSub = $authSub !== '' ? $authSub : (string)($claim['googleSub'] ?? '');
    if ($googleSub === '') {
        return ['ok' => true, 'skipped' => true, 'reason' => 'no_google_sub'];
    }
    if ($claim === null || ($claim['name'] ?? '') === '') {
        return ['ok' => true, 'skipped' => true, 'reason' => 'no_username_yet'];
    }
    $map = load_username_map($saveDir);
    $bySub = $map['bySub'][$googleSub] ?? null;
    $byName = $map['byName'][$claim['nameKey']] ?? null;
    if (is_array($bySub) && !empty($bySub['nameKey']) && $bySub['nameKey'] !== $claim['nameKey']) {
        return [
            'ok' => false,
            'status' => 409,
            'code' => 'username_locked',
            'error' => 'Username is permanent for this Google account and cannot be changed.',
            'lockedName' => $bySub['name'] ?? $bySub['nameKey'],
        ];
    }
    if (is_array($byName) && !empty($byName['googleSub']) && $byName['googleSub'] !== $googleSub) {
        return [
            'ok' => false,
            'status' => 409,
            'code' => 'username_taken',
            'error' => 'That username is permanently bound to another Google account.',
        ];
    }
    $now = gmdate('c');
    $map['byName'][$claim['nameKey']] = [
        'googleSub' => $googleSub,
        'playerKey' => $claim['playerKey'],
        'name' => $claim['name'],
        'lockedAt' => is_array($byName) && !empty($byName['lockedAt']) ? $byName['lockedAt'] : $now,
    ];
    $map['bySub'][$googleSub] = [
        'nameKey' => $claim['nameKey'],
        'name' => $claim['name'],
        'playerKey' => $claim['playerKey'],
        'lockedAt' => is_array($bySub) && !empty($bySub['lockedAt']) ? $bySub['lockedAt'] : $now,
    ];
    save_username_map($saveDir, $map);
    return ['ok' => true, 'locked' => true, 'name' => $claim['name'], 'googleSub' => $googleSub];
}
