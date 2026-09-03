#!/usr/bin/env bash
# Refresh Enugu claim catalog from Overpass (roads/places/names).
# No cron by default — run manually or wire host cron weekly.
# Usage: ./scripts/refresh_enugu_catalog.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== Overpass ingest (Enugu bbox) =="
python3 scripts/ingest_places.py

echo "== Claim points =="
python3 scripts/claim_points.py

echo "== Export catalog.json + csv =="
python3 scripts/export_catalog.py

# Local rename patches that OSM may lag on
python3 - <<'PY'
from pathlib import Path
for rel in ("data/catalog.json", "data/places.geojson"):
    p = Path(rel)
    if not p.is_file():
        continue
    t = p.read_text(encoding="utf-8")
    n = t.replace("City Park Luxury Hotel", "Asabana Hotel").replace("City Park Hotel", "Asabana Hotel")
    if n != t:
        p.write_text(n, encoding="utf-8")
        print("patched", rel, "City Park → Asabana Hotel")
    else:
        print("ok", rel)
PY

echo "== Done. Stage PWA / sync-www to ship. =="
echo "Cadence: manual or weekly cron; world Overpass in-app still refreshes ~45s / 30min cell cache."
