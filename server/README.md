# Lvfe save server (local)

Zero-dependency Node HTTP server for player progress sync.

## Run

```bash
cd server
cp .env.example .env   # optional
node index.js          # http://0.0.0.0:18787
npm test               # round-trip + LWW conflict
```

## Env vars

| Var | Default | Meaning |
|-----|---------|---------|
| `PORT` | `18787` | Listen port |
| `SAVE_SECRET` | empty | Shared Bearer for production |
| `LVFE_ALLOW_DEV_AUTH` | `1` | Allow `Bearer lvfe-dev:<playerKey>` |
| `GOOGLE_WEB_CLIENT_ID` | empty | Identity OAuth Web client; Gmail path fails loud until set |
| `SAVE_DIR` | `./data/saves` | JSON files on disk |
| `MAX_BODY_BYTES` | `2621440` | ~2.5 MiB body cap |

## Conflict policy

**Last-write-wins** by `pack.updatedAt` (ISO-8601). Stale PUT → `409` with server pack.

## Photos

Up to 8 photos. Data-URLs over ~400 KB become meta-only on the server. Keep Export/Import for full local backup.

## Client

Default public base: **`https://iconiaglobal.com/lvfe-save`** (PHP on Iconia; see `hosting/lvfe-save/`).

Overrides: `SAVE_API_BASE` in `web/js/save-api.config.js`, or `?saveApi=http://LAN:18787`, or `localStorage.lvfe.saveApiBase`.

Optional Netlify: `netlify.toml` + `netlify/functions/save.js` (requires `npx netlify login`; set `SAVE_SECRET`, `LVFE_ALLOW_DEV_AUTH=0`, `GOOGLE_WEB_CLIENT_ID` in the site UI). GitHub Pages cannot host the save API.
