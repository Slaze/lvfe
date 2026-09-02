#!/usr/bin/env python3
"""Overpass → cluster → SQLite places catalog. No paid APIs."""

from __future__ import annotations

import argparse
import json
import math
import sqlite3
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from claim_points import CATCHALL_TERRITORY, claim_points

GEOJSON = ROOT / "geojson" / "enugu-factions.geojson"
SCHEMA = ROOT / "schema" / "places.sql"
DATA = ROOT / "data"
CACHE = DATA / "overpass-enugu-pois.json"
DB = DATA / "lvfe.sqlite"
OVERPASS = "https://overpass-api.de/api/interpreter"
UA = "LvfeXperience/0.2 (catalog ingest; OSM ODbL)"
CLUSTER_M = 80
SKIP_AMENITY = {
    "parking",
    "toilets",
    "bicycle_parking",
    "mortuary",
    "veterinary",
}

FOOD = {"restaurant", "bar", "cafe", "fast_food", "food_court"}
SCHOOL = {"school", "college", "university", "kindergarten", "driving_school"}
HOSPITAL_AMENITY = {"hospital", "clinic", "doctors", "dentist"}
HOSPITAL_HEALTH = {"hospital", "clinic", "laboratory"}
PARK = {"park", "garden"}
PITCH = {"pitch", "sports_centre", "stadium", "golf_course", "swimming_pool"}
HOTEL = {"hotel", "guest_house", "hostel", "apartment", "camp_site", "resort"}
LANDMARK = {"museum", "artwork", "attraction"}
CIVIC_AMENITY = {
    "police",
    "fire_station",
    "post_office",
    "library",
    "community_centre",
    "events_venue",
    "townhall",
    "courthouse",
}
CIVIC_OFFICE = {"government", "ngo", "lawyer", "political_party", "water_utility"}


def haversine_m(lat1, lon1, lat2, lon2) -> float:
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def pip(lon, lat, ring) -> bool:
    inside = False
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1 + 1e-18) + x1:
            inside = not inside
    return inside


def shoelace_abs(ring) -> float:
    s = 0.0
    for i in range(len(ring) - 1):
        s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return abs(s) / 2


def load_territories():
    fc = json.loads(GEOJSON.read_text())
    out = []
    for feat in fc["features"]:
        ring = [(c[0], c[1]) for c in feat["geometry"]["coordinates"][0]]
        out.append(
            {
                "id": feat["id"],
                "ring": ring,
                "area": shoelace_abs(ring),
                "role": feat["properties"].get("role", "unclaimed"),
            }
        )
    out.sort(key=lambda t: t["area"])
    return out, fc


def bbox_from_territories(territories, pad=0.01):
    lons, lats = [], []
    for t in territories:
        for lon, lat in t["ring"]:
            lons.append(lon)
            lats.append(lat)
    return min(lats) - pad, min(lons) - pad, max(lats) + pad, max(lons) + pad


def smallest_territory(lon, lat, territories):
    hits = [t for t in territories if pip(lon, lat, t["ring"])]
    if not hits:
        return CATCHALL_TERRITORY
    return hits[0]["id"]


def overpass_ql(s, w, n, e) -> str:
    bbox = f"({s:.5f},{w:.5f},{n:.5f},{e:.5f})"
    return f"""[out:json][timeout:120];
(
  node["amenity"]{bbox};
  way["amenity"]{bbox};
  node["shop"]{bbox};
  way["shop"]{bbox};
  node["leisure"]{bbox};
  way["leisure"]{bbox};
  node["tourism"]{bbox};
  way["tourism"]{bbox};
  node["office"]{bbox};
  way["office"]{bbox};
  node["healthcare"]{bbox};
  way["healthcare"]{bbox};
  node["highway"="bus_stop"]{bbox};
  node["shop"="vacant"]{bbox};
  way["shop"="vacant"]{bbox};
);
out center tags;
"""


