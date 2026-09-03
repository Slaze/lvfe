<?php
/**
 * OPay Cashier (Buy NCN) — soft-fail until keys exist in config.local.php.
 * Destination settlement: merchant OPay account (operator). Game credit = USD equiv of paid amount; 1 NCN = $1.
 * Docs: docs/OPAY_NCN.md
 * Never invent live secrets.
 */
declare(strict_types=1);

const OPAY_ATOMIC_PER_COIN = 100000000;
const OPAY_MIN_NCN = 1;
const OPAY_MAX_NCN = 500;

function opay_cfg(array $cfg): array
{
    return [
        'merchant_id' => trim((string)($cfg['OPAY_MERCHANT_ID'] ?? '')),
        'public_key' => trim((string)($cfg['OPAY_PUBLIC_KEY'] ?? '')),
        'secret_key' => trim((string)($cfg['OPAY_SECRET_KEY'] ?? '')),
        'sandbox' => (($cfg['OPAY_SANDBOX'] ?? '1') !== '0'),
        'currency' => strtoupper(trim((string)($cfg['OPAY_CURRENCY'] ?? 'NGN'))) ?: 'NGN',
        'ngn_per_usd' => max(1, (float)($cfg['NGN_PER_USD'] ?? 1500)),
        'payout_account' => trim((string)($cfg['OPAY_PAYOUT_ACCOUNT'] ?? '7035474827')),
        'payout_name' => trim((string)($cfg['OPAY_PAYOUT_NAME'] ?? 'Okogeri Ugochukwu O')),
        'merchant_email' => trim((string)($cfg['OPAY_MERCHANT_EMAIL'] ?? 'ugidentity@gmail.com')),
    ];
}

function opay_base_url(array $o): string
{
    return $o['sandbox']
        ? 'https://testapi.opaycheckout.com'
        : 'https://liveapi.opaycheckout.com';
}

function opay_keys_status(array $cfg): array
{
    $o = opay_cfg($cfg);
    $configured = $o['merchant_id'] !== '' && $o['public_key'] !== '' && $o['secret_key'] !== '';
    return [
        'provider' => 'opay',
        'configured' => $configured,
        'sandbox' => $o['sandbox'],
        'currency' => $o['currency'],
        'ngnPerUsd' => $o['ngn_per_usd'],
        'ncnPerUsd' => 1,
        'payoutAccount' => $o['payout_account'],
        'payoutName' => $o['payout_name'],
    ];
}

function opay_blocker_payload(string $code = 'opay_not_configured'): array
{
    return [
        'ok' => false,
        'code' => $code,
        'title' => 'OPay Buy NCN isn’t wired yet (keys missing).',
        'error' => 'Set OPAY_MERCHANT_ID + OPAY_PUBLIC_KEY + OPAY_SECRET_KEY in config.local.php. See docs/OPAY_NCN.md.',
        'steps' => [
            'Create OPay merchant dashboard → API Keys & Webhooks.',
            'Paste sandbox keys into hosting/lvfe-save/config.local.php (gitignored).',
            'Webhook / callback: https://iconiaglobal.com/lvfe-save/v1/opay/webhook',
            'Settlement account for ops: 7035474827 · Okogeri Ugochukwu O',
            '1 NCN = USD $1; NGN charge uses NGN_PER_USD (amount in kobo/cents per OPay docs).',
        ],
    ];
}

function opay_clamp_ncn($raw): int
{
    $n = (int)floor((float)$raw);
    if ($n < OPAY_MIN_NCN) {
        return OPAY_MIN_NCN;
    }
    if ($n > OPAY_MAX_NCN) {
        return OPAY_MAX_NCN;
    }
    return $n;
}

/** OPay amount.total is in minor units (kobo for NGN). */
function opay_amount_minor(int $ncn, array $cfg): array
{
    $o = opay_cfg($cfg);
    $currency = $o['currency'];
    if ($currency === 'USD') {
        return ['total' => $ncn * 100, 'currency' => 'USD', 'ncn' => $ncn, 'usd' => $ncn];
    }
    $kobo = (int)round($ncn * $o['ngn_per_usd'] * 100);
    if ($kobo < 100) {
        $kobo = 100;
    }
    return ['total' => $kobo, 'currency' => 'NGN', 'ncn' => $ncn, 'usd' => $ncn];
}

