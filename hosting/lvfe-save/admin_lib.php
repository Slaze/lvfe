<?php
/**
 * Lvfe admin CMS helpers — session auth, host config R/W, game-config R/W, ops credit.
 * Secrets never go to the public /v1/game-config endpoint.
 */
declare(strict_types=1);

const LVFE_ADMIN_SESSION = 'lvfe_admin_v1';
const LVFE_GAME_CONFIG_VERSION = 1;

function admin_game_config_path(): string
{
    return __DIR__ . '/data/game-config.json';
}

function admin_default_game_config(): array
{
    return [
        'v' => LVFE_GAME_CONFIG_VERSION,
        'updatedAt' => '',
        'economy' => [
            'claimRadiusM' => 80,
            'yieldRate' => 0,
            'factionCut' => 0,
            'minStakeFloor' => 5,
            'faucetWhole' => 100,
            'maxNeighbourhoodBonus' => 0,
            'baseVisitXp' => 10,
            'ownerReferralXp' => 0.2,
            'hoodPinGoal' => 20,
            'hoodNcnBonus' => 5,
            'unknownValueFloor' => 100,
            'tollFloorNcn' => 2,
            'tollStakePct' => 0.05,
            'tollEscapePct' => 0.4,
            'tollCooldownMin' => 60,
            'walkKmh' => 5,
            'nearbyNotifyRadiusM' => 400,
            'approachRadiusM' => 120,
            'arPinRangeM' => 120,
            'ncnPerUsd' => 1,
            'ngnPerUsd' => 1500,
            'buyMinNcn' => 1,
            'buyMaxNcn' => 500,
            'buyPresets' => [5, 10, 25, 50],
            'defaultBuyProvider' => 'paystack',
            'ownedPinPoints' => 10,
        ],
        'client' => [
            'saveApiBase' => 'https://iconiaglobal.com/lvfe-save',
            'googleWebClientId' => '',
            'paystackPublicKey' => '',
            'flwPublicKey' => '',
            'buyApiBase' => '',
            'satDefaultOn' => true,
            'mapStyleUrl' => 'https://tiles.openfreemap.org/styles/dark',
        ],
        'copy' => [
            'buyBlockerTitle' => "Buy NCN isn’t available yet — try again later.",
            'oauthBlockerTitle' => "Sign in with Google isn’t available yet — try again later.",
        ],
        'features' => [
            'buyNcn' => true,
            'flutterwave' => true,
            'opay' => false,
            'p2p' => true,
            'travelMode' => true,
            'passToll' => false,
            'visitXp' => true,
            'ratings' => true,
            'hoodChallenges' => true,
            'sponsorships' => true,
            'worldOverpass' => true,
        ],
    ];
}

function admin_load_game_config(): array
{
    $defaults = admin_default_game_config();
    $path = admin_game_config_path();
    if (!is_file($path)) {
        return $defaults;
    }
    $raw = file_get_contents($path);
    $o = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($o)) {
        return $defaults;
    }
    return admin_deep_merge($defaults, $o);
}

function admin_deep_merge(array $base, array $over): array
{
    foreach ($over as $k => $v) {
        if (is_array($v) && isset($base[$k]) && is_array($base[$k]) && admin_is_assoc($base[$k])) {
            $base[$k] = admin_deep_merge($base[$k], $v);
        } else {
            $base[$k] = $v;
        }
    }
    return $base;
}

function admin_is_assoc(array $a): bool
{
    if ($a === []) {
        return true;
    }
    return array_keys($a) !== range(0, count($a) - 1);
}

function admin_save_game_config(array $cfg): array
{
    $merged = admin_deep_merge(admin_default_game_config(), $cfg);
    $merged['v'] = LVFE_GAME_CONFIG_VERSION;
    $merged['updatedAt'] = gmdate('c');
    $dir = dirname(admin_game_config_path());
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }
    $path = admin_game_config_path();
    $tmp = $path . '.tmp';
    $json = json_encode($merged, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false || file_put_contents($tmp, $json) === false || !rename($tmp, $path)) {
        return ['ok' => false, 'error' => 'Failed to write game-config.json'];
    }
    return ['ok' => true, 'config' => $merged];
}