def fetch_overpass(ql: str) -> dict:
    req = urllib.request.Request(
        OVERPASS,
        data=("data=" + urllib.parse.quote(ql)).encode(),
        headers={"User-Agent": UA},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode())


def coords(el) -> tuple[float, float] | None:
    if "lat" in el and "lon" in el:
        return float(el["lat"]), float(el["lon"])
    c = el.get("center")
    if c and "lat" in c and "lon" in c:
        return float(c["lat"]), float(c["lon"])
    return None


def norm_name(name: str | None) -> str | None:
    if not name:
        return None
    s = "".join(ch.lower() if ch.isalnum() or ch.isspace() else " " for ch in name)
    s = " ".join(s.split())
    return s or None


def is_ruin(tags: dict) -> bool:
    if tags.get("shop") == "vacant":
        return True
    if tags.get("opening_hours") == "closed":
        return True
    for k, v in tags.items():
        if k.startswith("disused:") or k.startswith("abandoned:"):
            return True
        if k in ("disused", "abandoned") and v in ("yes", "true"):
            return True
    return False


def classify(tags: dict) -> str | None:
    if is_ruin(tags):
        return "ruin"
    amenity = tags.get("amenity")
    if amenity in SKIP_AMENITY:
        return None
    shop = tags.get("shop")
    leisure = tags.get("leisure")
    tourism = tags.get("tourism")
    office = tags.get("office")
    healthcare = tags.get("healthcare")
    highway = tags.get("highway")

    if amenity == "marketplace":
        return "market"
    if shop == "mall":
        return "mall"
    if shop and shop != "mall":
        return "shop"
    if amenity in FOOD:
        return "food"
    if amenity == "atm":
        return "atm"
    if amenity == "bank":
        return "bank"
    if amenity == "pharmacy" or healthcare == "pharmacy":
        return "pharmacy"
    if amenity == "fuel":
        return "fuel"
    if highway == "bus_stop" or amenity in {"bus_station", "taxi"}:
        return "transit"
    if leisure in PARK:
        return "park"
    if leisure in PITCH:
        return "pitch"
    if amenity == "place_of_worship":
        return "worship"
    if amenity in SCHOOL:
        return "school"
    if amenity in HOSPITAL_AMENITY or healthcare in HOSPITAL_HEALTH:
        return "hospital"
    if tourism in LANDMARK:
        return "landmark"
    if tourism in HOTEL or leisure == "resort":
        return "hotel"
    if amenity in CIVIC_AMENITY or office in CIVIC_OFFICE:
        return "civic" if tags.get("name") else "civic_unknown"
    if amenity == "public_building" or office in {"yes", "sitout"}:
        return "civic" if tags.get("name") else "civic_unknown"
    if amenity == "studio":
        return "shop"
    return None


def quality(catalog_type: str, has_name: bool, has_type: bool, has_photo: bool) -> str:
    if catalog_type == "civic_unknown":
        return "D"
    if not has_name:
        return "C"
    if has_name and has_type and has_photo:
        return "A"
    return "B"


def place_id(osm_type: str, osm_id: int) -> str:
    return f"{osm_type[0]}_{osm_id}"


def extract_rows(payload: dict) -> list[dict]:
    rows = []
    seen = set()
    for el in payload.get("elements", []):
        tags = el.get("tags") or {}
        xy = coords(el)
        if not xy:
            continue
        lat, lon = xy
        ctype = classify(tags)
        if not ctype:
            continue
        osm_type = el["type"]
        osm_id = int(el["id"])
        key = (osm_type, osm_id)
        if key in seen:
            continue
        seen.add(key)
        name = tags.get("name")
        rows.append(
            {
                "osm_type": osm_type,
                "osm_id": osm_id,
                "lat": lat,
                "lon": lon,
                "name": name,
                "norm": norm_name(name),
                "catalog_type": ctype,
                "opening_hours": tags.get("opening_hours"),
                "tags": tags,
            }
        )
    return rows


