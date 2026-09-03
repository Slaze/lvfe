<?php
/**
 * Buy NCN (Paystack) helpers for lvfe-save.
 * 1 NCN = USD $1. Credits IOU wallet inside the player's save pack after verify/webhook.
 * Secrets only from config.local.php / env — never commit.
 */
declare(strict_types=1);

const BUY_ATOMIC_PER_COIN = 100000000;
const BUY_MIN_NCN = 1;
const BUY_MAX_NCN = 500;

function buy_cfg(array $cfg): array
{
    return [
        'public' => trim((string)($cfg['PAYSTACK_PUBLIC_KEY'] ?? '')),
        'secret' => trim((string)($cfg['PAYSTACK_SECRET_KEY'] ?? '')),
        'currency' => strtoupper(trim((string)($cfg['PAYSTACK_CURRENCY'] ?? 'NGN'))) ?: 'NGN',
        'ngn_per_usd' => max(1, (float)($cfg['NGN_PER_USD'] ?? 1500)),
        'webhook_secret' => trim((string)($cfg['PAYSTACK_WEBHOOK_SECRET'] ?? '')),
    ];
}

function buy_keys_status(array $cfg): array
{
    $b = buy_cfg($cfg);
    $pub = $b['public'];
    $sec = $b['secret'];
    $testPub = (bool)preg_match('/^pk_test_/i', $pub);
    $livePub = (bool)preg_match('/^pk_live_/i', $pub);
    $testSec = (bool)preg_match('/^sk_test_/i', $sec);
    $liveSec = (bool)preg_match('/^sk_live_/i', $sec);
    $configured = $pub !== '' && $sec !== '' && ($testPub || $livePub) && ($testSec || $liveSec);
    $liveMissing = ($livePub && !$liveSec) || ($liveSec && !$livePub);
    return [
        'provider' => 'paystack',
        'configured' => $configured && !$liveMissing,
        'sandbox' => $testPub && $testSec,
        'liveMissing' => $liveMissing,
        'publicKey' => $configured ? $pub : '',
        'currency' => $b['currency'],
        'ngnPerUsd' => $b['ngn_per_usd'],
        'ncnPerUsd' => 1,
    ];
}

function buy_blocker_payload(string $code = 'paystack_not_configured'): array
{
    return [
        'ok' => false,
        'code' => $code,
        'title' => 'Buy NCN is not wired yet (sandbox or live keys missing).',
        'error' => 'Set PAYSTACK_PUBLIC_KEY + PAYSTACK_SECRET_KEY in config.local.php (sk_test_ for sandbox). See docs/BUY_NCN.md.',
        'steps' => [
            'Create Paystack account → API Keys.',
            'Paste pk_test_ into web/js/buy-ncn.config.js PAYSTACK_PUBLIC_KEY.',
            'Paste sk_test_ + pk_test_ into hosting/lvfe-save/config.local.php (gitignored).',
            'Webhook URL: https://iconiaglobal.com/lvfe-save/v1/buy/webhook',
            '1 NCN = USD $1; NGN settlement uses NGN_PER_USD (kobo).',
        ],
    ];
}

function buy_clamp_ncn($raw): int
{
    $n = (int)floor((float)$raw);
    if ($n < BUY_MIN_NCN) {
        return BUY_MIN_NCN;
    }
    if ($n > BUY_MAX_NCN) {
        return BUY_MAX_NCN;
    }
    return $n;
}

function buy_amount_minor(int $ncn, array $cfg): array
{
    $b = buy_cfg($cfg);
    $currency = $b['currency'];
    if ($currency === 'USD') {
        return ['amount' => $ncn * 100, 'currency' => 'USD'];
    }
    // NGN kobo: USD$1 * NGN_PER_USD * 100
    $kobo = (int)round($ncn * $b['ngn_per_usd'] * 100);
    if ($kobo < 100) {
        $kobo = 100;
    }
    return ['amount' => $kobo, 'currency' => 'NGN'];
}

function buy_payments_dir(): string
{
    $dir = __DIR__ . '/data/payments';
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }
    return $dir;
}

function buy_pending_path(string $ref): string
{
    return buy_payments_dir() . '/' . preg_replace('/[^a-zA-Z0-9._-]/', '', $ref) . '.json';
}

function buy_write_pending(string $ref, array $doc): void
{
    $path = buy_pending_path($ref);
    $tmp = $path . '.tmp';
    file_put_contents($tmp, json_encode($doc, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
    rename($tmp, $path);
}

function buy_read_pending(string $ref): ?array
{
    $path = buy_pending_path($ref);
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

function buy_make_reference(string $playerKey): string
{
    $pk = preg_replace('/[^a-zA-Z0-9]/', '', $playerKey);
    return 'lvfe_' . substr($pk, 0, 12) . '_' . bin2hex(random_bytes(6));
}

function buy_paystack_get(string $path, string $secret): ?array
{
    $url = 'https://api.paystack.co' . $path;
    $ctx = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => "Authorization: Bearer {$secret}\r\nAccept: application/json\r\n",
            'timeout' => 20,
            'ignore_errors' => true,
        ],
    ]);
    $raw = @file_get_contents($url, false, $ctx);
    if ($raw === false) {
        return null;
    }
    $json = json_decode($raw, true);
    return is_array($json) ? $json : null;
}