/** Public subset for PWA/APK (no secrets). */
function admin_public_game_config(array $hostCfg): array
{
    $g = admin_load_game_config();
    // Prefer live host public keys so admin Host tab drives Buy without redeploying JS.
    $g['client']['googleWebClientId'] = trim((string)($hostCfg['GOOGLE_WEB_CLIENT_ID'] ?? $g['client']['googleWebClientId'] ?? ''));
    $g['client']['paystackPublicKey'] = trim((string)($hostCfg['PAYSTACK_PUBLIC_KEY'] ?? $g['client']['paystackPublicKey'] ?? ''));
    $g['client']['flwPublicKey'] = trim((string)($hostCfg['FLW_PUBLIC_KEY'] ?? $g['client']['flwPublicKey'] ?? ''));
    $g['economy']['ngnPerUsd'] = (float)($hostCfg['NGN_PER_USD'] ?? $g['economy']['ngnPerUsd'] ?? 1500);
    return $g;
}

function admin_secret_keys(): array
{
    return [
        'SAVE_SECRET',
        'PAYSTACK_SECRET_KEY',
        'PAYSTACK_WEBHOOK_SECRET',
        'FLW_SECRET_KEY',
        'FLW_SECRET_HASH',
        'OPAY_SECRET_KEY',
        'ADMIN_PASSWORD_HASH',
    ];
}

function admin_host_editable_keys(): array
{
    return [
        'SAVE_SECRET',
        'LVFE_ALLOW_DEV_AUTH',
        'GOOGLE_WEB_CLIENT_ID',
        'PAYSTACK_PUBLIC_KEY',
        'PAYSTACK_SECRET_KEY',
        'PAYSTACK_WEBHOOK_SECRET',
        'PAYSTACK_CURRENCY',
        'NGN_PER_USD',
        'FLW_PUBLIC_KEY',
        'FLW_SECRET_KEY',
        'FLW_SECRET_HASH',
        'FLW_CURRENCY',
        'BUY_MERCHANT_EMAIL',
        'OPAY_MERCHANT_ID',
        'OPAY_PUBLIC_KEY',
        'OPAY_SECRET_KEY',
        'OPAY_SANDBOX',
        'OPAY_CURRENCY',
        'OPAY_PAYOUT_ACCOUNT',
        'OPAY_PAYOUT_NAME',
        'OPAY_MERCHANT_EMAIL',
        'ADMIN_EMAIL',
        'ADMIN_PASSWORD', // write-only: hashed into ADMIN_PASSWORD_HASH
    ];
}

function admin_mask_secret(string $v): array
{
    $v = trim($v);
    if ($v === '') {
        return ['set' => false, 'hint' => ''];
    }
    $len = strlen($v);
    $hint = $len <= 4 ? '••••' : ('••••' . substr($v, -4));
    return ['set' => true, 'hint' => $hint, 'length' => $len];
}

function admin_host_config_for_ui(array $cfg): array
{
    $secrets = array_flip(admin_secret_keys());
    $out = [];
    foreach (admin_host_editable_keys() as $k) {
        if ($k === 'ADMIN_PASSWORD') {
            continue;
        }
        $raw = (string)($cfg[$k] ?? '');
        if (isset($secrets[$k])) {
            $out[$k] = admin_mask_secret($raw);
        } else {
            $out[$k] = $raw;
        }
    }
    $out['ADMIN_EMAIL'] = (string)($cfg['ADMIN_EMAIL'] ?? '');
    $out['hasAdminPassword'] = trim((string)($cfg['ADMIN_PASSWORD_HASH'] ?? '')) !== '';
    return $out;
}

function admin_local_config_path(): string
{
    return __DIR__ . '/config.local.php';
}

function admin_read_local_file(): array
{
    $path = admin_local_config_path();
    if (!is_file($path)) {
        return [];
    }
    $loaded = include $path;
    return is_array($loaded) ? $loaded : [];
}