function opay_make_reference(string $playerKey): string
{
    $pk = preg_replace('/[^a-zA-Z0-9]/', '', $playerKey);
    return 'lvfeop_' . substr($pk, 0, 10) . '_' . bin2hex(random_bytes(5));
}

function opay_sign(string $payloadJson, string $secret): string
{
    return hash_hmac('sha512', $payloadJson, $secret);
}

function opay_http_post(string $url, array $headers, string $body): ?array
{
    $hdr = '';
    foreach ($headers as $k => $v) {
        $hdr .= $k . ': ' . $v . "\r\n";
    }
    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => $hdr . "Content-Type: application/json\r\nAccept: application/json\r\n",
            'content' => $body,
            'timeout' => 25,
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

function opay_append_activity(array &$pack, array $row): void
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

function opay_store_receipt(array &$pack, array $receipt): void
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

function opay_try_mail_receipt(array $cfg, array $receipt): array
{
    $o = opay_cfg($cfg);
    $to = trim((string)($receipt['payerEmail'] ?? ''));
    $bcc = $o['merchant_email'];
    $subject = 'Lvfe NCN receipt — ' . (int)($receipt['ncn'] ?? 0) . ' NCN';
    $body = "Lvfe: The Xperience\n\n"
        . "Credited: " . (int)($receipt['ncn'] ?? 0) . " NCN\n"
        . "Paid: " . ($receipt['paidLabel'] ?? '') . "\n"
        . "Reference: " . ($receipt['reference'] ?? '') . "\n"
        . "Provider: OPay\n"
        . "Settlement account: " . $o['payout_account'] . " (" . $o['payout_name'] . ")\n"
        . "At: " . ($receipt['at'] ?? gmdate('c')) . "\n";
    $headers = "From: Lvfe <noreply@iconiaglobal.com>\r\n";
    if ($bcc !== '' && filter_var($bcc, FILTER_VALIDATE_EMAIL)) {
        $headers .= "Bcc: {$bcc}\r\n";
    }
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return ['sent' => false, 'reason' => 'no_payer_email', 'stored' => true];
    }
    /* Prefer host mail(); Gmail API not wired unless GOOGLE_GMAIL_* exists later. */
    $ok = @mail($to, $subject, $body, $headers);
    return ['sent' => (bool)$ok, 'reason' => $ok ? 'php_mail' : 'mail_failed', 'stored' => true];
}

