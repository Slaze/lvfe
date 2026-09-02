#!/usr/bin/env python3
"""Export player-facing catalog JSON/CSV from sqlite (or GeoJSON fallback).

claim_nairacoin in this dump is the **min stake** for ownable pins
(scripts/claim_points.py). Banks/ATMs export 0. Not extractive XP.
"""

from __future__ import annotations

import csv
import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from claim_points import CATCHALL_TERRITORY, claim_points

DATA = ROOT / "data"
DB = DATA / "lvfe.sqlite"
GEOJSON = DATA / "places.geojson"
OUT_JSON = DATA / "catalog.json"
OUT_CSV = DATA / "catalog.csv"

NO_FARM = {"bank", "atm"}

TYPE_LABELS = {
    "market": "Market",
    "shop": "Shop",
    "mall": "Mall",
    "food": "Food",
    "bank": "Bank",
    "atm": "ATM",
    "pharmacy": "Pharmacy",
    "fuel": "Fuel station",
    "transit": "Transit",
    "park": "Park",
    "pitch": "Pitch",
    "worship": "Worship",
    "school": "School",
    "hospital": "Hospital",
    "civic": "Civic",
    "civic_unknown": "Unidentified building",
    "hotel": "Hotel",
    "landmark": "Landmark",
    "ruin": "Ruin",
    "unmapped": "Unmapped",
}


def player_nairacoin(ctype: str, pts) -> int:
    if ctype in NO_FARM:
        return 0
    return int(pts)


def from_sqlite() -> list[dict]:
    conn = sqlite3.connect(DB)
    rows = conn.execute(
        """
        SELECT p.id, p.display_name, p.catalog_type, p.quality, p.claim_points,
               p.territory_id, p.lat, p.lon, t.name AS territory_name, t.role AS territory_role
        FROM places p
        LEFT JOIN territories t ON t.id = p.territory_id
        """
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        tid = r[5] or CATCHALL_TERRITORY
        role = r[9] or "unclaimed"
        ctype = r[2]
        quality = r[3]
        pts = r[4] if r[4] is not None else claim_points(ctype, quality, role)
        out.append(
            {
                "id": r[0],
                "name": r[1] or f"Unnamed {ctype}",
                "catalog_type": ctype,
                "catalog_label": TYPE_LABELS.get(ctype, ctype),
                "quality": quality,
                "territory_id": tid,
                "territory_name": r[8] or "Unclaimed area",
                "territory_role": role,
                "claim_nairacoin": player_nairacoin(ctype, pts),
                "lat": r[6],
                "lon": r[7],
            }
        )
    return out


def from_geojson() -> list[dict]:
    fc = json.loads(GEOJSON.read_text())
    out = []
    for f in fc.get("features", []):
        p = f["properties"]
        g = f["geometry"]["coordinates"]
        ctype = p["catalog_type"]
        role = p.get("territory_role") or "unclaimed"
        quality = p["quality"]
        pts = p.get("claim_points")
        if pts is None:
            pts = claim_points(ctype, quality, role)
        out.append(
            {
                "id": p["id"],
                "name": p.get("name") or f"Unnamed {ctype}",
                "catalog_type": ctype,
                "catalog_label": TYPE_LABELS.get(ctype, ctype),
                "quality": quality,
                "territory_id": p.get("territory_id") or CATCHALL_TERRITORY,
                "territory_name": p.get("territory_name") or "Unclaimed area",
                "territory_role": role,
                "claim_nairacoin": player_nairacoin(ctype, pts),
                "lat": g[1],
                "lon": g[0],
            }
        )
    return out


def payload(places: list[dict]) -> dict:
    return {
        "currency": "NairaCoin",
        "unit": "NairaCoin",
        "claim_radius_m": 80,
        "formula": "ownable min stake: round(BASE[type] * QUALITY[q] * ROLE[role]), min 1; bank/atm 0",
        "count": len(places),
        "places": places,
    }


def write_csv(places: list[dict]) -> None:
    fields = [
        "id",
        "name",
        "catalog_type",
        "catalog_label",
        "quality",
        "territory_id",
        "territory_name",
        "territory_role",
        "claim_nairacoin",
        "lat",
        "lon",
    ]
    with OUT_CSV.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        for row in places:
            w.writerow(row)


def main() -> None:
    DATA.mkdir(exist_ok=True)
    if DB.exists():
        places = from_sqlite()
        src = "sqlite"
    elif GEOJSON.exists():
        places = from_geojson()
        src = "geojson"
    else:
        raise SystemExit("Need data/lvfe.sqlite or data/places.geojson")
    OUT_JSON.write_text(json.dumps(payload(places), separators=(",", ":")))
    write_csv(places)
    print(f"{len(places)} places from {src} → {OUT_JSON.name} + {OUT_CSV.name}", file=sys.stderr)


if __name__ == "__main__":
    main()
