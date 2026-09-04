<?php
/**
 * Buy NCN — Paystack (primary) + Flutterwave (alternate).
 * 1 NCN = USD $1. Credits IOU wallet inside the player's save pack after verify/webhook.
 * Settlement stays on each merchant dashboard (no OPay required).
 * Secrets only from config.local.php / env — never commit.
 */
declare(strict_types=1);

const BUY_ATOMIC_PER_COIN = 100000000;
const BUY_MIN_NCN = 1;
const BUY_MAX_NCN = 500;

function buy_cfg(array $cfg): array
{
    return [
        'ps_public' => trim((string)($cfg['PAYSTACK_PUBLIC_KEY'] ?? '')),
        'ps_secret' => trim((string)($cfg['PAYSTACK_SECRET_KEY'] ?? '')),
        'ps_webhook_secret' => trim((string)($cfg['PAYSTACK_WEBHOOK_SECRET'] ?? '')),
        'ps_currency' => strtoupper(trim((string)($cfg['PAYSTACK_CURRENCY'] ?? 'NGN'))) ?: 'NGN',
        'flw_public' => trim((string)($cfg['FLW_PUBLIC_KEY'] ?? '')),
        'flw_secret' => trim((string)($cfg['FLW_SECRET_KEY'] ?? '')),
        'flw_hash' => trim((string)($cfg['FLW_SECRET_HASH'] ?? '')),
        'flw_currency' => strtoupper(trim((string)($cfg['FLW_CURRENCY'] ?? ($cfg['PAYSTACK_CURRENCY'] ?? 'NGN')))) ?: 'NGN',
        'ngn_per_usd' => max(1, (float)($cfg['NGN_PER_USD'] ?? 1500)),
        'merchant_email' => trim((string)($cfg['BUY_MERCHANT_EMAIL'] ?? ($cfg['OPAY_MERCHANT_EMAIL'] ?? ''))),
    ];
}

function buy_paystack_status(array $cfg): array
{
    $b = buy_cfg($cfg);
    $pub = $b['ps_public'];
    $sec = $b['ps_secret'];
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
        'publicKey' => ($configured && !$liveMissing) ? $pub : '',
        'currency' => $b['ps_currency'],
    ];
}

function buy_flutterwave_status(array $cfg): array
{
    $b = buy_cfg($cfg);
    $pub = $b['flw_public'];
    $sec = $b['flw_secret'];
    $testPub = (bool)preg_match('/FLWPUBK_TEST/i', $pub);
    $livePub = $pub !== '' && !$testPub && (bool)preg_match('/FLWPUBK_/i', $pub);
    $testSec = (bool)preg_match('/FLWSECK_TEST/i', $sec);
    $liveSec = $sec !== '' && !$testSec && (bool)preg_match('/FLWSECK_/i', $sec);
    $configured = $pub !== '' && $sec !== '' && ($testPub || $livePub) && ($testSec || $liveSec);
    $liveMissing = ($livePub && !$liveSec) || ($liveSec && !$livePub);
    return [
        'provider' => 'flutterwave',
        'configured' => $configured && !$liveMissing,
        'sandbox' => $testPub && $testSec,
        'liveMissing' => $liveMissing,
        'publicKey' => ($configured && !$liveMissing) ? $pub : '',
        'currency' => $b['flw_currency'],
    ];
}

/** Aggregate health — primary is Paystack when configured. */
function buy_keys_status(array $cfg): array
{
    $ps = buy_paystack_status($cfg);
    $flw = buy_flutterwave_status($cfg);
    $b = buy_cfg($cfg);
    $primary = 'paystack';
    $configured = $ps['configured'] || $flw['configured'];
    $sandbox = false;
    if ($ps['configured']) {
        $sandbox = $ps['sandbox'];
    } elseif ($flw['configured']) {
        $primary = 'flutterwave';
        $sandbox = $flw['sandbox'];
    }
    return [
        'provider' => $primary,
        'configured' => $configured,
        'sandbox' => $sandbox,
        'liveMissing' => $ps['liveMissing'] || $flw['liveMissing'],
        'publicKey' => $ps['publicKey'],
        'currency' => $ps['currency'],
        'ngnPerUsd' => $b['ngn_per_usd'],
        'ncnPerUsd' => 1,
        'paystack' => [
            'configured' => $ps['configured'],
            'sandbox' => $ps['sandbox'],
        ],
        'flutterwave' => [
            'configured' => $flw['configured'],
            'sandbox' => $flw['sandbox'],
        ],
    ];
}

