<?php
/**
 * P2P NCN transfer — server-authoritative when both players have cloud packs.
 * Debit sender wallet; credit receiver; ledger in both activity logs.
 */
declare(strict_types=1);

const P2P_ATOMIC_PER_COIN = 100000000;
const P2P_MIN = 1;
const P2P_MAX = 1000000;

function p2p_wallet_key(string $playerKey): string
{
    return 'lvfe.nc.iou.v1.' . $playerKey;
}

function p2p_append_activity(array &$pack, array $row): void
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

function p2p_find_by_username(string $saveDir, string $name): ?string
{
    $want = strtolower(trim($name));
    if ($want === '') {
        return null;
    }
    $mapPath = $saveDir . '/../username-map.json';
    /* username-map lives next to data/ or in save dir parent */
    $candidates = [
        dirname($saveDir) . '/username-map.json',
        $saveDir . '/username-map.json',
        __DIR__ . '/data/username-map.json',
    ];
    foreach ($candidates as $path) {
        if (!is_file($path)) {
            continue;
        }
        $raw = file_get_contents($path);
        $map = json_decode($raw ?: 'null', true);
        if (!is_array($map)) {
            continue;
        }
        foreach ($map as $uname => $row) {
            if (strtolower((string)$uname) === $want) {
                $sub = is_array($row) ? (string)($row['googleSub'] ?? $row['playerKey'] ?? '') : (string)$row;
                if ($sub !== '') {
                    if (str_starts_with($sub, 'g')) {
                        return safe_key($sub);
                    }
                    $pk = 'g' . preg_replace('/[^a-zA-Z0-9]/', '', $sub);
                    return safe_key(substr($pk, 0, 32));
                }
            }
        }
    }
    /* Scan save packs for identity playerName (bounded). */
    $files = glob($saveDir . '/*.json') ?: [];
    $n = 0;
    foreach ($files as $file) {
        if ($n++ > 400) {
            break;
        }
        $raw = file_get_contents($file);
        $doc = json_decode($raw ?: 'null', true);
        if (!is_array($doc) || !is_array($doc['pack'] ?? null)) {
            continue;
        }
        $pack = $doc['pack'];
        $idents = $pack['identity'] ?? [];
        if (!is_array($idents)) {
            continue;
        }
        foreach ($idents as $idRow) {
            if (!is_array($idRow)) {
                continue;
            }
            if (strtolower((string)($idRow['playerName'] ?? '')) === $want) {
                $pk = safe_key((string)($pack['playerKey'] ?? $doc['accountKey'] ?? ''));
                if ($pk) {
                    return $pk;
                }
            }
        }
    }
    return null;
}

function p2p_resolve_to(string $saveDir, string $toRaw): ?string
{
    $to = trim($toRaw);
    if ($to === '') {
        return null;
    }
    if (preg_match('/^g[0-9A-Za-z]{6,}$/', $to)) {
        return safe_key($to);
    }
    $byName = p2p_find_by_username($saveDir, $to);
    if ($byName) {
        return $byName;
    }
    /* Direct key attempt */
    return safe_key($to);
}

