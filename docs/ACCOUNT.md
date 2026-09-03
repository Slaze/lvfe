# Lvfe account identity — username + Google + factions

## Username (permanent)

1. Player picks a **unique in-game username** (not email).
2. Once set, it is **`nameLocked`** on the device and **cannot be changed**.
3. When signed in with Google and synced to `lvfe-save`, the server stores **`username ↔ googleSub`** in `username-map.json`:
   - Reject **rename** for the same Google `sub` (`409 username_locked`).
   - Reject **reuse** of that username by another Google account (`409 username_taken`).
   - Reject a **second username** for a sub that already has one.
4. **Guest / local** (no Google): name stays unique on that device only. Cloud permanence requires Google + save API.
5. **Migration:** any existing save with a `playerName` is treated as locked.

Client UI: name field is read-only after set; account sheet shows a lock; dossier “edit” opens neighbourhood only.

## Factions (location-based)

| GPS region | Faction picker |
|------------|----------------|
| **Enugu catalog bbox** | Canonical four: Independence Layout, Coal Camp, Abakpa, Emene (+ 1044 place catalog) |
| **Elsewhere** | Overpass suburb/neighbourhood/quarter/residential names near GPS → **3–6** local factions; closest high-rank is `prize_zone` analog; fail soft → generic North/South/East/West quarters + hinterland Unclaimed |

**Travel:** chosen `factionId` is **not** wiped when the player leaves the city. UI keeps the chapter; re-pick only if unset. New walkers see the **current map/GPS** faction list.

Rate-limit Overpass (~45s), cell cache 30 min — same spirit as `world-catalog.js` / `field-claim.js`.

## Related

- Save API: `https://iconiaglobal.com/lvfe-save`
- OAuth consent: `docs/OAUTH_CONSENT.md`
- PWA: `docs/PWA.md`