function admin_write_local_config(array $local): array
{
    // Never persist plaintext password field
    unset($local['ADMIN_PASSWORD']);
    $path = admin_local_config_path();
    $export = var_export($local, true);
    $php = "<?php\n/** Host-only — never commit. Updated via Lvfe admin CMS " . gmdate('c') . " */\nreturn " . $export . ";\n";
    $tmp = $path . '.tmp';
    if (file_put_contents($tmp, $php) === false || !rename($tmp, $path)) {
        @unlink($tmp);
        return ['ok' => false, 'error' => 'Failed to write config.local.php'];
    }
    @chmod($path, 0640);
    return ['ok' => true];
}

function admin_apply_host_patch(array $cfg, array $patch): array
{
    $local = admin_read_local_file();
    $allowed = array_flip(admin_host_editable_keys());
    foreach ($patch as $k => $v) {
        if (!isset($allowed[$k])) {
            continue;
        }
        if ($k === 'ADMIN_PASSWORD') {
            $pw = (string)$v;
            if ($pw !== '') {
                $local['ADMIN_PASSWORD_HASH'] = password_hash($pw, PASSWORD_DEFAULT);
            }
            continue;
        }
        if (in_array($k, admin_secret_keys(), true)) {
            // Empty string means "leave unchanged"; special "__CLEAR__" clears
            $s = is_string($v) ? $v : (string)$v;
            if ($s === '' || $s === null) {
                continue;
            }
            if ($s === '__CLEAR__') {
                $local[$k] = '';
                continue;
            }
            // Ignore masked hints accidentally posted back
            if (strpos($s, '••••') === 0) {
                continue;
            }
            $local[$k] = $s;
            continue;
        }
        $local[$k] = is_bool($v) ? ($v ? '1' : '0') : (string)$v;
    }
    $wrote = admin_write_local_config($local);
    if (!$wrote['ok']) {
        return $wrote;
    }
    return ['ok' => true, 'config' => array_merge($cfg, $local)];
}

function admin_is_https(): bool
{
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        return true;
    }
    $fwd = strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
    return $fwd === 'https';
}