function buy_credit_save(string $saveDir, string $playerKey, int $ncn, string $ref): array
{
    $key = safe_key($playerKey);
    if ($key === null) {
        return ['ok' => false, 'error' => 'bad_player'];
    }
    $walletKey = 'lvfe.nc.iou.v1.' . $key;
    $atomicAdd = $ncn * BUY_ATOMIC_PER_COIN;
    $existing = read_doc($saveDir, $key);
    $pack = is_array($existing['pack'] ?? null) ? $existing['pack'] : [
        'kind' => PACK_KIND,
        'v' => 1,
        'playerKey' => $key,
        'wallets' => [],
        'places' => [],
        'identity' => [],
        'factionPool' => [],
        'google' => [],
        'photos' => [],
    ];
    if (($pack['kind'] ?? '') !== PACK_KIND) {
        $pack['kind'] = PACK_KIND;
    }
    if (!isset($pack['wallets']) || !is_array($pack['wallets'])) {
        $pack['wallets'] = [];
    }
    $w = is_array($pack['wallets'][$walletKey] ?? null) ? $pack['wallets'][$walletKey] : [
        'atomic' => 0,
        'faucetGranted' => false,
        'unit' => 'atomic',
    ];
    if (!isset($pack['purchases']) || !is_array($pack['purchases'])) {
        $pack['purchases'] = [];
    }
    if (!empty($pack['purchases'][$ref])) {
        return [
            'ok' => true,
            'idempotent' => true,
            'ncnAmount' => $ncn,
            'reference' => $ref,
            'atomic' => (int)($w['atomic'] ?? 0),
        ];
    }
    $w['atomic'] = (int)($w['atomic'] ?? 0) + $atomicAdd;
    $pack['wallets'][$walletKey] = $w;
    $pack['purchases'][$ref] = [
        'ncn' => $ncn,
        'at' => gmdate('c'),
        'provider' => 'paystack',
    ];
    $pack['updatedAt'] = gmdate('c');
    $pack['playerKey'] = $key;
    $doc = [
        'accountKey' => $key,
        'updatedAt' => $pack['updatedAt'],
        'pack' => $pack,
        'savedAt' => gmdate('c'),
    ];
    write_doc($saveDir, $key, $doc);
    return [
        'ok' => true,
        'idempotent' => false,
        'ncnAmount' => $ncn,
        'reference' => $ref,
        'atomic' => $w['atomic'],
    ];
}

function buy_handle_init(array $cfg, string $saveDir): void
{
    $status = buy_keys_status($cfg);
    if ($status['liveMissing']) {
        json_out(503, buy_blocker_payload('live_keys_missing'));
    }
    if (!$status['configured']) {
        json_out(503, buy_blocker_payload());
    }
    $raw = file_get_contents('php://input');
    $body = json_decode($raw ?: '{}', true);
    if (!is_array($body)) {
        json_out(400, ['ok' => false, 'error' => 'Invalid JSON']);
    }
    $playerKey = safe_key((string)($body['playerKey'] ?? ''));
    if ($playerKey === null) {
        json_out(400, ['ok' => false, 'error' => 'playerKey required']);
    }
    $auth = authorize($cfg, $playerKey);
    if (!$auth['ok']) {
        json_out((int)($auth['status'] ?? 401), [
            'ok' => false,
            'code' => $auth['code'] ?? 'unauthorized',
            'error' => $auth['error'] ?? 'unauthorized',
        ]);
    }
    $ncn = buy_clamp_ncn($body['ncnAmount'] ?? 1);
    $email = trim((string)($body['email'] ?? ''));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $email = $playerKey . '@lvfe.local';
    }
    $priced = buy_amount_minor($ncn, $cfg);
    $ref = buy_make_reference($playerKey);
    buy_write_pending($ref, [
        'reference' => $ref,
        'playerKey' => $playerKey,
        'ncnAmount' => $ncn,
        'amount' => $priced['amount'],
        'currency' => $priced['currency'],
        'email' => $email,
        'status' => 'pending',
        'createdAt' => gmdate('c'),
    ]);
    json_out(200, [
        'ok' => true,
        'provider' => 'paystack',
        'publicKey' => $status['publicKey'],
        'reference' => $ref,
        'ncnAmount' => $ncn,
        'amount' => $priced['amount'],
        'currency' => $priced['currency'],
        'email' => $email,
        'sandbox' => $status['sandbox'],
        'ncnPerUsd' => 1,
        'usd' => $ncn,
    ]);
}