def cluster(rows: list[dict]) -> list[list[dict]]:
    """Named same-type within CLUSTER_M fuse. Unnamed stay singleton."""
    named = [r for r in rows if r["norm"]]
    unnamed = [r for r in rows if not r["norm"]]
    groups: list[list[dict]] = []
    used = [False] * len(named)
    by_key = defaultdict(list)
    for i, r in enumerate(named):
        by_key[(r["catalog_type"], r["norm"])].append(i)
    for key, idxs in by_key.items():
        for i in idxs:
            if used[i]:
                continue
            g = [named[i]]
            used[i] = True
            for j in idxs:
                if used[j]:
                    continue
                if haversine_m(named[i]["lat"], named[i]["lon"], named[j]["lat"], named[j]["lon"]) <= CLUSTER_M:
                    g.append(named[j])
                    used[j] = True
            groups.append(g)
    for r in unnamed:
        groups.append([r])
    return groups


def pick_primary(members: list[dict]) -> dict:
    named = [m for m in members if m["name"]]
    pool = named or members
    return min(pool, key=lambda m: (m["osm_type"] != "node", m["osm_id"]))


def ingest(db: sqlite3.Connection, groups: list[list[dict]], territories) -> None:
    db.execute("DELETE FROM place_edits")
    db.execute("DELETE FROM place_photos")
    db.execute("DELETE FROM place_osm_links")
    db.execute("DELETE FROM places")
    roles = {t["id"]: t["role"] for t in territories}
    roles[CATCHALL_TERRITORY] = "unclaimed"
    n_places = 0
    for members in groups:
        primary = pick_primary(members)
        lat = sum(m["lat"] for m in members) / len(members)
        lon = sum(m["lon"] for m in members) / len(members)
        tid = smallest_territory(lon, lat, territories)
        role = roles.get(tid, "unclaimed")
        has_name = 1 if primary["name"] else 0
        has_type = 0 if primary["catalog_type"] in {"civic_unknown", "unmapped"} else 1
        has_photo = 0
        q = quality(primary["catalog_type"], bool(has_name), bool(has_type), bool(has_photo))
        pts = claim_points(primary["catalog_type"], q, role)
        pid = place_id(primary["osm_type"], primary["osm_id"])
        db.execute(
            """
            INSERT INTO places (
              id, display_name, catalog_type, quality, territory_id,
              lat, lon, osm_type, osm_id, source,
              has_name, has_type, has_photo, opening_hours, cluster_radius_m, claim_points
            ) VALUES (?,?,?,?,?,?,?,?,?,'osm',?,?,?,?,?,?)
            """,
            (
                pid,
                primary["name"],
                primary["catalog_type"],
                q,
                tid,
                lat,
                lon,
                primary["osm_type"],
                primary["osm_id"],
                has_name,
                has_type,
                has_photo,
                primary["opening_hours"],
                CLUSTER_M,
                pts,
            ),
        )
        for m in members:
            db.execute(
                """
                INSERT INTO place_osm_links (
                  place_id, osm_type, osm_id, osm_name, osm_tags_json, is_primary
                ) VALUES (?,?,?,?,?,?)
                """,
                (
                    pid,
                    m["osm_type"],
                    m["osm_id"],
                    m["name"],
                    json.dumps(m["tags"], ensure_ascii=False),
                    1 if m is primary else 0,
                ),
            )
        n_places += 1
    db.commit()
    return n_places