function buy_blocker_payload(string $code = 'paystack_not_configured'): array
{
    $isFlw = strpos($code, 'flutterwave') !== false || strpos($code, 'flw') !== false;
    return [
        'ok' => false,
        'code' => $code,
        'title' => 'Buy NCN is not wired yet (sandbox or live keys missing).',
        'error' => $isFlw
            ? 'Set FLW_PUBLIC_KEY + FLW_SECRET_KEY in config.local.php. See docs/BUY_NCN.md.'
            : 'Set PAYSTACK_PUBLIC_KEY + PAYSTACK_SECRET_KEY in config.local.php (sk_test_ for sandbox). See docs/BUY_NCN.md.',
        'steps' => $isFlw ? [
            'Flutterwave Dashboard → Settings → API Keys.',
            'Paste FLWPUBK_TEST_… into web/js/buy-ncn.config.js FLW_PUBLIC_KEY.',
            'Paste FLWSECK_TEST_… + FLWPUBK_TEST_… into hosting/lvfe-save/config.local.php (gitignored).',
            'Copy Secret Hash → FLW_SECRET_HASH; webhook URL: https://iconiaglobal.com/lvfe-save/v1/buy/flw-webhook',
            '1 NCN = USD $1; NGN uses NGN_PER_USD (major units for Flutterwave).',
            'Payout/settlement stays on your Flutterwave dashboard (bank already linked there).',
        ] : [
            'Paystack Dashboard → Settings → API Keys & Webhooks.',
            'Paste pk_test_… into web/js/buy-ncn.config.js PAYSTACK_PUBLIC_KEY.',
            'Paste sk_test_… + pk_test_… into hosting/lvfe-save/config.local.php (gitignored).',
            'Webhook URL: https://iconiaglobal.com/lvfe-save/v1/buy/webhook',
            '1 NCN = USD $1; NGN settlement uses NGN_PER_USD (kobo for Paystack).',
            'Payout/settlement stays on your Paystack dashboard (bank already linked there).',
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

/** Paystack = minor units (kobo/cents). Flutterwave = major units (naira/dollars). */
function buy_amount_for_provider(int $ncn, string $provider, array $cfg): array
{
    $b = buy_cfg($cfg);
    $provider = strtolower($provider);
    if ($provider === 'flutterwave') {
        $currency = $b['flw_currency'];
        if ($currency === 'USD') {
            return ['amount' => $ncn, 'currency' => 'USD', 'label' => '$' . $ncn . ' USD'];
        }
        $naira = (float)round($ncn * $b['ngn_per_usd'], 2);
        if ($naira < 1) {
            $naira = 1;
        }
        return [
            'amount' => $naira,
            'currency' => 'NGN',
            'label' => '₦' . number_format($naira, 2) . ' NGN',
        ];
    }
    $currency = $b['ps_currency'];
    if ($currency === 'USD') {
        return [
            'amount' => $ncn * 100,
            'currency' => 'USD',
            'label' => '$' . $ncn . ' USD',
        ];
    }
    $kobo = (int)round($ncn * $b['ngn_per_usd'] * 100);
    if ($kobo < 100) {
        $kobo = 100;
    }
    return [
        'amount' => $kobo,
        'currency' => 'NGN',
        'label' => '₦' . number_format($kobo / 100, 2) . ' NGN',
    ];
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

function buy_http_get(string $url, array $headers): ?array
{
    $hdr = '';
    foreach ($headers as $h) {
        $hdr .= $h . "\r\n";
    }
    $ctx = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => $hdr,
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

function buy_paystack_get(string $path, string $secret): ?array
{
    return buy_http_get('https://api.paystack.co' . $path, [
        "Authorization: Bearer {$secret}",
        'Accept: application/json',
    ]);
}

function buy_flw_verify_by_ref(string $txRef, string $secret): ?array
{
    $url = 'https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=' . rawurlencode($txRef);
    return buy_http_get($url, [
        "Authorization: Bearer {$secret}",
        'Accept: application/json',
    ]);
}

function buy_flw_verify_by_id($transactionId, string $secret): ?array
{
    $id = preg_replace('/[^0-9]/', '', (string)$transactionId);
    if ($id === '') {
        return null;
    }
    return buy_http_get('https://api.flutterwave.com/v3/transactions/' . $id . '/verify', [
        "Authorization: Bearer {$secret}",
        'Accept: application/json',
    ]);
}

function buy_append_activity(array &$pack, array $row): void
{
    if (!isset($pack['activity']) || !is_array($pack['activity'])) {
        $pack['activity'] = ['items' => []];
    }
    if (!isset($pack['activity']['items']) || !is_array($pack['activity']['items'])) {
        $pack['activity']['items'] = [];
    }
    array_unshift($pack['activity']['items'], $row);
    while (count($pack['activity']['items']) > 40) {
        array_pop($pack['activity']['items']);
    }
}

function buy_store_receipt(array &$pack, array $receipt): void
{
    if (!isset($pack['receipts']) || !is_array($pack['receipts'])) {
        $pack['receipts'] = [];
    }
    $ref = (string)($receipt['reference'] ?? '');
    if ($ref === '') {
        return;
    }
    $pack['receipts'][$ref] = $receipt;
}

function buy_try_mail_receipt(array $cfg, array $receipt): array
{
    $b = buy_cfg($cfg);
    $to = trim((string)($receipt['payerEmail'] ?? ''));
    $bcc = $b['merchant_email'];
    $provider = (string)($receipt['provider'] ?? 'paystack');
    $subject = 'Lvfe NCN receipt — ' . (int)($receipt['ncn'] ?? 0) . ' NCN';
    $body = "Lvfe: The Xperience\n\n"
        . "Credited: " . (int)($receipt['ncn'] ?? 0) . " NCN\n"
        . "Paid: " . ($receipt['paidLabel'] ?? '') . "\n"
        . "Reference: " . ($receipt['reference'] ?? '') . "\n"
        . "Provider: " . $provider . "\n"
        . "Settlement: your {$provider} merchant dashboard (bank already linked there).\n"
        . "At: " . ($receipt['at'] ?? gmdate('c')) . "\n";
    $headers = "From: Lvfe <noreply@iconiaglobal.com>\r\n";
    if ($bcc !== '' && filter_var($bcc, FILTER_VALIDATE_EMAIL)) {
        $headers .= "Bcc: {$bcc}\r\n";
    }
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL) || preg_match('/@lvfe\.local$/i', $to)) {
        return ['sent' => false, 'reason' => 'no_payer_email', 'stored' => true];
    }
    $ok = @mail($to, $subject, $body, $headers);
    return ['sent' => (bool)$ok, 'reason' => $ok ? 'php_mail' : 'mail_failed', 'stored' => true];
}

function buy_credit_save(string $saveDir, string $playerKey, int $ncn, string $ref, array $meta = []): array
{
    $key = safe_key($playerKey);
    if ($key === null) {
        return ['ok' => false, 'error' => 'bad_player'];
    }
    $provider = strtolower((string)($meta['provider'] ?? 'paystack')) ?: 'paystack';
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
        'activity' => ['items' => []],
        'receipts' => [],
        'purchases' => [],
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
            'receipt' => is_array($pack['receipts'][$ref] ?? null) ? $pack['receipts'][$ref] : null,
        ];
    }
    $w['atomic'] = (int)($w['atomic'] ?? 0) + $atomicAdd;
    $pack['wallets'][$walletKey] = $w;
    $label = $provider === 'flutterwave' ? 'Flutterwave' : 'Paystack';
    $pack['purchases'][$ref] = array_merge([
        'ncn' => $ncn,
        'at' => gmdate('c'),
        'provider' => $provider,
    ], array_diff_key($meta, ['provider' => 1]));
    buy_append_activity($pack, [
        'at' => gmdate('c'),
        'kind' => 'buy_ncn',
        'text' => 'Bought ' . $ncn . ' NCN (' . $label . ')',
        'amount' => $ncn,
        'ref' => $ref,
    ]);
    $receipt = [
        'reference' => $ref,
        'ncn' => $ncn,
        'payerEmail' => (string)($meta['email'] ?? ''),
        'paidLabel' => (string)($meta['paidLabel'] ?? ''),
        'provider' => $provider,
        'at' => gmdate('c'),
    ];
    buy_store_receipt($pack, $receipt);
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
        'receipt' => $receipt,
    ];
}

