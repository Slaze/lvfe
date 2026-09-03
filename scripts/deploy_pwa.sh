#!/usr/bin/env bash
# Upload staged PWA to Iconia public_html/lvfe/ and patch apex .htaccess pass-through.
# Reads FTP credentials from env FTP_HOST FTP_USER FTP_PASS (never commit).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="${1:-$ROOT/dist/pwa}"

if [[ ! -f "$STAGE/index.html" || ! -f "$STAGE/manifest.webmanifest" ]]; then
  echo "missing staged PWA at $STAGE — run scripts/stage_pwa.sh first" >&2
  exit 1
fi
: "${FTP_HOST:?}"
: "${FTP_USER:?}"
: "${FTP_PASS:?}"
FTP_PORT="${FTP_PORT:-21}"

TMP_DIR="$(mktemp -d)"
TMP_HT="$TMP_DIR/htaccess"
trap 'rm -rf "$TMP_DIR"' EXIT

lftp -c "
set ftp:ssl-allow no
set net:timeout 30
set net:max-retries 2
open -u ${FTP_USER},${FTP_PASS} ftp://${FTP_HOST}:${FTP_PORT}
cd public_html
get -e .htaccess -o ${TMP_HT}
"

python3 - "$TMP_HT" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
text = p.read_text(encoding="utf-8")
old = "RewriteRule ^(?:ipm-app|demos|lvfe-save)(?:/|$) - [L]"
new = "RewriteRule ^(?:ipm-app|demos|lvfe-save|lvfe)(?:/|$) - [L]"
if new in text:
    print("apex htaccess: lvfe already pass-through")
elif old in text:
    p.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("apex htaccess: added lvfe pass-through")
else:
    # broader match
    import re
    m = re.search(r"RewriteRule \^\(\?:ipm-app\|demos\|lvfe-save(?:\|lvfe)?\)\(\?:/\|\$\) - \[L\]", text)
    if m and "|lvfe)" not in m.group(0):
        text2 = text[:m.start()] + new + text[m.end():]
        p.write_text(text2, encoding="utf-8")
        print("apex htaccess: patched via regex")
    else:
        print("WARN: could not find pass-through rule; upload PWA anyway", file=sys.stderr)
PY

lftp -c "
set ftp:ssl-allow no
set net:timeout 60
set net:max-retries 2
set mirror:use-pget-n 1
open -u ${FTP_USER},${FTP_PASS} ftp://${FTP_HOST}:${FTP_PORT}
cd public_html
put ${TMP_HT} -o .htaccess
mirror -R --verbose --exclude-glob .DS_Store ${STAGE} lvfe
cls -l lvfe | head
"

echo "deploy_pwa: done → public_html/lvfe/"
