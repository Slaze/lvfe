#!/usr/bin/env bash
# Stage installable PWA tree for https://iconiaglobal.com/lvfe/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$ROOT/dist/pwa}"

rm -rf "$DEST"
mkdir -p "$DEST/data" "$DEST/geojson"

cp -R "$ROOT/web/." "$DEST/"
cp "$ROOT/data/places.geojson" "$DEST/data/places.geojson"
cp "$ROOT/data/catalog.json" "$DEST/data/catalog.json"
cp "$ROOT/geojson/enugu-factions.geojson" "$DEST/geojson/enugu-factions.geojson"
cp "$ROOT/hosting/lvfe/.htaccess" "$DEST/.htaccess"

# Drop leftover AR demo page weight is fine; keep parity with sync-www.
echo "stage_pwa: $DEST"
