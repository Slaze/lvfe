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
- `web/index.html` — MapLibre + OpenFreeMap; catalog/territory layers attach on **style.load** (not `map.loaded()`). Liberty POI/amenity labels hidden; road names kept. Fail banner if style never arrives. 80 m GPS; photo + NairaCoin into the place. **localStorage, not a shared world.**
- `web/catalog.html` — default **My places** (owned / stakes from `lvfe.places.v1`); optional all typed pins with **min stake** (not a visit payout).
- `web/ar-overlay.js` — camera overlay on the map (distinct from 3D buildings). `web/ar.html` is the same nearby-pin camera, stake still on the map.
- `web/map-3d.js` / `web/map-3d.css` — pitch/tilt, OSM-true Liberty extrusion (no 9 m city), AWS/Mapzen Terrarium DEM + hillshade, **3D buildings** toggle (not AR). No Three.js.
- `data/places.geojson` — typed pins. Place value/owner live in `lvfe.places.v1`.

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

## Sessions

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