function opay_credit_save(string $saveDir, string $playerKey, int $ncn, string $ref, array $meta = []): array
{
    $key = safe_key($playerKey);
    if ($key === null) {
        return ['ok' => false, 'error' => 'bad_player'];
    }
    $walletKey = 'lvfe.nc.iou.v1.' . $key;
    $atomicAdd = $ncn * OPAY_ATOMIC_PER_COIN;
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
    $pack['purchases'][$ref] = array_merge([
        'ncn' => $ncn,
        'at' => gmdate('c'),
        'provider' => 'opay',
    ], $meta);
    opay_append_activity($pack, [
        'at' => gmdate('c'),
        'kind' => 'buy',
        'text' => 'Bought ' . $ncn . ' NCN (OPay)',
        'amount' => $ncn,
        'ref' => $ref,
    ]);
    $receipt = [
        'reference' => $ref,
        'ncn' => $ncn,
        'payerEmail' => (string)($meta['email'] ?? ''),
        'paidLabel' => (string)($meta['paidLabel'] ?? ''),
        'provider' => 'opay',
        'at' => gmdate('c'),
    ];
    opay_store_receipt($pack, $receipt);
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

function opay_handle_init(array $cfg, string $saveDir): void
{
    $status = opay_keys_status($cfg);
    if (!$status['configured']) {
        json_out(503, opay_blocker_payload());
    }
    $o = opay_cfg($cfg);
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
    $ncn = opay_clamp_ncn($body['ncnAmount'] ?? 1);
    $email = trim((string)($body['email'] ?? ''));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $email = $playerKey . '@lvfe.local';
    }
    $priced = opay_amount_minor($ncn, $cfg);
    $ref = opay_make_reference($playerKey);
    $returnUrl = trim((string)($body['returnUrl'] ?? 'https://iconiaglobal.com/lvfe/?buy=opay'));
    $callbackUrl = 'https://iconiaglobal.com/lvfe-save/v1/opay/webhook';
    $payload = [
        'country' => 'NG',
        'reference' => $ref,
        'amount' => [
            'total' => $priced['total'],
            'currency' => $priced['currency'],
        ],
        'returnUrl' => $returnUrl,
        'callbackUrl' => $callbackUrl,
        'cancelUrl' => $returnUrl,
        'displayName' => 'Lvfe NCN',
        'customerVisitSource' => 'BROWSER',
        'evokeOpay' => true,
        'expireAt' => 30,
        'userInfo' => [
            'userId' => $playerKey,
            'userEmail' => $email,
            'userName' => trim((string)($body['playerName'] ?? 'Lvfe player')),
        ],
        'product' => [
            'name' => $ncn . ' NCN',
            'description' => 'Lvfe NairaCoin — 1 NCN = USD $1',
        ],
    ];
    $jsonBody = json_encode($payload, JSON_UNESCAPED_SLASHES);
    $url = opay_base_url($o) . '/api/v1/international/cashier/create';
    $resp = opay_http_post($url, [
        'Authorization' => 'Bearer ' . $o['public_key'],
        'MerchantId' => $o['merchant_id'],
    ], $jsonBody);
    buy_write_pending($ref, [
        'reference' => $ref,
        'playerKey' => $playerKey,
        'ncnAmount' => $ncn,
        'amount' => $priced['total'],
        'currency' => $priced['currency'],
        'email' => $email,
        'provider' => 'opay',
        'status' => 'pending',
        'createdAt' => gmdate('c'),
        'opayCreate' => $resp,
    ]);
    $cashierUrl = '';
    if (is_array($resp)) {
        $data = $resp['data'] ?? $resp;
        if (is_array($data)) {
            $cashierUrl = (string)($data['cashierUrl'] ?? $data['url'] ?? $data['redirectUrl'] ?? '');
        }
    }
    if ($cashierUrl === '') {
        json_out(502, [
            'ok' => false,
            'code' => 'opay_create_failed',
            'error' => 'OPay cashier create failed — check sandbox keys / merchant ID.',
            'debug' => (isset($cfg['LVFE_ALLOW_DEV_AUTH']) && $cfg['LVFE_ALLOW_DEV_AUTH'] !== '0') ? $resp : null,
        ]);
    }
    json_out(200, [
        'ok' => true,
        'provider' => 'opay',
        'reference' => $ref,
        'ncnAmount' => $ncn,
        'amount' => $priced['total'],
        'currency' => $priced['currency'],
        'cashierUrl' => $cashierUrl,
        'payoutHint' => $o['payout_account'] . ' · ' . $o['payout_name'],
    ]);
}