function buy_handle_verify(array $cfg, string $saveDir): void
{
    $status = buy_keys_status($cfg);
    if (!$status['configured']) {
        json_out(503, buy_blocker_payload());
    }
    $raw = file_get_contents('php://input');
    $body = json_decode($raw ?: '{}', true);
    if (!is_array($body)) {
        json_out(400, ['ok' => false, 'error' => 'Invalid JSON']);
    }
    $ref = preg_replace('/[^a-zA-Z0-9._-]/', '', (string)($body['reference'] ?? ''));
    if ($ref === '') {
        json_out(400, ['ok' => false, 'error' => 'reference required']);
    }
    $pending = buy_read_pending($ref);
    $playerKey = safe_key((string)($body['playerKey'] ?? ($pending['playerKey'] ?? '')));
    if ($playerKey === null) {
        json_out(400, ['ok' => false, 'error' => 'playerKey required']);
    }
    $auth = authorize($cfg, $playerKey);
    if (!$auth['ok']) {
        json_out((int)($auth['status'] ?? 401), [
            'ok' => false,
            'code' => $auth['code'] ?? 'unauthorized',
            'error' => $auth['error'] ?? 'unauthorized',
        ]);
    }
    $b = buy_cfg($cfg);
    $ps = buy_paystack_get('/transaction/verify/' . rawurlencode($ref), $b['secret']);
    if ($ps === null || empty($ps['status']) || empty($ps['data'])) {
        json_out(502, ['ok' => false, 'code' => 'paystack_unreachable', 'error' => 'Paystack verify failed']);
    }
    $data = $ps['data'];
    if (strtolower((string)($data['status'] ?? '')) !== 'success') {
        json_out(402, ['ok' => false, 'code' => 'not_paid', 'error' => 'Payment not successful', 'status' => $data['status'] ?? '']);
    }
    $ncn = buy_clamp_ncn($pending['ncnAmount'] ?? ($data['metadata']['ncnAmount'] ?? 1));
    if ($pending && (string)($pending['playerKey'] ?? '') !== $playerKey) {
        json_out(403, ['ok' => false, 'code' => 'player_mismatch', 'error' => 'Reference belongs to another player']);
    }
    $credit = buy_credit_save($saveDir, $playerKey, $ncn, $ref);
    if ($pending) {
        $pending['status'] = 'credited';
        $pending['creditedAt'] = gmdate('c');
        buy_write_pending($ref, $pending);
    }
    json_out(200, array_merge($credit, [
        'provider' => 'paystack',
        'playerKey' => $playerKey,
    ]));
}

function buy_handle_webhook(array $cfg, string $saveDir): void
{
    $status = buy_keys_status($cfg);
    if (!$status['configured']) {
        json_out(503, buy_blocker_payload());
    }
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        json_out(400, ['ok' => false, 'error' => 'empty body']);
    }
    $b = buy_cfg($cfg);
    $sig = $_SERVER['HTTP_X_PAYSTACK_SIGNATURE'] ?? '';
    $hmacKey = $b['webhook_secret'] !== '' ? $b['webhook_secret'] : $b['secret'];
    $calc = hash_hmac('sha512', $raw, $hmacKey);
    if ($sig === '' || !hash_equals($calc, $sig)) {
        json_out(401, ['ok' => false, 'code' => 'bad_signature', 'error' => 'Invalid Paystack signature']);
    }
    $evt = json_decode($raw, true);
    if (!is_array($evt)) {
        json_out(400, ['ok' => false, 'error' => 'Invalid JSON']);
    }
    $event = (string)($evt['event'] ?? '');
    if ($event !== 'charge.success') {
        json_out(200, ['ok' => true, 'ignored' => true, 'event' => $event]);
    }
    $data = is_array($evt['data'] ?? null) ? $evt['data'] : [];
    $ref = preg_replace('/[^a-zA-Z0-9._-]/', '', (string)($data['reference'] ?? ''));
    $pending = $ref !== '' ? buy_read_pending($ref) : null;
    $meta = is_array($data['metadata'] ?? null) ? $data['metadata'] : [];
    $playerKey = safe_key((string)($pending['playerKey'] ?? ($meta['playerKey'] ?? '')));
    $ncn = buy_clamp_ncn($pending['ncnAmount'] ?? ($meta['ncnAmount'] ?? 0));
    if ($playerKey === null || $ref === '' || $ncn < 1) {
        json_out(400, ['ok' => false, 'error' => 'missing playerKey/reference/ncn']);
    }
    $credit = buy_credit_save($saveDir, $playerKey, $ncn, $ref);
    if ($pending) {
        $pending['status'] = 'credited';
        $pending['creditedAt'] = gmdate('c');
        $pending['via'] = 'webhook';
        buy_write_pending($ref, $pending);
    }
    json_out(200, ['ok' => true, 'credited' => $credit]);
}
