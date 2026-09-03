# Lvfe PWA — installable web app

## Public URL

**https://iconiaglobal.com/lvfe/**

- Manifest: https://iconiaglobal.com/lvfe/manifest.webmanifest
- Service worker: https://iconiaglobal.com/lvfe/sw.js (scope `/lvfe/`)
- Cloud save (shared with Android APK): https://iconiaglobal.com/lvfe-save

Theme: Nord dark `#0a0a0a`, gold `#c9a227` / `#b8893a`, green `#34c759`. `display: standalone`.

## Install

1. Open the URL in **Chrome** (Android) or **Chrome/Edge** (desktop) over HTTPS.
2. Menu → **Install app** / **Add to Home screen** (or the install icon in the address bar).
3. Sign in with Google → Sync now. Progress uses the same `playerKey` derived from Google `sub` as the APK.

## Google Console — Authorized JavaScript origins

Web client ID: `730640559588-i03q4imeb8cl8lonr3j6iliaefmr1sa6.apps.googleusercontent.com`

Add these **exact origins** (scheme + host + optional port; **no path**):

| Origin | Why |
|--------|-----|
| `https://iconiaglobal.com` | Production PWA + site (path `/lvfe/` does **not** change the origin) |
| `https://www.iconiaglobal.com` | Only if players use the www host |
| `http://localhost` | Local GIS tests |
| `http://127.0.0.1` | Local GIS tests |

**Not** a JS origin: Android WebView (`appassets.androidplatform.net`) uses the **Android** OAuth client (`com.lvfe.xperience` + SHA-1) via Credential Manager.

Authorised domain on the consent screen remains `iconiaglobal.com` (domain only).

## APK ↔ PWA sync

1. Sign in with Google on either client → JWT `sub` → `playerKey` = `g` + sanitized sub.
2. Save pack `lvfe.save.v1` pull/push `GET/PUT https://iconiaglobal.com/lvfe-save/v1/save/:playerKey` with `Authorization: Bearer google:<id_token>`.
3. Last-write-wins by `pack.updatedAt`.
4. **Guest** (no Google): local play only; **Sync now** fails loud until signed in.
5. Service worker is **not** registered when `LvfeNative` exists or host is `appassets.androidplatform.net` (APK path unchanged).

## Deploy

```bash
./scripts/stage_pwa.sh
# FTP_* from operator env / FileZilla Iconia Server — never commit
source /path/to/ftp.env
./scripts/deploy_pwa.sh
curl -sI https://iconiaglobal.com/lvfe/ | head
curl -sI https://iconiaglobal.com/lvfe/manifest.webmanifest | head
```

Apex `public_html/.htaccess` must pass through `lvfe` alongside `lvfe-save` (deploy script patches this).

## Related

- `docs/OAUTH_CONSENT.md` — consent screen + homepage
- `hosting/lvfe/README.md` — host folder notes
- `hosting/lvfe-save/README.md` — save API
