# Lvfe PWA host (`https://iconiaglobal.com/lvfe/`)

Static installable web app. Same `web/` + catalog geojson as the Android WebView APK, served over HTTPS for Google Identity Services + PWA install.

## Live URL

- **PWA:** `https://iconiaglobal.com/lvfe/`
- **Manifest:** `https://iconiaglobal.com/lvfe/manifest.webmanifest`
- **Cloud save (shared with APK):** `https://iconiaglobal.com/lvfe-save`

## Deploy

1. Build staging tree (copies `web/`, `data/places.geojson`, `data/catalog.json`, `geojson/enugu-factions.geojson`, this `.htaccess`):
   ```bash
   ./scripts/stage_pwa.sh
   ```
2. Upload `dist/pwa/` → `public_html/lvfe/` on Iconia FTP (`iconicxy`).
3. Ensure apex `public_html/.htaccess` pass-through includes `lvfe`:
   ```
   RewriteRule ^(?:ipm-app|demos|lvfe-save|lvfe)(?:/|$) - [L]
   ```
4. Curl `https://iconiaglobal.com/lvfe/` and `…/manifest.webmanifest` → 200.

## Google Console (human)

Authorized JavaScript origins for Web client `730640559588-…`:

- `https://iconiaglobal.com`
- `https://www.iconiaglobal.com` (if used)
- `http://localhost` / `http://127.0.0.1` (local GIS tests only)
- Android WebView also needs origin awareness via Credential Manager + Android OAuth client (package `com.lvfe.xperience` + SHA-1) — not a JS origin.

See `docs/OAUTH_CONSENT.md` and `docs/PWA.md`.
