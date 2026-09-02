"""Slaze/nairacoin units (src/CryptoNoteConfig.h). Not a running daemon.

Python mirror of web/nairacoin/protocol.js. Sibling game code should prefer
the JS ledger (getBalance/credit/debit in atomic units).
"""

CRYPTONOTE_NAME = "nairacoin"
PLAYER_FACING_NAME = "NairaCoin"
CRYPTONOTE_DISPLAY_DECIMAL_POINT = 8
ATOMIC_PER_COIN = 10 ** CRYPTONOTE_DISPLAY_DECIMAL_POINT
CRYPTONOTE_PUBLIC_ADDRESS_BASE58_PREFIX = 0x2
ADDRESS_PREFIX_HINT = "f"
ADDRESS_KIND = "iou-stub"
MINIMUM_FEE_ATOMIC = 100000
P2P_DEFAULT_PORT = 17356
RPC_DEFAULT_PORT = 18357
DAEMON_BIN = "nairacoind"
GENESIS_COINBASE_TX_HEX = ""
CHAIN_LAUNCHED = bool(GENESIS_COINBASE_TX_HEX)
SEED_HOST = "nairacoin.iconiaglobal.com"
SEED_NODES = ["nairacoin.iconiaglobal.com:17356", "127.0.0.1:17356"]
SEED_ORIGIN_A = "198.54.120.94"
P2P_LISTENING = False
FAUCET_WHOLE = 100  # demo faucet IOU only — not earned chain coins
FAUCET_ATOMIC = FAUCET_WHOLE * ATOMIC_PER_COIN
FAUCET_LABEL = "demo faucet"
UPSTREAM = "https://github.com/Slaze/nairacoin"
UPSTREAM_COMMIT = "6ac59523227a03414e6af60a979fd31577dd15d0"


def whole_to_atomic(whole: int) -> int:
    return int(whole) * ATOMIC_PER_COIN


def atomic_to_whole(atomic: int) -> int:
    return int(atomic) // ATOMIC_PER_COIN


def _fnv1a32(s: str) -> int:
    h = 0x811C9DC5
    for ch in s:
        h ^= ord(ch) & 0xFFFF
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def account_address(player_id: str) -> str:
    """Local IOU stub: 'f' + 8 hex + 4 hex checksum. Not a CryptoNote spend address."""
    pid = (player_id or "default")[:32]
    body = f"{_fnv1a32('lvfe-iou|' + pid):08x}"
    chk = f"{_fnv1a32('f' + body):08x}"[:4]
    return "f" + body + chk


def get_balance(store: dict, player_id: str) -> int:
    """Atomic balance from an in-memory dict {player_id: atomic}."""
    return int(store.get(player_id, 0) or 0)


def credit(store: dict, player_id: str, atomic: int) -> bool:
    n = int(atomic)
    if n <= 0 or not player_id:
        return False
    store[player_id] = get_balance(store, player_id) + n
    return True


def debit(store: dict, player_id: str, atomic: int) -> bool:
    n = int(atomic)
    if n <= 0:
        return False
    have = get_balance(store, player_id)
    if have < n:
        return False
    store[player_id] = have - n
    return True
