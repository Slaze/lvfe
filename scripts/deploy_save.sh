#!/usr/bin/env bash
# Upload hosting/lvfe-save to Iconia public_html/lvfe-save/
# Excludes live player saves/payments. Includes config.local.php + game-config.
# Reads FTP_HOST FTP_USER FTP_PASS from env (never commit).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/hosting/lvfe-save"

: "${FTP_HOST:?}"
: "${FTP_USER:?}"
: "${FTP_PASS:?}"
FTP_PORT="${FTP_PORT:-21}"

if [[ ! -f "$SRC/index.php" || ! -f "$SRC/admin_lib.php" || ! -d "$SRC/admin" ]]; then
  echo "missing lvfe-save admin surface at $SRC" >&2
  exit 1
fi
if [[ ! -f "$SRC/config.local.php" ]]; then
  echo "WARN: no config.local.php — admin login may fail on host until seeded" >&2
fi

lftp -c "
set ftp:ssl-allow no
set net:timeout 60
set net:max-retries 2
set mirror:use-pget-n 1
open -u ${FTP_USER},${FTP_PASS} ftp://${FTP_HOST}:${FTP_PORT}
cd public_html
mirror -R --verbose \
  --exclude-glob .DS_Store \
  --exclude-glob '*.tmp' \
  --exclude-glob '*.sqlite' \
  --exclude data/saves/ \
  --exclude data/payments/ \
  --exclude data/username-map.json \
  ${SRC} lvfe-save
cls -l lvfe-save | head
cls -l lvfe-save/admin | head
"

echo "deploy_save: done → public_html/lvfe-save/"
