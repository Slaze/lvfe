# Google Cloud OAuth consent screen — Lvfe: The Xperience

Copy-paste cheat sheet for **APIs & Services → OAuth consent screen**. Human fills the Console; do not invent live URLs.

Verified **2026-09-03** against `iconiaglobal.com` (curl + page fetch). Terms row updated **2026-09-03** after CMS publish.

## Findings (do not skip)

| URL | HTTP | Content |
|-----|------|---------|
| `https://iconiaglobal.com/privacy-policy` | 200 | **Real** universal Iconia privacy policy (canonical URL stated on page) |
| `https://iconiaglobal.com/pages/privacy-policy` | 200 | Same policy (footer link) |
| `https://iconiaglobal.com/pages/terms-and-conditions` | 200 | **Live ToS** (effective 3 September 2026) — Iconia services + **Lvfe: The Xperience** (Google sign-in, `lvfe-save`, NCN, GPS/camera). Source: `docs/ICONIA_TERMS.md` |
| `/privacy`, `/terms`, `/terms-of-service`, `/tos`, `/lvfe/privacy`, `/lvfe/terms` | 404 | — |
| `https://iconiaglobal.com/lvfe/` | 200 | **Installable PWA** (map + Google GIS + cloud save) |
| `https://iconiaglobal.com/lvfe-save` | 200 | Save **API**, not a product homepage |
| `https://github.com/Slaze/lvfe` | 404 public | Repo is **private** — unsuitable as OAuth homepage |

No `privacy.html` under local `hosting/lvfe` / `web/` (privacy stays on Iconia CMS).

## Recommended homepage

**Prefer now:** `https://iconiaglobal.com/lvfe/`

- Public HTTPS PWA for **Lvfe: The Xperience**.
- Same host as privacy / terms / save API.
- Fallback if Console rejects a path URL: `https://iconiaglobal.com/` (publisher site).

Do **not** use GitHub (private) or `lvfe-save` (API).

## Consent screen table

| Field | Value to paste | Notes |
|-------|----------------|-------|
| **Application name** | `Lvfe: The Xperience` | Short display name `Lvfe` is also fine if Console truncates; match store/APK branding. |
| **User support email** | *(your Google account email on this Cloud project)* | Pick from the Console dropdown. |
| **Application home page** | `https://iconiaglobal.com/lvfe/` | Or `https://iconiaglobal.com/` if a path homepage is rejected. |
| **Application privacy policy link** | `https://iconiaglobal.com/privacy-policy` | Prefer this canonical URL. Footer alias: `https://iconiaglobal.com/pages/privacy-policy`. |
| **Application terms of service link** | `https://iconiaglobal.com/pages/terms-and-conditions` | Live CMS page (not “Coming soon…”). Paste this exact URL. |
| **Authorised domains** | `iconiaglobal.com` | Domain only: **no** `https://`, **no** path. Must match hosts used in homepage / privacy / terms. |
| **Developer contact information** | *(your email)* | Often same as support; used by Google for policy notices. |
| **Scopes** | `openid`, `email`, `profile` only | Identity OAuth for Sign in with Google / Credential Manager. No Maps, Drive, etc. |
| **Android / Web clients reminder** | Consent screen ≠ OAuth clients | Still create: **Web** client (ID already used in app) + **Android** client for `com.lvfe.xperience` + debug/release SHA-1. Package: `com.lvfe.xperience`. |

## Web client — Authorized JavaScript origins (human must add)

Credentials → OAuth 2.0 Client IDs → Web client `730640559588-…`:

| Origin | Required |
|--------|----------|
| `https://iconiaglobal.com` | **Yes** — PWA at `/lvfe/` uses this origin |
| `https://www.iconiaglobal.com` | If www is used |
| `http://localhost` | Local GIS only |
| `http://127.0.0.1` | Local GIS only |

Path `/lvfe/` is **not** part of the origin. See `docs/PWA.md`.

## Publish app to Production (consent screen)

1. Google Cloud Console → select the project that owns client `730640559588-…`.
2. **APIs & Services** → **OAuth consent screen**.
3. Fill App information (name, support email, homepage, privacy, terms when live).
4. **Authorised domains** → add `iconiaglobal.com` → Save.
5. **Scopes** → Add or confirm `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` (UI labels vary; same three).
6. **Test users** (while in Testing): add your Gmail if you sign in during Testing.
7. Click **Publish app** / **Push to production** (wording varies) → confirm.
8. Separately: **Credentials** → ensure **Web** + **Android** OAuth client IDs exist; Android must list correct package + SHA-1; Web client JS origins include `https://iconiaglobal.com`.

## Terms (filled 2026-09-03)

1. Canonical ToS: `https://iconiaglobal.com/pages/terms-and-conditions` (Yii `page` row `terms-and-conditions`; HTML in `hosting/iconia/terms-content.html`).
2. Curl 200; body includes Lvfe / NCN / `lvfe-save`; “Coming soon…” gone.
3. Paste that URL into the consent screen **Application terms of service link** if not already.

## Related

- PWA: `https://iconiaglobal.com/lvfe/` — `docs/PWA.md`
- Save API: `https://iconiaglobal.com/lvfe-save`
- Cookie policy (site footer, not required for this OAuth row): `https://iconiaglobal.com/pages/cookie-policy`
- App package: `com.lvfe.xperience`