function buy_normalize_provider($raw): string
{
    $p = strtolower(trim((string)$raw));
    if ($p === 'flutterwave' || $p === 'flw') {
        return 'flutterwave';
    }
    return 'paystack';
}

function buy_handle_init(array $cfg, string $saveDir): void
{
    $raw = file_get_contents('php://input');
    $body = json_decode($raw ?: '{}', true);
    if (!is_array($body)) {
        json_out(400, ['ok' => false, 'error' => 'Invalid JSON']);
    }
    $provider = buy_normalize_provider($body['provider'] ?? 'paystack');
    $ps = buy_paystack_status($cfg);
    $flw = buy_flutterwave_status($cfg);

    if ($provider === 'flutterwave') {
        if ($flw['liveMissing']) {
            json_out(503, buy_blocker_payload('flutterwave_live_keys_missing'));
        }
        if (!$flw['configured']) {
            json_out(503, buy_blocker_payload('flutterwave_not_configured'));
        }
    } else {
        if ($ps['liveMissing']) {
            json_out(503, buy_blocker_payload('live_keys_missing'));
        }
        if (!$ps['configured']) {
            json_out(503, buy_blocker_payload());
        }
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
    $priced = buy_amount_for_provider($ncn, $provider, $cfg);
    $ref = buy_make_reference($playerKey);
    $status = $provider === 'flutterwave' ? $flw : $ps;
    buy_write_pending($ref, [
        'reference' => $ref,
        'playerKey' => $playerKey,
        'ncnAmount' => $ncn,
        'amount' => $priced['amount'],
        'currency' => $priced['currency'],
        'paidLabel' => $priced['label'],
        'email' => $email,
        'provider' => $provider,
        'status' => 'pending',
        'createdAt' => gmdate('c'),
    ]);
    json_out(200, [
        'ok' => true,
        'provider' => $provider,
        'publicKey' => $status['publicKey'],
        'reference' => $ref,
        'ncnAmount' => $ncn,
        'amount' => $priced['amount'],
        'currency' => $priced['currency'],
        'paidLabel' => $priced['label'],
        'email' => $email,
        'sandbox' => $status['sandbox'],
        'ncnPerUsd' => 1,
        'usd' => $ncn,
        'ngnPerUsd' => buy_cfg($cfg)['ngn_per_usd'],
    ]);
}

function buy_handle_verify(array $cfg, string $saveDir): void
{
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
    $provider = buy_normalize_provider($body['provider'] ?? ($pending['provider'] ?? 'paystack'));
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
    if ($pending && (string)($pending['playerKey'] ?? '') !== $playerKey) {
        json_out(403, ['ok' => false, 'code' => 'player_mismatch', 'error' => 'Reference belongs to another player']);
    }

    $b = buy_cfg($cfg);
    $ncn = buy_clamp_ncn($pending['ncnAmount'] ?? 1);
    $paidLabel = (string)($pending['paidLabel'] ?? '');
    $email = (string)($pending['email'] ?? ($body['email'] ?? ''));

    if ($provider === 'flutterwave') {
        $flw = buy_flutterwave_status($cfg);
        if (!$flw['configured']) {
            json_out(503, buy_blocker_payload('flutterwave_not_configured'));
        }
        $txId = $body['transactionId'] ?? $body['transaction_id'] ?? null;
        $flwResp = null;
        if ($txId !== null && $txId !== '') {
            $flwResp = buy_flw_verify_by_id($txId, $b['flw_secret']);
        }
        if ($flwResp === null) {
            $flwResp = buy_flw_verify_by_ref($ref, $b['flw_secret']);
        }
        if ($flwResp === null || (string)($flwResp['status'] ?? '') !== 'success') {
            json_out(502, ['ok' => false, 'code' => 'flutterwave_unreachable', 'error' => 'Flutterwave verify failed']);
        }
        $data = is_array($flwResp['data'] ?? null) ? $flwResp['data'] : [];
        $txStatus = strtolower((string)($data['status'] ?? ''));
        if ($txStatus !== 'successful' && $txStatus !== 'success') {
            json_out(402, ['ok' => false, 'code' => 'not_paid', 'error' => 'Payment not successful', 'status' => $data['status'] ?? '']);
        }
        $meta = is_array($data['meta'] ?? null) ? $data['meta'] : [];
        $ncn = buy_clamp_ncn($pending['ncnAmount'] ?? ($meta['ncnAmount'] ?? 1));
    } else {
        $ps = buy_paystack_status($cfg);
        if (!$ps['configured']) {
            json_out(503, buy_blocker_payload());
        }
        $psResp = buy_paystack_get('/transaction/verify/' . rawurlencode($ref), $b['ps_secret']);
        if ($psResp === null || empty($psResp['status']) || empty($psResp['data'])) {
            json_out(502, ['ok' => false, 'code' => 'paystack_unreachable', 'error' => 'Paystack verify failed']);
        }
        $data = $psResp['data'];
        if (strtolower((string)($data['status'] ?? '')) !== 'success') {
            json_out(402, ['ok' => false, 'code' => 'not_paid', 'error' => 'Payment not successful', 'status' => $data['status'] ?? '']);
        }
        $meta = is_array($data['metadata'] ?? null) ? $data['metadata'] : [];
        $ncn = buy_clamp_ncn($pending['ncnAmount'] ?? ($meta['ncnAmount'] ?? 1));
    }

    $credit = buy_credit_save($saveDir, $playerKey, $ncn, $ref, [
        'provider' => $provider,
        'email' => $email,
        'paidLabel' => $paidLabel,
    ]);
    $mail = ['sent' => false, 'reason' => 'idempotent'];
    if (empty($credit['idempotent']) && is_array($credit['receipt'] ?? null)) {
        $mail = buy_try_mail_receipt($cfg, $credit['receipt']);
    }
    if ($pending) {
        $pending['status'] = 'credited';
        $pending['creditedAt'] = gmdate('c');
        buy_write_pending($ref, $pending);
    }
    json_out(200, array_merge($credit, [
        'provider' => $provider,
        'playerKey' => $playerKey,
        'mail' => $mail,
    ]));
}

function buy_handle_webhook(array $cfg, string $saveDir): void
{
    $ps = buy_paystack_status($cfg);
    if (!$ps['configured']) {
        json_out(503, buy_blocker_payload());
    }
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        json_out(400, ['ok' => false, 'error' => 'empty body']);
    }
    $b = buy_cfg($cfg);
    $sig = $_SERVER['HTTP_X_PAYSTACK_SIGNATURE'] ?? '';
    $hmacKey = $b['ps_webhook_secret'] !== '' ? $b['ps_webhook_secret'] : $b['ps_secret'];
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
    $credit = buy_credit_save($saveDir, $playerKey, $ncn, $ref, [
        'provider' => 'paystack',
        'email' => (string)($pending['email'] ?? ($data['customer']['email'] ?? '')),
        'paidLabel' => (string)($pending['paidLabel'] ?? ''),
    ]);
    if (empty($credit['idempotent']) && is_array($credit['receipt'] ?? null)) {
        buy_try_mail_receipt($cfg, $credit['receipt']);
    }
    if ($pending) {
        $pending['status'] = 'credited';
        $pending['creditedAt'] = gmdate('c');
        $pending['via'] = 'webhook';
        buy_write_pending($ref, $pending);
    }
    json_out(200, ['ok' => true, 'credited' => $credit]);
}

