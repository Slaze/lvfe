# Google Cloud OAuth consent screen — Lvfe: The Xperience

Copy-paste cheat sheet for **APIs & Services → OAuth consent screen**. Human fills the Console; do not invent live URLs.

Verified **2026-09-03** against `iconiaglobal.com` (curl + page fetch).

## Findings (do not skip)

| URL | HTTP | Content |
|-----|------|---------|
| `https://iconiaglobal.com/privacy-policy` | 200 | **Real** universal Iconia privacy policy (canonical URL stated on page) |
| `https://iconiaglobal.com/pages/privacy-policy` | 200 | Same policy (footer link) |
| `https://iconiaglobal.com/pages/terms-and-conditions` | 200 | **Placeholder only** (“Coming soon…”) — **not** usable ToS text yet |
| `/privacy`, `/terms`, `/terms-of-service`, `/tos`, `/lvfe`, `/lvfe/privacy`, `/lvfe/terms` | 404 | — |
| `https://iconiaglobal.com/lvfe-save` | 200 | Save **API**, not a product homepage |
| `https://github.com/Slaze/lvfe` | 404 public | Repo is **private** — unsuitable as OAuth homepage |

No `privacy.html` under local `hosting/lvfe` / `web/`.

## Recommended homepage

**Paste for now:** `https://iconiaglobal.com/`

- Public, stable, same host as privacy.
- Describes Iconia (publisher), not Lvfe specifically.
- **Better later:** add a short public page (e.g. `https://iconiaglobal.com/lvfe` or a portfolio card on `/pages/work`) that names **Lvfe: The Xperience** and what the app does, then switch the consent homepage to that URL.
- Do **not** use GitHub (private) or `lvfe-save` (API).

## Consent screen table

| Field | Value to paste | Notes |
|-------|----------------|-------|
| **Application name** | `Lvfe: The Xperience` | Short display name `Lvfe` is also fine if Console truncates; match store/APK branding. |
| **User support email** | *(your Google account email on this Cloud project)* | Pick from the Console dropdown. |
| **Application home page** | `https://iconiaglobal.com/` | Prefer a dedicated Lvfe page when you publish one. |
| **Application privacy policy link** | `https://iconiaglobal.com/privacy-policy` | Prefer this canonical URL. Footer alias: `https://iconiaglobal.com/pages/privacy-policy`. |
| **Application terms of service link** | **Create/fill first** — then paste `https://iconiaglobal.com/pages/terms-and-conditions` | Page exists but body is only “Coming soon…”. Google expects real terms. Fill that CMS page **or** add e.g. `/terms` / `/lvfe/terms` with real text, then use **that** live URL. Do not paste a 404. |
| **Authorised domains** | `iconiaglobal.com` | Domain only: **no** `https://`, **no** path. Must match hosts used in homepage / privacy / terms. Add `github.com` only if homepage is a **public** GitHub Pages/repo URL (not the case today). |
| **Developer contact information** | *(your email)* | Often same as support; used by Google for policy notices. |
| **Scopes** | `openid`, `email`, `profile` only | Identity OAuth for Sign in with Google / Credential Manager. No Maps, Drive, etc. |
| **What to click for Production** | See steps below | |
| **Whether Google verification is needed** | **Usually not** for these scopes alone | Sensitive/restricted scopes (or branding review thresholds) can trigger verification. Stick to openid/email/profile and you typically stay out of full verification. |
| **Android / Web clients reminder** | Consent screen ≠ OAuth clients | Still create: **Web** client (ID already used in app) + **Android** client for `com.lvfe.xperience` + debug/release SHA-1. Package: `com.lvfe.xperience`. |

## Publish app to Production (consent screen)

1. Google Cloud Console → select the project that owns client `730640559588-…`.
2. **APIs & Services** → **OAuth consent screen**.
3. Fill App information (name, support email, homepage, privacy, terms when live).
4. **Authorised domains** → add `iconiaglobal.com` → Save.
5. **Scopes** → Add or confirm `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` (UI labels vary; same three).
6. **Test users** (while in Testing): add your Gmail if you sign in during Testing.
7. Click **Publish app** / **Push to production** (wording varies) → confirm.
8. Separately: **Credentials** → ensure **Web** + **Android** OAuth client IDs exist; Android must list correct package + SHA-1.

## Terms blocker (do this before relying on Production)

1. Edit Iconia CMS page **Terms and conditions** (`/pages/terms-and-conditions`) and replace “Coming soon…” with real ToS, **or** publish a new page (suggested paths: `/terms`, `/lvfe/terms`).
2. Confirm the URL returns 200 with readable terms (not empty).
3. Paste that exact URL into the consent screen **Application terms of service link**.

## Related

- Save API: `https://iconiaglobal.com/lvfe-save`
- Cookie policy (site footer, not required for this OAuth row): `https://iconiaglobal.com/pages/cookie-policy`
- App package: `com.lvfe.xperience`
