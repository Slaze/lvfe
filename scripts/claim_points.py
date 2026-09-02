"""Min stake for ownable pins. Used by ingest, export, and the map.

Not claim XP and not a visitor payout. Banks/ATMs keep an internal formula
for ingest; player-facing NairaCoin is 0 (not ownable, not farmable).
"""

BASE = {
    "market": 50,
    "shop": 35,
    "mall": 45,
    "food": 40,
    "bank": 25,
    "atm": 10,
    "pharmacy": 30,
    "fuel": 20,
    "transit": 15,
    "park": 20,
    "pitch": 35,
    "worship": 25,
    "school": 20,
    "hospital": 20,
    "civic": 30,
    "civic_unknown": 15,
    "hotel": 30,
    "landmark": 50,
    "ruin": 40,
    "unmapped": 12,
}

QUALITY = {"A": 1.25, "B": 1.0, "C": 0.7, "D": 0.55}

# Unclaimed (named neighbourhood or hinterland) raises min stake.
ROLE = {
    "playable_faction": 1.0,
    "prize_zone": 1.5,
    "unclaimed": 1.2,
}

CATCHALL_TERRITORY = "unclaimed"


def claim_points(catalog_type: str, quality: str, territory_role: str) -> int:
    base = BASE.get(catalog_type, 20)
    q = QUALITY.get(quality, 1.0)
    r = ROLE.get(territory_role or "unclaimed", 1.2)
    return max(1, round(base * q * r))
