# Lvfe public save API (PHP on iconiaglobal.com)

Same contract as `server/` (Node) and `netlify/functions/save.js`.

## Live URL

- **Public base (wired in client):** `https://iconiaglobal.com/lvfe-save`
- Health: `GET /health`
- Pull: `GET /v1/save/:playerKey`
- Push: `PUT /v1/save/:playerKey` with JSON `{ "pack": { "kind": "lvfe.save.v1", "updatedAt": "…", … } }`

## Auth

| Bearer | When |
| --- | --- |
| `lvfe-dev:<playerKey>` | `LVFE_ALLOW_DEV_AUTH=1` (default until Google Web client ID is live) |
| `<SAVE_SECRET>` | Always if set in `config.local.php` |
| `google:<id_token>` | When `GOOGLE_WEB_CLIENT_ID` is set (aud must match) |

## Deploy (operators)

1. Copy `config.example.php` → `config.local.php`, set `SAVE_SECRET` (openssl rand -hex 24).
2. Upload this folder to `public_html/lvfe-save/` on Iconia cPanel (`iconicxy`).
3. Ensure apex `public_html/.htaccess` includes `lvfe-save` in the standalone pass-through rule (with `ipm-app|demos`).
4. Curl health + PUT/GET round-trip.

## Rotate `SAVE_SECRET`

1. Generate a new hex secret.
2. Edit host `config.local.php` only (never commit).
3. Re-upload. Clients using `lvfe-dev:` are unaffected; any client sending Bearer SAVE_SECRET must be updated.

## Preferred subdomain (human DNS)

After this path URL works, in **Cloudflare** → zone `iconiaglobal.com`:

1. Add **A** or **CNAME** `lvfe-save` → origin `198.54.120.94` (or CNAME `iconiaglobal.com`), **proxied** (orange) is fine for HTTPS JSON.
2. In **cPanel** → Subdomains: create `lvfe-save.iconiaglobal.com` with document root `public_html/lvfe-save` (same files).
3. Point client `SAVE_API_BASE` at `https://lvfe-save.iconiaglobal.com` when DNS resolves.

## Netlify alternative

`netlify.toml` + `netlify/functions/save.js` remain optional. Requires `npx netlify login` then `npx netlify deploy --prod`. Set env `SAVE_SECRET`, `LVFE_ALLOW_DEV_AUTH=0`, `GOOGLE_WEB_CLIENT_ID`. GitHub Pages cannot run this API.