def report(db: sqlite3.Connection) -> str:
    lines = []
    total = db.execute("SELECT COUNT(*) FROM places").fetchone()[0]
    links = db.execute("SELECT COUNT(*) FROM place_osm_links").fetchone()[0]
    fused = db.execute(
        "SELECT COUNT(*) FROM (SELECT place_id FROM place_osm_links GROUP BY place_id HAVING COUNT(*)>1)"
    ).fetchone()[0]
    lines.append(f"places={total} osm_objects={links} fused_clusters={fused}")
    lines.append("\nquality × type")
    lines.append(f"{'type':16} {'A':>5} {'B':>5} {'C':>5} {'D':>5} {'n':>5}")
    qmap = defaultdict(lambda: {"A": 0, "B": 0, "C": 0, "D": 0})
    for ctype, q, n in db.execute(
        "SELECT catalog_type, quality, COUNT(*) FROM places GROUP BY 1,2"
    ):
        qmap[ctype][q] = n
    for ctype in sorted(qmap):
        r = qmap[ctype]
        lines.append(f"{ctype:16} {r['A']:5d} {r['B']:5d} {r['C']:5d} {r['D']:5d} {sum(r.values()):5d}")
    lines.append("\nterritory × quality")
    lines.append(f"{'territory':24} {'A':>5} {'B':>5} {'C':>5} {'D':>5} {'n':>5}")
    tmap = defaultdict(lambda: {"A": 0, "B": 0, "C": 0, "D": 0})
    for tid, q, n in db.execute(
        "SELECT COALESCE(territory_id,'unclaimed'), quality, COUNT(*) FROM places GROUP BY 1,2"
    ):
        tmap[tid][q] = n
    for tid in sorted(tmap):
        r = tmap[tid]
        lines.append(f"{tid:24} {r['A']:5d} {r['B']:5d} {r['C']:5d} {r['D']:5d} {sum(r.values()):5d}")
    return "\n".join(lines)


def export_places_geojson(db: sqlite3.Connection) -> None:
    rows = db.execute(
        """
        SELECT p.id, p.display_name, p.catalog_type, p.quality, p.claim_points,
               p.territory_id, p.lat, p.lon, t.name AS territory_name, t.role AS territory_role
        FROM places p
        LEFT JOIN territories t ON t.id = p.territory_id
        """
    ).fetchall()
    fc = {
        "type": "FeatureCollection",
        "name": "lvfe-places",
        "features": [],
    }
    for r in rows:
        tid = r[5] or CATCHALL_TERRITORY
        role = r[9] or "unclaimed"
        name = r[1] or f"Unnamed {r[2]}"
        fc["features"].append(
            {
                "type": "Feature",
                "id": r[0],
                "properties": {
                    "id": r[0],
                    "name": name,
                    "catalog_type": r[2],
                    "quality": r[3],
                    "claim_points": r[4],
                    "territory_id": tid,
                    "territory_name": r[8] or "Unclaimed area",
                    "territory_role": role,
                },
                "geometry": {"type": "Point", "coordinates": [r[7], r[6]]},
            }
        )
    path = DATA / "places.geojson"
    path.write_text(json.dumps(fc))
    print(f"exported {len(fc['features'])} → {path}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="Ingest OSM POIs into Lvfe catalog")
    parser.add_argument("--cache-only", action="store_true", help="Reuse cached Overpass JSON")
    args = parser.parse_args()
    DATA.mkdir(exist_ok=True)
    territories, _ = load_territories()
    s, w, n, e = bbox_from_territories(territories)
    if args.cache_only and CACHE.exists():
        payload = json.loads(CACHE.read_text())
    else:
        ql = overpass_ql(s, w, n, e)
        print(f"Overpass bbox {s:.4f},{w:.4f},{n:.4f},{e:.4f}", file=sys.stderr)
        payload = fetch_overpass(ql)
        CACHE.write_text(json.dumps(payload))
        print(f"cached {len(payload.get('elements', []))} elements → {CACHE}", file=sys.stderr)
    rows = extract_rows(payload)
    groups = cluster(rows)
    if DB.exists():
        DB.unlink()
    conn = sqlite3.connect(DB)
    conn.executescript(SCHEMA.read_text())
    ingest(conn, groups, territories)
    text = report(conn)
    print(text)
    (DATA / "ingest-report.txt").write_text(text + "\n")
    export_places_geojson(conn)
    conn.close()
    print(f"\nDB {DB}", file=sys.stderr)


if __name__ == "__main__":
    main()