function buy_handle_flw_webhook(array $cfg, string $saveDir): void
{
    $flw = buy_flutterwave_status($cfg);
    if (!$flw['configured']) {
        json_out(503, buy_blocker_payload('flutterwave_not_configured'));
    }
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        json_out(400, ['ok' => false, 'error' => 'empty body']);
    }
    $b = buy_cfg($cfg);
    $hash = $_SERVER['HTTP_VERIF_HASH'] ?? '';
    if ($b['flw_hash'] === '' || $hash === '' || !hash_equals($b['flw_hash'], $hash)) {
        json_out(401, ['ok' => false, 'code' => 'bad_signature', 'error' => 'Invalid Flutterwave verif-hash']);
    }
    $evt = json_decode($raw, true);
    if (!is_array($evt)) {
        json_out(400, ['ok' => false, 'error' => 'Invalid JSON']);
    }
    $data = is_array($evt['data'] ?? null) ? $evt['data'] : [];
    $status = strtolower((string)($data['status'] ?? ($evt['status'] ?? '')));
    if ($status !== 'successful' && $status !== 'success') {
        json_out(200, ['ok' => true, 'ignored' => true, 'status' => $status]);
    }
    $ref = preg_replace('/[^a-zA-Z0-9._-]/', '', (string)($data['tx_ref'] ?? ($data['txRef'] ?? '')));
    $pending = $ref !== '' ? buy_read_pending($ref) : null;
    $meta = is_array($data['meta'] ?? null) ? $data['meta'] : [];
    $playerKey = safe_key((string)($pending['playerKey'] ?? ($meta['playerKey'] ?? '')));
    $ncn = buy_clamp_ncn($pending['ncnAmount'] ?? ($meta['ncnAmount'] ?? 0));
    if ($playerKey === null || $ref === '' || $ncn < 1) {
        json_out(400, ['ok' => false, 'error' => 'missing playerKey/reference/ncn']);
    }
    $credit = buy_credit_save($saveDir, $playerKey, $ncn, $ref, [
        'provider' => 'flutterwave',
        'email' => (string)($pending['email'] ?? ($data['customer']['email'] ?? '')),
        'paidLabel' => (string)($pending['paidLabel'] ?? ''),
    ]);
    if (empty($credit['idempotent']) && is_array($credit['receipt'] ?? null)) {
        buy_try_mail_receipt($cfg, $credit['receipt']);
    }
    if ($pending) {
        $pending['status'] = 'credited';
        $pending['creditedAt'] = gmdate('c');
        $pending['via'] = 'flw_webhook';
        buy_write_pending($ref, $pending);
    }
    json_out(200, ['ok' => true, 'credited' => $credit]);
}