function opay_handle_verify(array $cfg, string $saveDir): void
{
    $status = opay_keys_status($cfg);
    if (!$status['configured']) {
        json_out(503, opay_blocker_payload());
    }
    $o = opay_cfg($cfg);
    $raw = file_get_contents('php://input');
    $body = json_decode($raw ?: '{}', true);
    if (!is_array($body)) {
        json_out(400, ['ok' => false, 'error' => 'Invalid JSON']);
    }
    $ref = preg_replace('/[^a-zA-Z0-9._-]/', '', (string)($body['reference'] ?? ''));
    $playerKey = safe_key((string)($body['playerKey'] ?? ''));
    if ($ref === '' || $playerKey === null) {
        json_out(400, ['ok' => false, 'error' => 'reference and playerKey required']);
    }
    $auth = authorize($cfg, $playerKey);
    if (!$auth['ok']) {
        json_out((int)($auth['status'] ?? 401), [
            'ok' => false,
            'code' => $auth['code'] ?? 'unauthorized',
            'error' => $auth['error'] ?? 'unauthorized',
        ]);
    }
    $pending = buy_read_pending($ref);
    if (!$pending || ($pending['playerKey'] ?? '') !== $playerKey) {
        json_out(404, ['ok' => false, 'error' => 'Unknown payment reference']);
    }
    $statusPayload = json_encode(['reference' => $ref], JSON_UNESCAPED_SLASHES);
    $sig = opay_sign($statusPayload, $o['secret_key']);
    $url = opay_base_url($o) . '/api/v1/international/cashier/status';
    $resp = opay_http_post($url, [
        'Authorization' => 'Bearer ' . $sig,
        'MerchantId' => $o['merchant_id'],
    ], $statusPayload);
    $paid = false;
    $orderStatus = '';
    if (is_array($resp)) {
        $data = is_array($resp['data'] ?? null) ? $resp['data'] : $resp;
        $orderStatus = strtoupper((string)($data['status'] ?? $data['orderStatus'] ?? ''));
        $paid = in_array($orderStatus, ['SUCCESS', 'SUCCESSFUL', 'COMPLETED', 'PAID'], true);
    }
    if (!$paid) {
        json_out(402, [
            'ok' => false,
            'code' => 'not_paid',
            'error' => 'Payment not confirmed yet',
            'status' => $orderStatus,
        ]);
    }
    $ncn = (int)($pending['ncnAmount'] ?? 0);
    $credit = opay_credit_save($saveDir, $playerKey, $ncn, $ref, [
        'email' => $pending['email'] ?? '',
        'paidLabel' => ($pending['amount'] ?? '') . ' ' . ($pending['currency'] ?? ''),
    ]);
    $mail = opay_try_mail_receipt($cfg, $credit['receipt'] ?? [
        'reference' => $ref,
        'ncn' => $ncn,
        'payerEmail' => $pending['email'] ?? '',
        'paidLabel' => ($pending['amount'] ?? '') . ' ' . ($pending['currency'] ?? ''),
        'at' => gmdate('c'),
    ]);
    json_out(200, array_merge($credit, [
        'provider' => 'opay',
        'mail' => $mail,
    ]));
}

function opay_handle_webhook(array $cfg, string $saveDir): void
{
    $status = opay_keys_status($cfg);
    if (!$status['configured']) {
        json_out(503, opay_blocker_payload());
    }
    $raw = file_get_contents('php://input') ?: '';
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        json_out(400, ['ok' => false, 'error' => 'Invalid JSON']);
    }
    $data = is_array($body['payload'] ?? null) ? $body['payload'] : $body;
    if (isset($data['data']) && is_array($data['data'])) {
        $data = $data['data'];
    }
    $ref = preg_replace('/[^a-zA-Z0-9._-]/', '', (string)($data['reference'] ?? $body['reference'] ?? ''));
    $orderStatus = strtoupper((string)($data['status'] ?? $data['orderStatus'] ?? ''));
    if ($ref === '' || !in_array($orderStatus, ['SUCCESS', 'SUCCESSFUL', 'COMPLETED', 'PAID'], true)) {
        json_out(200, ['ok' => true, 'ignored' => true]);
    }
    $pending = buy_read_pending($ref);
    if (!$pending) {
        json_out(200, ['ok' => true, 'ignored' => true, 'reason' => 'no_pending']);
    }
    $playerKey = (string)($pending['playerKey'] ?? '');
    $ncn = (int)($pending['ncnAmount'] ?? 0);
    $credit = opay_credit_save($saveDir, $playerKey, $ncn, $ref, [
        'email' => $pending['email'] ?? '',
        'paidLabel' => ($pending['amount'] ?? '') . ' ' . ($pending['currency'] ?? ''),
        'via' => 'webhook',
    ]);
    if (!empty($credit['receipt'])) {
        opay_try_mail_receipt($cfg, $credit['receipt']);
    }
    json_out(200, ['ok' => true, 'credited' => !empty($credit['ok']), 'reference' => $ref]);
}