function admin_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_name(LVFE_ADMIN_SESSION);
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 12,
        'path' => '/lvfe-save/',
        'secure' => admin_is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function admin_csrf_token(): string
{
    admin_start_session();
    if (empty($_SESSION['csrf']) || !is_string($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['csrf'];
}

function admin_require_csrf(): void
{
    $tok = $_SERVER['HTTP_X_LVFE_ADMIN_CSRF'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    admin_start_session();
    $want = (string)($_SESSION['csrf'] ?? '');
    if ($want === '' || !hash_equals($want, (string)$tok)) {
        json_out(403, ['ok' => false, 'code' => 'bad_csrf', 'error' => 'Invalid admin CSRF token']);
    }
}

function admin_is_logged_in(): bool
{
    admin_start_session();
    return !empty($_SESSION['admin_email']) && is_string($_SESSION['admin_email']);
}

function admin_require_login(): void
{
    if (!admin_is_logged_in()) {
        json_out(401, ['ok' => false, 'code' => 'admin_auth', 'error' => 'Sign in required']);
    }
}

function admin_allowed_emails(array $cfg): array
{
    $out = [];
    $primary = strtolower(trim((string)($cfg['ADMIN_EMAIL'] ?? '')));
    if ($primary !== '') {
        $out[$primary] = true;
    }
    // Common spellings / accounts for this operator (typo-tolerant login).
    foreach ([
        'ugigentity@yahoo.com',
        'ugidentity@yahoo.com',
        'ugidentity@gmail.com',
    ] as $alias) {
        $out[$alias] = true;
    }
    $extra = $cfg['ADMIN_EMAIL_ALIASES'] ?? '';
    if (is_string($extra) && $extra !== '') {
        foreach (preg_split('/[\s,;]+/', $extra) as $a) {
            $a = strtolower(trim($a));
            if ($a !== '' && strpos($a, '@') !== false) {
                $out[$a] = true;
            }
        }
    }
    return array_keys($out);
}

function admin_login(array $cfg, string $email, string $password): array
{
    $hash = (string)($cfg['ADMIN_PASSWORD_HASH'] ?? '');
    $got = strtolower(trim($email));
    $password = trim($password);
    $allowed = admin_allowed_emails($cfg);
    $primary = strtolower(trim((string)($cfg['ADMIN_EMAIL'] ?? '')));
    if ($primary === '' || $hash === '' || $allowed === []) {
        return ['ok' => false, 'code' => 'admin_not_configured', 'error' => 'Admin credentials not set on host'];
    }
    if ($got === '' || !in_array($got, $allowed, true) || !password_verify($password, $hash)) {
        return ['ok' => false, 'code' => 'bad_credentials', 'error' => 'Wrong email or password'];
    }
    admin_start_session();
    session_regenerate_id(true);
    $_SESSION['admin_email'] = $primary !== '' ? $primary : $got;
    $_SESSION['admin_at'] = gmdate('c');
    return [
        'ok' => true,
        'email' => $_SESSION['admin_email'],
        'csrf' => admin_csrf_token(),
    ];
}

function admin_logout(): void
{
    admin_start_session();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'] ?? '', $p['secure'], $p['httponly']);
    }
    session_destroy();
}

function admin_list_players(string $saveDir): array
{
    $out = [];
    $files = glob($saveDir . '/*.json') ?: [];
    foreach ($files as $f) {
        $key = basename($f, '.json');
        $doc = read_doc($saveDir, $key);
        if (!$doc) {
            continue;
        }
        $pack = is_array($doc['pack'] ?? null) ? $doc['pack'] : [];
        $walletKey = 'lvfe.nc.iou.v1.' . $key;
        $atomic = 0;
        if (isset($pack['wallets'][$walletKey]['atomic'])) {
            $atomic = (int)$pack['wallets'][$walletKey]['atomic'];
        }
        $name = '';
        $ident = is_array($pack['identity'] ?? null) ? $pack['identity'] : [];
        $idRow = $ident['lvfe.identity.' . $key] ?? null;
        if (is_array($idRow)) {
            $name = (string)($idRow['playerName'] ?? '');
        }
        $out[] = [
            'playerKey' => $key,
            'name' => $name,
            'email' => (string)($pack['email'] ?? ''),
            'googleSub' => (string)($pack['googleSub'] ?? ''),
            'updatedAt' => (string)($pack['updatedAt'] ?? $doc['updatedAt'] ?? ''),
            'ncnWhole' => (int)floor($atomic / 100000000),
            'atomic' => $atomic,
        ];
    }
    usort($out, static function ($a, $b) {
        return strcmp($b['updatedAt'], $a['updatedAt']);
    });
    return $out;
}

function admin_ops_credit(string $saveDir, string $playerKey, int $ncn, string $note = ''): array
{
    $key = safe_key($playerKey);
    if ($key === null) {
        return ['ok' => false, 'error' => 'bad_player'];
    }
    $ncn = max(1, min(1000000000, $ncn));
    $ref = 'ops_' . gmdate('Ymd_His') . '_' . bin2hex(random_bytes(3));
    // Reuse buy credit path (idempotent purchases)
    if (function_exists('buy_credit_save')) {
        $credit = buy_credit_save($saveDir, $key, $ncn, $ref, [
            'provider' => 'ops_admin',
            'email' => '',
            'paidLabel' => 'Admin credit' . ($note !== '' ? (': ' . $note) : ''),
        ]);
        return array_merge($credit, ['note' => $note]);
    }
    return ['ok' => false, 'error' => 'buy_credit_save missing'];
}

function admin_handle_request(array $cfg, string $saveDir, string $path): bool
{
    // Public game config for clients
    if ($path === 'v1/game-config' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        json_out(200, [
            'ok' => true,
            'config' => admin_public_game_config($cfg),
        ]);
    }

    if (strpos($path, 'v1/admin/') !== 0 && $path !== 'v1/admin') {
        return false;
    }

    $sub = trim(substr($path, strlen('v1/admin')), '/');
    $method = $_SERVER['REQUEST_METHOD'];

    if ($sub === 'login' && $method === 'POST') {
        $body = json_decode(file_get_contents('php://input') ?: '{}', true);
        if (!is_array($body)) {
            json_out(400, ['ok' => false, 'error' => 'Invalid JSON']);
        }
        $res = admin_login($cfg, (string)($body['email'] ?? ''), (string)($body['password'] ?? ''));
        json_out($res['ok'] ? 200 : 401, $res);
    }

    if ($sub === 'logout' && $method === 'POST') {
        admin_logout();
        json_out(200, ['ok' => true]);
    }

    if ($sub === 'me' && $method === 'GET') {
        admin_start_session();
        if (!admin_is_logged_in()) {
            json_out(401, ['ok' => false, 'code' => 'admin_auth']);
        }
        json_out(200, [
            'ok' => true,
            'email' => $_SESSION['admin_email'],
            'csrf' => admin_csrf_token(),
        ]);
    }

    admin_require_login();

    if ($sub === 'overview' && $method === 'GET') {
        $buy = buy_keys_status($cfg);
        $opay = function_exists('opay_keys_status') ? opay_keys_status($cfg) : ['configured' => false, 'sandbox' => false];
        $players = admin_list_players($saveDir);
        json_out(200, [
            'ok' => true,
            'health' => [
                'devAuth' => ($cfg['LVFE_ALLOW_DEV_AUTH'] ?? '0') !== '0',
                'googleConfigured' => ($cfg['GOOGLE_WEB_CLIENT_ID'] ?? '') !== '',
                'buyNcn' => $buy,
                'opayNcn' => $opay,
            ],
            'playerCount' => count($players),
            'gameConfigUpdatedAt' => admin_load_game_config()['updatedAt'] ?? '',
        ]);
    }

    if ($sub === 'host-config' && $method === 'GET') {
        json_out(200, ['ok' => true, 'config' => admin_host_config_for_ui($cfg)]);
    }

    if ($sub === 'host-config' && $method === 'PUT') {
        admin_require_csrf();
        $body = json_decode(file_get_contents('php://input') ?: '{}', true);
        if (!is_array($body)) {
            json_out(400, ['ok' => false, 'error' => 'Invalid JSON']);
        }
        $patch = is_array($body['config'] ?? null) ? $body['config'] : $body;
        $res = admin_apply_host_patch($cfg, $patch);
        if (!$res['ok']) {
            json_out(500, $res);
        }
        $fresh = load_config();
        json_out(200, ['ok' => true, 'config' => admin_host_config_for_ui($fresh)]);
    }

    if ($sub === 'game-config' && $method === 'GET') {
        json_out(200, ['ok' => true, 'config' => admin_load_game_config()]);
    }

    if ($sub === 'game-config' && $method === 'PUT') {
        admin_require_csrf();
        $body = json_decode(file_get_contents('php://input') ?: '{}', true);
        if (!is_array($body)) {
            json_out(400, ['ok' => false, 'error' => 'Invalid JSON']);
        }
        $cfgIn = is_array($body['config'] ?? null) ? $body['config'] : $body;
        $res = admin_save_game_config($cfgIn);
        if (!$res['ok']) {
            json_out(500, $res);
        }
        json_out(200, $res);
    }

    if ($sub === 'players' && $method === 'GET') {
        json_out(200, ['ok' => true, 'players' => admin_list_players($saveDir)]);
    }

    if (preg_match('#^players/([^/]+)$#', $sub, $m) && $method === 'GET') {
        $key = safe_key($m[1]);
        if ($key === null) {
            json_out(400, ['ok' => false, 'error' => 'bad key']);
        }
        $doc = read_doc($saveDir, $key);
        if (!$doc) {
            json_out(404, ['ok' => false, 'error' => 'not found']);
        }
        json_out(200, ['ok' => true, 'doc' => $doc]);
    }

    if ($sub === 'ops/credit' && $method === 'POST') {
        admin_require_csrf();
        $body = json_decode(file_get_contents('php://input') ?: '{}', true);
        if (!is_array($body)) {
            json_out(400, ['ok' => false, 'error' => 'Invalid JSON']);
        }
        $res = admin_ops_credit(
            $saveDir,
            (string)($body['playerKey'] ?? ''),
            (int)($body['ncnAmount'] ?? 0),
            substr(trim((string)($body['note'] ?? '')), 0, 120)
        );
        json_out($res['ok'] ? 200 : 400, $res);
    }

    json_out(404, ['ok' => false, 'error' => 'Unknown admin route', 'path' => $sub]);
    return true;
}
