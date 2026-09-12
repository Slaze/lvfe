# Lvfe Admin CMS

URL (production): **https://iconiaglobal.com/lvfe-save/admin/**

Session login (host-only credentials in `config.local.php`):

- Email: set as `ADMIN_EMAIL`
- Password: stored only as `ADMIN_PASSWORD_HASH` (bcrypt). Change from **Host & Auth** tab.

## Tabs

| Tab | Writes |
| --- | --- |
| Overview | read-only health |
| Host & Auth | `config.local.php` (Google client, dev auth, SAVE_SECRET, admin password) |
| Payments | Paystack / Flutterwave / OPay / FX / receipt email |
| Economy | `data/game-config.json` (radii, yield, tolls, buy clamps, …) |
| Client & Map | public client defaults + blocker copy |
| Features | feature flags |
| Players | list saves + ops NCN credit |

## Public client endpoint

`GET /v1/game-config` — no secrets. PWA loads via `web/js/remote-config.js` on boot and applies to live modules.

## Deploy

1. Upload `hosting/lvfe-save/` (including `admin/`, `admin_lib.php`, updated `index.php` / `.htaccess`) to Iconia `public_html/lvfe-save/`.
2. Ensure host `config.local.php` has `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` (never commit).
3. Redeploy PWA (`scripts/deploy_pwa.sh`) so clients get `remote-config.js` + SW v9.

## Security

- Secrets masked in UI; blank field = leave unchanged; `__CLEAR__` wipes a secret.
- `config.local.php`, `admin_lib.php`, and `data/` are denied by `.htaccess`.
- Admin session cookie: HttpOnly, path `/lvfe-save/`, CSRF header `X-Lvfe-Admin-Csrf`.
