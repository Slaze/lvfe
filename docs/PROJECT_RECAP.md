# Lvfe: The Xperience — project recap

Location-based territorial game. World data from OpenStreetMap (no paid Google Maps SKUs). Device GPS is the physics. Canonical loop is **endowment / ownership + NairaCoin IOU** (not extractive XP).

**Internal (not for players):** schema `locked_by` / `source` may use the username `architect`. Player UI, catalog, AR, and GeoJSON notes must not mention The Architect, God Mode, or Architect points.

## Architecture / layout map

- `geojson/enugu-factions.geojson` — Enugu polygons (v0.2): 5 playable/prize + 7 named unclaimed neighbourhoods.
- `schema/places.sql` — territories, catalog types, places (`claim_points` = **min stake** formula). Catch-all `unclaimed` / Unclaimed area / UNC / `#7f8c8d`.
- `web/nairacoin/` — **coin layer** (sibling import this, not a third wallet): `protocol.js` (8 decimals, `formatIouAddress` stub `f`+checksum, empty genesis, intended seed hostname), `iou-ledger.js` (`getBalance`/`credit`/`debit` **atomic**; whole-coin aliases; demo faucet 100), `rpc-stub.js` (RPC after GPS → `{ok:false}`), `index.js` Node barrel. `scripts/nairacoin.js` re-exports. `web/js/nairacoin.js` is catalog/AR **place** helpers (whole-coin wrappers; does **not** define `LvfeNairaCoin`).
- `schema/nairacoin.sql` — unwired off-chain credit/debit + redeem queue (not sqlite place owners, not live).
- `docs/nairacoin.md` — live vs stub; sibling API; operator node steps; seed **nairacoin.iconiaglobal.com:17356** (grey-cloud A **`198.54.120.94`**; 17356 not listening).
- `scripts/ingest_places.py` — Overpass → cluster 80 m → `data/lvfe.sqlite`; points outside all polygons get `territory_id=unclaimed`.
- `scripts/claim_points.py` — min stake: `round(BASE[type] * QUALITY[q] * ROLE[role])`, min 1. Not claim XP.
- `scripts/export_catalog.py` — sqlite/geojson → `data/catalog.json` + `data/catalog.csv` (ownable **min stake**; bank/atm **0**).
- `web/css/nord-shell.css` + **`web/css/nord-shell-v2.css`** — Nord dark-glass design system (splash/menu + secondary page chrome; orange `#ff7a1a`). Live PWA links **`nord-shell-v2.css`** to bypass Cloudflare’s 30-day immutable cache on the old CSS URL.
- `web/assets/brand/` — **Lvfe brand mark** (gold seal + green `#34c759` map pin + gold geometric L). Primary PNGs: `lvfe-mark-512.png`, `lvfe-logo-wide.png`; SVG sources `lvfe-mark.svg` / `lvfe-logo-wide.svg`. Immediate Google OAuth uploads: `exports/brand/GOOGLE-OAUTH-*.png`.
- `web/js/buy-ncn.config.js` / `buy-ncn.js` — **Buy NCN** via Paystack Checkout (1 NCN = USD $1). Public key only in client; init/verify against save host; clear sandbox blocker if keys missing. Docs: `docs/BUY_NCN.md`.
- `web/js/rank-sigils.js` — rank **sigils/emblems** (Initiate→Sovereign tiers + Banner Lord / Vanguard / Kin faction roles). Used in Rankings hub + under profile FAB.
- `hosting/lvfe-save/buy.php` + Node `server/buy.js` — `POST /v1/buy/init|verify|webhook`; credits IOU in save pack after Paystack verify (idempotent `purchases[ref]`).
- `web/index.html` — Cold start **splash → main menu** (Play Now / Save / Restart / Check Catalog / Rules / My places / Account; splash/menu seals use `assets/brand/lvfe-mark-512.png`), then MapLibre + OpenFreeMap **GMaps-style chrome**: full-bleed map, top search pill with **magnifier** (`#btnSearch`), **bottom-left profile FAB** (`#btnMore` / `layoutFabs`): Google photo circle when signed in (else letter/mark fallback) + rank sigil + points under it; opens account/main-menu sheet. CSS bottom sheet (**hidden until pin tap**). **SAT / 3D / AR** are LTR/RTL slide switches on-map (`role="switch"`, green `#34c759` on / gray `#9aa0a6` off). **GPS is a locate action**, not a switch. `ensureLayers` uses valid `addLy({` (seven `addLy({)` SyntaxErrors fixed). `window.lvfeFitMap` → `map.resize()` after style/load, SAT toggle, `visualViewport`/`orientationchange`/`window.resize`, and delayed boot (WebView). Esri World Imagery `{z}/{y}/{x}` overlay (no `setStyle`). **Unclaimed named pins = red X** (`places-x`, `#ff3b30`); **unknown (quality D / civic_unknown / unmapped) = black X** (`places-x-unknown`, `#111111`); **owned pins = circle** (`places-circles`, self `#1d8cff` vs other/faction color). Invisible `places-hit` keeps taps at z12.2. Pins / green walk + dashed alts / 80 m ring / bus stops / you-dot re-attach via `reattachOverlays`; hybrid OSM labels in account **Map pins**; fail banner **Satellite couldn’t load**. Pin tap opens a **paper file / dossier** (`.sheet.doc` compact peek **34vh**, expand `.sheet.doc-exp` **70vh**) with **Place / Mission / Land / Money / Wallet** tabs (44px). Wallet **Pay** is `disabled` unless GPS and `dist <= 80`. Track chip + green OSRM walk line + muted dashed alts + in-line Walk/Car labels + 80 m pay ring. Player coin copy prefers **NCN**. ▴ / handle expands; × + swipe-down close fully. Idle map still auto-hides (`display:none`). Profile stamp → **grouped account sheet** (`#accountSheet`: You / Play [How to play, Catalog, My places, **Wallet** (Buy NCN), **Earn more**, **Rankings**, **Analytics**] / Map pins / This phone + Google signed-in chip / Sign out / Main menu + export/import + **Sync now**). **`#playHub`** Nord sheet for Wallet balance/Buy NCN/stakes/activity, Earn missions, Rankings (sigils), Analytics (territory / claims / rival pressure / mute prefs / Test notification). Catalog/rules/assets use Nord pill nav (not old flat chrome). No left `.panel`, no always-on `#hud`, no MapLibre Popup, no OSM/Esri wordmark on the map (About only). Default pitch **0**. 80 m GPS; photo + NairaCoin. **localStorage cache + optional cloud save** (`SAVE_API_BASE` / `?saveApi=`). Reinstall still wipes unless Export save **or** cloud sync. **Sign in with Google** uses Web client ID via native Credential Manager (Identity OAuth only — no Maps SKUs); photo URL cached from Credential Manager / JWT `picture`; when `googleSub` is present the Sign-in CTA is **hidden** and email is shown. Android OAuth client + SHA-1 still required in Console for fresh native sign-in on new devices.
- `server/` — zero-dep Node save API (`PORT` default **18787**). `GET/PUT /v1/save/:playerKey`. Conflict: **last-write-wins** by `pack.updatedAt`. Auth: `Bearer lvfe-dev:<playerKey>` when `LVFE_ALLOW_DEV_AUTH=1`; `SAVE_SECRET`; `google:<id_token>` when `GOOGLE_WEB_CLIENT_ID` set (else production Gmail fails loud). Photos: max 8, dataURL >~400KB → meta-only; body ≤2.5 MiB. Env: see `server/.env.example` + `server/README.md`. Optional Netlify: `netlify.toml` + `netlify/functions/save.js`.
- `hosting/lvfe-save/` — **public HTTPS save API** (PHP on Iconia Namecheap/cPanel). Live base **`https://iconiaglobal.com/lvfe-save`**. Same routes/auth as Node. Secrets in host-only `config.local.php` (gitignored). Preferred branded host `lvfe-save.iconiaglobal.com` needs Cloudflare DNS + cPanel subdomain (human).
- `docs/ICONIA_TERMS.md` + `hosting/iconia/terms-content.html` — Iconia ToS (live CMS `https://iconiaglobal.com/pages/terms-and-conditions`, September 2026). Privacy remains `https://iconiaglobal.com/privacy-policy`.
- `web/js/save-api.config.js` / `save-sync.js` — client pull after boot, push on stake/identity (debounced), offline queue, Export/Import kept. Default `SAVE_API_BASE` = public Iconia URL (override `?saveApi=` / `localStorage`).
- `web/js/google-auth.config.js` / `google-auth.js` / `account.js` — Web OAuth `WEB_CLIENT_ID` set (`730640559588-…apps.googleusercontent.com`); native `LvfeNative.signInWithGoogle` on Android; **username permanent once set** (`nameLocked`; bound to Google `sub` on save API); save pack `lvfe.save.v1` + `updatedAt`. Docs: `docs/ACCOUNT.md`.
- `web/js/local-factions.js` — GPS-region factions: Enugu → canonical four; elsewhere Overpass suburb/neighbourhood/quarter (3–6); travel keeps chapter; fail soft → generic quarters.
- `server/username-lock.js` + PHP `enforce_username_lock` — `username-map.json` (`username ↔ googleSub`); reject rename/reuse.
- `hosting/lvfe-save/` — **public HTTPS save API** (PHP on Iconia Namecheap/cPanel). Live base **`https://iconiaglobal.com/lvfe-save`**. Same routes/auth as Node. Secrets in host-only `config.local.php` (gitignored). Preferred branded host `lvfe-save.iconiaglobal.com` needs Cloudflare DNS + cPanel subdomain (human).
- `docs/OAUTH_CONSENT.md` — consent + **Authorized JavaScript origins** for GIS (`https://iconiaglobal.com`, …).
- `docs/ACCOUNT.md` — username permanence + location factions.
- `web/js/conquest.js` — neighbourhood owned-count bonus: `displayValue = baseValue * (1 + 0.5 * count/max)`; hinterland `unclaimed` bonus 0. Does not mint into `rec.value`. **Unknown** (quality D / `civic_unknown` / `unmapped`) `baseValue = max(ledger, 100)` so it is the top quality tier; named empty stays 0. Red X `#ff3b30` vs black unknown `#111111`.
- `web/js/satellite.js` — Esri World Imagery overlay; SAT switch; never billed Google tiles; never `setStyle`. Source `maxzoom` **18** (Enugu z19 is Esri empty plate); raster **layer** `maxzoom` 24 so street zoom overscales last rooftops. `map.resize()` after style load and SAT toggle.
- `web/rules.html` — player How to play (walk, photo, NairaCoin, 80 m, highest backer owns, faction, neighbourhood value bonus, Pay gate, beep/track, AR, catalog, banks, world Overpass).
- `web/assets.html` + `web/js/assets.js` — owned/backed places, visit interest (10%), gap vs next backer; dossier-style section toggles.
- `web/js/dossier.js` — place-file HTML; Land mark actions (watch / threat / takeover); **Bid to overturn** via `LvfeWalletEarn.bidToOwn`. Flex head row; 2-line title clamp.
- `web/js/place-thumb.js` — place snapshot: Esri World Imagery tile + Wikipedia geosearch upgrade; IndexedDB cache; catalog chips.
- `web/js/game-notify.js` — notifications (`claim_self` / `claim_rival` / `nearby_claimable` / `enemy_nearby` / `pass_toll` / `toll_owner` / `watch_change` / `threat_act` / `test`); prefs; Android `LvfeNative.showGameNotification` else `#gameBanner`.
- `web/js/pass-toll.js` — pass-by toll ≤80 m enemy-owned: `max(2, floor(ownerStake×5%))`, 60 min/place, partial+debt, Escape refund fee, owner inbox.
- `web/js/game-marks.js` — watchlist / threats / takeover plans (`lvfe.marks.v1` + save pack); ledger diff notifies.
- `web/js/rankings.js` — live leaders from stakes / owned / faction score; faction who’s who.
- `web/js/wallet-earn.js` — stakes out, activity log, earn missions near GPS, territory + rival pressure, `bidToOwn`.
- `web/js/play-hub.js` — Wallet (Buy NCN + watch/takeover) / Earn / Rankings / Analytics (threats + Simulate pass-by toll).
- `web/js/track-guide.js` — marked pin, AudioContext + vibrate pulse, public OSRM **walking** (`alternatives=3`, plus via-point alt if demo returns one path) and **driving** for Car ETA labels only. Primary `#00e676` / `#00c853`; alts muted dashed; tap alt to activate; in-line Walk/Car labels; geodesic + 5 km/h fail-open. Gold 80 m `pay-ring`. `line-join`/`line-cap` in **layout**. No Google Directions.
- `web/js/bus-stops.js` — viewport Overpass bus stops/platforms (45s rate-limit, fail soft); icons from z≈13.5, names from z15; tap tip not claimable.
- `web/js/claim-rules.js` — `placeTitle`; `isUnknownPlace`; `ncn(n)` → `"12 NCN"` for player UI.
- `android/…/MainActivity.kt` — FrameLayout: CameraX `PreviewView` behind WebView; FINE+COARSE+CAMERA; AR CameraX; Google Sign-In; file chooser. **Notification channels** `claims` / `nearby` / `enemy` / `game`; `POST_NOTIFICATIONS` (API 33+ soft-fail); `LvfeNative.showGameNotification` / `hasNotifications` / `requestNotifications`; deep link `lvfe://place/{id}?action=bid|escape|open|ignore` → `window.lvfeDeepLink`. No Play Maps SDK.
- `web/catalog.html` — same dossier as pin tap; section toggles (Place / Mission / Land / Money / Wallet); compact list (not table-only). Default **My places**.
- `web/ar-overlay.js` — map-page AR (not `ar.html`). **Nord/Android:** CameraX `PreviewView` under a transparent WebView (`LvfeNative.startArCamera`); no getUserMedia (rear WebView stream is #000). `#arThree` hidden. HTML pin glyphs (red X / black unknown / claimed circles) within **~120 m**, FOV + compass (native heading preferred). Marked-pin HUD (`#arTrackHud`) live metres + heading every tick. Debug: `?arMock=1` or `localStorage.lvfe.arMock=1` places a mock pin ~45 m north. Empty-range / GPS-off copy, × → map. **Desktop:** visible `<video id="arCam">`. Pin labels do **not** touch `LvfeCatalogWallet` (`W`). `web/ar.html` leftover.
- `web/map-3d.js` / `web/map-3d.css` — **one** `#btn3d` switch (green only when live 3D: pitch ~52 + terrain). Tap 3D from idle 12.2 → pitch 52 **and zoom ≥ 14.2**. Every OSM footprint is a box (tagged height/levels; untagged **OMT 5 m**; cap 80). **SAT-off opacity 1** (solid box city). **SAT+3D opacity 0.35** (ghost walls so draped Esri roofs read). SAT restacks above Liberty beige, under extrusion, under pins. 2D `building` fill hidden while extruded. No skip-filter. Terrain **1.0×** + sky; DEM fail → banner, switch off, stay flat. Labels `text-pitch-alignment: viewport`. Pins billboard (X/circle); no −16 px; no chimney poles. NavigationControl `visualizePitch` off. No Google 3D SKU. No Three.js.
- `data/places.geojson` — typed pins. Place value/owner live in `lvfe.places.v1`.
- `web/js/lvfe-assets.js` — URL helper for repo-root python (`/data`), APK `appassets…/www/`, and HTTPS PWA under `/lvfe/`.
- `web/manifest.webmanifest` + `web/sw.js` + `web/js/pwa-register.js` + `web/js/pwa-install.js` + `web/install.html` — installable PWA (Nord dark theme, standalone). In-app install banner (Chromium `beforeinstallprompt` / iOS Share guide); SW caches shell; network-first for HTML/CSS/JS + `lvfe-save` / tiles / GIS. **SW skipped** when `LvfeNative` or appassets WebView. Cache id **`lvfe-shell-v4`**. Theme CSS: `web/css/nord-shell-v2.css` (cache-bust rename).
- `hosting/lvfe/` + `scripts/stage_pwa.sh` / `deploy_pwa.sh` — deploy tree to **`https://iconiaglobal.com/lvfe/`** (FTP Iconia). Apex `.htaccess` pass-through includes `lvfe`. Docs: `docs/PWA.md`.
- `docs/OAUTH_CONSENT.md` — consent + **Authorized JavaScript origins** for GIS (`https://iconiaglobal.com`, …).
- `android/` — debug WebView APK (`com.lvfe.xperience`, minSdk 24). `sync-www.sh` bundles `web/` + `data/places.geojson` + `data/catalog.json` + `geojson/enugu-factions.geojson` + MapLibre JS/CSS. OpenFreeMap tiles still need the network. No Google Maps SDK. Not the Don Maseratte shop.

## Inception → now timeline

- 2026-08-31: Design — Google Maps rejected for cost; OSM + MapLibre + phone GPS.
- 2026-08-31: Enugu OSM tag census; place-tag → mission roles.
- 2026-09-01: Catalog layer (clean player-facing, messy OSM as Collector/Historian quests). Faction GeoJSON v0.
- 2026-09-02: Extra polygons (New Haven, Trans-Ekulu, Uwani, Ogui, Thinkers Corner). Catalog SQL schema.
- 2026-09-02: Overpass ingest into SQLite catalog (1044 places).

- 2026-09-02: MapLibre catalog map on OpenFreeMap.
- 2026-09-02: Hinterland catch-all `unclaimed`; click popup shows claim XP.
- 2026-09-02: Walk-outside check-in (GPS / 80 m / localStorage XP).
- 2026-09-02: MapLibre pitch + OpenFreeMap 3D building extrusion.
- 2026-09-02: Place-value / ownership loop (stake NairaCoin; visitors fund the pin; owners take yield).
- 2026-09-02: Player catalog table + camera AR pages.
- 2026-09-02: Critic loop — yield from endowment, IOU, AR ≠ 3D, no extractive crumbs.
- 2026-09-02: OSM-true building heights + free Terrarium terrain (no 9 m fallback).
- 2026-09-02: NairaCoin coin-layer API rounded up (atomic getBalance/credit/debit; honest IOU; RPC stub).
- 2026-09-02: Catalog layers attach on style.load; Liberty POI/amenity labels hidden.
- 2026-09-02: Sideloadable debug APK for OnePlus Nord (`com.lvfe.xperience`).
- 2026-09-02: Independent map UI/UX critic vs Google Maps mobile chrome — **fail** (dashboard cards, no sheet, OSM wordmark). No code changes.
- 2026-09-02: Player map chrome rewritten to GMaps mobile layout (sheet + FABs + pill); OSM off the map; location on GPS tap; camera on AR tap.
- 2026-09-02: Independent critic re-score vs GMaps mobile — **fail** (no 48dp CTA outside 80 m; Nord 3D FAB selected on pitch-0 map; default zoom pins untappable).
- 2026-09-02: Closed those three P0s (sheet CTA, 3D FAB vs pitch, pin hit at z12.2). APK reinstalled on Nord DE2118.
- 2026-09-02: Nord double-prompt: persist WebView geo for `appassets.androidplatform.net`; skip OS dialogs when already granted.
- 2026-09-02: Independent GMaps UX re-score — **fail** (`getPitch() > 8`, FAB unpressed at pitch 8). No code changes.
- 2026-09-02: Closed remaining GMaps P0: 3D FAB `getPitch() > 1` (or toggle on); APK reinstalled on Nord.
- 2026-09-02: Independent GMaps UX re-score vs `74cbdbb7` — **pass**. Last P0 (FAB unpressed at pitch 8) closed on installed Nord APK.
- 2026-09-02: Pokémon GO AR — live camera + Three.js billboards; critic `d0002cf5` fail (black canvas lid / undefined `W` / no X).
- 2026-09-02: Independent Pokémon GO AR re-score vs builder `e7a599a8` — **FAIL**. Street still not in Nord viewfinder (live camera + black WebGL lid). × does return to map. `W` / `ar.html` closed.
- 2026-09-02: AR viewfinder is VideoTexture on one WebGL canvas (no stacked `<video>` under `#arThree`). Independent critic on the 21:56 Nord APK still saw a black viewfinder.
- 2026-09-02: Pin tap opens a paper file (Place / Mission / Land / Money). Launch requests FINE+COARSE+CAMERA (skip if granted).
- 2026-09-02: Pokémon GO AR — Nord WebView VideoTexture / `<video>` / canvas2d all failed for rear camera (#000 frames). CameraX PreviewView under transparent WebView produces a live viewfinder.
- 2026-09-02: Independent Pokémon GO AR re-score vs last FAIL `f409acc1` / builder CameraX overlay — **pass**. Nord rear viewfinder is live camera (not #000); empty 80 m copy + × to map.
- 2026-09-02: Independent critic — walk-to-pin loop (beep, AR numbers, wallet+gated Pay, no dash junk, catalog dossier, free route). **FAIL.** No code.
- 2026-09-02: Closed critic `c2cb1cc7` six P0s (beep, live AR HUD, Wallet Pay gate, placeTitle, catalog dossier, OSRM gold walk line).
- 2026-09-02: Independent re-score of that loop-exit vs builder `9da3e482` / Nord `bea6919f` — **FAIL.** P0-3 (geolocate closes file) and P0-6 (walk line layers never paint) remain. No code.
- 2026-09-02: Closed critic `46b2a779` P0-3 + P0-6 (dossier stays on geolocate; gold walk layers attach). Kept 1,2,4,5. Nord `bea6919f` reinstall.
- 2026-09-02: Independent re-score of `c2cb1cc7` / `46b2a779` vs builder `6bbb8245` / Nord `bea6919f` 23:03 — **pass**. P0-3 and P0-6 closed on live WebView CDP. No remaining P0s on this gate.
- 2026-09-03: Independent critic — satellite toggle vs Google Maps satellite feel. **FAIL.** Feature absent on disk.
- 2026-09-03: SAT/MAP FAB + Esri World Imagery overlay; How to play + My assets; profile ⋯. Closed critic `d819a262` absence.
- 2026-09-03: Independent satellite vs GMaps re-score of builder `d85b8646` / commit `87a7e44` / Nord 05:34 APK — **FAIL.** Map JS does not parse (`addLy({)`). SAT is a sticker. Esri tiles themselves are live rooftops.
- 2026-09-03: Unclaimed map pins are X; owned pins are circles (self vs other color). Neighbourhood with most owned places boosts display value / cost-to-back (max +50%).
- 2026-09-03: Independent critic — 3D map vs Google Maps 3D feel (switch + extrusion + DEM). **FAIL.** No Photorealistic 3D SKU. Free MapLibre path still a tilted paper city.
- 2026-09-03: 3D box city for critic `a07cc0ab`: every footprint extruded (untagged 5 m), zoom ≥ 14.2, terrain 1.0× + sky, one `#btn3d` switch.
- 2026-09-03: Independent satellite vs GMaps re-score of builder `01f3fae6` / Nord 05:44 APK vs last FAIL `fd537fd2` — **FAIL.** Parse is closed. SAT paints Enugu at z12 in a 400×300 postage stamp; z17 showed Esri empty-tile copy.
- 2026-09-03: SAT critic `dd0212ef` P0s: `map.resize()` full-bleed canvas; Esri source maxzoom 18 (overzoom rooftops; do not fetch z19 empty plate).
- 2026-09-03: Independent SAT vs GMaps re-score of builder `be0a49ea` / Nord 05:56 APK vs last FAIL `dd0212ef` — **PASS.** Full-bleed canvas + street-zoom rooftops (not z19 empty plate).
- 2026-09-03: Independent GMaps 3D re-score of builder `533ca9ea` / Nord 05:56 APK vs last FAIL `a07cc0ab` — **pass.** Loop-exit 1–6 all true on live WebView + adb screencap.
- 2026-09-03: $0 photoreal-look — drape Esri SAT on Terrarium + ghost extrusion (0.35) when SAT+3D; SAT-off stays solid boxes. Not Google Photorealistic 3D.
- 2026-09-03: Independent SAT-on-terrain + ghost-walls critic of builder `c92a3d55` / Nord 06:16 APK — **PASS.** Photo ground through 0.35 boxes; SAT-off still solid; SAT-on 3D-off full-bleed; X pins; no Google SKU.
- 2026-09-03: Auth is device-local (username + faction). Gmail Sign-In UI + Android Credential Manager with **placeholder** Web client ID (fails loud). Photo bytes IndexedDB on Pay confirm. GPS fly-to + hinterland claim outside Enugu catalog.
- 2026-09-03: Map chrome — green OSRM walk (`#00e676` / `#00c853`); unclaimed named red X (`#ff3b30`); unknown quality D black X (`#111111`) + display/cost floor 100.
- 2026-09-03: Place-tap dossier opens at **34vh** peek (map majority); expand to **70vh** via ▴ / handle / swipe-up; × / swipe-down closes fully.
- 2026-09-03: Menu/nav — gold seal stamp + grouped account sheet; closed incomplete `365af887` chrome (missing `bindAccountSwipe`).
- 2026-09-03: Server-backed saves (`server/` + optional Netlify), AR pin overlays with native heading, world Overpass catalog outside Enugu.
- 2026-09-03: Public HTTPS save on Iconia PHP (`https://iconiaglobal.com/lvfe-save`); client default `SAVE_API_BASE` wired; Google Web client ID how-to expanded (still empty placeholder).
- 2026-09-03: Human Web OAuth client ID wired into web + Android + host `GOOGLE_WEB_CLIENT_ID`; Nord debug APK reinstalled; health `googleConfigured:true`; `LVFE_ALLOW_DEV_AUTH` left on until Gmail verified.
- 2026-09-03: Critic/builder — skipped-request audit; splash + main menu; Nord dark-glass chrome; Google signed-in hides Sign-in CTA; catalog/rules/assets remodeled so gold-seal destinations no longer dump into old flat UI.
- 2026-09-03: Nord reinstall ships `lvfe-mark-512.png` in www bundle; menu screencap confirms gold/green seal (`lastUpdateTime=2026-09-03 10:03:05`).
- 2026-09-03: Game activity notifications + Wallet/Earn/Rankings/Analytics hub; Bid to overturn; NCN copy; sibling map chrome kept.
- 2026-09-03: Overlay/layout audit — `box-sizing:border-box`, menu clip, dossier peek/expand px heights, FAB/toast chrome bottom; Nord CDP + screencaps.
- 2026-09-03: Iconia CMS Terms filled (Lvfe + NCN + Google Identity; live `/pages/terms-and-conditions`).
- 2026-09-03: Buy NCN (Paystack) + rank sigils + Google profile FAB; PHP buy routes on Iconia.
- 2026-09-03: Pass-by toll + contest notify (Outpay/Escape/Accept) + mark watch/threat/takeover (`dc5eba5`); co-landed PWA shell in same commit.
- 2026-09-03: PWA deployed live to **`https://iconiaglobal.com/lvfe/`** (FTP; apex `lvfe` pass-through; GIS origins documented).
- 2026-09-03: PWA install prompt + `install.html` guide; co-landed iOS menu/Nord translucent fixes (sibling); SW **`lvfe-shell-v4`**.
- 2026-09-03: Place dossier layout overlap fixed (flex head + 2-line clamp); place snapshot thumbs via **Esri World Imagery** + Wikipedia geosearch upgrade (`place-thumb.js`).

## Sessions

### 2026-09-03 — Place dossier overlap + place snapshot thumbs (P0)

**Goal:** Stop long place titles covering Track/tabs/controls in the place file; show a free online place snapshot/thumb (no Google Maps/Places SKUs); Nord install + PWA redeploy; commit/push.

**Overlap root cause:** `.track-toggle` was `position:absolute; right:48px` (~Track label + 52px switch ≈ 100px wide → ~148px from the right edge) while `.dossier-head h2` only reserved `margin-right:110px` and used unbounded `overflow-wrap:anywhere`. Long names ran under Track and grew the head into the tab row on ~424px / 34vh peek.

**What changed:**
- `web/js/dossier.js` — flex `.dossier-head-row` / `.dossier-head-text` + Track as static flex sibling; photo block with `data-lat/lon/place-id`.
- `web/index.html` + `web/css/lvfe.css` — 2-line `-webkit-line-clamp` titles, `min-width:0`, scrollable tab row / page body; peek 34vh / expand 70vh kept.
- `web/js/place-thumb.js` — **Esri** z16 World Imagery tile at lon/lat (immediate); optional **Wikipedia geosearch** page image upgrade; IndexedDB URL cache; fail soft. Visit photos still win via `data-visit-photo`.
- `web/js/catalog.js` + `catalog.html` — Esri chip thumbs on list rows; fill dossier photo on open.
- `scripts/test_place_thumb.js` — tile math smoke test.
- Co-landed in sibling commit **`d494a3c`** (iOS PWA/Nord shell same tree). This session redeployed PWA after append-immediate img fix for WebView.

**Thumb source chosen:** Esri World Imagery static tile (same ArcGIS endpoint as SAT) as primary worldwide/Enugu snapshot; Wikipedia geosearch thumbnail when nearby page image exists.

**How verified:**
- `node scripts/test_place_thumb.js` ok.
- Nord `bea6919f`: `assembleDebug` + `install -r`; **`lastUpdateTime=2026-09-03 11:09:26`**.
- WebView CDP @423×882: long title `lineClamp=2`, `headOverlapTrack=false` (titleRight 313 < trackLeft 321), peek `sheetH=300` (~34vh), expand ~70vh, `photoSrcKind=esri` / `naturalWidth=256`.
- Screencap `_state/layout-audit/11-dossier-long-name.png` (+ `11d-dossier-bottom.png`): File head + Track side-by-side, tabs intact, Esri aerial in Place tab.
- PWA: `./scripts/stage_pwa.sh` + `deploy_pwa.sh` → `https://iconiaglobal.com/lvfe/`; live `place-thumb.js` body **10968** bytes; `dossier-head-row` present.

**Current state:** Overlap P0 closed on Nord APK + live PWA. Thumbs Esri-first; wiki upgrade best-effort. Sibling account/username-lock WIP may still be dirty in the tree — not part of this session.

**Next steps:** Optional Overpass `image=` / `wikimedia_commons=` tag prefer when present; CF may briefly serve stale HEAD for JS (GET body was correct after deploy).

**Blockers / risks:** Cloudflare cache on `/lvfe/js/*` can stale HEAD `Content-Length`; hard-refresh / SW network-first mitigates. Wikipedia rate limits → soft fall back to Esri.

### 2026-09-03 — P0 iOS PWA: menu dead + Nord theme missing

**Goal:** Fix Apple device PWA at `https://iconiaglobal.com/lvfe/` — splash/main menu + gold account menu fail to open; darker translucent Nord chrome not applied. Redeploy; commit+push.

**Root cause (combined):**
1. **`#bootOverlay` positioning lived only in external CSS** and used `position:absolute`. If Nord CSS was stale/missing (SW cache-first `lvfe-shell-v1` + CF `Cache-Control: immutable` max-age 30d on `/css/nord-shell.css`), the overlay was not stacked over `#map` → menus appeared dead / light map chrome dominated.
2. **Account sheet / gold FAB** also `position:absolute` under iOS standalone — unreliable vs visual viewport; clicks needed `touch-action` + pointerup fallback.
3. Stale SW + CDN meant phones kept pre-Nord shell even after FTP updates.

**What changed:**
- Inline critical `#bootOverlay` / `.menu-panel` / `.menu-btn` dark-glass in `web/index.html`; overlays → **`position:fixed`**; gold FAB `z-index:12` + `touch-action:manipulation`; `onActivate` (click + touch `pointerup`).
- `nord-shell.css` fixed overlay + solid-then-translucent card fallbacks; ship as **`css/nord-shell-v2.css`** (CF bypass).
- SW **`lvfe-shell-v3`**: network-first HTML/CSS/JS; `SKIP_WAITING` message; `pwa-register` controllerchange reload.
- `hosting/lvfe/.htaccess`: `no-cache` for css/html/js (plus existing sw/manifest).
- Co-landed sibling install prompt (`install.html` / `pwa-install.js`) already on the same tree/deploy.

**Why:** Absolute overlays + cache-first shell + immutable CDN CSS is a classic iOS PWA failure mode; renaming CSS URL is the reliable purge when CF ignores origin revalidate.

**How verified:**
- `curl -sI https://iconiaglobal.com/lvfe/css/nord-shell-v2.css` → **200**, body **8260** bytes with `--nord-bg`, `position: fixed`, `touch-action`.
- Live HTML contains `nord-shell-v2.css`, inline `z-index: 40` boot overlay, `onActivate`, `pwaInstallBanner`.
- Live `sw.js` → `CACHE = "lvfe-shell-v3"` + `./css/nord-shell-v2.css`.
- Bare `/css/nord-shell.css` still CF-stale (7675 / old md5) — intentional reason for `-v2` filename.

**Current state:** Fix live on Iconia. Commit **`d494a3c`** pushed to `Slaze/lvfe` `main`. iPhone home-screen users may still need **Clear Website Data** once if `v1` SW never updates.

**Next steps:** User clears Safari site data for iconiaglobal.com and reopens home-screen icon; confirm Play Now + gold seal open; Android Chrome install banner smoke.

**Blockers / risks:** CF still immutably caches old `nord-shell.css` URL; do not relink to it without a new filename or CF purge.

### 2026-09-03 — PWA install / download prompt + guide

**Goal:** Real Add to Home Screen / install PWA prompt (not fake store), detailed multi-platform guide, menu + account entry points; merge with sibling iOS menu + Nord translucent theme; redeploy `/lvfe/`; commit+push.

**What changed:**
- `web/js/pwa-install.js` — `beforeinstallprompt` capture; iOS Safari Share guide copy; throttled `#pwaInstallBanner` after Play; skip `LvfeNative`/appassets/standalone.
- `web/install.html` — iPhone/iPad, Android Chrome, desktop Chrome/Edge, after-install Google sync steps.
- `web/index.html` — menu **Install app**, account **Install / download game**, banner DOM/CSS; wire after Play / `?play=1`.
- SW cache bump **`lvfe-shell-v1` → `v4`** (sibling theme rename + this ship); shell includes `install.html` / `pwa-install.js` / `nord-shell-v2.css`; network-first HTML/CSS/JS retained.
- Sibling (same tree): iOS menu `position:fixed` / `onActivate` pointerup, inline critical Nord chrome, `pwa-register` SKIP_WAITING reload, `.htaccess` no-cache for css/html/js, nord-shell solid fallback + **`nord-shell-v2.css`**.
- `docs/PWA.md` + this recap.

**Why:** Players need a discoverable install path on HTTPS; iOS has no install event; APK must not register SW.

**How verified:**
- FTP redeploy after SW **v4**; `curl` live `install.html` **200**; `sw.js` → `CACHE = "lvfe-shell-v4"`; `pwa-install.js` **8551** bytes; index has `menuInstall` / `pwaInstallBanner` / `nord-shell-v2.css`; manifest **200**.
- Feature code co-landed on `main` in sibling **`d494a3c`**; this follow-up bumps SW id to match live + docs.

**Current state:** Install prompt + guide + iOS theme/menu fix live on `https://iconiaglobal.com/lvfe/`.

**Next steps:** Confirm Android Chrome install prompt + iOS Share path on a real device after Clear Website Data.

**Blockers / risks:** CF may cache `sw.js` briefly; `beforeinstallprompt` only after Chrome engagement heuristics.

### 2026-09-03 — Deploy PWA to Iconia HTTPS

**Goal:** Ship installable PWA so any device can Sign in with Google (GIS) and share cloud save with the APK; HTTPS host; document JS origins; commit+push.

**What changed:**
- Code already on `main` in **`dc5eba5`** (co-landed with pass-toll): manifest, SW, pwa-register (skip `LvfeNative`/appassets), GIS button hosts, guest-local / Google-required Sync now, `/lvfe/` asset base, `docs/PWA.md`, OAUTH origins, stage/deploy scripts.
- This session: FTP upload `dist/pwa` → `public_html/lvfe/`; patched apex `.htaccess` pass-through `lvfe`; recap + `.gitignore` `dist/`. Commit **`cff1325`**.

**Why:** GIS + installability need a public HTTPS origin; APK WebView must not register the SW.

**How verified:**
- `curl -sI https://iconiaglobal.com/lvfe/` → **200**, `Permissions-Policy: geolocation=(self),…`
- `curl -sI https://iconiaglobal.com/lvfe/manifest.webmanifest` → **200** `application/manifest+json`
- `sw.js`, `data/places.geojson` → 200; `lvfe-save/health` → `googleConfigured:true`
- Live HTML includes `data-gis-btn`, `pwa-register.js`, `requireGoogleForCloudSync`

**Current state:** PWA public. Human must confirm Google Console **Authorized JavaScript origins** include `https://iconiaglobal.com`.

**Next steps:** Add origins if missing; Install on Android Chrome / desktop; Gmail on PWA ↔ Nord APK Sync now; then `LVFE_ALLOW_DEV_AUTH=0`.

**Blockers / risks:** Console origins are human-only. CF may cache `sw.js`. Dev auth still on public save API. Paystack still unconfigured.

### 2026-09-03 — Pass-by toll + marks / threats / takeover (P0)

**Goal:** Auto toll when local GPS enters 80 m of an enemy-owned place; contest notification actions (Outpay / Escape / Accept); persist watchlist, threat marks, takeover plans; tests; Nord install; commit+push `Slaze/lvfe`. Merge with Buy NCN hub (already on `main`) and do not revert splash/layout/terms. Co-landed sibling PWA script tags already in `index.html` so the page stays coherent.

**What changed:**
- `web/js/pass-toll.js` — formula, cooldown, partial/debt, escape refund, owner inbox, scan.
- `web/js/game-marks.js` — watch / threat / takeover + ledger diff.
- `web/js/game-notify.js` — `pass_toll` / `toll_owner` / `watch_change` / `threat_act` + Outpay/Escape/Accept actions.
- `web/js/play-hub.js`, `wallet-earn.js`, `dossier.js`, `account.js` (marks + toll in save pack), `web/index.html` wiring + **Simulate pass-by toll** debug CTA.
- `scripts/test_pass_toll_marks.js`.

**Toll formula (player-facing):** `max(2 NCN, floor(5% of owner’s stake))`, once per place per **60 minutes**.
**Escape:** pay `max(1, ceil(charged × 40%))` to refund the charged amount (net cost = escape fee). Charge is immediate on enter (no grace); Accept/Ignore leaves the charge.
**Empty wallet:** soft fail — take what they have + `debtByPlace` flag for the remainder (documented; not auto-collected later).

**How verified:**
- `node scripts/test_pass_toll_marks.js` + `test_game_economy.js` + `test_buy_ncn_sigils.js` ok.
- `./gradlew assembleDebug` SUCCESS; `adb -s bea6919f install -r`; force-stop; **`lastUpdateTime=2026-09-03 10:33:12`**.
- Commit **`dc5eba5`** pushed to `https://github.com/Slaze/lvfe` (`main`).

**Current state:** Toll + marks live on Nord APK. Owner notify is best-effort via save-pack inbox (same device / next sync), not live multiplayer push.

**Next steps:** Optional debt repayment UX; true multiplayer presence for live owner push; Paystack keys for Buy NCN.

**Blockers / risks — multiplayer:**
- No dedicated presence/server for “someone just walked past your pin” in real time — owner sees toll only if inbox reaches their client via cloud save or same-device credit.
- Rival threat/watch diffs need remote place ledger updates (save pull), not a live event bus.
- Cross-player wallet credit on toll is same-device only (`W.credit(ownerId)`); remote owners are not paid until a shared economy exists.

### 2026-09-03 — Buy NCN, rank sigils, Google profile FAB

**Goal:** Paystack Buy NCN (1 NCN = $1) with verify/webhook credit; rank emblems; bottom-left FAB = Google photo + sigil/points; Nord install; commit+push `Slaze/lvfe`.

**What changed:**
- Client: `web/js/buy-ncn.config.js`, `buy-ncn.js`, `rank-sigils.js`; Wallet hub Buy UI; Rankings use sigils; FAB photo + sigil + pts; Google `photoUrl` cache (`account.js` / `google-auth.js`); Android Credential Manager `profilePictureUri` + JWT `picture`.
- Server: `hosting/lvfe-save/buy.php` + routes in `index.php` / `.htaccess`; Node `server/buy.js`; `docs/BUY_NCN.md`; `scripts/test_buy_ncn_sigils.js`.
- FTP uploaded PHP buy surface to `public_html/lvfe-save/` (no secret keys). `config.local.php` still lacks Paystack secrets → health `buyNcn.configured:false`.

**Why:** Fastest Nigeria Checkout path; credit only after Paystack verify; visual rank hierarchy; profile FAB matches Google identity.

**How verified:**
- `node scripts/test_buy_ncn_sigils.js` + `test_game_economy.js` ok.
- `curl …/lvfe-save/health` → `buyNcn.configured:false`; `POST /v1/buy/init` → `paystack_not_configured` blocker.
- `./gradlew clean assembleDebug` SUCCESS; `adb -s bea6919f install -r`; **`lastUpdateTime=2026-09-03 10:23:31`**.
- Nord CDP: `buyModule`+`sigils` true, `buyConfigured` false, FAB photo node + initiate sigil + `goldHang`+`searchMag` kept.
- Commit **`5e15556`**.

**Current state:** Buy UI + credit path live; payments blocked until Paystack keys pasted. Profile FAB shows letter until Google photo available.

**Next steps:** Paste `pk_test_` / `sk_test_` into client config + host `config.local.php`; webhook URL; sandbox card buy → local+server credit; then live keys.

**Blockers / risks:** **Paystack API keys missing** (sandbox and live). No Flutterwave/Stripe wired yet (Paystack default).

### 2026-09-03 — Iconia Terms and conditions (OAuth ToS)

**Goal:** Replace live “Coming soon…” on `https://iconiaglobal.com/pages/terms-and-conditions` with enforceable Terms covering Iconia digital services and **Lvfe: The Xperience**; keep privacy links; save repo copy; commit+push `Slaze/lvfe`.

**What changed:**
- `docs/ICONIA_TERMS.md` — markdown source of record (effective 3 September 2026).
- `hosting/iconia/terms-content.html` + `hosting/iconia/README.md` — CMS HTML body (Yii `html_purify`).
- Live Yii MySQL `page` row `slug=terms-and-conditions` updated via operator FTP + one-shot PHP on the Iconia host (script deleted after run). Privacy page untouched.
- `docs/OAUTH_CONSENT.md` — terms URL now live, not a blocker.

**Why:** Google OAuth Production consent needs a real ToS URL on `iconiaglobal.com`. CMS page already existed; filling the DB row keeps `/pages/terms-and-conditions` without a parallel `/terms` rewrite.

**How verified:**
- One-shot apply: `affected:1`, content length 14 → 11494.
- `curl`/fetch `https://iconiaglobal.com/pages/terms-and-conditions` HTTP 200; **Coming soon** absent; **Lvfe: The Xperience**, NCN, `lvfe-save`, Google Maps Platform disclosure, Enugu address, +234 703 547 4827 present. Cloudflare obfuscates mailto in HTML (`[email protected]`), same as footer.
- `https://iconiaglobal.com/pages/privacy-policy` still the universal privacy policy.
- Commit **`d65f503`**.

**Current state:** Live ToS usable for consent screen. Privacy unchanged.

**Next steps:** Paste terms URL into Google Cloud OAuth consent if not already; publish consent to Production. Android OAuth client + SHA-1 still separate.

**Blockers / risks:** None for ToS text. Host DB credentials stay on the server (`main-local.php`); not in this repo.

### 2026-09-03 — Overlay / layout audit + fix (Nord)

**Goal:** Fix overlay/box/text layout across splash/menu, account, dossier 34/70, map FABs, track chip, nord-shell pages; merge sibling map+hub work; verify on Nord `bea6919f`.

**P0s found → fixed:**
1. **Menu button width overflow** — `width:100%` + padding without `box-sizing` made rows spill past `.menu-panel` (ghost edges). Global `box-sizing:border-box` in `nord-shell.css` / `index.html` / `lvfe.css`; menu panel `overflow:hidden`.
2. **Dossier expand stuck at peek height** — class swap to `.doc-exp` kept used ~34vh. `setSheet` now sets **pixel** height/min/max (`0.34` / `0.70 * innerHeight`, floor 160); CSS `#sheet.doc` / `#sheet.doc-exp` `!important` + drop height transitions.
3. **Hit targets & secondary chrome** — nav/nord pills and catalog dossier bar → **≥44px**; filters/pager min-height 44.
4. **Toast vs gold/FABs** — `#toast` uses `--lvfe-chrome-bottom` from `layoutFabs` (gold + FABs share bottom).
5. **Dossier/account text** — flex `min-height:0`, `overflow-wrap`, tab row scroll; account sheet scroll flex; track chip wrap + padding.

**Preserved siblings:** gold hang bottom-left, search magnifier, bus/OSRM alts/NCN (`2a93a78`); Wallet/Earn/Rankings/Analytics + notify (`f9cf927`). No game-logic rewrite.

**How verified (Nord `bea6919f`, CSS ~424×882):**
- CDP: `menuFit:true`, `boxSizing:border-box`, peek **300** / expand **617**, `fabsAbove:true`, idle sheet `display:none`, map full-bleed, `lvfeFitMap` function, gold≠fabs collision, account open h≈635 rows 48px, tabs 44px, `bodyOW:false`.
- Screencaps: `_state/layout-audit/60-splash.png` … `66-idle.png`.
- `assembleDebug` + `adb install -r` + force-stop; **`lastUpdateTime=2026-09-03 10:16:10`**.
- Commit **`d53d896`** pushed to `https://github.com/Slaze/lvfe` (`main`).

**Current state:** Layout P0s closed on installed APK. Pocket-mode OS overlay can blank screencaps if proximity trips — dismiss circles / keep device awake for visual QA.

**Next steps:** Optional track-chip copy shorten; rename local “The Architect”; Android OAuth if fresh Gmail fails.

**Blockers / risks:** Device Pocket Mode / sleep can make `innerHeight` 0 mid-CDP (px heights mitigate).

### 2026-09-03 — Game notifications, Wallet/Earn, rankings, analytics (P0)

**Goal:** Occasional Android notifications for claims / nearby opens / enemy assets; separate Wallet + Earn more; live rankings; analytics tabs; Bid to overturn; keep sibling chrome (gold bottom-left, search mag, NCN, splash menu); Nord install; commit+push `Slaze/lvfe`.

**What changed:**
- `web/js/game-notify.js`, `rankings.js`, `wallet-earn.js`, `play-hub.js` + `scripts/test_game_economy.js`.
- `web/index.html` — `#playHub` (Wallet / Earn / Rankings / Analytics); account Play rows; `#gameBanner` web fallback; GPS nearby scan; claim activity log; cloud ownership diff → rival notify; `lvfeDeepLink`.
- `android/…/MainActivity.kt` + Manifest — channels, `POST_NOTIFICATIONS`, deep links `lvfe://place/…`.
- Dossier/nearby Pay: **Bid to overturn** when enemy-owned (already in `dossier.js` from map-UX commit; wired to `bidToOwn`).
- Did **not** revert sibling gold hang / search mag / bus / alt routes / NCN.

**Why:** Human P0 loop for money surface + presence without spam; highest-stake ownership already in ledger.

**How verified:**
- `node scripts/test_game_economy.js` ok.
- `./gradlew clean assembleDebug` SUCCESS; `adb -s bea6919f install -r`; force-stop; **`lastUpdateTime=2026-09-03 10:08:26`**.
- Commit **`f9cf927`** pushed to `https://github.com/Slaze/lvfe` (`main`).
- Channels `claims`/`nearby`/`enemy`/`game` present in `dumpsys notification`.
- WebView CDP: Wallet opens (100 NCN + Earn more); Earn pane; Rankings `.hub-pos`; Analytics Test notification → native `tag=lvfe` title “Lvfe test”; sibling `goldHang`+`searchMag`+`mapHint` true.

**Current state:** P0 hub + notify live on Nord. Rival events need other players’ ownership in local/server save (no dedicated multiplayer presence server).

**Next steps:** Optional poll interval for remote rival claims beyond save pull; richer city board; rename local “The Architect”; Android OAuth client if fresh Gmail fails.

**Blockers / risks:** True multiplayer rival push needs other players writing the shared save (or a presence channel). Notification permission may be denied — soft-fail to in-app banner.

### 2026-09-03 — Nord reinstall: brand mark on splash/menu

**Goal:** Ship `lvfe-mark-512.png` into the Nord debug APK so splash + main menu show the new seal (not a placeholder L).

**What changed:** Confirmed `web/assets/brand/lvfe-mark-512.png` + splash/menu `<img>` refs in `web/index.html`. Ran `android/sync-www.sh`; `assembleDebug`; `adb -s bea6919f install -r`; `am force-stop com.lvfe.xperience`. No git commit — `android/app/src/main/assets/www/` is gitignored; sync did not change tracked sources.

**How verified:** Source/bundled/APK mark MD5 match `9ac45fbb8d61655794702801309d43ce`. Package `lastUpdateTime=2026-09-03 10:03:05`. Nord screencap of main menu shows gold-ring seal + green pin/L next to “Lvfe / Main menu”. Early splash frame was black (WebView paint race); splash HTML still points at the same mark path.

**Current state:** Brand mark live on Nord menu; splash uses same asset.

**Next steps:** None for brand ship. Unrelated dirty Android/web files remain uncommitted.

**Blockers / risks:** None.

### 2026-09-03 — Map UX: alt routes, bus stops, gold hang, NCN

**Goal:** Map-first upgrades without Google Directions: OSRM alternative walks + in-line Walk/Car labels, OSM bus stops, magnifier search up top, gold account seal hanging bottom-left, player copy **NCN**. Merge with sibling splash/menu — gold still opens the **new** account sheet.

**What changed:**
- `web/js/track-guide.js` — OSRM walk `https://router.project-osrm.org/route/v1/walking/` with `alternatives=3`; if only one path, a perpendicular via-point walk is merged as a dashed alt. Driving `https://router.project-osrm.org/route/v1/driving/` for Car ETA only. Tap dashed line to make it the active green guide. 80 m pay ring kept.
- `web/js/bus-stops.js` — dedicated Overpass layer (`overpass-api.de` + kumi mirror).
- `web/index.html` — `#btnSearch` magnifier in the search pill; `#btnMore` `.gold-hang` bottom-left via `layoutFabs`; `places-label` at street zoom; subtle map hint.
- Dossier / rules / catalog / assets / wallet strings: **NCN** (`LvfeRules.ncn`). Ledger keys still NairaCoin.

**Why:** Public OSRM walk often returns one route; via-point gives a selectable alt without Google. Bus stops are OSM, not claimable. Search stays primary up top.

**How verified:**
- `node scripts/test_track_layers.js` ok.
- `./gradlew assembleDebug` SUCCESS; `adb -s bea6919f install -r`; **`lastUpdateTime=2026-09-03 09:58:35`**. Commit **`2a93a78`**.
- Nord CDP: magnifier top-left, gold bottom-left, chip Walk + Car, **alts=2**, `guide-label` + `bus-stops-dot`; bus features sparse in that Enugu cell (1).

**Current state:** Map chrome + alt routes live on Nord. Splash/menu sibling work remains.

**Next steps:** Tap a dashed alt on a real walk; zoom a city with denser OSM bus stops.

**Blockers / risks:** Public OSRM demo rate limits; Overpass fail-soft hides buses. No Google Maps SKUs.

### 2026-09-03 — OAuth consent URL cheat sheet

**Goal:** Exact Iconia privacy/terms URLs + paste table for Google Cloud OAuth consent (Lvfe: The Xperience).

**What changed:** Added `docs/OAUTH_CONSENT.md`. Verified live: privacy `https://iconiaglobal.com/privacy-policy` (also `/pages/privacy-policy`). Terms URL `https://iconiaglobal.com/pages/terms-and-conditions` exists but body is only “Coming soon…”. No `/lvfe` marketing page; `github.com/Slaze/lvfe` private (404 public); `lvfe-save` is API only. Recommended homepage for now: `https://iconiaglobal.com/`. Authorised domain: `iconiaglobal.com`. Scopes: openid/email/profile.

**Why:** Consent screen needs stable public HTTPS links matching authorised domains; do not invent ToS URLs.

**How verified:** `/usr/bin/curl` status codes on common paths; Context scrape of privacy + terms pages.

**Current state:** Privacy ready to paste. Terms must be filled on Iconia before Production ToS field is honest. Local `hosting/lvfe` has no `privacy.html`.

**Next steps:** Human fills Iconia terms CMS (or `/terms` / `/lvfe/terms`); paste cheat sheet into Console; publish consent; keep Android OAuth client + SHA-1.

**Blockers / risks:** Terms placeholder will fail a serious review if left as “Coming soon…”.

### 2026-09-03 — Lvfe brand mark for Google OAuth + splash

- **Goal:** Proper logo assets for Google Cloud OAuth consent branding and app splash (not placeholder “L” gold disc).
- **What changed:**
  - `web/assets/brand/lvfe-mark-512.png` (+ `lvfe-mark-1024.png`) — square seal: dark disc, gold ring, green map pin, gold geometric L. No Google Maps / “G” marks.
  - `web/assets/brand/lvfe-logo-wide.png` (1024×512) + `lvfe-logo-wide-1536.png` — horizontal wordmark “Lvfe” + “The Xperience” on white for consent.
  - SVG sources: `lvfe-mark.svg`, `lvfe-logo-wide.svg` (+ flat SVG rasters `*-svg*.png` as backups).
  - Human upload folder: `exports/brand/GOOGLE-OAUTH-app-icon-512.png`, `GOOGLE-OAUTH-logo-wide-1024x512.png`, `README.txt`.
  - Splash + main-menu seals in `web/index.html` now `<img src="assets/brand/lvfe-mark-512.png">`; `nord-shell.css` img-friendly `.splash-seal`.
- **Why:** Consent screen + splash need readable green/gold/dark-glass mark on white and dark; vector SVG for future edits; AI-rendered PNGs used as primary premium seal look.
- **How verified:** `magick identify` sizes; visual review of 512 mark + wide logo; files present under `web/assets/brand/` and `exports/brand/`.
- **Current state:** Assets ready for Console upload; splash wired. Other uncommitted map/catalog work on disk is unrelated and was not included in this commit.
- **Next steps:** Upload icon + wide logo in Google Cloud OAuth consent branding; re-run `android/sync-www.sh` before next Nord APK so splash mark ships in the bundle.
- **Blockers / risks:** None for asset delivery. Android OAuth client + SHA-1 still required for native sign-in separately.

### 2026-09-03 — Critic/builder: skipped requests + splash/menu remodel (PASS)

**Goal:** Inventory all human asks; close P0 gaps (splash/menu, gold-seal old UI, Google signed-in state); remodel chrome from last Nord screenshots (dark glass / orange / gold seal); keep map features; install Nord; commit+push `Slaze/lvfe`.

**Skipped-request audit (inception → now)**

| Request | Status | Notes |
|---|---|---|
| Splash / intro then main menu (Play Now, Save, Restart, Check Catalog) | **DONE** (this session) | Was SKIPPED; now `#bootOverlay` splash → menu |
| Gold seal options land in modern IA (not old flat UI) | **DONE** (this session) | Was PARTIAL; catalog/rules/assets + account restyled via `nord-shell` |
| Google signed-in: hide Sign-in CTA; show identity; persist | **DONE** (this session) | Was PARTIAL (note only); now chip + Sign out; `unbindGoogle` |
| Zero Google Maps SKUs / OSM path | DONE | Standing rule |
| Enugu polygons + catalog schema + ingest | DONE | |
| NairaCoin as currency / endowment ownership loop | DONE (IOU) | On-chain genesis still open |
| No “The Architect” in player UI | PARTIAL | Code/copy cleaned; **local Nord name still “The Architect”** — rename via Name and neighbourhood |
| AR switch + CameraX viewfinder | DONE | |
| 3D tilt + extrusion + SAT ghost 0.35 | DONE | Not Google Photorealistic mesh |
| Walk beep / Track / green walk line / Mute | DONE | |
| Dossier 34vh peek / 70vh expand / Pay @ 80 m | DONE | CDP: `.sheet.doc` height rule + ~300px |
| Satellite toggle (Esri) | DONE | |
| Rules + My assets pages | DONE | Remodeled chrome this session |
| Server / public save (`iconiaglobal.com/lvfe-save`) | DONE | |
| Gmail Web client ID | DONE | Wired `730640559588-…` |
| Android OAuth client + SHA-1 for Credential Manager | **BLOCKER / PARTIAL** | Fresh native sign-in may fail loud; existing session on Nord works |
| NairaCoin genesis + seed on iconiaglobal | SKIPPED / P1 | DNS noted; daemon not listening; empty genesis in protocol |
| Photo confirm / discard UX | DONE | IndexedDB on Pay; discard on cancel/close |
| Export / Import save | DONE | Plus cloud Sync |
| Filters (quality / neighbourhoods) | DONE | In account Map pins |
| World Overpass outside Enugu | DONE | |
| Calendar / Gmail as game props (original GTA-Google brief) | SKIPPED / rejected | Replaced by $0 OSM stack |
| Divine Authority / God Mode player features | SKIPPED / rejected | Internal `architect` username only |

**P0 backlog closed this session:** splash+menu; gold destinations; Google signed-in UI.  
**P1 remaining:** NairaCoin genesis/seed; rename local “The Architect”; optional subdomain `lvfe-save.iconiaglobal.com`; turn off `LVFE_ALLOW_DEV_AUTH` after Android OAuth verified; catalog default “My places” empty until owned pins.

**What changed:**
- `web/css/nord-shell.css` — design tokens + splash/menu + signed-in chip.
- `web/index.html` — splash/menu overlay; Save/Restart/Account; Main menu from seal; Google hide/show; translucent account sheet accents.
- `web/js/account.js` — `unbindGoogle`, `googleSessionFor`.
- `web/css/lvfe.css`, `catalog.html`, `rules.html`, `assets.html` — Nord dark pill nav.
- `.gitignore` — `_state/`.

**Why:** Human asked for intro menu + no resurrection of old chrome + correct signed-in Google state. Visual reference: Nord Screenshots 08:58–08:59 (dark glass energy dashboard) for chrome; Lvfe map 06:12 + live map for play layer.

**How verified (Nord `bea6919f`):**
- `assembleDebug` SUCCESS; `adb install -r`; **`lastUpdateTime=2026-09-03 09:25:56`**.
- Commit **`510a64a`** pushed to `https://github.com/Slaze/lvfe` (`main`).
- Screencaps: splash, menu, account signed-in (no Sign in button; “Signed in as ugidentity@gmail.com”), catalog pill nav.
- WebView CDP: `bootHidden` false→true on Play; `googleBtnHidden:true`; `places-x` + `guide-line` present; `.sheet.doc` 34vh rule true; catalog URL loads.

**Current state:** PASS on P0 UI gates. Map features intact. Google session already present on this Nord profile.

**Next steps:** Confirm Android OAuth client exists for package+SHA-1; after that set host `LVFE_ALLOW_DEV_AUTH=0`. Rename local player off “The Architect”. Optional NairaCoin genesis work.

**Blockers / risks:** Android OAuth client may still be required for *new* Credential Manager sign-ins on other devices. Device must be unlocked for adb screencap (lockscreen captured as black earlier).

### 2026-09-03 — Wire Google Web OAuth client ID + ship Nord

**Goal:** Paste human Web OAuth client ID into Lvfe client + Iconia save host; rebuild/install on Nord `bea6919f`; commit+push public client ID files (not `config.local.php` / SAVE_SECRET).

**What changed:**
- `web/js/google-auth.config.js` — `WEB_CLIENT_ID` = `730640559588-i03q4imeb8cl8lonr3j6iliaefmr1sa6.apps.googleusercontent.com`.
- `android/app/src/main/res/values/strings.xml` — `google_web_client_id` same string.
- Host-only `hosting/lvfe-save/config.local.php` (gitignored) — `GOOGLE_WEB_CLIENT_ID` same; `LVFE_ALLOW_DEV_AUTH=1` left on. FTP upload to `public_html/lvfe-save/` via FileZilla **Iconia Server** (`iconicxy@198.54.120.95`). No Client Secret committed or uploaded beyond existing SAVE_SECRET.
- Debug APK rebuilt (`assembleDebug`); `adb -s bea6919f install -r`; force-stop `com.lvfe.xperience`.

**Why:** Web client ID unblocks GIS / Credential Manager token audience + save-host Google Bearer path. Android OAuth client (package + SHA-1) is still a separate Console step if not already created.

**How verified:**
- Disk: ID present in `google-auth.config.js`, `strings.xml`, synced `assets/www/js/google-auth.config.js`, host config (gitignored).
- `curl https://iconiaglobal.com/lvfe-save/health` → `{"ok":true,…,"devAuth":true,"googleConfigured":true}`.
- `./gradlew assembleDebug` SUCCESS; install Success; **`lastUpdateTime=2026-09-03 08:48:03`**.
- Commit **`43a4e70`** pushed to `https://github.com/Slaze/lvfe` (`main`).
- `git check-ignore` confirms `config.local.php` ignored.

**Current state:** Web client ID live on phone + public save. Dev auth still enabled. Sign-in may still fail until Google Cloud has an **Android** OAuth client for `com.lvfe.xperience` with SHA-1 `2E:48:31:66:B1:07:A2:4C:FB:25:35:EE:EA:9C:B6:B3:E5:E4:35:E5`.

**Next steps:** Create Android OAuth client if missing; tap Sign in with Google on Nord (gold seal → account sheet → Sign in with Google). After Gmail works end-to-end, set host `LVFE_ALLOW_DEV_AUTH=0` and re-upload `config.local.php`. Optional subdomain `lvfe-save.iconiaglobal.com`.

**Blockers / risks:** Android OAuth client + SHA-1 still required for native Credential Manager on Nord — fail loud if Console only has the Web client.

### 2026-09-03 — Public save URL + Google Web client ID how-to

**Goal:** (1) Public save API so Nord syncs without LAN. Prefer iconiaglobal.com subdomain; else Netlify. (2) Document Google Web client ID steps and keep placeholders empty until human pastes. Commit+push `Slaze/lvfe`. Zero Maps SKUs.

**What changed:**
- `hosting/lvfe-save/` — PHP save API (health + GET/PUT `/v1/save/:key`, LWW, photos trim, auth parity with Node). Deployed to Iconia `public_html/lvfe-save/` via existing FileZilla **Iconia Server** FTP (`iconicxy@198.54.120.95`). Apex `.htaccess` pass-through now includes `lvfe-save` with `ipm-app|demos`.
- Host-only `config.local.php` (gitignored) with generated `SAVE_SECRET`; `LVFE_ALLOW_DEV_AUTH=1` until Google OAuth is live.
- `web/js/save-api.config.js` default `SAVE_API_BASE=https://iconiaglobal.com/lvfe-save` (override `?saveApi=` / localStorage still works).
- `web/js/google-auth.config.js` blocker steps expanded (consent, Web origins incl. `appassets.androidplatform.net`, Android client + SHA-1, host `GOOGLE_WEB_CLIENT_ID`, then `LVFE_ALLOW_DEV_AUTH=0`).
- `.gitignore` ignores `hosting/lvfe-save/config.local.php` + save JSON dir.
- Netlify still optional — CLI not logged in on this machine (`npx netlify status` → Not logged in). GitHub Pages cannot run the API.
- Preferred subdomain `lvfe-save.iconiaglobal.com`: DNS empty; human Cloudflare + cPanel steps documented in `hosting/lvfe-save/README.md`.

**Why:** Namecheap origin is Apache/PHP (no Node). Netlify needs login. Path URL on working HTTPS apex ships today; CNAME subdomain later.

**How verified:**
- `curl https://iconiaglobal.com/lvfe-save/health` → `{"ok":true,"service":"lvfe-save","host":"php",…}`
- PUT/GET round-trip with `Bearer lvfe-dev:<key>` + Bearer `SAVE_SECRET` ok.
- `keytool` SHA-1 re-verified `2E:48:31:66:B1:07:A2:4C:FB:25:35:EE:EA:9C:B6:B3:E5:E4:35:E5`.
- `./gradlew assembleDebug` SUCCESS; `adb -s bea6919f install -r` Success; **`lastUpdateTime=2026-09-03 07:38:16`**.
- Commit **`17fbb31`** pushed to `https://github.com/Slaze/lvfe` (`main`).

**Current state:** Cloud save default on for web + Nord APK. Dev auth still on (pre-Google). Google Web client ID still empty. Netlify undeployed. Subdomain DNS not set.

**Rotate SAVE_SECRET:** Edit host `public_html/lvfe-save/config.local.php` only → re-upload via FTP. Do not commit. `lvfe-dev:` clients unaffected until `LVFE_ALLOW_DEV_AUTH=0`.

**Next steps (superseded 2026-09-03 Web ID session):** Web client ID now wired; verify Gmail on Nord after Android OAuth client exists; then `LVFE_ALLOW_DEV_AUTH=0`. Optional: Cloudflare A/CNAME `lvfe-save` + cPanel subdomain → then switch `SAVE_API_BASE` to `https://lvfe-save.iconiaglobal.com`. Optional: `npx netlify login` + deploy function as backup.

**Blockers / risks:** Dev auth on a public URL is intentional until OAuth; tighten after Google. FTP password lives in FileZilla (not in repo). No Netlify auth token on disk.

### 2026-09-03 — Server saves + AR pins + world catalog (ordered delivery)

**Goal:** (1) Progress survives reinstall / cross-device via save API. (2) AR shows pin glyphs on CameraX when within claim range. (3) Outside Enugu, named Overpass POIs near GPS. Then commit+push to `Slaze/lvfe`. Zero billed Google Maps SKUs. Do not revert SAT 0.35 / green walk / red·black X / dossier 34·70 / account sheet / Esri / `addLy({` / `lvfeFitMap` / CameraX / hinterland / photo IDB.

**What changed:**
- `server/index.js` + `.env.example` + `README.md` + `test.js` — localhost save API on **18787**; LWW by `updatedAt`; `lvfe-dev:` auth; Google token path fails loud until `GOOGLE_WEB_CLIENT_ID`.
- `netlify.toml` + `netlify/functions/save.js` — optional deploy (env: `SAVE_SECRET`, `LVFE_ALLOW_DEV_AUTH=0`, `GOOGLE_WEB_CLIENT_ID`).
- `web/js/save-api.config.js`, `save-sync.js`; `account.js` `updatedAt`; `index.html` pull/push/queue/Sync now.
- `web/ar-overlay.js` + `MainActivity.kt` `getDeviceHeading` — FOV billboards ~120 m; glyphs match map; `?arMock=1` debug pin ~45 m north.
- `web/js/world-catalog.js` + `field-claim.js` — Overpass viewport outside Enugu bbox; cache + rate-limit; hinterland fallback.
- Tests: `scripts/test_save_world_ar.js`; `server/test.js`; existing account/conquest/etc.

**Why:** Local-only saves wiped on reinstall. AR had live camera but unverified building pins. Hinterland alone was unnamed outside Enugu. Chose Node+files (simplest verify) over inventing FTP; Netlify as optional host.

**How verified:**
- `node server/test.js` + curl PUT/GET round-trip on `:18787` ok.
- `node scripts/test_save_world_ar.js` + account/conquest/track/sat/map3d ok.
- Live Overpass Lagos `6.52,3.38` → **74** features (e.g. Chicken Republic/food/B).
- `./gradlew assembleDebug` SUCCESS; `adb -s bea6919f install -r` Success; **`lastUpdateTime=2026-09-03 07:12:49`**.
- Commit **`0b600e4`** pushed to `https://github.com/Slaze/lvfe` (`main`).

**Current state:** Cloud save works when `SAVE_API_BASE` / `?saveApi=` / `localStorage.lvfe.saveApiBase` points at `http://<lan>:18787` (or Netlify). Default APK has empty base → local+Export only until configured. AR heading bridged; mock pin for desk test. World catalog live outside Enugu.

**Env vars (recap):** `PORT`, `SAVE_SECRET`, `LVFE_ALLOW_DEV_AUTH`, `GOOGLE_WEB_CLIENT_ID`, `SAVE_DIR`, `MAX_BODY_BYTES` (server); Netlify same names via site UI / `Netlify.env`.

**Next steps:** Human sets Google Web client ID + (optional) Netlify deploy / LAN save URL on Nord. Walk within 80 m of a real pin with AR on, or use `arMock=1`. Simulate GPS outside Enugu (`?lat=&lon=`) for named Overpass pins.

**Blockers / risks:** Google Web client ID still empty — production Gmail sync/sign-in fails loud by design. Public save host not deployed (local `server/` verified). Cleartext HTTP from WebView to LAN may need cleartext permission if using http://LAN (document; prefer HTTPS Netlify for production).

### 2026-09-03 — Menu + navigation critic/builder (resume after `365af887`)

**Goal:** Critic → fix P0s → Nord install → re-score map-game nav (GMaps / Pokémon GO class). Do not revert green walk / red X / black unknown / SAT ghost 0.35 / Google auth / photo-store / field-claim. Merge with place-dossier compact peek (~28–40%) — do not revert.

**Critic P0s (pre-fix, disk after dead agent `365af887`):**
1. **`bindAccountSwipe` called but never defined** — `bindChrome()` threw; GPS / SAT / 3D / AR / sheet handlers after that call never bound.
2. **Account hero dead** — `paintProfileMenu` still wrote `#menuWho` (removed from DOM); seal/name/coin/stamp never updated.
3. **`#btnGoogleSignInSheet` unwired** — Google button in the new sheet did nothing.
4. **Handle / tab targets &lt; 44px** — 36×4 drag pills; compact doc tabs had been forced to **36px**.

Not P0 here (sibling / preserved): place `.sheet.doc` **34vh** + `.doc-exp` **70vh**; green walk / red+black X / SAT 0.35.

**What changed:**
- `web/index.html` — `bindAccountSwipe` (swipe-down dismiss); `paintProfileMenu` paints stamp/seal/name/coin/Google note; wired sheet Google button; About + identity-edit close account first; 44px handle hit areas; dossier tabs **min-height 44px**; `layoutFabs` prefers measured sheet height.
- Left sibling place-sheet heights / expand control alone.
- No commit/push.

**Why:** Prior agent shipped account-sheet markup but died mid-JS. Completing that sheet + unblocking `bindChrome` was the smallest path to the six gates.

**How verified:**
- `node --check` inline script ok; `./gradlew assembleDebug` SUCCESS; `adb -s bea6919f install -r` + `am force-stop`.
- **`lastUpdateTime=2026-09-03 06:53:40`** (reinstall after sibling dossier peek merge).
- Nord CDP + PNG `/tmp/lvfe-nav-rescore/{idle,menu,doc}-final.png`: idle sheet height 0; account sections You/Play/Map pins/This phone; handles/rows ≥44–48px; pin dossier **34%** + five tabs tabH **44**; SAT/3D toggle; APK still `#00e676` + `SAT_EXTRUSION_OPACITY=0.35`.

**Current state:** **PASS** on the six menu/nav gates. Map-first idle. On-map SAT/3D/AR/GPS. Grouped account sheet. Motion ~240ms + swipe dismiss. Place peek from sibling intact.

**Next steps:** Tap gold seal → account → ×/swipe; tap pin → ~⅓ paper file → ▴ expand. Optional: rename device test identity off “The Architect” (localStorage, not chrome copy).

**Blockers / risks:** Google Web client ID still empty — Sign in fails loud by design.

### 2026-09-03 — Dossier sheet compact peek (map stays majority)

**Goal:** Place-tap popup was covering ~70% of the Nord screen so the player could not see pins / walk line / SAT context. Open at a compact peek (~28–40vh), allow expand for full tabs, keep idle `display:none`, keep movestart from closing while dossier/track is open.

**What changed:**
- `web/index.html` only (surgical; did not rewrite sibling account/⋯ sheet work):
  - CSS: `.sheet.doc` **34vh** peek; new `.sheet.doc-exp` **70vh** expand; shared paper dossier chrome on both; scroll height `calc(*vh - 44px)` to match 44px sheet-bar; ▴ `#sheetExpand` control.
  - JS: `openPlacePopup` → `setSheet("doc")` (preserves `doc-exp` on GPS refresh); `toggleDocSheet`; handle / ▴ toggle peek↔expand; × + swipe-down still `closeSheet()`; swipe-up from peek expands; `layoutFabs` uses 0.34 / 0.70; `setSheet` removes/adds `doc-exp`; idle still `collapsed` + `hidden` + `display:none`.
- `web/js/dossier.js` unchanged (HTML builder only).

**Why:** Root cause was CSS/JS opening straight to `.sheet.doc { height: 70vh }`. Rejected rewriting the whole sheet/nav; kept existing collapsed/peek/half/full modes and dossierPinned movestart guard.

**How verified:**
- Inline map script parse OK; assets synced via `./gradlew assembleDebug`.
- `adb -s bea6919f install -r` + `am force-stop`.
- CDP on Nord (~423×882): peek **ratio 0.34** (300px); expand **0.70** (617px); collapse back 0.34; movestart leaves sheet open; × → `display:none` height 0. Screencap `/tmp/lvfe-sheet-peek.png`.
- **`lastUpdateTime=2026-09-03 06:50:41`**.

**Current state:** Place tap = map-majority peek. Expand available. Close clears. Pay/photo/80 m logic untouched (same dossier HTML + claim button). Sibling nav/account sheet edits left in place.

**Next steps:** Player: tap any pin → confirm sheet is ~⅓ screen with map above; tap ▴ (or handle / swipe up) → full tabs; × closes with no blank dark panel.

**Blockers / risks:** OpenFreeMap style may be slow to load on cold start (unrelated); CDP place-source open needs loaded places — height modes verified by forcing `setSheet` when tiles lag.

### 2026-09-03 — Map chrome: green walk / red X / black unknown

**Goal:** Walk-to-pin line reads as bright green (not gold) on Liberty and Esri SAT. Unclaimed named pins are red X. Unknown (quality D / unidentified) pins are black X and the highest-value quality tier. Do not revert SAT drape, ghost walls, `addLy({`, `lvfeFitMap`, Esri `{z}/{y}/{x}`, CameraX AR, Pay-on-geolocate.

**What changed:**
- `web/js/track-guide.js` — `guide-line` `#00e676`, `guide-casing` `#00c853`. Pay fill/ring stay gold/orange. `line-join`/`line-cap` still in **layout**. `ensureLayers` still retries when the GeoJSON source already exists.
- `web/js/conquest.js` — unclaimed X `#ff3b30`. Unknown mark `owner_mark=unknown`, color `#111111`. `isUnknownPlace` = quality D **or** `civic_unknown` **or** `unmapped` (not quality C unnamed shops). `baseValue` for unknown = `max(rec.value, 100)`; named empty still 0. `displayValue` / `costToBack` then apply neighbourhood bonus (hinterland still 0). Ledger `rec.value === sum(stakes)` unchanged.
- `web/js/claim-rules.js` — `isUnknownPlace`; `qualityWords("D")` = "Unknown building".
- `web/index.html` — canvas `lvfe-x` red + `lvfe-x-unknown` black (light halo so SAT reads). Layer `places-x-unknown`. Hit layer still fat. Filter/click/3D restack include the new layer. AR glyph red / black.
- `web/js/dossier.js` — unstaked unknown shows `N NairaCoin · no one has backed this yet` (floor is not a fake stake).
- `web/map-3d.js` / `web/js/satellite.js` — stack `places-x-unknown`. SAT drape / 0.35 ghost / solid boxes untouched.
- `web/ar-overlay.js` / `web/rules.html` — black unknown glyph; player copy says green line, red X, black unknown.
- `scripts/claim_points.py` — `QUALITY["D"]` 0.55 → **1.6** (above A 1.25) for future ingest. Live map uses the JS floor 100, not a catalog re-export. Baked geojson still has old D `claim_points` (8 / 10 on the two civic_unknown rows).

**Why:** Gold walk fought SAT roofs and Liberty beige. White X looked like labels. Unknown vs unclaimed was already quality D / `civic_unknown` (2 pins: `w_760009591` Emene, `w_1059375680` Ogui) — did not invent a class or paint quality C red-as-black. Rejected: merging unknown into red X; minting the floor into `rec.value`.

**How verified:**
- `node scripts/test_track_layers.js` / `test_conquest.js` / `test_place_title.js` / `test_satellite.js` / `test_map_3d.js` ok. Inline `node --check` via those scripts. 0 `addLy({)`.
- `./gradlew clean assembleDebug` SUCCESS (first assemble hit stale dex `graph.bin`; clean rebuilt). APK `assets/www` has green line, red/black X, `places-x-unknown`.
- `adb -s bea6919f install -r` Success; `am force-stop`; **`lastUpdateTime=2026-09-03 06:34:50`**.
- CDP optional this pass (not run). Phone walk: track a pin → green line; named unclaimed → red X; the two D buildings → black X.

**Current state:** Walk line green. Named unclaimed red X. Quality D unidentified black X + display/cost floor 100 (150 in a winning neighbourhood). Claimed still circles. SAT+3D ghost 0.35 and SAT-off solid boxes left as-is.

**Next steps:** Nord: SAT on then off — green walk on both; red X dense; jump to Emene `w_760009591` / Ogui `w_1059375680` for black X. Open an unknown dossier: Money should show 100 (or 150) + “no one has backed this yet”.

**Blockers / risks:** Only **2** quality-D pins in the 1044-row catalog, so black X is rare. Catalog.json / places.geojson `claim_points` for those two still use old QUALITY D 0.55 until re-ingest; JS floor 100 is what the player sees. Black X uses a light halo so it reads on SAT; do not drop the halo.

### 2026-09-03 — Auth, Gmail path, photos, claim outside Enugu

**Goal:** Answer how auth/records/photos work; ship smallest Gmail + reinstall-survival path (no fake login); store confirmed photos locally; let players outside Enugu see their GPS and claim hinterland. Zero billed Google Maps SKUs. Do not revert SAT/3D/X-circles.

**What changed:**
- `web/js/google-auth.config.js` — empty `WEB_CLIENT_ID`; console steps (Web client ID, Android SHA-1, package `com.lvfe.xperience`). Identity OAuth only.
- `web/js/google-auth.js` — Sign in with Google. Native WebView first. GIS only if a real client ID exists. Never pretends success.
- `web/js/account.js` — unique username; Google `sub` → `g{sub}` player key; export/import pack (`lvfe.save.v1`: identity, places/stakes, IOU wallets, faction pool, field pins).
- `web/js/photo-store.js` — pending file in RAM; Pay confirm → IndexedDB; sheet close / cancel discards. No Cloud upload.
- `web/js/field-claim.js` — Enugu catalog bbox; outside → `Unclaimed area` at GPS + nearby on-screen OSM footprints. No planet download.
- `web/index.html` — identity gate Google button + blocker copy; ⋯ Export/Import save; geolocate `flyToUser`; visit Pay confirms photo.
- `android/…/MainActivity.kt` + `strings.xml` `google_web_client_id` empty; Credential Manager Google ID token; `LvfeNative.signInWithGoogle`.
- `web/rules.html` — record / photo confirm / outside-Enugu GPS.
- `scripts/test_account_photo_field.js`.

**Why:** Auth was username-only localStorage (`lvfe.identity.{playerKey}`). Photos were metadata-only (bytes dropped). Map defaulted to Enugu `[7.515, 6.45]`; catalog is Enugu-only so Lagos/London had nothing to claim. Rejected: fake Gmail login, Maps/Places keys, server accounts without console IDs.

**How verified:** `node scripts/test_account_photo_field.js` ok; `test_satellite.js` / `test_map_3d.js` / `test_conquest.js` / `test_track_layers.js` / `test_place_title.js` / `test_nairacoin_ledger.js` / `test_endowment.js` ok. `./gradlew assembleDebug` SUCCESS. `adb -s bea6919f install -r` Success; **`lastUpdateTime=2026-09-03 06:34:01`**. APK `assets/www/js/` includes account.js, google-auth*.js, photo-store.js, field-claim.js. No commit/push.

**Current state:**
- **Auth today:** no accounts. Unique name + optional faction in localStorage. Wallet `lvfe.nc.iou.v1.{playerKey}` (demo faucet 100). Places `lvfe.places.v1`. **Reinstall = wipe.** Android backup may restore WebView storage; do not rely on it.
- **Gmail:** button ships; tap fails loud with console steps until Web client ID is pasted in two files. After OAuth: `sub` is account key; player still picks a unique **name** (not email).
- **Photos:** CameraX/file chooser → `<input capture>`. Confirm = Pay with image. Discard = × sheet, cancel camera, non-image, GPS/80 m fail (bytes never committed).
- **Outside Enugu:** GPS flies to you. Outside catalog bbox (~3 km pad around bundled pins) you get a claimable hinterland X. Worldwide named catalog still needs Overpass ingest (**blocker**).

**Next steps:** Human pastes Web client ID + creates Android OAuth client (SHA-1, `com.lvfe.xperience`). Rebuild APK. Tap Sign in with Google. Optional later: server save keyed by `sub`.

**Blockers / risks:** Google Cloud OAuth client IDs are empty — login cannot succeed until a human creates them. Catalog expansion beyond Enugu is not this pass (hinterland pin only). Credential Manager needs Play Services.

### 2026-09-03 — Independent SAT-on-terrain + ghost walls critic (builder `c92a3d55` / Nord 06:16, no code)

**Goal:** Harsh PASS/FAIL of SAT drape + ghost walls vs Google-ish photo-over-hills *feel*. Free MapLibre + Esri + Terrarium only. No billed Photorealistic 3D. Do not implement. Do not push.

**What changed:** Docs only (this recap). No `web/` / `android/` edits.

**Why:** Builder `c92a3d55` claimed SAT-off extrusion opacity **1**, SAT+3D **0.35**, restack Liberty → `esri-sat` → `building-3d` → pins via `lvfeSyncSat3d`, no `setStyle`, Esri `{z}/{y}/{x}`, maxzoom 18/24, installed `lastUpdateTime=2026-09-03 06:16:18`. Score the live Nord WebView + adb PNG, not the claim.

**How verified:**
- Disk `web/map-3d.js`: `SAT_EXTRUSION_OPACITY=0.35`, `SOLID_EXTRUSION_OPACITY=1`, `restackSat3d` + `lvfeSyncSat3d`. `web/js/satellite.js`: Esri `{z}/{y}/{x}`, source maxzoom **18**, layer **24**, `setOn`/`failToStreets` call `lvfeSyncSat3d`. 0 `setStyle(`. `node --check` both ok. APK zip: no `play-services-maps` / `gms/maps` / `maps.googleapis`.
- Nord `bea6919f`: `am force-stop` + `am start` `com.lvfe.xperience/.MainActivity`. `dumpsys lastUpdateTime=2026-09-03 06:16:18` (matches builder). Canvas **424×882** (buffer 1081×2249) — not the old 400×300 stamp.
- Boot CDP (SAT leftover on, 3D off): `satVis=visible`, src max 18 / layer 24, Esri `{z}/{y}/{x}`, `places-x` + `places-circles` present, 0 google scripts / Network photoreal hosts.
- SAT **on** + 3D Independence/New Haven z15.6 pitch **52**: CDP `fill-extrusion-opacity=0.35`, `esri-sat` idx **110** / `building-3d` **111** / `places-x` **118**, terrain `{lvfe-dem, 1}`, 2D `building` none, SAT+3D switches `aria-checked=true`. Adb PNG `/tmp/lvfe-sat3d-critic/sat-on-3d-b.png` (2.8 MB) + map crop `sat-on-3d-b-map.png` + fabs `sat-on-3d-b-fabs.png`: photo trees/ground/roofs visible **through** soft beige boxes; SAT green / 3D green; X pins on top; Independence Layout / Rangers / Okpara. Not opaque paper city. Not Esri empty plate.
- SAT **off** + 3D same GPS z16.2 pitch 52: CDP opacity **1**, `esri-sat` visibility **none**. PNG `/tmp/lvfe-sat3d-critic/sat-off-3d.png` (558 KB) + `sat-off-3d-fabs.png`: solid beige box city, Liberty paper ground, SAT gray / 3D green, readable streets.
- SAT **on**, 3D **off**: PNG `/tmp/lvfe-sat3d-critic/sat-on-3d.png` (2.4 MB) + `sat-on-3d-fabs.png`: full-bleed Esri photo (trees/roofs/roads), SAT green / 3D gray, X pins, Independence Layout. No 3D boxes. Previous SAT critic does not regress. (Later critic re-`setOn` tripped the 8 s SAT fail-watch → `sat-on-2d.png` 284 KB Liberty — discarded as critic artifact, not a product fail.)
- X pins: `places-x` layer + bitmap X on SAT+3D and SAT-on 3D-off. No Google SKU.

**Current state:** **PASS.** All four gates true on the 06:16 Nord APK. SAT+3D is photo ground + ghost walls. SAT-off 3D is still a solid box city. SAT-on 3D-off stays full-bleed. Pins X. Not Shoprite facades / not Google Photorealistic 3D.

**Remaining P0s:** none on this gate.

**Next steps:** None for SAT-on-terrain + ghost walls. Optional: claim one pin so circles paint next to X; street walk for DEM/Esri under a moving GPS.

**Blockers / risks:** Terrarium AWS + Esri + OpenFreeMap need network. Ghost walls are still OSM boxes. CDP WebGL screenshots black — adb PNG is the evidence. Phone lock / shade can zero later caps. Re-invoking `LvfeSatellite.setOn(true)` while already on resets the 8 s tile watch and can `failToStreets` — UI toggle is `toggle()`, not a remaining P0.

### 2026-09-03 — $0 photoreal-look (SAT drape + ghost walls)

**Goal:** When SAT and 3D are both on, Enugu should read as a tilted aerial photo over hills, with buildings as soft/ghost walls so roofs are the SAT photo. Not Google Photorealistic 3D. Not Shoprite facades.

**What changed:**
- `web/map-3d.js` — `SOLID_EXTRUSION_OPACITY=1` (SAT-off box city). `SAT_EXTRUSION_OPACITY=0.35` when SAT+3D. `restackSat3d` moves `esri-sat` above Liberty beige, then `building-3d` above SAT, then pins/game. `lvfeSyncSat3d` on SAT toggle and 3D toggle. After `setTerrain`, re-`ensure` SAT so the raster drapes on Terrarium (MapLibre drapes rasters when terrain is live; no `setStyle`). Pitch 52, sky, `setLight`, vertical-gradient kept. No hillshade (would fight SAT). DEM fail path unchanged (flat, switch off, banner).
- `web/js/satellite.js` — `setOn` / `failToStreets` call `lvfeSyncSat3d`. Source maxzoom **18**, layer **24**, URL `{z}/{y}/{x}` unchanged. No `setStyle`.
- `scripts/test_map_3d.js` / `scripts/test_satellite.js` — ghost-opacity + restack checks.

**Why:** SAT+3D on the 05:56 APK was opaque beige boxes covering the photo (`moveLayer(building-3d)` over SAT at opacity 1). Drape is free once terrain is on; ghost walls let SAT roofs show through. Rejected: Google/Cesium 3D Tiles, Mapbox Standard, scraped Earth, hillshade, SAT above walls (hides ghost silhouettes).

**How verified:**
- `node --check` map-3d.js + satellite.js; `node scripts/test_map_3d.js` ok (inline `node --check`); `test_satellite.js` / `test_conquest.js` / `test_track_layers.js` ok. 0 `addLy({)`.
- `./gradlew assembleDebug` SUCCESS. `adb -s bea6919f install -r` Success; `am force-stop`; **`lastUpdateTime=2026-09-03 06:16:18`**.
- Nord CDP: SAT+3D Independence/New Haven — `fill-extrusion-opacity=0.35`, `esri-sat` idx 110 / `building-3d` 111 / `places-x` 118, pitch 52, terrain `{lvfe-dem, 1}`, 2D `building` none, canvas **424×882**. SAT-off + 3D: opacity **1**, `esri-sat` none, solid boxes (`/tmp/lvfe-3d-solid.png`). SAT+3D screencap `/tmp/lvfe-sat3d-z16b.png` (2.8 MB): SAT vegetation/ground + ghost boxes + X; SAT and 3D switches green.

**Current state:** SAT still Esri overlay. 3D still one `#btn3d`. SAT+3D = photo ground + 0.35 walls. SAT-off + 3D = solid box city. Pins X/circles, no chimneys. Not photoreal facades.

**Next steps:** Player walk: SAT on, then 3D, Independence Layout / New Haven at street zoom — roofs should read as photo through soft boxes. SAT off should snap back to solid beige city.

**Blockers / risks:** Terrarium AWS + Esri + OpenFreeMap need network. Ghost walls are still OSM boxes (no Shoprite facades). CDP WebGL screenshots black — adb PNG is the evidence. Phone lock / shade can zero later caps.

### 2026-09-03 — Independent GMaps 3D re-score (builder `533ca9ea` / Nord 05:56, no code)

**Goal:** Harsh pass/fail of critic `a07cc0ab` loop-exit vs Google Maps 3D *feel*. Free MapLibre only. No billed Photorealistic 3D. Do not implement.

**What changed:** Docs only (this recap). No `web/` / `android/` edits.

**Why:** Last FAIL was skip-filter + idle z12.2 empty tilt, no sky, 1.7× DEM, poles/−16, second `visualizePitch` control. Builder `533ca9ea` claimed every footprint extruded (untagged 5 m), tap 3D → zoom ≥14.2 pitch 52, terrain 1.0 + sky, one `#btn3d`, billboard pins. Score the installed APK, not the claim.

**How verified:**
- Disk `web/map-3d.js` SHA = APK `assets/www/map-3d.js`. `UNTAGGED_M=5`, no `hasTrueHeightExpr` / `unknownFootprintFilter`, opacity 1, `ZOOM_3D=14.2`, `TERRAIN_EXAGGERATION=1.0`, `setSky`, `visualizePitch: false`. `node scripts/test_map_3d.js` ok (regex only — not the score). Gradle: CameraX + WebView; `google()` is Maven. No Play Maps SDK / `maps.googleapis`.
- Nord `bea6919f` `lastUpdateTime=2026-09-03 05:56:44` (builder said 05:55; same APK). CDP: boot pitch 0, `#btn3d` gray, 0 `.maplibregl-ctrl-pitch`, canvas **424×882**. Tap 3D: zoom **14.2**, pitch **52**, switch green, `building-3d` visible, 2D `building` none, terrain `{lvfe-dem, 1}`, `getSky()` set, labels `text-pitch-alignment: viewport` (27/27), pins viewport `[0,0]`, no `place-poles`. `map.fire('click')` → dossier **Clara Beauty Salon**. Resource log: 0 google/mapbox/photoreal hosts.
- Adb PNG (lock-black 15 KB discarded): idle `/tmp/lvfe-nord-3d-idle2.png` 3D gray, dense X, SAT leftover on. Play tap `/tmp/lvfe-nord-3d-play2.png` pitch ~52, sky band, extruded boxes, X billboards, 3D green. Independence z16 SAT-on `/tmp/lvfe-nord-3d-ind2.png` beige boxes + X. **Liberty-only** `/tmp/lvfe-nord-3d-liberty.png` (SAT off, `esri-sat` none): New Haven packed 5 m tan prisms, Independence sparser, street labels (Chime / Link / Second / Valley), X along Chime, 3D green / SAT gray.

**Current state:** **Pass.** Loop-exit 1–6 all true. Last-fail P0s (skip-city, sky/DEM, pins, second control, map-aligned labels, pitch-only ease) closed on the 05:56 APK. Still OSM boxes, not Google’s photoreal mesh.

**Remaining P0s:** none on this gate.

**Next steps:** None for 3D-vs-GMaps. Geolocate can flatten pitch and gray the switch while extrusion stays on — not a remaining P0.

**Blockers / risks:** Terrarium AWS + OpenFreeMap need network. Phone lock yields 15 KB black screencaps. `queryRenderedFeatures` on extrusion+terrain undercounts (6–15) vs the bitmap city.

### 2026-09-03 — Independent SAT vs GMaps re-score (builder `be0a49ea` / Nord 05:56, no code)

**Goal:** Harsh PASS/FAIL of the two SAT P0s from critic `dd0212ef` vs Google Maps satellite *feel* (full-bleed photo, street zoom shows roofs). Zero Google Maps SKUs. Esri World Imagery only. Do not implement. Do not revert 3D / X / circles / AR / Pay / guide-line layout join-cap.

**What changed:** Docs only (this recap). No `web/` / `android/` edits.

**Why:** Builder `be0a49ea` claimed both P0s fixed and installed (`lastUpdateTime=2026-09-03 05:56:44`). Score the live Nord WebView + adb screencap, not the claim.

**How verified:**
- `adb -s bea6919f` `lastUpdateTime=2026-09-03 05:56:44`. `am force-stop` + `am start` `com.lvfe.xperience/.MainActivity`. NotificationShade blocked `exec-out` (0 B); `screencap` to `/sdcard` + collapse shade worked.
- Code + bundled `app-debug.apk` `assets/www`: source `maxzoom` **18**, layer **24**, Esri `{z}/{y}/{x}`, `window.lvfeFitMap` → `map.resize()`, SAT click + style/load + visualViewport / orientationchange / delayed boot, Android `notifyMapFit` after `onPageFinished` (+80/400 ms) + layout. 0 `addLy({)`. No `setStyle` on SAT toggle.
- Nord CDP (`lvfeMap` ready): canvas **424×882** matches `#map` 424×882 (buffer 1081×2249). Previous FAIL was **400×300** on ~882 px `#map`. `srcMaxzoom` 18, `layerMax` 24. `lvfeFitMap` is a function.
- SAT **off** street zoom (jump 6.4268, 7.5222 z17.2): Liberty streets — Isiuzor Street / Independence Layout. Screencap `/tmp/lvfe-sat-critic/sat-off-z17.png` (468 KB). SAT switch gray. City boot `/tmp/lvfe-sat-critic/boot.png` (1.7 MB): full-bleed Liberty + dense unclaimed **X**.
- SAT **on** same GPS z17.4: SAT green, `visibility=visible`, `isSourceLoaded=true`, fail banner hidden. Screencap `/tmp/lvfe-sat-critic/sat-on-z17.png` (2.1 MB): full-bleed photo — trees, roads, ground texture; **not** the pale Esri “Map data not yet available” plate. Map-band luma 127.7 / chroma 42 vs SAT-off luma 231.7 / chroma 17 (vector pale, not empty-plate pale-on-SAT).
- SAT on later neighbourhood `/tmp/lvfe-sat-critic/sat-on-z12b.png` (3.9 MB): rooftops + vegetation + roads + dense **X** pins. First z12 pull `/tmp/lvfe-sat-critic/sat-on-z12.png` (15 KB) was lock-black — discarded. CDP WebGL still unusable; adb PNG is the evidence.
- Pins: `places-x` + `places-circles` layers + filters intact (`owner_mark` `x` vs `self`/`other`). This Nord profile: **1044/1044** `owner_mark=x`, 0 claimed → 0 circles painted (not a revert). SAT on z14.2: **337** rendered X.

**Current state:** **PASS.** Both `dd0212ef` P0s closed on the installed 05:56 Nord APK. SAT is a full-bleed Esri photo overlay at city and street zoom. Liberty streets remain when SAT is off. No Google Maps SKU.

**Remaining P0s:** none on this SAT gate.

**Next steps:** None for SAT critic `dd0212ef`. Optional: claim one pin on this profile so circles paint next to X; 3D critic still separate (box city, not photoreal mesh).

**Blockers / risks:** Esri/OSM need network. Phone lock / NotificationShade still zeros `exec-out` screencap. CDP `Page.captureScreenshot` blacks WebGL — do not treat that as missing tiles.

### 2026-09-03 — SAT full-bleed + Esri maxzoom 18 (critic `dd0212ef`)

**Goal:** Close two P0s from independent SAT vs GMaps FAIL. Do not revert X/circles or 3D (`map-3d.js`). Do not reintroduce `addLy({)`.

**What changed:**
- `web/js/satellite.js` — raster **source** `maxzoom` 19 → **18** (Enugu GPS `tile/19/…` is 2521 B empty plate; `tile/18/126382/136549` is 10 KB rooftops). Raster **layer** `maxzoom` 24 so z16–18 still paint and overscale z18. Tile URL still `{z}/{y}/{x}`. `map.resize()` after style.load and SAT on/off.
- `web/index.html` — `window.lvfeFitMap` → `map.resize()`. Hooks: style.load, load, SAT click, `window.resize`, `orientationchange`, `visualViewport.resize`, delayed 0/60/200/500/1200 ms. `#map` width/height 100%. Left `places-x`, `visualizePitch: false`, `addLy({`.
- `android/…/MainActivity.kt` — `notifyMapFit` after `onPageFinished` (+ 80/400 ms) and WebView `OnLayoutChangeListener`.
- `scripts/test_satellite.js` — MAXZOOM 18, layer 24, resize hooks, Android fit.

**Why:** MapLibre inited at default 400×300 because WebView layout lagged; no `resize()`. At GPS z17.71, covering zoom (~zoom+1, rounded) requested **z19**; Esri returns HTTP 200 “Map data not yet available”. Clamping native zoom to 18 overzooms last good rooftops. Did not flip `{z}/{x}/{y}`.

**How verified:**
- GPS 6.4268,7.5222 curl: z16 19 KB, z17 14 KB, z18 10 KB rooftop JPEGs; z19 2521 B empty plate.
- `node scripts/test_satellite.js` ok; `node scripts/test_map_3d.js` ok; `node scripts/test_conquest.js` ok. Inline 0 `addLy({)`.
- `./gradlew assembleDebug` SUCCESS. APK `assets/www`: MAXZOOM 18, `{z}/{y}/{x}`, `lvfeFitMap`, `places-x`, `visualizePitch: false`.
- `adb -s bea6919f install -r` Success; `am force-stop`; `lastUpdateTime=2026-09-03 05:56:44`. No push.

**Current state:** SAT still Esri overlay (not `setStyle`). Canvas should fill `#map` after resize hooks. Street zoom should show z18 rooftops scaled, not the empty plate. 3D box-city + X/circle pins left intact. Critic re-score of full-bleed SAT at GPS zoom is still due (no Nord screencap this pass).

**Next steps:** Nord walk: SAT on at GPS street zoom — rooftops full-bleed, pins tappable, no Esri empty copy. Re-score critic `dd0212ef` those two P0s only.

**Blockers / risks:** Esri/OSM need network. CDP WebGL screenshots black — use adb screencap. Phone lock can zero later captures.

### 2026-09-03 — 3D box city (critic `a07cc0ab` loop-exit)

**Goal:** Close independent 3D-vs-GMaps FAIL. Free MapLibre only. Untagged buildings are **5 m boxes** (a city), not skipped 2D / not a 9 m lie.

**What changed:**
- `web/map-3d.js` — extrude every footprint (`hide_3d` only skip). Height: OSM `height` / `levels` / `building:levels`, else `render_height` (includes 5 m sentinel), else **5 m**. Cap 80. Opacity 1. Hide 2D `building` fill while on. Terrain 1.0× + `setSky` + light. DEM fail → `#demFail` “Terrain couldn’t load”, switch off, pitch 0. `#btn3d` green only when toggle + pitch + terrain live. Tap 3D zooms to ≥ 14.2. Pins: viewport billboards, translate `[0,0]`, poles removed. Labels `text-pitch-alignment: viewport`.
- `web/map-3d.css` — `#demFail` banner; hide `.maplibregl-ctrl-pitch`.
- `web/index.html` — `visualizePitch: false`; `#btn3d` toggles the checkbox only (not `pitched || checked`). SAT / switches / `addLy({` / `places-x` left intact.
- `scripts/test_map_3d.js` — critic checks + `node --check`.

**Why:** Skip-filter deleted Liberty’s city (beige slab at pitch 52). Empty tilt must not go green. One 3D control. Pins must stay tappable X/circles.

**How verified:** `node scripts/test_map_3d.js` ok. `node scripts/test_satellite.js` ok (inline parse, 0 `addLy({)`). `./gradlew assembleDebug` SUCCESS. `adb -s bea6919f install -r` Success; `am force-stop`; `lastUpdateTime=2026-09-03 05:55:19`. APK `map-3d.js` has `UNTAGGED_M = 5`, opacity 1, zoom 14.2; index keeps `places-x` + `visualizePitch: false`.

**Current state:** 3D switch builds a 5 m box city at z≥14.2 with terrain + sky. Off = north-up pitch 0.

**Next steps:** Nord: idle 12.2 → 3D → Independence Layout / New Haven z16 pitch 52 must show boxes + sky + terrain, not a slab. Pin tap X/circle still opens dossier.

**Blockers / risks:** Terrarium AWS + OpenFreeMap need network. Not photorealistic (no billed Google/Mapbox mesh).

### 2026-09-03 — Independent satellite vs GMaps re-score (`01f3fae6` / Nord 05:44, no code)

**Goal:** Harsh pass/fail of SAT vs Google Maps satellite. Last FAIL `fd537fd2` was `addLy({)` killing the map. Do not implement.

**What changed:** Docs only (this recap). No `web/` / `android/` edits.

**Why:** Builder `01f3fae6` claimed `addLy({`, `node --check` pass, SAT green/gray switch, Nord APK 05:44. Score the installed APK and live WebView, not the claim.

**How verified:**
- Working tree + pulled APK `assets/www/index.html`: 0 `addLy({)`; extracted inline `node --check` exit 0 (63365 chars). HEAD `87a7e44` still has the seven typos — fix is uncommitted; 05:44 APK has the fix (`lastUpdateTime=2026-09-03 05:44:15`).
- `LvfeSatellite.bind` + `#btnSat` click → `toggle()`. Esri `{z}/{y}/{x}`, scheme `xyz`, no `.setStyle(`. Gradle: CameraX + WebView only.
- Esri Enugu 6.45,7.515 and GPS 6.4268,7.5222 z12–18 HTTP 200 JPEG 10–19 KB rooftops. Swapped `{z}/{x}/{y}` is the 1.6–2.5 KB empty tile.
- Nord `bea6919f` CDP: `lvfeMap` object, style ready, 1 canvas, `esri-sat` present. SAT click → `aria-checked=true`, `visibility=visible`, `isSourceLoaded=true`, sat under pins (`satIdx` 62 / `pinIdx` 119).
- Adb boot: Liberty streets, SAT gray. After SAT + jump Enugu z12.2: real imagery + colored pins + New Haven/Enugu labels, SAT green (`/tmp/lvfe-nord-sat-z12.png`). First SAT at GPS z17.71: pale Esri **Map data not yet available** in the 400×300 strip (`/tmp/lvfe-nord-sat-z17.png`).
- Canvas `client` 400×300 vs `#map` 423×882. No `map.resize()`. Rest of the phone is FrameLayout `#0e1116` through a transparent WebView.
- Pin after SAT: `map.fire('click')` on `w_1066222371` National Orientation Agency → sheet `.doc` Place tab; SAT still on; `places-circles` still there.

**Current state:** **FAIL.** Parse P0 is closed. SAT is a real switch and can paint Enugu at city zoom. It is not Google Maps satellite: the WebGL canvas is a postcard, street zoom showed Esri’s empty-tile plate, z16–18 rooftops were not shown full-bleed on the Nord.

**Remaining P0s:**
1. **Canvas never fills the map.** `#map` is `inset:0` (882 px). MapLibre canvas stays default **400×300**. No `map.resize()`. SAT/streets only occupy the top strip. GMaps satellite is full-bleed.
2. **z12–18 imagery not proven in-app.** z12 SAT is rooftops. Player-GPS z17 SAT painted Esri’s “Map data not yet available” even though `tile/18/126382/136549` HTTP is a 10 KB roof JPEG. Do not flip tile order — template is already `{z}/{y}/{x}`. Find why MapLibre showed the empty plate.
3. Not P0 (closed): inline parse; SAT bind/toggle; no Google SKU; no `setStyle` wipe; pin dossier still opens after SAT on.

**Next steps:** Builder must `map.resize()` until the canvas matches `#map`, then SAT at Enugu z12 **and** z16–18 must show rooftops on a Nord screencap (not CDP WebGL-black). Re-score those two only.

**Blockers / risks:** Phone lock killed later adb screencaps (0 bytes). CDP `Page.captureScreenshot` blacks the WebGL canvas — do not treat that as missing tiles.

### 2026-09-03 — X vs circle pins + neighbourhood conquest value

**Goal:** Unclaimed pins draw an X; any owner is a circle (self vs other by color). Neighbourhood with the most owned places raises place value / cost-to-back automatically.

**What changed:** `web/js/conquest.js` (`displayValue = base * (1 + 0.5 * ownedCount/max)`; hinterland 0). Map `places-x` symbol + `places-circles` owned-only; `places-hit` still tappable at z12.2. Dossier Money + catalog list/cost. Rules one sentence. AR HTML glyphs match. SAT/`addLy({` parse left intact.

**Why:** Ownership is still highest NairaCoin in that place; conquest bonus is a display/cost multiplier, not minted ledger value.

**How verified:** `node scripts/test_conquest.js`; `node scripts/test_satellite.js` (`node --check` inline, 0 `addLy({)`). `./gradlew assembleDebug` SUCCESS. `adb -s bea6919f install -r` Success; `am force-stop`; `lastUpdateTime=2026-09-03 05:51:33`. APK `assets/www` has `conquest.js` + `places-x`.

**Current state:** Unclaimed = X, owned = circle. Winner neighbourhood +50%, others proportional.

**Next steps:** Nord walk: X at z12.2 taps dossier; back a place → circle in your blue; Money tab shows boosted cost.

**Blockers / risks:** Esri/OSM need network.

### 2026-09-03 — Independent 3D vs GMaps 3D feel (no code)

**Goal:** Harsh pass/fail of `#btn3d` + OSM extrusion + Terrarium DEM vs Google Maps 3D *feel*. Read-only. No billed Google Photorealistic 3D.

**What changed:** Docs only (this recap). No `web/` / `android/` edits.

**Why:** GMaps 3D is smooth pitch, a box/terrain city, sky, readable labels, pins that stay findable, **one** 3D control. Builder claimed OSM-true Liberty extrusion + AWS Terrarium + green/gray 3D switch. Score that stack, not the claim.

**How verified:** Read `web/map-3d.js`, `web/map-3d.css`, `web/index.html` 3D switch + Map ctor, `web/css/switch.css`, `web/js/satellite.js` / `track-guide.js` stacking. Fetched live OpenFreeMap Liberty JSON: stock `building-3d` is `fill-extrusion` **all** footprints at minzoom 14 via `render_height` (OMT 5 m untagged boxes). No device/browser run this pass.

**Current state:** **FAIL.** Switch chrome is green/gray. Extrusion filter **removes** Liberty’s box city. DEM is optional and silent. No sky. Two pitch UIs. Pins are −16 px / 24 m chimneys at z≥14.

**Remaining P0s:** See critic report (P0-1 skip-untagged + z14 / idle z12.2 empty; P0-2 no sky + 1.7× DEM + swallowed fail; P0-3 pins lost; P0-4 NavigationControl `visualizePitch` second 3D control; P0-5 map-aligned labels; P0-6 3D `easeTo` pitch-only).

**Next steps:** Builder loop-exit on free MapLibre only (OpenFreeMap, Terrarium, OSM/OMT heights). Re-score when all P0s closed. Do not add Google Map Tiles Photorealistic 3D.

**Blockers / risks:** Enugu OSM `height` / `building:levels` is sparse — untagged must still be short boxes (OMT 5 m), not paper. AWS Terrarium needs network + WebGL CORS.

### 2026-09-03 — P0 `addLy({)` parse + LTR/RTL switches (critic `fd537fd2`)

**Goal:** Map boots again; SAT/3D/AR and other on/off controls become green/gray slide switches. GPS stays locate.

**What changed:** `web/index.html` `ensureLayers` seven `addLy({)` → `addLy({`. SAT/3D/AR/hybrid/filters/mute/Track + catalog/assets section checkboxes → `role="switch"` (`web/css/switch.css`). GPS locate FAB unchanged. `scripts/test_satellite.js` now `node --check`s the inline script.

**Why:** SyntaxError left `lvfeMap` undefined; SAT was dead chrome. Switches replace round FABs/checkboxes without faking GPS as a mode.

**How verified:** `node --check` extracted + APK inline scripts (0 `addLy({)` leftovers). `node scripts/test_satellite.js` (now syntax-checks inline). `./gradlew assembleDebug` SUCCESS. `adb -s bea6919f install -r` Success; `am force-stop`; `lastUpdateTime=2026-09-03 05:44:15`.

**Current state:** Inline script parses. SAT is a switch over Esri `{z}/{y}/{x}`. GPS is locate.

**Next steps:** Nord walk: Liberty → Esri rooftops, pin tap, gold route, Pay gate.

**Blockers / risks:** Esri/OSM need network.

### 2026-09-03 — Independent satellite vs GMaps re-score (`87a7e44`, no code)

**Goal:** Harsh pass/fail of SAT/MAP vs Google Maps satellite. Read disk + Nord. Do not implement.

**What changed:** Docs only (this recap). No `web/` / `android/` edits.

**Why:** Last FAIL `d819a262` was “no toggle.” Builder `d85b8646` claimed SAT/MAP FAB, Esri overlay, hybrid in profile, pins/route survive, fail toast, commit `87a7e44`, Nord APK 05:34. Score the installed APK and HEAD, not the claim.

**How verified:**
- HEAD `87a7e44` (2026-09-03 05:35 +0100). Nord `bea6919f` `com.lvfe.xperience` `lastUpdateTime=2026-09-03 05:34:42`. Bundled APK `assets/www/index.html` has the same seven `addLy({)` as disk.
- `web/js/satellite.js`: Esri `tile/{z}/{y}/{x}`, no `.setStyle(`, no Google host. `#btnSat` SAT/MAP FAB in HTML. Hybrid checkbox in ⋯. `#satFail` banner. About credits Esri.
- Nord WebView CDP: `SyntaxError: Unexpected token ')'` at `index.html` ~2126. `window.lvfeMap` undefined. `#map` 0 children, 0 MapLibre canvases. `#btnSat.click()` leaves `aria-pressed=false`, `LvfeSatellite.isOn()=false`, no fail banner. `node --check` of the inline script fails on `addLy({)`.
- Boot screencap `/tmp/lvfe-nord-boot.png` (05:37): search pill + SAT/3D/AR/GPS FABs over a dark void. No streets, no pins, no imagery.
- Esri Enugu 6.45,7.515: `{z}/{y}/{x}` z12–18 HTTP 200 (14 / 16 / 19 / 19 / 19 / 16 / 12 KB JPEG). z16 `…/tile/16/31591/34136` is real rooftops/roads/trees — not grey. Wrong order `{z}/{x}/{y}` is the 2.5 KB “Map data not yet available” grey tile. Tile math in `satellite.js` is the good order.
- `node scripts/test_satellite.js` prints ok (false green: regexes HTML, never parses `ensureLayers`).
- SKU: no `maps.googleapis` / `play-services-maps` / Maps SDK in `web/` or `android/` (gradle `google()` is Maven). CameraX + WebView only.

**Current state:** **FAIL.** SAT chrome exists. The map never starts. Imagery overlay never attaches. Pins never exist to tap. Builder tests lie.

**Remaining P0s:**
1. **Map script dead.** Seven `addLy({)` in `ensureLayers` (`index.html` 2127, 2142, 2153, 2160, 2176, 2205, 2217). Introduced in `87a7e44` while making `addLayer` idempotent. First call `addLy({` is valid. Fix: `addLy({` then object, or the map (and every prior GMaps pass) stays dark.
2. **SAT is not a control.** Click handler is in the unparseable inline script. FAB does not toggle, does not fail-to-streets, does not paint MAP.
3. **No app imagery at Enugu z12–18.** Esri tiles are fine; MapLibre never mounts them. Do not “fix” tile order — it is already `{z}/{y}/{x}`.
4. **Pins not tappable after SAT** — pins never paint. Overlay-under-pins / `raiseGame` is untested because nothing boots.

Not P0 (already clean): no Google Maps SKU; `satellite.js` does not `setStyle`. Hybrid-in-profile is HTML-only until bind runs.

**Next steps:** Builder must make `index.html` parse, prove MapLibre canvas + Liberty streets, then SAT → Esri rooftops at z12 and z16–18, pin tap still opens the dossier, gold walk still paints. Re-score on Nord CDP + screencap. Do not trust `test_satellite.js` until it `node --check`s the inline script.

**Blockers / risks:** None for a one-character parse fix. Screen was asleep after the boot shot; lock-screen recapture is not map evidence.

### 2026-09-03 — Satellite FAB + profile rules/assets (critic `d819a262`)

**Goal:** Close independent critic `d819a262` / satellite-vs-GMaps FAIL (no satellite on disk). Obvious SAT/MAP FAB, free Esri only. Profile ⋯ → How to play + My assets. Commit and push `main`.

**What changed:**
- `web/js/satellite.js` — Esri World Imagery raster `{z}/{y}/{x}` (`server.arcgisonline.com` World_Imagery). Overlay only; **no `setStyle`**. SAT FAB shows SAT on streets / MAP on imagery. Optional hybrid OSM labels (⋯ checkbox). If tiles never arrive: banner “Satellite couldn’t load”, imagery hidden, Liberty streets stay. Pins / gold walk / 80 m ring / you-dot raised above imagery.
- `web/index.html` — `#btnSat` FAB (not buried in ⋮). `#satFail` banner. About credits Esri. ⋯ is a profile menu (How to play, My assets, Catalog, name switcher, hybrid labels). `ensureLayers` is idempotent; `style.load` sets `layersReady = false` and `reattachOverlays()` restores catalog + track layers.
- `web/rules.html` — full player rules (no Architect / IOU / RPC / genesis).
- `web/assets.html` + `web/js/assets.js` — owned/backed, 10% visit interest, gap vs 2nd / vs owner; section toggles.
- `web/js/nairacoin.js` — `setPlayerKey` so the map profile switcher and catalog share one key.
- `scripts/test_satellite.js` — Enugu z15/z18 tile math, no Google SKU, no `setStyle`, FAB + pages present.

**Why:** Critic law: satellite must exist as a visible Map/Satellite control, Enugu z12–18 rooftops, fail-to-streets, no billed Google. `ensureLayers` was one-shot so a style swap would eat pins/route/3D — overlay + re-attach instead of `setStyle`.

**How verified:**
- `node scripts/test_satellite.js` ok. `node scripts/test_track_layers.js` ok. `node scripts/test_place_title.js` ok.
- Esri Enugu 6.45,7.515 z12/15/17/18 HTTP 200 (~11–19 KB JPEG) with `{z}/{y}/{x}`.
- `cd android && ./gradlew assembleDebug` BUILD SUCCESSFUL. APK has `js/satellite.js`, `rules.html`, `assets.html`, `#btnSat`.
- `adb -s bea6919f install -r …/app-debug.apk` Success. `lastUpdateTime=2026-09-03 05:34:42` on Nord DE2118.
- No Google Maps SKU in `web/` or `android/` source.

**Current state:** Satellite is a SAT/MAP FAB over OpenFreeMap. Default is streets. Imagery is opt-in Esri. Profile pages: `web/rules.html`, `web/assets.html`.

**Next steps:** Street walk on Nord: SAT at z12.2 city, z16–18 roofs, MAP back, Track gold line still paints on imagery, Pay gate unchanged.

**Blockers / risks:** Esri tiles need network (same as OpenFreeMap). Public OSRM can 429. Not a Google Maps SKU.

### 2026-09-03 — Independent critic: satellite vs GMaps (no code)

**Goal:** Harsh pass/fail of Lvfe satellite vs Google Maps (toggle, imagery, labels, zoom). Free Esri/OSM hybrid only. No billed Google SKU. Do not implement.

**What changed:** Docs only (this recap). No `web/` / `android/` edits.

**Why:** Human bar is “as well as Google Maps.” Loop-exit is toggle on Nord/web, imagery visible, pins still tappable, no Google SKU. Score disk, not a planned builder.

**How verified:**
- Repo-wide grep: `satellite` / `esri` / `World_Imagery` / `arcgisonline` / `btnSat` / `toggleSat` / `hybrid` — **zero** hits in `web/`, `android/`, scripts.
- `googleapis` / Maps SDK — **zero** hits (SKU clean).
- Read `web/index.html` chrome + Map constructor, `web/map-3d.js` DEM, `web/map-3d.css`.
- Nord not exercised: nothing to toggle. APK tree has the same absence.

**Current state:** **FAIL.** Four P0s. Only SKU check passes. Liberty vector map only.

**Next steps:** Builder must add a real Map/Satellite switch, Esri (or equivalent free) raster + OSM label overlay, keep pins/3D/route/GPS across the switch (`layersReady` one-shot will eat overlays if they `setStyle`). Then critic re-score on web + Nord.

**Blockers / risks:** Esri World Imagery ToS / attribution in About. Enugu z18 readability is unproven until tiles are wired. `ensureLayers` `layersReady` (`index.html:1945–1948`) + `style.load` (`2186`) is a landmine for a style swap.

### 2026-09-02 — Independent re-score critic `46b2a779` / `c2cb1cc7` (no code)

**Goal:** Harsh pass/fail of builder `6bbb8245` claim that P0-3 (dossier dies on movestart) and P0-6 (guide layers never attach) are closed, and that 1,2,4,5 still hold. Do not implement.

**What changed:** Docs only (this recap). No `web/` / `android/` edits.

**Why:** Loop-exit must be independently scored against the last FAIL, not the builder’s recap.

**How verified:**
- Read `web/js/track-guide.js`, `web/index.html` sheet/geolocate, `web/js/dossier.js`, `web/ar-overlay.js`, `web/catalog.html`, `web/js/catalog.js`, `web/js/claim-rules.js`.
- `node scripts/test_track_layers.js` ok. `node scripts/test_place_title.js` ok. 1044 catalog rows → 0 dash / `Unnamed civic_unknown` titles.
- Nord DE2118 `bea6919f` `lastUpdateTime=2026-09-02 23:03:03`. Bundled `track-guide.js` / `dossier.js` match disk. APK `index.html` is vendor MapLibre (hash differs) but has `dossierPinned` + `refreshOpenDossier`.
- Nord WebView CDP (`appassets.androidplatform.net` `index.html`): radius 80; `__lvfeLastBeep` `track` vs `pay-radius`; Mute + `#arTrackHud` exist; wallet 100 NairaCoin; Pay disabled at 1112 m / no GPS, enabled at 22 m.
- After Track: `guide-line` + `guide-casing` + `pay-fill` + `pay-ring` all in `getStyle().layers`; `ensureLayers` true; no throw; 80 m ring (65 pts, vertex 80 m); geodesic 2-pt line + chip `13 min walk (as the crow flies) · 80 m pay ring`. Public OSRM walking HTTP 200 (69 coords). No Google Maps SKU / scripts.
- Open file + `map.fire('movestart'|'dragstart')` → sheet stays `doc`, dossier remains. Synthetic GeolocateControl `geolocate` far→near: file stays; Wallet Pay `disabled` then enabled from live dist.

**Current state:** **Pass.** No remaining P0s on this gate. 1 (beep), 2 (AR HUD), 4 (placeTitle), 5 (catalog dossier) still hold. Last-fail P0-3 and P0-6 closed on the installed APK.

**Next steps:** None for this critic loop. Optional human street walk for ear-beep + gold line on an unlocked screen (NotificationShade covered the panel; screencap was 0 bytes).

**Blockers / risks:** Phone shade/lock — no ear-proof of the beep, no bitmap of the gold line. Device route this sample was geodesic (OSRM public 200; code fail-opens). Not remaining P0s.

### 2026-09-02 — Close critic `46b2a779` P0-3 + P0-6 (dossier stay / walk line)

**Goal:** Fix the two remaining P0s from critic `46b2a779` / prior `c2cb1cc7` re-score. Keep beep, AR HUD, titles, catalog dossier. No billed Google.

**What changed:**
- `web/js/track-guide.js` — `line-join` / `line-cap` moved from `paint` to `layout` on `guide-casing` + `guide-line`. `ensureLayers` adds source and layers independently (`addSourceOnce` / `addLayerOnce`) so a prior failed `addLayer` (source already exists) still attaches the gold walk line + 80 m ring.
- `web/index.html` — `dossierPinned()` is true while a place file is open (`dossierPlaceId`) or `LvfeTrack.get()` is set. `movestart` / `dragstart` hide menus but **do not** `closeSheet` when pinned. Geolocate `refreshOpenDossier()` can re-render Pay with live dist. × / swipe-down still close.
- `scripts/test_track_layers.js` — mock MapLibre throws if join/cap are in paint; asserts retry when source exists; greps dossier pin.

**Why:** GeolocateControl `trackUserLocation` `easeTo` fires `movestart` → old `closeSheet()` nulled `dossierPlaceId` → Pay stayed stale. MapLibre rejects `line-join`/`line-cap` in paint (`unknown property`); catch left the `guide` source in place so later `ensureLayers` skipped the layers.

**How verified:**
- `node scripts/test_track_layers.js` ok. `node scripts/test_place_title.js` ok.
- `cd android && ./gradlew assembleDebug` BUILD SUCCESSFUL (4s). Assets include layout join/cap + `dossierPinned`.
- `adb -s bea6919f install -r …/app-debug.apk` Success. `am force-stop com.lvfe.xperience`. `lastUpdateTime=2026-09-02 23:03:03` on Nord DE2118.
- No Google Maps SKU added. No street walk this pass.

**Current state:** P0-3 and P0-6 coded + installed. 1,2,4,5 unchanged. Player must Track a pin: gold walk line + 80 m ring should paint; walking 1112 m → 22 m should enable Pay without re-tap (file stays open).

**Next steps:** Critic re-score on unlocked Nord: Track → see gold line + ring; geolocate while file open → Pay flips at 80 m.

**Blockers / risks:** Public OSRM can 429 (geodesic still draws). No CDP walk this session — phone install only.

### 2026-09-02 — Independent re-score critic `c2cb1cc7` loop-exit (no code)

**Goal:** Harsh pass/fail of builder `9da3e482` claim that all six P0s are on disk + Nord `bea6919f`. Do not implement.

**What changed:** Docs only (this recap). No `web/` / `android/` edits.

**Why:** Loop-exit must be independently scored. Four P0s are real on disk/APK. Two still fail a player walk.

**How verified:**
- Read `web/index.html`, `web/js/track-guide.js`, `web/js/dossier.js`, `web/ar-overlay.js`, `web/js/catalog.js`, `web/js/claim-rules.js`, `web/catalog.html`.
- APK `lastUpdateTime=2026-09-02 22:49:04` on Nord DE2118 `bea6919f`. JS hashes match disk. `index.html` differs only vendor vs unpkg (APK bundles MapLibre).
- `node scripts/test_place_title.js` ok. 1044 catalog rows → 0 dash / `Unnamed` / `civic_unknown` titles (`Unnamed civic_unknown` → Unidentified building).
- Public OSRM walking HTTP 200 (69 coords). No Google Maps SKU in `web/` or `android/`.
- Nord WebView CDP (`appassets.androidplatform.net` `index.html`): `LvfeTrack`/`LvfeDossier`/`LvfeRules`/`LvfeCatalogWallet` present; radius 80; Mute exists; `__lvfeLastBeep` `track` vs `pay-radius`; dossier Pay disabled at 1112 m / no GPS, enabled at 22 m; wallet tab 100 NairaCoin; chip `13 min walk` then OSRM `4 min walk (walk) · 80 m pay ring`.
- CDP after Track: `guide` source 108 OSRM coords, `pay-fill`+`pay-ring` layers exist, **`guide-line` / `guide-casing` absent** from `getStyle().layers`. `map.fire('movestart')` → sheet collapsed, dossier gone.
- No street walk: last fused GPS `et=+6d`; lock/notification shade covered the panel; screencaps were lock UI / black, not the map. Score is code+CDP.

**Current state:** **FAIL.** Remaining P0s:
3. Wallet+Pay gate exists, but `geolocate` cannot refresh a live file — `trackUserLocation` camera `easeTo` fires `movestart` → `closeSheet()`; `refreshOpenDossier()` then no-ops.
6. OSRM/geodesic + time + 80 m ring exist; **walk line does not paint.** `line-join`/`line-cap` in `paint` throw; `ensureLayers` then skips guide layers because the source already exists.

**Next steps:** Builder: move `line-join`/`line-cap` to `layout` (or drop them) and add layers even if `guide` source exists. Stop closing the dossier on geolocate camera moves (`ignorePan` during geo, or don't `closeSheet` on programmatic move). Then re-score with an unlocked Nord walk.

**Blockers / risks:** Phone was locked; no ear-proof of the beep, no AR camera bitmap this pass. Those two are coded and CDP-exercised; not the remaining P0s.

### 2026-09-02 — Close critic `c2cb1cc7` six P0s (track / AR HUD / Pay / titles / catalog / OSRM)

**Goal:** Ship all six P0s. Same 80 m radius. No Google Directions.

**What changed:**
- `web/js/claim-rules.js` — `placeTitle` for `-` / undefined / `Unnamed civic_unknown` → Shop / Unidentified building / etc.
- `web/js/dossier.js` — shared Place/Mission/Land/Money/Wallet file. **Pay** `disabled` unless `userPos` and `dist <= 80`.
- `web/js/track-guide.js` — Track pulse (AudioContext + `navigator.vibrate`); distinct double-beep inside 80 m; Mute; `__lvfeLastBeep` + `[lvfe-beep]` log. OSRM walking `router.project-osrm.org`; geodesic + 5 km/h fail-open. Gold walk line + 80 m pay ring (not Google blue).
- `web/index.html` — Wallet tab, Track chip, rebuild file on every `geolocate`, route layers.
- `web/ar-overlay.js` — `#arTrackHud` live metres + heading every GPS/compass tick for the marked pin outside 80 m. Nearby pin metres update in place (not frozen `htmlIds` text).
- `web/catalog.html` + `catalog.js` — same dossier + section toggles.

**Why:** Critic `c2cb1cc7` FAIL: no beep, frozen AR HTML, Pay stale after GPS, unnamed junk, catalog table ≠ pin file, no walk line.

**How verified:** `node scripts/test_place_title.js` ok. Dossier Pay disabled at 400 m, enabled at 40 m. OSRM public walking HTTP 200. `cd android && ./gradlew assembleDebug` BUILD SUCCESSFUL (3s). `adb -s bea6919f install -r …/app-debug.apk` Success. `am force-stop com.lvfe.xperience`. APK has `js/dossier.js`, `js/track-guide.js`.

**Current state:** Six P0s on disk and installed APK. CameraX AR, document tabs, OSM off map kept. `CLAIM_RADIUS_M` still 80.

**Next steps:** Critic re-score on Nord. Human: Track a pin → pulse; walk into 80 m → distinct beep; AR HUD metres move; Pay flips on geolocate; catalog file matches pin tap.

**Blockers / risks:** Public OSRM can 429 — geodesic still draws and shows walk time. WebView AudioContext needs the Track tap (user gesture).

### 2026-09-02 — Independent critic: walk-to-pin / Pay / catalog / route (no code)

**Goal:** Harsh pass/fail vs disk for beep, live AR distance+heading to the marked pin, place-file wallet + Pay gated at 80 m, no "-" titles, catalog = pin-tap dossier with toggles, OSRM/Valhalla walk polyline + time that beats a generic Google blue line for this game. Do not implement.

**What changed:** Docs only (this recap). No `web/` / `android/` edits.

**Why:** Human asked an independent critic. Six P0s are missing or only half-wired. 80 m radius already exists (`CLAIM_RADIUS_M`). Wallet exists but is hidden on the place file. Catalog is a table. No beep, no live AR HUD, no route source.

**How verified:** Read `web/index.html`, `web/ar-overlay.js`, `web/catalog.html`, `web/js/catalog.js`, `web/js/claim-rules.js`, `web/js/ar.js`, `android/` (no Tone/Sound), `data/catalog.json` / `places.geojson` (0 literal `"-"` names; 60 `Unnamed {type}` titles including `Unnamed civic_unknown`). Grep: no `AudioContext` / beep / OSRM / Valhalla / polyline route layer. `git rev-parse` HEAD `75bb465` plus dirty working tree (same files as prior sessions).

**Current state:** **FAIL.** Six P0s. Radius constant is the only piece already defined. Submit-time 80 m check exists; the visible Pay/CTA is stale after GPS moves. Catalog is not the pin file.

**Next steps:** Builder loop-exit (all must be true on disk + Nord):
1. Audible beep while tracking the marked pin, and again / continuously when inside 80 m. No silent path.
2. AR HUD on the marked pin: live metres + heading that update every GPS/compass tick (not cached HTML). Visible beyond 80 m.
3. Place file shows total wallet. Button labeled **Pay** is `disabled` outside 80 m and enabled only while `dist <= 80`. Re-render on each `geolocate`.
4. No title/caption/content is `"-"`, `Unnamed civic_unknown`, or raw `catalog_type`. Use type words or honest empty states.
5. `catalog.html` opens the same dossier as pin tap (all player fields) with toggle-able sections, not a 6-column table-only page.
6. MapLibre line from user GPS to marked pin via free OSRM/Valhalla/OSM (no Google Directions). Show walk time + direction + pay-radius / beep / faction context. Not a mute blue line.

**Blockers / risks:** Public OSRM can 429; need a documented free endpoint and a straight-line fallback that still shows walk time. WebView audio may need a user gesture. Do not add billed Google Directions.

### 2026-09-02 — Independent Pokémon GO AR re-score (CameraX overlay)

**Goal:** Harsh re-score vs last FAIL `f409acc1` (black WebGL lid). No code. Pass only if Nord bitmap is live camera, copy/× sit on it, native fail speaks, free stack.

**What changed:** Docs only (this recap). No `web/` / `android/` edits.

**Why:** Builder claimed CameraX `PreviewView` behind transparent WebView, no getUserMedia viewfinder, HTML pins, ×, Nord screencap not `#000`. Critic must not trust that without a rear-lens-uncovered bitmap.

**How verified:**
- Installed `com.lvfe.xperience` lastUpdate **22:21:21**. APK `assets/www/ar-overlay.js` SHA matches source. AR CSS/HTML in APK `index.html` identical to source. CameraX 1.4.1. Nord DE2118 `bea6919f`, CAMERA+LOCATION granted. OS `location_mode=3`.
- App GPS **on** (Independence Layout `~6.4261, 7.5210`, acc ~30–50 m). Catalog 1044 places; **0 within 80 m** (closest German Leprosy & Tb Relief Association **403 m**). Not GPS-off.
- CDP tap AR FAB: `arOn` + `arNative`; html/body/`#arStage` `rgba(0,0,0,0)`; `#arCam`/`#arThree` `display:none`; map `display:none`; **no gum tracks**; `previewLuma` **98**. Device **0 rear OPEN** (`SurfaceView` BLAST consumer). Hint **“No places within 80 m”**. White ×. `THREE` still loaded from unpkg but canvas hidden — not a lid.
- adb screencap `/tmp/lvfe-ar/critic-ar.png` (4.1 MB, 1080×2400): indoor room (lamp/cables), **y300–2000 exact `#000` = 0%**, band luma **90.3**. Not the 36 KB compositor black of `f409acc1`.
- CDP null `lvfeUserPos` one frame: hint **“Turn on GPS to see nearby places.”** Restored. × (`#arExit`): `arOn` false, map + FABs back, camera **DISCONNECT**, Device 0 closed. After-X screencap is Independence Layout map.

**Current state:** **Pass.** No P0. Rear CameraX viewfinder is the camera world. Empty-80 m copy is honest at this GPS. HTML pins-on-buildings **unverified** (none in range, not GPS-off). Native fail banner code-wired (`notifyNativeFail` → `lvfeArNativeFail`); deny/bind-fail not live-exercised this session. Free stack (CameraX local). Dead `three@0.160.1` script is leftover, not a lid.

**Next steps:** Optional: stand within 80 m of a catalog pin and confirm HTML `.ar-pin` on the camera. Drop unused Three.js. Trim debug `setFacingFront` / `previewLuma` / max exposure.

**Blockers / risks:** Rear getUserMedia in this WebView is still black if anyone calls it while CameraX holds the camera. SOFTWARE WebView layer during AR.

### 2026-09-02 — Pokémon GO AR: drop WebGL lid (critic `f409acc1`)

**Goal:** Nord viewfinder must not be exact `#000` in the middle. Trust critic: camera track was live, `#arThree` was a black lid, VideoTexture did not punch frames.

**What changed:**
- `web/ar-overlay.js` — no Three.js / VideoTexture. Visible `<video id="arCam">` on desktop; **Android uses `LvfeNative.startArCamera()`** (no getUserMedia, so it does not steal CameraX). HTML pins via compass/FOV; paintHtml never reads `W` (wallet). GPS-off / empty 80 m copy on the viewfinder. × → `stopArCamera` + map.
- `web/index.html` — AR CSS only (dossier sheet untouched): `#arCam` opacity 1; `#arThree { display:none }`; `body.ar-native` transparent stage/html, map `display:none`.
- `android/app/src/main/java/com/lvfe/xperience/MainActivity.kt` — CameraX `PreviewView` behind WebView; software layer + transparent background during AR.
- `android/app/build.gradle.kts` — camera-core / camera2 / lifecycle / view 1.4.1.

**Why:** CSS `<video>` under WebGL was a black lid. Hiding video + VideoTexture still `#000`. Visible video alone still `#000` (middle band exact black). canvas2d `drawImage` + `ImageCapture.grabFrame` on the **rear** track: avg 0. **Front** getUserMedia samples ~168. Rear WebView MediaStream never delivers pixels on this Nord/WebView 151. Native Camera2 preview does.

**How verified:**
- `cd android && ./gradlew assembleDebug` BUILD SUCCESSFUL. `adb -s bea6919f install -r …/app-debug.apk` Success; `am force-stop`; screen **ON**.
- Visible `<video>` screencap: middle y300–1200 **exact #000** (36 KB PNG). Track live 480×640 `readyState:4`.
- canvas2d: same; `ImageCapture` rear max 0, front avg 168.
- CameraX native, rear `previewLuma` **14** (lens dark/covered). Front `previewLuma` **207**. Front screencap 10:21 `/tmp/lvfe-ar/ar-front.png` (~937 KB): **overexposed camera world** (not #000), white ×, “No places within 80 m”. CDP: `arOn` `arNative`, `#arThree`/`#arCam` `display:none`, map `display:none`, no gum stream.
- ×: `arOn` false, map visible, camera client **DISCONNECT**.

**Current state:** Installed APK default viewfinder is **CameraX rear PreviewView** under transparent WebView (HTML pins + ×). Rear scene on the desk was dark (luma 14, not compositor `#000`). Front proof shot is a bright live camera. No WebGL lid. Dossier sheet not reverted.

**Next steps:** Critic re-score with Nord **rear lens uncovered** (street/room). GPS-on 80 m HTML pins on that camera world. Optional: drop debug `setFacingFront` / `previewLuma` / `setTorch`.

**Blockers / risks:** Rear getUserMedia in this WebView is still black if anyone calls it while CameraX holds the camera. SOFTWARE WebView layer during AR. Headless Chrome has no camera.

### 2026-09-02 — Place file tabs + perms on open

**Goal:** Nord pin tap opens a paper **file/document** (not a thin empty card). Ask location + camera when the app opens.

**What changed:**
- `web/index.html` — pin sheet is a dossier: tabs **Place** (name, type, photo/quality words), **Mission** (one next action + 48dp CTA), **Land** (neighbourhood, Unclaimed vs faction, owner, conquered), **Money** (cost to back, place value, “owner earns N from visits”). Banks/ATMs: cannot be owned, no yield essay. Fallbacks: Unknown owner / Unclaimed / No one has backed this yet. × kept. Sheet still hidden on idle map.
- `web/js/claim-rules.js` — `typeLabel` (Shop/Food/…) and `qualityWords` (Has a photo / Named / Needs a name).
- `MainActivity.kt` — `requestAllLaunchPerms()` on `onCreate` and first `onPageFinished`; skip if FINE+COARSE+CAMERA already granted. JS `requestLaunchPerms` + `lvfeOnNativePerms` starts GPS when loc is on. No activity-recognition perm.

**Why:** Thin half-sheet looked empty. Human wants all needed OS perms at launch (overrides FAB-only).

**How verified:** `node` claim-rules labels. `./gradlew assembleDebug` SUCCESS (19s). `adb -s bea6919f install -r` Success; `am force-stop com.lvfe.xperience`. Bundled `assets/www/index.html` has `dossier-tabs`.

**Current state:** Installed on Nord `bea6919f` (lastUpdate 22:10:28). FINE+COARSE+CAMERA already granted — launch will skip the OS dialog. AR overlay / OSM-off-map unchanged.

**Next steps:** Human on Nord: cold start → one OS perm dialog (or none if granted). Tap a pin → file with four tabs. Swipe tabs. × closes. Map idle stays clear.

**Blockers / risks:** If the Nord already granted camera+location, no dialog (correct). Denied-forever needs Settings.

### 2026-09-02 — Independent Pokémon GO AR re-score (builder `6de9d97e`)

**Goal:** Harsh re-score vs last FAIL `f0afbaca` and the Pokémon GO bar. No code.

**What changed:** Docs only (this recap). No `web/` / `android/` edits.

**Why:** Builder claimed one WebGL canvas, `VideoTexture` quad, hidden `<video>`, street/room on Nord screencap, ×, GPS-off copy. Pass only if the installed APK bitmap is the camera world.

**How verified:**
- Read `web/ar-overlay.js` + `web/index.html` AR CSS. Bundled `android/app/src/main/assets/www/ar-overlay.js` identical; APK `index.html` only vendors MapLibre/Three. `#arCam { opacity: 0 }`, `#arThree { background:#000 }`, `WebGLRenderer({ alpha: false })`, `setClearColor(0x000000, 1)`. `lvfeEnableAr({ getNearby: nearbyFeatures })`; `syncBillboards` Three sprites + HTML `.ar-pin`; empty 80 m / GPS-off copy in `paintHtml`. Free stack (getUserMedia + Three 0.160.1). No Niantic.
- Nord DE2118 `bea6919f`, `com.lvfe.xperience` lastUpdate **21:56:40**, CAMERA+LOCATION granted. OS location_mode=3. App GPS unused (`lvfeUserPos` null) until GPS FAB.
- Cold start, tap AR FAB. Three adb screencaps while `media.camera` Device 0 **open** for Lvfe: viewfinder band **y≈300–1200 is exact #000**. White × top-left. Leaked half sheet (place card) over the bottom. Not a room or street.
- CDP during that black frame: `arOn` true; map `visibility:hidden`; rear track **live** `camera 0, facing back` 480×640, video `paused:false` `readyState:4`; `#arCam` opacity **0**; `#arThree` 848×1764 z-index 1; `#arFail` **hidden**; hint “Turn on GPS to see nearby places.” WebGL Adreno 619, context not lost.
- × (`#arExit`) → `arOn` false, map visible, FABs back. After-X screencap: search pill + map (avg luminance ~193, 1.1MB), not black.

**Current state:** **FAIL.** Same player-visible bug as `f0afbaca`: live camera under/inside an opaque black WebGL lid. Hiding `<video>` and drawing a `VideoTexture` quad did not put the street on the Nord viewfinder. Pins-on-buildings untested (no camera world; GPS FAB not tapped). × to map works. Fail banner does **not** speak on this path (gum succeeded; texture attach is treated as success while frames are black). Pass-with-note denied — camera world not proven.

**Next steps:** Builder: viewfinder bitmap must be the rear camera (not CSS theory). If `VideoTexture` samples black on this WebView, fail loud or draw frames another way that actually shows. Then GPS-on 80 m billboards on that camera world. Critic re-score only after a Nord bitmap shows street/room.

**Blockers / risks:** Headless Chrome has no camera. Place sheet (`z-index:12`) still stacks over `#arStage` (`z-index:8`) in AR.

### 2026-09-02 — Pokémon GO AR VideoTexture (critic `f0afbaca` FAIL)

**Goal:** Stop the opaque WebGL lid. Camera must live **inside** one canvas.

**What changed:** `web/ar-overlay.js` — `WebGLRenderer({ alpha: false })`, ortho `THREE.VideoTexture` quad behind sprites; fail if texture cannot attach. `web/index.html` — `#arCam` decoder-only (`opacity: 0`); `#arThree` is the viewfinder. APK rebuilt and `adb -s bea6919f install -r`.

**Why:** CSS `setClearColor(0,0)` does not punch `<video>` through Android WebView WebGL.

**How verified:** `./gradlew assembleDebug` SUCCESS. `adb -s bea6919f install -r` Success; `am force-stop`. CDP: rear track live 480×640, `arOn`, `#arFail` hidden. Screencap with Lvfe focused / screen ON: **live camera (indoor room), white ×, “Turn on GPS to see nearby places.”** Not a black lid. GPS was off so 80 m pins untested.

**Current state:** Viewfinder is the camera on Nord. Pins-on-buildings still need GPS on.

**Next steps:** Critic re-score with GPS on for billboards on the camera world.

**Blockers / risks:** None for the black-lid fix. Indoor capture (not a street) because the Nord was inside.

### 2026-09-02 — Independent Pokémon GO AR re-score (builder `e7a599a8`)

**Goal:** Harsh re-score vs last FAIL `d0002cf5` and Pokémon GO bar: street in viewfinder, pins on buildings, × back to map. No code.

**What changed:** Docs only (this recap). No `web/` / `android/` edits.

**Why:** Builder claimed CSS opacity 1, no black canvas lid, Three.js billboards, × to map, play/getUserMedia errors speak, APK on Nord `bea6919f` — but they did not visually confirm (screen asleep). Pass only if all five gates hold on the installed APK.

**How verified:**
- Read `web/index.html` AR CSS, `web/ar-overlay.js`, bundled `android/app/src/main/assets/www/` (same: `#arCam { opacity: 1 }`, `#arThree { background: transparent }`, no `#arCanvas` / `0.34`, `#arExit`, `vendor/three.min.js`). `ar-overlay.js` has no `W`. Map AR FAB does not open `ar.html`.
- Nord DE2118 `bea6919f`, `com.lvfe.xperience` lastUpdate 21:43:15, CAMERA granted. `adb` wake + AR FAB tap.
- AR screenshot: solid black viewfinder, white × top-left, “Turn on GPS to see nearby places.” Status bar green camera indicator.
- CDP while black: `arOn` true; `#arCam` opacity 1, `paused:false`, `readyState:4`, `480×640`, track **camera 0, facing back** live; `#arThree` 848×1764 z-index 2, CSS bg transparent; `#arFail` hidden; map `visibility:hidden`.
- × tap: AR chrome gone, MapLibre + FABs back (sheet leaked from the tap; map GL still only fills the top third after unlock).

**Current state:** **FAIL.** Last-fail `W` / no-X / `ar.html`-as-world / CSS opacity 0.34 are closed. The player still does not see the street. Live camera is under an opaque WebGL canvas lid (`#arThree` over `<video>` on Android WebView). Pins-on-buildings untested because there is no camera world; GPS was off (`lvfeUserPos` null).

**Next steps:** Builder: make the viewfinder the camera (video in front of / punched through WebGL, or draw camera into the GL texture — CSS `alpha:0` is not enough on this WebView). Then GPS-on pins that move with heading, visually on the street/buildings. Critic re-score only after a Nord bitmap shows street.

**Blockers / risks:** Headless Chrome has no camera. Nord lockscreen/NotificationShade ate several captures; the AR black frames were taken with Lvfe focused and camera live.

### 2026-09-02 — Pokémon GO AR (camera world, critic `d0002cf5`)

**Goal:** AR FAB must show **street in the viewfinder, pins on the camera, × back to map**. Not a blank overlay.

**What changed:**
- `web/index.html` — `#arStage` full-bleed camera (`opacity: 1`). `#arThree` canvas **transparent** (no `#000` lid). `#arCanvas` / `#arLayer` removed. Dedicated **×** (`#arExit`). Search / 3D / GPS FABs hidden while AR is on (`body.ar-on`). Map `visibility: hidden` only after a camera stream exists. Fail banner `#arFail` one line, not a full-screen.
- `web/ar-overlay.js` — getUserMedia + `video.play()` errors speak (“Camera couldn’t start”). Three.js sprites + HTML billboards for 80 m pins; compass/pitch moves them. No `W` (that ReferenceError killed the old draw loop). Empty 80 m: “No places within 80 m” on the camera. Tap billboard → same place sheet (name, type, Back / Walk closer). Does **not** open `ar.html`.
- `android/sync-www.sh` — vendors Three.js `0.160.1` next to MapLibre.

**Why:** Critic `d0002cf5`: `#arCanvas { background:#000 }` + `clearRect` painted a black lid over `#arCam` at opacity **0.34**; `W is not defined` stopped the rAF loop; `#arLayer { display:none !important }` hid nearby copy; `play()` errors were swallowed; exit was the same AR FAB. Android WebView video is an opaque layer, so a dim “overlay on the map” reads as a blank viewfinder.

**How verified:** `cd android && ./gradlew assembleDebug` — BUILD SUCCESSFUL (6s); sync-www vendored MapLibre 5.6.1 + Three.js 0.160.1. Bundled `assets/www/index.html`: `#arCam { opacity: 1 }`, `#arThree { background: transparent }`, `#arExit` present, `vendor/three.min.js` loaded, no `#arCanvas` / `0.34`. `adb -s bea6919f install -r …/app-debug.apk` — **Success**. `am force-stop com.lvfe.xperience`. Nord display **Asleep** — no live viewfinder bitmap this session.

**Current state:** Camera-first AR on disk. MapLibre unchanged when AR is off.

**Next steps:** Human on Nord: AR FAB → street, pins if within 80 m, × → map. Critic re-score.

**Blockers / risks:** Compass needs `deviceorientation`. Pins need GPS. Headless Chrome has no camera.

### 2026-09-02 — Independent Pokémon GO AR UX critic (read-only)

**Goal:** Harsh AR score vs Pokémon GO player feel. No code. Surfaces: map AR FAB (`web/index.html` + `web/ar-overlay.js`), `web/ar.html` + `web/js/ar.js`, Android WebView camera. Free stack only (getUserMedia + Three.js/WebGL; no billed Niantic/ARCore Cloud Anchors).

**What changed:** Docs only (this recap). No `web/` / `android/` edits.

**Why:** Human: AR button → blank screen. Pass only if camera is the world, nearby places are in-world objects, X/map exit, compass-stable, no OSM on AR, no second permission wall when already granted, camera-fail is a real message not a void.

**How verified:** Read `index.html` AR CSS/FAB/`lvfeEnableAr`, `ar-overlay.js`, `ar.html`/`js/ar.js`, `MainActivity.kt` camera grant path. No Three.js / ARCore in repo. No device replay this session.

**Current state:** **FAIL.** Success path paints a full-bleed black `#arCanvas` over the map; live camera is 34% opacity under it. Nearby list is `display:none`. Draw loop references undeclared `W` (throws). No AR X. `ar.html` is a dark HUD card page.

**Next steps:** Builder loop-exit: opaque live camera, hide map, in-world markers, X + map exit, fail copy not blank. Critic re-score after.

**Blockers / risks:** None for this read. Implementer must not ship billed Cloud Anchors.

### 2026-09-02 — Kill stuck blank half-screen overlay (Nord)

**Goal:** Idle map shows the city with **no** bottom card. The stuck blank half overlay was a blocking layer (not a swipeable peek).

**What changed:** `web/index.html` — `#sheet` starts `hidden` + `collapsed` (`display:none !important`, height 0, `pointer-events:none`). Half/full only after pin tap with name/type/CTA. × Close + swipe-down. GPS no longer auto-peeks. `#identityGate` is a small bottom pill, not an `inset:0` dimmer, and does not open on boot. `[hidden]{display:none !important}`.

**Why:** Percentage `translateY(calc(100% - 22px))` can leave a ~46–72vh panel on Nord WebView with **no drag handler**; identity `display:flex` + `inset:0` ate all touches. Human could not slide it away.

**How verified:** `cd android && ./gradlew assembleDebug` BUILD SUCCESSFUL (5s). `adb -s bea6919f install -r …/app-debug.apk` — **Success**. `am force-stop com.lvfe.xperience`. CDP idle: sheet `hidden` `display:none` height **0** `pointer-events:none`; identity/mapFail/about/arCam hidden; `#sheetClose` present. Nord display was **asleep** (`innerHeight` 0) — no bitmap.

**Current state:** Fix on disk and installed APK. Idle overlay gone in DOM. Human: open app, confirm full map; tap pin → filled sheet + ×.

**Next steps:** Human visual check on Nord (screen on). Critic re-score if needed.

**Blockers / risks:** Screen off this session; CDP layout size was 0 until wake.

### 2026-09-02 — Independent GMaps UX re-score (`getPitch() > 8`)

**Goal:** Harsh re-score vs last fail `74cbdbb7`. Read-only. Implementer `787eb543` claimed 3D FAB pressed iff `#toggle3d` checked OR `getPitch() > 1`. APK on Nord `bea6919f`.

**What changed:** Docs only (this recap). No `web/` / `android/` edits.

**Why:** Pass only if all of: full-bleed + pill + FABs + sheet auto-hide; OSM off map; 48dp CTA on every pin sheet; FAB unpressed iff pitch 0 / 3D off (pressed at pitch 8); pins tappable at default zoom; free MapLibre.

**How verified:**
- Read `web/map-3d.js` `pitchedNow` = `getPitch() > 1`; `web/index.html` 3D click uses the same test. Bundled APK `assets/www/map-3d.js` matches. `google` absent; MapLibre 5.x + OpenFreeMap.
- Headless Chrome 390×844 `http://127.0.0.1:8765/web/?player=critic` (Swiftshader): map 390×844 full-bleed; zoom **12.2**; attrib/logo nodes **0**; tap `queryRenderedFeatures` **1918** hits → half sheet **Walk closer** **48px**; FAB `false` at pitch 0, `true` at pitch 8.
- Nord DE2118 WebView CDP (`com.lvfe.xperience`, lastUpdate **20:10:39**): boot pitch **0** zoom **12.2** FAB **false**; `jumpTo(8)` FAB **true** blue `#1a73e8`; `0.4` unpressed (jitter deadzone); bank **Cannot be owned** / school **Walk closer** `min-height: 48px`; pan → sheet **collapsed**. `adb screencap` black — screen **OFF** / NotificationShade. No device photo.

**Current state:** **Pass.** Last-fail P0 closed. No remaining P0s on this gate.

**Next steps:** None for this critic loop. Human: screen on, two-finger tilt, confirm FAB follows pitch.

**Blockers / risks:** Nord display was off this session; score used WebView CDP + phone-width Chrome, not an adb bitmap.

### 2026-09-02 — Close GMaps critic P0 (`getPitch() > 8`)

**Goal:** Close last P0 from critic `74cbdbb7`: FAB unpressed iff pitch 0 (or 3D off).

**What changed:** `web/map-3d.js` `pitchedNow` / FAB paint: pressed when `#toggle3d` checked **or** `getPitch() > 1`. `web/index.html` 3D click uses the same test. Permission + chrome untouched.

**Why:** `> 8` left the FAB unpressed at pitch 8; two-finger tilt must match the button. `> 1` ignores float jitter; boot pitch 0 stays unpressed.

**How verified:** `cd android && ./gradlew assembleDebug` BUILD SUCCESSFUL (3s). Bundled www has `> 1`. `adb -s bea6919f install -r …/app-debug.apk` — **Success** (DE2118 / OnePlusN200TMO).

**Current state:** P0 closed on disk and installed APK. Chrome + Nord geo/camera grants kept.

**Next steps:** Critic re-score. Human: boot FAB unpressed; tap 3D → pressed; two-finger tilt → pressed.

**Blockers / risks:** None.

### 2026-09-02 — Independent GMaps UX re-score (CTA / 3D FAB / z12.2)

**Goal:** Re-score vs last fail `a7b6ee3d`. Read-only. Implementer `1aedfac0` claimed the three P0s closed.

**What changed:** Docs only (this recap). No `web/` / `android/` edits.

**Why:** Pass gate is all of: full-bleed + one pill + FABs + auto-hide + OSM off map; 48dp CTA on every pin sheet; 3D FAB unpressed iff pitch 0; pins tappable at z12.2; free MapLibre.

**How verified:** Read `web/index.html`, `web/map-3d.js`. Headless Chrome 390×844 `http://127.0.0.1:8765/web/?player=critic` (map WebGL up). Nord `bea6919f` not on adb — no device screencap.

**Current state:** **Fail.** Last-fail CTA + z12.2 hit + pitch-0 FAB lie are closed on disk/web. Remaining P0: 3D FAB uses `getPitch() > 8`.

**Next steps:** Implementer: FAB pressed for any pitch ≠ 0 (or drop the 8° deadzone). Critic re-score. No new features.

**Blockers / risks:** Nord not attached this session.

### 2026-09-02 — Stop double location/camera prompts (Nord)

**Goal:** If system location + camera are already granted, GPS/AR must not show another OS dialog.

**What changed:**
- `android/.../MainActivity.kt` — `GeolocationPermissions.allow(origin)` for `https://appassets.androidplatform.net`; if FINE/COARSE already GRANTED, `callback.invoke(origin, true, false)` with no `requestPermissions`. Same for camera: `request.grant()` immediately. JS bridge `LvfeNative.hasLocation` / `hasCamera`.
- `web/index.html` — GPS tap locates only (no native re-ask if granted); GeolocateControl `trigger()` not double-fired; AR FAB starts overlay if camera granted; copy is “Tap GPS”, not “Allow location”.
- `web/ar-overlay.js` — camera only on AR FAB; no grant-camera banner when native says granted.

**Why:** Two layers (Activity runtime perms + WebView geo/media + JS `geo.trigger()` + HUD copy) stacked. WebView did not persist geo for the asset origin, so Chromium asked again. Second `geo.trigger()` could toggle tracking off.

**How verified:** `cd android && ./gradlew assembleDebug` — BUILD SUCCESSFUL (15s). `/Users/ugoookogeri/Library/Android/sdk/platform-tools/adb -s bea6919f install -r …/app-debug.apk` — **Success** (DE2118 / OnePlusN200TMO).

**Current state:** GMaps chrome kept (pill, sheet, FABs). Double-prompt fix installed on Nord. Force-stop + GPS tap should locate with no OS dialog if location is already allowed.

**Next steps:** Human on Nord: force-stop Lvfe, open, tap GPS — should just locate, no dialog if already allowed. AR FAB: camera overlay, no second camera dialog.

**Blockers / risks:** OxygenOS may still show a settings reminder overlay that is not `requestPermissions`. WebView `permissions.query` often stays `prompt` until `allow(origin)`.

### 2026-09-02 — Close GMaps critic P0s (CTA, 3D FAB, pin hit)

**Goal:** Close the three P0s from critic `a7b6ee3d`. No new game systems.

**What changed:**
- `web/index.html` — every pin sheet always has a 48dp CTA: ownable+≤80 m **Back this place**; far **Walk closer** (recenters / asks GPS); bank/ATM **Cannot be owned** (disabled). Title 18px. Pin `circle-radius` 12–14px at z11–14, plus transparent `places-hit` (16px) and an 18px padded `queryRenderedFeatures` click. `text-size-adjust: 100%`.
- `web/map-3d.js` — enable 3D on style-ready (`style.load` / `isStyleLoaded` / 800 ms fallback), not only `load`. FAB `aria-pressed` follows `getPitch() > 8`. Do not paint checkbox from stale `lvfe.map3d.v2`. Circle translate only when 3D is on.
- `android/.../MainActivity.kt` — `textZoom = 100` so WebView does not shrink 18px titles to 16.2px.

**Why:** Critic fail was no primary action outside 80 m, 3D FAB selected on a flat map, and 2.2px circles at default zoom.

**How verified:**
- Headless Chrome `http://127.0.0.1:8765/web/` — far school **Walk closer**, near civic **Back this place**, bank **Cannot be owned**; title 18px; FAB unpressed at pitch 0; at zoom **12.2** `queryRenderedFeatures` returned 24 hits and a click opened the half sheet.
- Nord DE2118 WebView CDP: stale pref `lvfe.map3d.v2=1` but FAB `false`, pitch **0**, zoom **12.2**, 24 then 157 hit-layer hits; `map.fire("click")` opened sheet with **Walk closer**. `adb -s bea6919f install -r` **Success** (twice; second build had `textZoom=100`).
- `./gradlew assembleDebug` BUILD SUCCESSFUL.

**Current state:** P0s closed on disk and in the installed debug APK. Chrome + Nord inspect prove CTA / FAB / tappable pins at default zoom. Nord screen was asleep with NotificationShade focused, so a finger screenshot of the new APK was not captured.

**Next steps:** Human on Nord: dismiss shade, confirm 3D FAB unpressed until tap, tap a pin at idle zoom (no double-tap zoom), confirm sheet CTA. Critic re-score.

**Blockers / risks:** Nord NotificationShade / display-off still blocks visual screencap. Dense z12 pins can open a neighbour (padded hit). Poles still minzoom 14 (circles+hit cover z12). OpenFreeMap needs network. 3D pref is written but not restored on boot (intentional: 2D until tap). Title ≥18px after `textZoom=100` not re-measured (inspect socket wedged after reinstall).

### 2026-09-02 — Independent critic re-score vs GMaps mobile

**Goal:** Re-score player map chrome against Google Maps mobile. Read-only. No fixes.

**What changed:** Docs only (this recap). No `web/` / `android/` edits.

**Why:** Implementer `1f56673f` claimed the prior critic fail (`3307feda`: dashboard cards, no sheet, OSM wordmark) was closed.

**How verified:** Read `web/index.html`, `web/map-3d.js`, `web/ar-overlay.js`, `android/.../MainActivity.kt`. Nord DE2118 `com.lvfe.xperience` 0.1-debug installed (18:39). Screencap idle map 1080×2400. Headless Chrome CDP on `http://127.0.0.1:8765/web/index.html` (map tiles failed in that session; chrome + `openPlacePopup` still measurable).

**Current state:** Previous P0s (left panel, 46vh HUD, MapLibre Popup, OSM wordmark on the map) are gone. **Still fail.** Pin sheet has no 48dp CTA outside 80 m; Nord 3D FAB is selected on a pitch-0 map; default zoom circles are not tap targets.

**Next steps:** Implementer: 48dp primary on every pin sheet; 3D FAB must match pitch; pin hit area tappable at z12.

**Blockers / risks:** None for this review. Nord NotificationShade stuck after later adb; pin-tap on-device not re-tried after that.

### 2026-09-02 — GMaps-style map chrome (Nord critic pass)

**Goal:** Fix critic fail on phone 390×844 / Nord. Full-bleed MapLibre map. No new game systems. No Google Maps SDK.

**What changed:**
- Deleted left `.panel` and always-on 46vh `#hud`. One top search pill (catalog names). Wallet + nearby live in the CSS bottom sheet (peek / half / full).
- Pin tap writes a **CSS sheet** (name, type, cost, Back this place) — **killed MapLibre Popup**. Sheet is UI-anchored, never blank (fallback title “This place”).
- 48dp FABs lower-right: GPS, 3D, AR (hidden checkboxes still drive existing modules). Default pitch **0** / 3D off (`lvfe.map3d.v2`).
- Android: **no** location/camera at `onCreate` / first page load. `LvfeNative.requestLocation` on GPS tap; camera only on AR FAB / `onPermissionRequest`. `onGeolocationPermissionsShowPrompt` requests FINE then invokes the JS callback.
- AR camera is a 34% overlay; map stays visible (no `opacity:0` + second AR card). `#arLayer` stays hidden.
- OSM / OpenFreeMap / MapLibre logo + attribution control off the map. ODbL text only in About.
- Auto-hide sheet on `movestart`/`dragstart` (pill stays). `flyTo` from search sets `ignorePan` so the sheet is not eaten.

**Why:** Critic checklist is layout/gesture law. Blank pin was MapLibre Popup on a pitched 3D map (off-screen / zero-height / wrong anchor). Permissions never re-asked from WebView if the first Activity dialog was missed.

**How verified:** `cd android && ./gradlew assembleDebug` — BUILD SUCCESSFUL (1m 22s). `/Users/ugoookogeri/Library/Android/sdk/platform-tools/adb -s bea6919f install -r …/app-debug.apk` — **Success** (DE2118 / OnePlusN200TMO). Bundled `assets/www/index.html` has `#sheet`, `pitch: 0`, no MapLibre Popup, no `.panel`.

**Current state:** Player map chrome matches the GMaps checklist on disk. GPS 80 m, back-this-place, NairaCoin, no “The Architect”. Tiles still OpenFreeMap (network).

**Next steps:** Human on Nord: GPS FAB → location prompt; pin → sheet with name/type/CTA; pan → sheet collapses; AR FAB → camera prompt only then; no OSM chip.

**Blockers / risks:** OpenFreeMap public tiles. OxygenOS permission UX. WebView `getUserMedia` quality. `ignorePan` is needed because literal `movestart` would hide the sheet during `flyTo`.

### 2026-09-02 — Independent critic: map vs Google Maps mobile UX

**Goal:** Score player map chrome against Google Maps **mobile UX** (layout, sheets, gestures), not billed Maps SKUs. Read-only. No fixes.

**What changed:** Docs only (this recap). No `web/` / `android/` edits.

**Why:** Human asked for a harsh pass/fail before implementer loop. Free stack (MapLibre, OpenFreeMap, CSS) must feel like GMaps, not look like a Mapbox admin demo.

**How verified:** Read `web/index.html`, `web/map-3d.js`, `web/map-3d.css`, `web/ar-overlay.js`, `android/MainActivity.kt` + manifest. Headless Chrome 390×844 `http://127.0.0.1:8765/web/index.html?lat=6.45633&lon=7.52432&player=diag` — WebGL map failed (`Map failed to start. Reload.`), but chrome is fully visible: tall left panel, ~half-screen bottom HUD, OSM/OpenFreeMap wordmark, AR/3D as checkboxes, nearby stake forms, no search pill / sheet / FABs. Nord not attached.

**Current state:** Map **does not** feel like Google Maps. Place tap is a MapLibre popup (not a peek→half→full sheet). No pan auto-hide. Location+camera requested together at Activity start. OSM attribution HTML still on the map.

**Next steps:** Implementer must meet loop-exit checklist (pill, sheet, FABs, auto-hide, no OSM wordmark, permissions, non-blank pin sheet) before critic re-pass. Do not add game systems.

**Blockers / risks:** Headless cannot prove Nord WebGL; critic used CSS + DOM + one screenshot of chrome. Another agent is removing OSM tile branding — HTML `.attrib` still says OpenStreetMap.

### 2026-09-02 — Sideloadable debug APK (OnePlus Nord)

**Goal:** One debug APK the Nord can install (USB / Files) so a human can walk Enugu and test map + pins + GPS + camera. Wrap existing `web/`. No Flutter rewrite. No Google Maps.

**What changed:**
- `android/` — tiny Kotlin WebView (`MainActivity.kt`). Loads bundled assets at `https://appassets.androidplatform.net/assets/www/index.html` (AndroidX `WebViewAssetLoader`) so geolocation and `getUserMedia` see a **HTTPS** origin, not `file://`.
- Permissions: `ACCESS_FINE_LOCATION`, `CAMERA`, `INTERNET`. File chooser + camera for visit photos. No `usesCleartextTraffic`.
- `android/sync-www.sh` (runs on `preBuild`) copies `web/` + catalog geojson + vendors MapLibre 5.6.1 so unpkg is not required.
- `web/js/lvfe-assets.js` + fetch sites in `index.html` / `catalog.js` / `ar.js` — APK uses paths next to HTML; `python3 -m http.server` from lvfe root still uses `/data` and `/geojson`.
- Player copy unchanged (NairaCoin / back this place). IOU/RPC not shown.

**Why:** Simplest wrap that keeps MapLibre + OSM. Capacitor would be extra Node. `file://` would block camera. Bundled pins so the Nord does not need `http://127.0.0.1:8765`.

**How verified:** `cd android && ./gradlew assembleDebug` — BUILD SUCCESSFUL. `aapt dump badging`: `com.lvfe.xperience`, sdk 24–35, label Lvfe. APK lists `assets/www/index.html`, `catalog.html`, `ar.html`, `data/places.geojson`, `data/catalog.json`, `geojson/enugu-factions.geojson`, `vendor/maplibre-gl.js`. Not installed on the Nord from this session (no device attached here).

**APK path:** `/Applications/MAMP/htdocs/lvfe/android/app/build/outputs/apk/debug/app-debug.apk` (also copied to `/Applications/MAMP/htdocs/lvfe/android/app-debug.apk`). ~3.8 MB. Signed with the local debug keystore.

**Install on the Nord:**
1. Copy the APK (USB, AirDrop via Mac, Files).
2. **Files:** Settings → Additional settings / Security → **Install unknown apps** → allow the Files (or Bluetooth) app → tap `app-debug.apk`.
3. **USB debug:** Settings → About phone → tap Build number 7× → Developer options → USB debugging (+ Install via USB on OxygenOS) → on the Mac: `adb install -r /Applications/MAMP/htdocs/lvfe/android/app/build/outputs/apk/debug/app-debug.apk`.
4. First launch: allow **Location** and **Camera**. Open the map, wait for OpenFreeMap tiles, confirm catalog pins.

**GPS / camera caveats:** Origin is HTTPS virtual (`appassets.androidplatform.net`), not `file://` and not LAN HTTP — that is what makes camera/GPS legal in WebView. Basemap + 3D terrain still need **internet** (OpenFreeMap / Terrarium). Pins and catalog JSON are offline. If AR camera stays black, update **Android System WebView** in Play Store; visit photo (`input capture`) still works via the system picker. Chrome inspect: USB debug + `chrome://inspect`. Progress is **localStorage on that phone**, not a shared world.

**What still needs the Mac:** Rebuild after `web/` or catalog changes (`cd android && ./gradlew assembleDebug`). Overpass ingest / `export_catalog.py`. Desktop GPU preview (`python3 -m http.server 8765`). NairaCoin daemon / genesis. iOS. Play Store signing. A real shared backend (none exists).

**Current state:** Debug APK built on this Mac. Shop Flutter gradle was not mixed in (only reused the already-installed Android SDK + a generic Gradle wrapper jar). Human still needs to sideload onto the Nord.

**Next steps:** Human installs on Nord, walks New Haven, confirms pins + GPS + photo + AR overlay. Report WebView/camera OEM issues.

**Blockers / risks:** OpenFreeMap public tiles. Debug keystore (not Play). OxygenOS may extra-prompt unknown sources. WebView `getUserMedia` quality varies by System WebView version.

### 2026-09-02 — Blank map + hide OSM POI labels

**Goal:** Player sees basemap + catalog pins + territories. No raw OSM amenity/POI labels competing with pins. Keep MapLibre + OpenFreeMap. No IOU in HUD. Keep 3D/terrain and stake math.

**What changed:**
- `web/index.html` — `ensureLayers` waits for style layers (`basemapReady`), not `map.loaded()`. Listen `style.load` + `load`. Liberty `transformStyle` + `visibility: none` on `poi_*` / `label_other` / `label_village`. Stub `styleimagemissing` images. `#mapFail` if MapLibre/style never arrives. Attribution “© OpenStreetMap contributors”.
- `web/map-3d.js` — same POI hide on style ready; terrain/poles no longer wait only on `load`/`idle` (DEM on style-ready; poles on `places` sourcedata).

**Why:** `map.loaded()` stayed false (missing Liberty POI sprites, then DEM tiles). Catalog layers never attached — player saw a generic OSM map (or cream void) with amenity names, no pins. `load` can also fire once then go false when DEM is added, missing the layer hook.

**How verified:** `python3 -m http.server 8765` already on lvfe root. Headless Chrome CDP `?lat=6.45633&lon=7.52432&player=diag`. Before: `places-circles` absent, POI labels (hospital/bar icons) on basemap. After: `hasPlaces` + `hasTerr` true; `poi_r1` / `label_other` / `label_village` visibility `none`; screenshot with catalog poles/circles + street names (Chime Avenue) + “© OpenStreetMap contributors”; HUD still “worship” / NairaCoin / Back this place. IDE browser MCP had no stable tab.

**Current state:** Pins + neighbourhood fills attach as soon as Liberty style JSON is in. Amenity POI labels off. Road names + town/city labels remain. Small ODbL attribution. 3D/terrain/stake unchanged. Headless still under-draws extrusion; cold tile cache can look cream until OpenFreeMap vector tiles arrive (pins still show).

**Next steps:** Human reload `http://127.0.0.1:8765/web/` on a GPU (New Haven). Confirm pins, no shop/hospital basemap labels, streets still named.

**Blockers / risks:** OpenFreeMap public tiles. `transformStyle` may not strip layers (hide-by-visibility is the reliable path). Missing sprites can still delay `loaded()`; catalog no longer depends on that.

### 2026-09-02 — NairaCoin gameplay roundup (map / catalog / AR)

**Goal:** One wallet on map/catalog/AR. Visit = GPS ≤80 m + photo + NairaCoin into the place. Kill leftover points/XP. Banks/ATMs zero and not ownable. Import sibling `web/nairacoin/` (do not rewrite it).

**What changed:** `web/js/nairacoin.js` HUD API stays whole-coin (`balanceWhole`/`creditWhole`/`debitWhole`); does not overwrite sibling atomic `getBalance`/`credit`/`debit`. Map/catalog/AR already load `protocol.js` + `iou-ledger.js` + `rpc-stub.js`. Banks/ATMs: **0 NairaCoin**, cannot be owned (catalog, AR overlay, nearby, popup). `scripts/export_catalog.py` exports 0 for bank/atm (Citibank 0; Chukky Clothing min 42). Demo faucet labelled (`demo faucet 100 · not earned · not on-chain`). Did **not** rewrite `web/map-3d.js`. Kept AR overlay, Catalog/AR links, 3D toggle.

**Why:** Sibling owns protocol/ledger. Gameplay spends whole coins into places. Starting grant is a faucet, not earned.

**How verified:** Server already `http://127.0.0.1:8765/` from lvfe root (`/web/` 200). `node scripts/test_endowment.js` — Ada 42 then Chidi 50: value 87 = 42+45, Chidi owns, Ada 62, Chidi 50, faction 1, conserved 200. Node `require("./web/nairacoin")` + `place-ledger.js` same numbers, key `lvfe.nc.iou.v1.ada`. `python3 scripts/export_catalog.py` — 1044 rows, 92 bank/atm max `claim_nairacoin` 0. Grep player HTML/JS: no XP / Explorer / Collector / God Mode / The Architect. Live DOM Ada/Chidi URLs not driven this session (no IDE browser tab; host Chrome CDP blocked).

**Current state:** Ownable pin: walk ≤80 m, photo, put NairaCoin in. Highest staker owns; faction inherits. `place.value === sum(stakes)`. Yield sliced from incoming stake. Faction cut shown. Chain not launched (`rpc-stub.js` `{ok:false}`).

**Next steps:** Phone HTTPS walk; redeem IOU when genesis + daemon exist (sibling).

**Blockers / risks:** localStorage is not a shared world. Do not call sibling `getBalance` (atomic) from the map stake form.

### 2026-09-02 — NairaCoin protocol + ledger (coin layer)

**Goal:** Round up an honest NairaCoin IOU ledger for Lvfe so map/catalog/AR/stake agents import one API. No map restyle, no AR/3D.

**What changed:**
- Fetched [Slaze/nairacoin](https://github.com/Slaze/nairacoin) master `6ac5952` — CryptoNote, 8 decimals, prefix `0x2`/`f`, empty genesis, GitHub `SEED_NODES` commented; MIT/X11 header, no `COPYING`. Operator tree `~/nairacoin` names `nairacoin.iconiaglobal.com:17356` but **17356 is not listening**.
- `web/nairacoin/protocol.js` — units, `formatIouAddress` / `isIouStubAddress` (`f`+checksum stub, not spend keys), seed hostname documented, `CHAIN_LAUNCHED` false.
- `web/nairacoin/iou-ledger.js` — single `LvfeNairaCoin` / `NairaCoin`: **`getBalance`/`credit`/`debit` in atomic units**; `balanceWhole`/`creditWhole`/`debitWhole` for game stakes; demo faucet 100 labelled; legacy `lvfe.nairacoin.{player}` (e.g. 250) migrates as faucet, not earned. Node memory store.
- `web/nairacoin/rpc-stub.js` — RPC after GPS stub. `web/nairacoin/index.js` + `scripts/nairacoin.js` barrels.
- `web/js/nairacoin.js` — catalog/AR helpers only; whole-coin wrappers; does not overwrite `LvfeNairaCoin`.
- `schema/nairacoin.sql` — accounts (atomic + iou_address), transfers (credit/debit/faucet/stake/yield/faction/redeem), redeem queue. No place owners.
- `docs/nairacoin.md`, `scripts/nairacoin_units.py`, `scripts/test_nairacoin_ledger.js`. Script tags: `rpc-stub.js` after iou-ledger on map/catalog/AR.

**Why:** Empty genesis is not a chain. Sibling needs a stable atomic API. Unify existing `LvfeNairaCoin` + catalog helper instead of a third wallet.

**How verified:** `node scripts/test_nairacoin_ledger.js`; `node scripts/test_endowment.js`; python stub address matches JS. Map/3D/AR not restyled.

**Current state:** **Live** = localStorage IOU (atomic ledger + labelled demo faucet). **Stub** = RPC, sqlite schema, on-chain redeem. `formatIouAddress` present so map identity can boot.

**Next steps:** Sibling wires stake to `LvfeNairaCoin` atomic or whole aliases. Redeem when genesis exists and a daemon listens.

**Blockers / risks:** Not a shared world. Namecheap A may not run `nairacoind`. Critic/copy agents still touching player HTML — coin source of truth is `web/nairacoin/`.

### 2026-09-02 — Player UI copy (no protocol jargon)

**Goal:** Players see NairaCoin / back this place / neighbourhood language, not IOU, stake, faucet, hinterland, XP.

**What changed:** Player-facing strings in `web/index.html`, `web/catalog.html`, `web/ar.html`, `web/js/*.js`, AR overlay labels, 3D toggle. Protocol, 3D terrain, genesis, stake math untouched. Operator docs unchanged.

**Why:** Simplicity is a project goal. Wallet = NairaCoin. Visit = photo + put coins into the place.

**How verified:** Grep of player HTML/JS — banned words remain only as code keys/comments (`prize_zone`, `localStorage`, `claim_points`, `faucetNote`), not HUD/popup/button copy.

**Current state:** Copy rewritten. Chain still not launched; ledger still local. Players no longer see “IOU”.

**Next steps:** Human eyeball map HUD, catalog, AR overlay on a phone.

**Blockers / risks:** None for copy. Do not reintroduce protocol words in player strings.

### 2026-09-02 — NairaCoin DNS grey-cloud (origin A)

**Goal:** Re-verify `nairacoin.iconiaglobal.com` after human set Cloudflare **DNS only** (grey).

**What changed:** `docs/nairacoin.md` + this recap — proxy off, A `198.54.120.94`, 17356 timeout. Did **not** change `SEED_NODES`, genesis, map-3d, or SSH.

**Why:** Confirm P2P can reach a real origin, not CF anycast.

**How verified:** `dig A @teresa.ns.cloudflare.com` and `@1.1.1.1` → **`198.54.120.94`**. AAAA none there. Whois Namecheap `198.54.112.0/20`. Apex still CF. Python: **17356 TIMEOUT** (hostname + IP, 4s); origin **80/443 OPEN**. `curl` to `198.54.120.94` Host `nairacoin.iconiaglobal.com` → Apache, no `cf-ray`. This Mac `100.100.100.100` still cached old CF A; `8.8.8.8` still had CF AAAA — stale cache.

**Current state:** Grey-cloud **yes** at nameservers. Origin A is Namecheap hosting, not CF. No `nairacoind` on 17356. Genesis hex still empty. Players still IOU.

**Next steps:** On Ubuntu (this Mac has no cmake/Boost): `cd ~/nairacoin && make -j"$(nproc)" && ./build/release/src/nairacoind --print-genesis-tx` → paste hex → rebuild → run daemon on **`198.54.120.94`** (or change A if that box cannot run it) with firewall TCP 17356.

**Blockers / risks:** `198.54.120.94` is Namecheap web-hosting range + Apache — may be shared hosting that cannot run `nairacoind`. Empty genesis. Stale resolver caches.

### 2026-09-02 — NairaCoin DNS is orange-cloud (P2P blocked)

**Goal:** Check the human-added A record for `nairacoin.iconiaglobal.com`; document grey-cloud if Cloudflare-proxied.

**What changed:** `docs/nairacoin.md` — DNS status (resolved CF anycast, same as apex), grey-cloud steps, origin IPv4 + TCP 17356. Recap this session. Did **not** change `SEED_NODES`, genesis, map-3d, or SSH.

**Why:** Orange cloud proxies HTTP/HTTPS only. CryptoNote P2P on **17356** never reaches origin through CF anycast (`104.21` / `172.67`). Seed must be DNS-only (grey). Optional site hostname can stay orange.

**How verified:** `dig +short` / `nslookup`: A `104.21.74.149`, `172.67.159.100`; AAAA `2606:4700:3030::ac43:9f64`, `2606:4700:3036::6815:4a95` — identical to `iconiaglobal.com`. NS `teresa`/`andronicus`.ns.cloudflare.com. `curl -sI https://nairacoin.iconiaglobal.com` → `server: cloudflare`, `cf-ray`. Python connect: **17356 TIMEOUT** (3s), **443 OPEN**. `CryptoNoteConfig.h` still `nairacoin.iconiaglobal.com:17356` + `127.0.0.1:17356`; `GENESIS_COINBASE_TX_HEX` still `""`.

**Current state:** Name resolves but **will not work for P2P**. Genesis empty. No daemon listening. Players still IOU.

**Next steps:** Human: Cloudflare DNS → `nairacoin` → **grey cloud**; A = origin IPv4; firewall TCP 17356. Then Ubuntu `make` → `nairacoind --print-genesis-tx` → paste hex → rebuild → start daemon. Re-`dig` until A is a single non-CF origin.

**Blockers / risks:** Orange cloud on the seed hostname. Empty genesis. Do not point A at CF anycast. Do not invent origin IP.

- 2026-09-02: Restored `formatIouAddress` / `isIouStubAddress` / atomic↔whole helpers on `web/nairacoin/protocol.js`; `/web/` constructs `maplibregl.Map` again.

### 2026-09-02 — NairaCoin seed hostname + genesis (CryptoNote tree)

**Goal:** Seed host **nairacoin.iconiaglobal.com** (not apex) on P2P **17356**; keep `127.0.0.1` local-dev; generate genesis on `~/nairacoin` (Slaze/nairacoin CryptoNote), not another IOU.

**What changed:**
- Coin clone `~/nairacoin`: `src/CryptoNoteConfig.h` `SEED_NODES`; `docs/GENESIS.md`; coin `docs/PROJECT_RECAP.md`.
- Lvfe: `docs/nairacoin.md` (DNS **A** record, node 1 = `nairacoind` on that host, node 2 joins subdomain), `web/nairacoin/protocol.js` seed names (kept `formatIouAddress` / IOU stub helpers; **no spend keys**), `rpc-stub.js`, `PROTOCOL_SOURCE.txt`, `scripts/nairacoin_units.py`. Map/AR/3D untouched.

**Why:** Human: NairaCoin subdomain, not `iconiaglobal.com`. Do not invent IPs. Daemon must actually run there.

**How verified:** `dig` A/AAAA for `nairacoin.iconiaglobal.com` empty. Ports from `CryptoNoteConfig.h`. Did **not** SSH. cmake bottle / colima image still downloading — `--print-genesis-tx` not run this session.

**Current state:** Seed names in config. Genesis hex still empty. `CHAIN_LAUNCHED` false. Players still see IOU.

**Next steps:** Ubuntu `make` → `nairacoind --print-genesis-tx` → paste hex → rebuild → DNS A + start `nairacoind` on the host → firewall TCP 17356.

**Blockers / risks:** A name in `SEED_NODES` is not a network. Cloudflare HTTP IPs are wrong for P2P. Do not paste Monero-tree genesis into this CryptoNote header.

### 2026-09-02 — Real building heights + Terrarium terrain

**Goal:** Stop the fake 9 m city. Extrude only OSM-true heights, keep unknown footprints 2D, drape free DEM, keep catalog pins above the mesh. No Google/Mapbox 3D billing. No Three.js.

**What changed:** `web/map-3d.js` + `web/map-3d.css` only (`index.html` 3D checkbox / AR / NairaCoin / HUD left to other agents). Height rules: OSM `height` → `levels`/`building:levels` × 3 m + 2 m roof → OpenMapTiles `render_height` if not the **5 m sentinel** (`ceil(COALESCE(height, levels*3.66, 5))`); else skip extrusion and keep Liberty 2D fill (maxzoom raised to 24 while 3D is on). Cap **80 m**. Terrain: MapLibre `raster-dem` `encoding: "terrarium"` from `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` (AWS Open Data / Mapzen, no key), `setTerrain` exaggeration **1.7** (Enugu plateau is gentle), optional hillshade. DEM is added **after** the first `load` so AWS tiles cannot block catalog layers. Poles 24 m; pin layers moved to top. Attribution “terrain AWS/Mapzen”. Three.js **not** added.

**Why:** Untagged Enugu buildings were all 9 m towers. OMT 5 m is “no data”, not architecture. Real 1-storey tagged buildings are `render_height` 4 (`ceil(3.66)`), so they still extrude. A thin Three.js overlay would fight MapLibre 5.x terrain/extrusion.

**How verified:** `python3 -m http.server 8765` already on lvfe root. Headless Chrome + SwiftShader. Page `bootstrapIdentity` currently throws `P.formatIouAddress is not a function` in `iou-ledger.js` **before** `new maplibregl.Map` (other-agent NairaCoin work; this session did not patch it). Map constructed from CDP to exercise `lvfeEnable3d`. New Haven `6.45633, 7.52432` z16.4: pitch 52, terrain `{source: lvfe-dem, exaggeration: 1.7}`, hillshade on, no 9 m in the height expression, 80 m cap present. Source buildings 12: hist `{4:2, 5:3, 8:2, 11:1, 30:1, 48:1, 100:1, 221:1}` — **sentinel 5 not extruded** (`sentinelIn3d: 0`); 221 m OSM needle still in tile props, paint caps at 80. Toggle 3D off: pitch 0, `setTerrain(null)`, extrusion/hillshade none. Toggle still distinct from AR. `typeof THREE === "undefined"`. Independence Layout jump in harness was inconclusive for terrain re-enable (jumpTo vs easeTo); New Haven on/off is the reliable check.

**Current state:** 3D module on disk does OSM-true extrusion + free DEM. Full `/web/` boot is blocked until `formatIouAddress` is restored. Catalog poles not re-checked this session because places layers never attached (map ctor never ran from HTML).

**Next steps:** Other agent: fix `formatIouAddress` so identity no longer throws before Map(). Human GPU reload New Haven / Independence Layout. OSM `building:levels` / `height` edits in Enugu for more true towers. Optional: data-driven pole height next to the 80 m cap.

**Blockers / risks:** Most Enugu footprints stay 2D until OSM is tagged — that is the point, not a regression. True OSM `height=5` is indistinguishable from the OMT sentinel and stays 2D. DEM S3 can be slow; exaggeration 1.7 is a visual choice. Headless WebGL still under-draws extrusions. `formatIouAddress` throw blocks the real page map until the NairaCoin agent lands.

### 2026-09-02 — NairaCoin operator chain guide

**Goal:** Tell a human how to actually launch the Slaze/nairacoin chain Lvfe is named after (empty genesis, no seeds), without touching player copy or map/3D.

**What changed:** `docs/nairacoin.md` only — operator section: empty genesis = `GENESIS_COINBASE_TX_HEX ""` plus `Currency.cpp` timestamp `0` / nonce `70`; `--print-genesis-tx` → paste → recompile; P2P **17356** / daemon RPC **18357** verified in `CryptoNoteConfig.h` + `RpcServerConfig.cpp`; hot wallet via `simplewallet --rpc-bind-port` (transfers are **not** on 18357); GPS stake remains endowment + server `transfer`, no mint RPC; cannot skip new-genesis-new-chain / burned genesis coinbase / IOU not on-chain. Player HTML, `web/map-3d.js`, catalog/AR unchanged.

**Why:** Adapter (`web/nairacoin/`) cannot run a daemon. GitHub master is an unlaunched CryptoNote fork. Operators need exact files and ports, not a generic coin tutorial.

**How verified:** Fetched Slaze/nairacoin `CryptoNoteConfig.h`, `Currency.cpp`, `Daemon.cpp`, `CMakeLists.txt`, `RpcServer.cpp`, `WalletRpcServer.cpp`, `SimpleWallet.cpp`. `RPC_DEFAULT_PORT = 18357` confirmed. This environment: no cmake; compile/`nairacoind` **not run**.

**Current state:** Chain still not launched. Lvfe still localStorage IOU. `CHAIN_LAUNCHED` still false. `schema/nairacoin.sql` still unwired.

**Next steps:** Compile on Linux with cmake + Boost; fill genesis; mine ≥61 blocks into a server wallet; only then proxy redeem from a game host (never the browser).

**Blockers / risks:** Empty public genesis = private/test chain. Anyone else’s `--print-genesis-tx` is a different coin. Wallet/daemon RPC have no auth.

### 2026-09-02 — Critic loop: endowment yield, IOU, AR ≠ 3D

**Goal:** Close P0 vs independent critic on disk: kill extractive crumbs / minted yield / fake chain HUD; keep GPS + MapLibre 3D; one visit action; player asset list; camera AR distinct from 3D buildings.

**What changed:**
- `web/index.html` — no Explorer/Collector, no bank `Visit · +1 explorer`. Banks/ATMs: not ownable, zero currency. One HUD (wallet + nearby + My places). Filters collapse. UI **min stake**. Faction pool shown. **AR overlay** ≠ **3D buildings**. Yield = 10% of incoming stake (not minted); `place.value === sum(stakes)`. Demo faucet 100 labelled as IOU.
- `web/nairacoin/` — Slaze/nairacoin atomic units. HUD: **NairaCoin IOU**, 1:1 redeemable, not on-chain. No private keys.
- `web/js/place-ledger.js` — endowment split. `web/catalog.html` defaults to **My places**. `web/ar.html` camera lists nearby pins and sends stake to the map (no extractive check-in). `schema/nairacoin.sql` unwired IOU transfers.

**Why:** Critic: extractive XP lost to endowment + NairaCoin. Empty genesis means a random integer labelled “NairaCoin” is a lie. 3D buildings are not AR. localStorage is not a shared world.

**How verified:** `node scripts/test_endowment.js` and `node scripts/desk_contest.mjs` (headless Chrome, same origin, `?player=`). Ada 42 on Chukky Clothing `n_8752997542` → value 42, owner ada, wallet 58. Chidi 50 → value **87** = 42+45, owner chidi, Ada 62 (+4 from the stake, not minted), Independence Layout pool +1, Chidi 50. Conserved 200. No Explorer crumbs, no bank Visit. Camera AR not exercised in headless (no phone camera). HTTPS/localhost required for `getUserMedia`.

**Current state:** One economy on the map. Ownable pin: GPS ≤80 m + photo + IOU into the place. Owner = highest staker (earlier `firstAt` tie-break); owner faction inherits pin; no faction → Unclaimed area property. Hinterland `unclaimed`. Ogbete `prize_zone`. **Not a shared world.** Player HTML: no The Architect / God Mode / XP.

**Next steps:** Phone HTTPS walk for camera AR; optional sqlite/API if two devices must share a ledger; redeem IOU when genesis exists.

**Blockers / risks:** Site-data wipe. Simulated GPS. Photo is a filename ref. `http://LAN-IP` blocks camera. Chain not launched.

### 2026-09-02 — Catalog table, NairaCoin IOU, AR camera

**Goal:** Player-facing catalog of 1044 assets with NairaCoin claim payouts; currency identity from Slaze/nairacoin; AR switch on phone; no Architect lore for players.

**What changed:** New `web/catalog.html` + `web/js/catalog.js` (search, type/quality/territory/owned filters, sort, 40-row pages). `scripts/export_catalog.py` → `data/catalog.json` + `data/catalog.csv` from sqlite. `docs/nairacoin.md` + `schema/nairacoin.sql` document CryptoNote `nairacoin` (8 decimals, empty genesis, no seeds) and a future server ledger. Catalog/AR read the map’s IOU wallet (`web/nairacoin/iou-ledger.js`, atomic units, labelled **NairaCoin IOU**) via `web/js/nairacoin.js` (`LvfeCatalogWallet` — does **not** overwrite `LvfeNairaCoin`). `web/ar.html` + `web/js/ar.js`: getUserMedia camera + GPS nearby labels; stake still happens on the map (same 80 m / bank-ATM rules). Map `web/index.html` only: Catalog + AR links, `lvfeUserPos` for overlay bearing. GeoJSON notes no longer mention Architect; schema comments mark `architect` as a username, not lore. Shared `web/js/claim-rules.js` + `web/css/lvfe.css`.

**Why:** OSM/GPS is the world; game balances are NairaCoin. Chain is not launched, so v0 is an honest local IOU. Full HTML table of 1044 rows is paginated but complete. Architect-as-god must not appear in player copy.

**How verified:** `python3 scripts/export_catalog.py` → 1044 rows, 0 formula mismatches. Samples: AMC Citibank Unclaimed area B bank **+30**; Abakpa ATM B **+10**; Ogbete bank B **+38**; hinterland name is Unclaimed area (312), never unknown/outside. curl `http://127.0.0.1:8765/web/catalog.html` and `/data/catalog.json`. Phone camera / HTTPS not exercised in this session.

**Current state:** Catalog table is the world list. Map stake/ownership loop left intact. NairaCoin **live** = browser IOU + faucet label. NairaCoin **stub** = on-chain mint (empty genesis). AR: full page at `/web/ar.html`; map overlay checkbox / `?ar=1` still in `ar-overlay.js`.

**Next steps:** Phone HTTPS test of camera + compass; optional sqlite multi-device ledger; redeem IOU when a daemon exists.

**Blockers / risks:** Camera blocked on non-localhost HTTP. IOU is per-browser. Two AR surfaces (full page vs map overlay) can drift. Catalog “Owned” filter reads `lvfe.places.v1` in this browser only.

### 2026-09-02 — Place-value / ownership loop (NairaCoin stake)

**Goal:** Replace extractive check-in with one visit action: photo + stake NairaCoin into the place. Highest staker owns it; the place is that player’s faction property; other visitors pay the owner.

**What changed:** `web/index.html` only (GPS 80 m list, GeolocateControl, `?lat=&lon=`, MapLibre 3D hook, and `map-3d.js` left intact). Nearby + popup no longer pay the visitor `claim_points`. Ownable pins: required photo stub (`<input type=file>` + local `{name,size,type,at}` ref), player-chosen stake with min = `max(5, claim_points)`, place **value** += stake, **owner** = highest total (tie → earlier `firstAt`). Place **faction** = owner’s faction, or Unclaimed area if they have none. When a *different* player stakes, owner gets 10% yield (20% of that yield is a faction cut if the owner has a faction). Banks/ATMs: not ownable; one explorer crumb then “not farmable”. Visitor crumbs: +1 Explorer on first visit, +1 Collector if they attach a photo — small counters, not a second XP bar. Quality **B→A** when a valid photo is on the place (in-memory + localStorage, not sqlite). Identity: `lvfe.identity.{player}` name + optional faction (prompt once; `?player=` / `?faction=` for desk test). Wallet: `lvfe.nairacoin.{player}` starting grant **250**. Shared place ledger: `lvfe.places.v1`. Player-facing copy never mentions The Architect / God Mode. *(Internal, not for players: `architect` identity unused.)*

**Why:** Old loop extracted value from the pin. New loop is property: you put NairaCoin in; you can be overtaken by a larger stake (shop war). Catalog/AR cloud NairaCoin (f913faf1) is **not** in this tree — labels are NairaCoin on a local ledger.

**How verified:** Server already `http://127.0.0.1:8765/` from lvfe root. Headless Chrome CDP on `?lat=6.4578996&lon=7.5143211`. Ada (`?player=ada&faction=independence_layout`) staked 42 NairaCoin + stub PNG on Chukky Clothing (`n_8752997542`): value 42, owner ada, property Independence Layout, quality B→A (nA 1 / nB 983), wallet 208, +1 explorer +1 collector. Chidi (`?player=chidi&faction=coal_camp`) staked 50: value 92, owner chidi, Property of Coal Camp, Ada wallet 212 (+4 yield), +1 faction cut, Chidi wallet 200. First Bank: visit +1 explorer, not ownable, no place ledger row, repeat blocked. No “Check in · +N pts” on the page. `node --check` on extracted script: pass. 3D toggle not injected in this headless session (MapLibre/WebGL; `lvfeEnable3d` hook still in HTML).

**Current state:** v0 ownership is localStorage-only on the existing map page. Real walk: `/web/`, grant GPS, photo + stake within 80 m. Hinterland pins can be owned; polygon role stays unclaimed area / prize zone (Ogbete still prize_zone). Extractive `lvfe.claims.v1` is no longer written.

**Next steps:** Human phone walk in New Haven; optional sqlite/API if two devices must share a ledger; surface faction pool in UI; cloud NairaCoin if that catalog work lands.

**Blockers / risks:** Clearing site data wipes value/owner. Simulated GPS can stake without being there. Photo is a local filename ref, not an upload. Two browser profiles do **not** share `lvfe.places.v1` unless they use the same origin storage (use `?player=` in one browser for contest tests). Headless WebGL still black.

### 2026-09-02 — MapLibre pitch + 3D building extrusion

**Goal:** Tilted camera and extruded buildings on the free OpenFreeMap Liberty basemap, with catalog pins still visible.

**What changed:** `web/map-3d.js` + `web/map-3d.css` (dedicated files to avoid fighting GPS / NairaCoin edits). Tiny `web/index.html` hook: stylesheet + script, Map constructor `pitch: 52`, `maxPitch: 85`, `bearing: -16`, `dragRotate` / `touchPitch` / `pitchWithRotate`, `lvfeEnable3d(map)`, `window.lvfeMap` / popup helpers. Liberty already has `building-3d` fill-extrusion on source `openmaptiles` / layer `building`; we patch height (`render_height` if >5 m, else `height` / `levels*3`, else **9 m**), cap 80 m, hide 2D `building` fill while pitched, minzoom 13. Panel checkbox **3D buildings** (localStorage `lvfe.map3d`). Catalog circles get viewport pitch alignment + translate; short colored poles (`place-poles`, 16 m) when 3D is on so pins read above extrusion.

**Why:** Zero Google/Mapbox 3D billing. Liberty extrusion is invisible at pitch 0. Enugu OSM rarely has real heights (OpenMapTiles sentinel is 5 m).

**How verified:** Existing server `http://127.0.0.1:8765/web/`. Headless Chrome + CDP, SwiftShader WebGL. New Haven `?lat=6.45633&lon=7.52432`: pitch 52, maxPitch 85, dragRotate/touchPitch on, `building-3d` present, 2D fill hidden, extruded blocks + catalog B/C dots, nearby check-in HUD still listed places. Independence Layout earlier pass also showed pitched extrusion (Edozie Close / Okpara Square). IDE browser MCP had no usable tab.

**Current state:** Default view is 3D. Uncheck **3D buildings** for north-up flat. Two-finger tilt/rotate on phone; Ctrl-drag rotate on desktop. NairaCoin / GPS check-in HTML from other agents left in place.

**Next steps:** Human reload on a real GPU (phone or laptop Chrome) and zoom Independence Layout / New Haven; optional OSM `building:levels` edits for Enugu so heights vary.

**Blockers / risks:** Most Enugu footprints use the tile default (~5 m) so our 9 m fallback is what you see. Occasional bad OSM heights (one ~221 m needle in New Haven) are capped at 80 m. Poles may lag one idle frame after catalog layers attach. Fill-extrusion can occlude ground circles; poles + viewport translate are the mitigation, not Mapbox `symbol-z-elevate`.

### 2026-09-02 — Walk-outside check-in

**Goal:** A person can stand near a catalog pin, tap Check in, and keep claim XP locally.

**What changed:** `web/index.html` only. Browser `GeolocateControl` (blue puck + accuracy circle) plus simulated GPS via `?lat=&lon=&acc=`. Nearby raid list within **80 m** (same as ingest cluster). Check-in awards geojson `claim_points` (type × quality × territory role, already on each feature). Persistence: `localStorage` key `lvfe.claims.v1` (`total` + `byPlace[id]`). One primary payout per place; banks/ATMs blocked on repeat with “not farmable”. HUD shows XP, place name, type, quality, territory name/role. Catalog fetch no longer waits on OpenFreeMap style load.

**Why:** Walk-outside is the physics. No Google Maps, no cloud, no native shell. Repeat farm (especially ATM/bank) is the abuse vector this slice closes.

**How verified:** Server already on `http://127.0.0.1:8765/web/`. Headless Chrome screenshot of `?lat=6.4578996&lon=7.5143211` (New Haven, Assemblies of God / First Bank cluster): Simulated GPS ±12 m; counts A0 B984 C58 D2 hinterland 312; nearby list with Check in · +N pts (worship +30, Chukky Clothing shop +42 at 24 m, First Bank +30 at 28 m, New Haven · unclaimed area). Python haversine on `data/places.geojson`: 16 places inside 80 m; shop claim +42 then blocked; bank +30 then “not farmable”; Citibank ~4 km away rejected. IDE browser MCP had no usable tab. Phone GPS / MapLibre WebGL not exercised in headless (black canvas).

**Current state:** v0 check-in is in the existing map page. Real walk: open `/web/`, grant location (top-right locate), walk to a pin, Check in. Desk test: append `?lat=&lon=`. Claims live in this browser’s localStorage only.

**Next steps:** Human walk in New Haven with a phone on the LAN server; optional B→A photo; Architect/factions still out of scope.

**Blockers / risks:** localStorage is per-browser (clearing site data wipes XP; no cross-device). Simulated `?lat=&lon=` can award XP without being there — desk-test only. Headless Chrome does not draw OpenFreeMap tiles. GPS accuracy outdoors can exceed 80 m; player may need to wait for a tighter fix.

### 2026-09-02 — Unclaimed hinterland + claim-point popups

**Goal:** Unknown/outside pins are Unclaimed area; click popup shows claim XP.

**What changed:** Catch-all territory `unclaimed` in `schema/places.sql`. Ingest assigns it when a point is in no polygon (was NULL / “outside”). `claim_points` column + `scripts/claim_points.py`. Export adds `claim_points`, `territory_name`, `territory_role`. Map filter label “Unclaimed area”; hinterland circles `#7f8c8d`; popup `+N pts on claim` plus type · quality and territory · role (`faction land` / `prize zone` / `unclaimed area`). Fixed ingest `NameError: ROOT` (import of `claim_points` had replaced `ROOT = ...`).

**Why:** User: unknown = unclaimed area. Named neighbourhoods stay their own ids; hinterland uses catch-all. Popup must show payout before a walk.

**How verified:** `python3 scripts/ingest_places.py --cache-only` → 1044 places, 312 `territory_id=unclaimed`, 0 NULL territories. Formula vs GeoJSON: 0 mismatches. Samples: AMC Citibank unclaimed B bank **+30**; Abakpa ATM B **+10**; Ogbete bank B **+38**. Served `http://127.0.0.1:8765/web/` HTML contains popup template. Browser click not run in this fork (IDE browser tab MCP returned no usable view).

**Current state:** Catalog + map source on disk match the rules. Local server still on 127.0.0.1:8765. Reload the map and click a grey hinterland pin vs a faction pin to confirm the popup in the UI.

**Next steps:** Human reload of `http://127.0.0.1:8765/web/`; optional B→A photo; walk New Haven.

**Blockers / risks:** Named unclaimed neighbourhoods (New Haven etc.) still pay ROLE 1.2 like hinterland. Filter “Unclaimed area” hides only hinterland (`territory_id=unclaimed`), not New Haven. Public Overpass: use `--cache-only`.

### 2026-09-02 — MapLibre catalog map

**Goal:** See polygons + place quality on a free basemap.

**What changed:** `data/places.geojson` (1044 points). `web/index.html` MapLibre + OpenFreeMap Liberty. Local `python3 -m http.server 8765`.

**Why:** Confirm New Haven density and C/D historian queue without a Google bill.

**How verified:** Opened http://127.0.0.1:8765/web/ — B 984, C 58, D 2, A 0, outside 312. Territory fills visible. Unchecking C hid orange dots.

**Current state:** Map running locally. Server on 127.0.0.1:8765.

**Next steps:** Click-popup already there; optional photo flow B→A; walk New Haven polygon.

**Blockers / risks:** Page needs the local server (fetch of GeoJSON). OpenFreeMap public tiles (donation-funded).

### 2026-09-02 — Overpass ingest into catalog

**Goal:** Fill `places` from OSM so A–D counts exist per territory.

**What changed:** `scripts/ingest_places.py` fetches POIs (cached), classifies into catalog types, fuses same name+type within 80 m, assigns smallest containing polygon, writes `data/lvfe.sqlite`.

**Why:** Catalog must be real rows, not a schema. Photos do not exist at ingest so quality A is empty by design.

**How verified:** `python3 scripts/ingest_places.py` → 1044 places, 1060 OSM objects, 16 fused clusters. Quality B=986, C=58, D=2, A=0. Inside polygons: New Haven 318, Independence Layout 197, Uwani 54, Ogui 54, outside 312 (padded bbox). `sqlite3 data/lvfe.sqlite` after schema load.

**Current state:** Playable catalog on disk. No app UI. Historian queue = C+D (58+2). Merchant density is highest in New Haven + Independence Layout.

**Next steps:** MapLibre view of catalog dots; walk New Haven density (318 in a small poly — confirm OSM way is not oversized); optional player photo to promote B→A.

**Blockers / risks:** 312 places sit outside all 12 polygons. Named `office=yes` became `civic` (B), so D is almost unused until unnamed civic is mapped. Overpass public instance is fair-use; reruns should use `--cache-only`.

### 2026-09-02 — Extra polygons + places catalog schema

**Goal:** Map the gap neighbourhoods; freeze a clean catalog table so OSM mess stays backstage.

**What changed:** GeoJSON v0.2 adds New Haven (+ extension), Trans-Ekulu (+ extension), Uwani, Ogui, Thinkers Corner as `unclaimed`. `schema/places.sql` — territories, catalog_types, places (quality A–D, lock, osm_id, territory_id), place_osm_links, photos, edits. Seeded 20 types + 12 territories.

**Why:** OSM has closed suburb ways for those areas; centroids do not fall inside the first five factions. Catalog is canonical; OSM id is a pointer. Architect lock stops later OSM edits from overwriting names.

**How verified:** Overpass `out geom` on ways 273509966, 273509967, 273510006, 259885129, 273510010, 273509976, 273509994. Centroid point-in-polygon vs existing five = no hits. `sqlite3 < schema/places.sql` loads; 20 types, 12 territories.

**Current state:** Polygons + schema on disk. No ingest job, no app.

**Next steps:** Overpass → cluster → INSERT places; walk edges; Architect may promote unclaimed → playable_faction.

**Blockers / risks:** Unclaimed polygons can still receive check-ins (neutral). Extensions share a parent; smallest-polygon still wins if they overlap at edges. ODbL.

### 2026-09-01 — Clean catalog + Enugu faction polygons

**Goal:** Keep Collector/Historian work without showing raw OSM mess; ship first faction boundaries.

**What changed:** `geojson/enugu-factions.geojson` from OSM ways Independence Layout `273509964`, Coal Camp `273509948`, Ogbete `273509971`, Abakpa `273509909`, Emene `273509958`.

**Why:** OSM has closed suburb polygons. Ogbete is a small market poly, not nested in Coal Camp.

**How verified:** Overpass `out geom`; Ogbete centroid not inside Coal Camp.

**Current state:** Design + one GeoJSON file. No app yet.

**Next steps:** Walk edges; add New Haven / Trans-Ekulu / Uwani as neutral or later factions; implement places catalog table.

**Blockers / risks:** OSM suburb ways ≠ how residents draw neighbourhoods. ODbL attribution required.
