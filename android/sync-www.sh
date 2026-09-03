#!/usr/bin/env bash
# Copy the static web app + catalog geojson into the APK assets.
# MapLibre JS/CSS is vendored so the Nord does not need unpkg; OpenFreeMap tiles still need the network.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/android/app/src/main/assets/www"
CACHE="$ROOT/android/.cache/maplibre"
ML_VER="5.6.1"
THREE_VER="0.160.1"

rm -rf "$DEST"
mkdir -p "$DEST/data" "$DEST/geojson" "$DEST/vendor" "$CACHE"

cp -R "$ROOT/web/." "$DEST/"
cp "$ROOT/data/places.geojson" "$DEST/data/places.geojson"
cp "$ROOT/data/catalog.json" "$DEST/data/catalog.json"
cp "$ROOT/geojson/enugu-factions.geojson" "$DEST/geojson/enugu-factions.geojson"

fetch_ml() {
  local name="$1"
  local out="$CACHE/$name"
  if [[ -s "$out" ]]; then
    return 0
  fi
  local urls=(
    "https://cdn.jsdelivr.net/npm/maplibre-gl@${ML_VER}/dist/${name}"
    "https://unpkg.com/maplibre-gl@${ML_VER}/dist/${name}"
  )
  local u
  for u in "${urls[@]}"; do
    if curl -fsSL --retry 2 --max-time 60 "$u" -o "$out.tmp"; then
      mv "$out.tmp" "$out"
      return 0
    fi
    rm -f "$out.tmp"
  done
  return 1
}

if fetch_ml "maplibre-gl.js" && fetch_ml "maplibre-gl.css"; then
  cp "$CACHE/maplibre-gl.js" "$DEST/vendor/maplibre-gl.js"
  cp "$CACHE/maplibre-gl.css" "$DEST/vendor/maplibre-gl.css"
  python3 - "$DEST/index.html" "$ML_VER" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
ver = sys.argv[2]
text = p.read_text(encoding="utf-8")
text = text.replace(
    f"https://unpkg.com/maplibre-gl@{ver}/dist/maplibre-gl.css",
    "vendor/maplibre-gl.css",
)
text = text.replace(
    f"https://unpkg.com/maplibre-gl@{ver}/dist/maplibre-gl.js",
    "vendor/maplibre-gl.js",
)
p.write_text(text, encoding="utf-8")
PY
  echo "sync-www: vendored MapLibre ${ML_VER}"
else
  echo "sync-www: WARN MapLibre download failed; APK will hit unpkg (needs network)" >&2
fi

fetch_three() {
  local out="$CACHE/three.min.js"
  if [[ -s "$out" ]]; then
    return 0
  fi
  local urls=(
    "https://cdn.jsdelivr.net/npm/three@${THREE_VER}/build/three.min.js"
    "https://unpkg.com/three@${THREE_VER}/build/three.min.js"
  )
  local u
  for u in "${urls[@]}"; do
    if curl -fsSL --retry 2 --max-time 60 "$u" -o "$out.tmp"; then
      mv "$out.tmp" "$out"
      return 0
    fi
    rm -f "$out.tmp"
  done
  return 1
}

if fetch_three; then
  cp "$CACHE/three.min.js" "$DEST/vendor/three.min.js"
  python3 - "$DEST/index.html" "$THREE_VER" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
ver = sys.argv[2]
text = p.read_text(encoding="utf-8")
text = text.replace(
    f"https://unpkg.com/three@{ver}/build/three.min.js",
    "vendor/three.min.js",
)
p.write_text(text, encoding="utf-8")
PY
  echo "sync-www: vendored Three.js ${THREE_VER}"
else
  echo "sync-www: WARN Three.js download failed; APK will hit unpkg (needs network)" >&2
fi

echo "sync-www: $DEST"