function p2p_handle_transfer(array $cfg, string $saveDir): void
{
    $raw = file_get_contents('php://input');
    $body = json_decode($raw ?: '{}', true);
    if (!is_array($body)) {
        json_out(400, ['ok' => false, 'error' => 'Invalid JSON']);
    }
    $from = safe_key((string)($body['fromPlayerKey'] ?? $body['playerKey'] ?? ''));
    if ($from === null) {
        json_out(400, ['ok' => false, 'error' => 'fromPlayerKey required']);
    }
    $auth = authorize($cfg, $from);
    if (!$auth['ok']) {
        json_out((int)($auth['status'] ?? 401), [
            'ok' => false,
            'code' => $auth['code'] ?? 'unauthorized',
            'error' => $auth['error'] ?? 'unauthorized',
        ]);
    }
    $amount = (int)floor((float)($body['ncnAmount'] ?? $body['amount'] ?? 0));
    if ($amount < P2P_MIN || $amount > P2P_MAX) {
        json_out(400, ['ok' => false, 'error' => 'Amount out of range']);
    }
    $to = p2p_resolve_to($saveDir, (string)($body['to'] ?? $body['toUsername'] ?? $body['toPlayerKey'] ?? ''));
    if ($to === null) {
        json_out(404, ['ok' => false, 'code' => 'receiver_not_found', 'error' => 'No player with that handle']);
    }
    if ($to === $from) {
        json_out(400, ['ok' => false, 'error' => "Can't send to yourself"]);
    }
    $fromDoc = read_doc($saveDir, $from);
    $toDoc = read_doc($saveDir, $to);
    if (!$toDoc || !is_array($toDoc['pack'] ?? null)) {
        json_out(404, [
            'ok' => false,
            'code' => 'receiver_offline',
            'error' => 'Receiver has no cloud save yet — they need Sign in + Sync once.',
        ]);
    }
    $fromPack = is_array($fromDoc['pack'] ?? null) ? $fromDoc['pack'] : [
        'kind' => PACK_KIND,
        'v' => 1,
        'playerKey' => $from,
        'wallets' => [],
        'activity' => ['items' => []],
    ];
    $toPack = $toDoc['pack'];
    $fwk = p2p_wallet_key($from);
    $twk = p2p_wallet_key($to);
    if (!isset($fromPack['wallets']) || !is_array($fromPack['wallets'])) {
        $fromPack['wallets'] = [];
    }
    if (!isset($toPack['wallets']) || !is_array($toPack['wallets'])) {
        $toPack['wallets'] = [];
    }
    $fw = is_array($fromPack['wallets'][$fwk] ?? null) ? $fromPack['wallets'][$fwk] : ['atomic' => 0, 'unit' => 'atomic'];
    $tw = is_array($toPack['wallets'][$twk] ?? null) ? $toPack['wallets'][$twk] : ['atomic' => 0, 'unit' => 'atomic'];
    $need = $amount * P2P_ATOMIC_PER_COIN;
    $have = (int)($fw['atomic'] ?? 0);
    if ($have < $need) {
        json_out(402, ['ok' => false, 'code' => 'insufficient', 'error' => 'Not enough NCN']);
    }
    $ref = 'p2p_' . substr($from, 0, 8) . '_' . bin2hex(random_bytes(4));
    $fw['atomic'] = $have - $need;
    $tw['atomic'] = (int)($tw['atomic'] ?? 0) + $need;
    $fromPack['wallets'][$fwk] = $fw;
    $toPack['wallets'][$twk] = $tw;
    $toName = '';
    $idents = $toPack['identity'] ?? [];
    if (is_array($idents)) {
        foreach ($idents as $row) {
            if (is_array($row) && !empty($row['playerName'])) {
                $toName = (string)$row['playerName'];
                break;
            }
        }
    }
    $fromName = '';
    $fidents = $fromPack['identity'] ?? [];
    if (is_array($fidents)) {
        foreach ($fidents as $row) {
            if (is_array($row) && !empty($row['playerName'])) {
                $fromName = (string)$row['playerName'];
                break;
            }
        }
    }
    $at = gmdate('c');
    p2p_append_activity($fromPack, [
        'at' => $at,
        'kind' => 'p2p_send',
        'text' => 'Sent ' . $amount . ' NCN to ' . ($toName !== '' ? $toName : $to),
        'amount' => -$amount,
        'to' => $to,
        'ref' => $ref,
    ]);
    p2p_append_activity($toPack, [
        'at' => $at,
        'kind' => 'p2p_receive',
        'text' => 'Received ' . $amount . ' NCN from ' . ($fromName !== '' ? $fromName : $from),
        'amount' => $amount,
        'from' => $from,
        'ref' => $ref,
    ]);
    $fromPack['updatedAt'] = $at;
    $toPack['updatedAt'] = $at;
    $fromPack['playerKey'] = $from;
    $toPack['playerKey'] = $to;
    write_doc($saveDir, $from, [
        'accountKey' => $from,
        'updatedAt' => $at,
        'pack' => $fromPack,
        'savedAt' => $at,
    ]);
    write_doc($saveDir, $to, [
        'accountKey' => $to,
        'updatedAt' => $at,
        'pack' => $toPack,
        'savedAt' => $at,
    ]);
    json_out(200, [
        'ok' => true,
        'ncnAmount' => $amount,
        'fromPlayerKey' => $from,
        'toPlayerKey' => $to,
        'toName' => $toName,
        'ref' => $ref,
        'fromAtomic' => $fw['atomic'],
        'toAtomic' => $tw['atomic'],
    ]);
}
