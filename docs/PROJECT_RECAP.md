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
- `web/index.html` — MapLibre + OpenFreeMap **GMaps-style chrome**: full-bleed map, top search pill, CSS bottom sheet (**hidden until pin tap**). **SAT / MAP FAB** (top of the right stack) toggles free **Esri World Imagery** raster (`web/js/satellite.js`, `{z}/{y}/{x}`) over Liberty streets. No `setStyle`. Pins, gold walk, 80 m ring, you-dot re-attach via `reattachOverlays` / idempotent `ensureLayers`. Hybrid OSM road names optional (profile ⋯). Fail banner **Satellite couldn’t load** → stay on streets. Pin tap opens a **paper file / dossier** (`.sheet.doc`, ~70vh) with **Place / Mission / Land / Money / Wallet** tabs (tap or horizontal swipe). Wallet **Pay** is `disabled` unless GPS and `dist <= 80`. Track chip + gold OSRM walk line + 80 m pay ring. × + swipe-down close. **Open file or tracking:** map `movestart`/`dragstart` do **not** `closeSheet`. Idle map still auto-hides. No left `.panel`, no always-on `#hud`, no MapLibre Popup, no OSM/Esri wordmark on the map (About only). ⋯ is a **profile menu** (How to play, My assets, catalog, name switcher). Default pitch **0**. 80 m GPS; photo + NairaCoin. **localStorage, not a shared world.**
- `web/js/satellite.js` — Esri World Imagery overlay; SAT FAB; never billed Google tiles; never `setStyle`.
- `web/rules.html` — player How to play (walk, photo, NairaCoin, 80 m, highest backer owns, faction, Pay gate, beep/track, AR, catalog, banks).
- `web/assets.html` + `web/js/assets.js` — owned/backed places, visit interest (10%), gap vs next backer; dossier-style section toggles.
- `web/js/dossier.js` — one place-file HTML builder for map + catalog.
- `web/js/track-guide.js` — marked pin, AudioContext + `navigator.vibrate` pulse, OSRM walking (geodesic + 5 km/h fail-open). Gold `guide-line` / `guide-casing` + 80 m `pay-ring`. `line-join`/`line-cap` live in **layout**. `ensureLayers` adds missing layers even if the GeoJSON source already exists.
- `web/js/claim-rules.js` — `placeTitle` (`"-"` / `undefined` / `Unnamed civic_unknown` → type words).
- `android/…/MainActivity.kt` — FrameLayout: CameraX `PreviewView` (PERFORMANCE / SurfaceView) behind the WebView. On `onCreate` / first load, request **FINE + COARSE + CAMERA** if missing (skip OS dialog when granted). AR: software WebView layer + transparent CSS so the preview punches through. JS does not add a second grant wall; location grant auto-starts MapLibre geo.
- `web/catalog.html` — same dossier as pin tap; section toggles (Place / Mission / Land / Money / Wallet); compact list (not table-only). Default **My places**.
- `web/ar-overlay.js` — map-page AR (not `ar.html`). **Nord/Android:** CameraX `PreviewView` under a transparent WebView (`LvfeNative.startArCamera`); no getUserMedia (rear WebView stream is #000). `#arThree` hidden. HTML pins (FOV + compass). Marked-pin HUD (`#arTrackHud`) live metres + heading every tick, even outside 80 m. Empty-range / GPS-off copy, × → map. **Desktop:** visible `<video id="arCam">` (opacity 1); canvas2d `drawImage` optional via `lvfeArUseCanvas`. Pin labels do **not** touch `LvfeCatalogWallet` (`W`). `web/ar.html` leftover.
- `web/map-3d.js` / `web/map-3d.css` — pitch/tilt, OSM-true Liberty extrusion (no 9 m city), AWS/Mapzen Terrarium DEM + hillshade, **3D buildings** toggle (not AR). Boots on **style-ready** (not only `load`). 3D FAB pressed iff toggle on **or** `getPitch() > 1` (unpressed at boot pitch 0). Not stale `lvfe.map3d.v2`. No Three.js.
- `data/places.geojson` — typed pins. Place value/owner live in `lvfe.places.v1`.
- `web/js/lvfe-assets.js` — URL helper so `/data` and `/geojson` work from the python server **and** the APK (`https://appassets.androidplatform.net/assets/www/`).
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

## Sessions

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
