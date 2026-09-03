# Lvfe PWA — installable web app

## Public URL

**https://iconiaglobal.com/lvfe/**

- Manifest: https://iconiaglobal.com/lvfe/manifest.webmanifest
- Service worker: https://iconiaglobal.com/lvfe/sw.js (scope `/lvfe/`)
- **Install guide:** https://iconiaglobal.com/lvfe/install.html
- Cloud save (shared with Android APK): https://iconiaglobal.com/lvfe-save

Theme: Nord dark `#0a0a0a`, gold `#c9a227` / `#b8893a`, orange accent `#ff7a1a`, green `#34c759`. `display: standalone`.

## In-app install prompt

`web/js/pwa-install.js` + `#pwaInstallBanner` on the map page:

| Platform | Behaviour |
|----------|-----------|
| **Chromium** (Android Chrome, desktop Chrome/Edge) | Captures `beforeinstallprompt`. Banner offers **Install** (native prompt) + **Show me how** → guide. |
| **iOS Safari** | No `beforeinstallprompt`. Banner explains Share → **Add to Home Screen**; CTA opens guide `#ios`. |
| **Already installed** (`display-mode: standalone` / `navigator.standalone`) | Prompt + menu Install rows hidden. |
| **Android APK WebView** (`LvfeNative` / `appassets`) | No SW register, no install banner (native package path). |

Throttle: once per session; **Maybe later** cools down 7 days (`lvfe.pwa.install.dismissedAt`). Auto-banner shows after first **Play** (or `?play=1`), not under the splash overlay.

Entry points: main menu **Install app**, account **Install / download game**, banner **Show me how** → `install.html`.

## Install guide (`install.html`)

Numbered steps + chips for:

1. iPhone / iPad (Safari) — Share → Add to Home Screen  
2. Android Chrome — Install app / Add to Home screen  
3. Desktop Chrome / Edge — address-bar install / Apps menu  
4. After install — Sign in with Google → Sync now  

## Manual install (short)

1. Open the URL in **Chrome** (Android) or **Chrome/Edge** (desktop) over HTTPS — or Safari on iOS with the guide above.
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

## Service worker cache

Current shell cache id: **`lvfe-shell-v3`**. HTML/CSS/JS are network-first; bump the `CACHE` string again when shipping shell changes so old clients drop stale menus/theme.

## Deploy

```bash
./scripts/stage_pwa.sh
# FTP_* from operator env / FileZilla Iconia Server — never commit
source /path/to/ftp.env
./scripts/deploy_pwa.sh
curl -sI https://iconiaglobal.com/lvfe/ | head
curl -sI https://iconiaglobal.com/lvfe/manifest.webmanifest | head
curl -sI https://iconiaglobal.com/lvfe/install.html | head
```

Apex `public_html/.htaccess` must pass through `lvfe` alongside `lvfe-save` (deploy script patches this).

After deploy on iPhone (if an old SW was stuck):

1. Open **https://iconiaglobal.com/lvfe/** in **Safari** (not only the home-screen icon).
2. **aA** → **Website Settings** → **Clear Website Data** (or Settings → Apps → Safari → Advanced → Website Data → remove `iconiaglobal.com`).
3. Force-quit the home-screen Lvfe app, then reopen it (or Add to Home Screen again).
4. Confirm dark Nord splash/menu and that **Play Now** + the gold seal open.

Alternatively open the PWA once and let `controllerchange` reload after `SKIP_WAITING` when `lvfe-shell-v3` installs.

Shell CSS URL is **`css/nord-shell-v2.css`** (Cloudflare still immutably caches the old `nord-shell.css` path).


## Related

- `docs/OAUTH_CONSENT.md` — consent screen + homepage
- `hosting/lvfe/README.md` — host folder notes
- `hosting/lvfe-save/README.md` — save API
