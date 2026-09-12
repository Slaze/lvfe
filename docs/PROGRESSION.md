# Lvfe mechanical rewrite — implementation roadmap

Priority order as shipped. Client modules work offline. Save-host SQLite is the 24h check-in authority.

## A — Toll off (immediate)

- `LvfePassToll` default `enabled: false`. `scanPass` / `applyToll` no-op. `formulaCopy()` is null.
- Game config `features.passToll: false`. Remote config only turns toll **on** if that flag is true.
- Simulate-toll CTA hidden unless enabled.

## B — No visit NCN cut; XP split

- `LvfePlaceLedger` `yieldRate: 0`. 100% of a stake stays on the pin.
- Check-in XP: visitor 100% of `baseXp` (10), owner 20% referral if a different owner exists.
- Module: `web/js/progression.js`.

## C — 1 check-in / location / player / 24h

- Client: rolling 24h in `LvfeProgression.canCheckIn` / `recordCheckIn`.
- Server: `POST /v1/check-in` in `hosting/lvfe-save/progression.php` (SQLite). HTTP 429 `cooldown_24h`.
- Claim/Bid still spends NCN; XP only if the 24h gate passes.

## D — Composite rank + 30-day window

```
score = (places claimed × 10) + (total XP × 1) + (check-ins last 30 days × 5)
tie   = most recent check-in timestamp
```

Profile and Rankings hub show the three metrics separately, not only the score.

**Early-player bias:** places claimed is cumulative. The 30-day term decays if you stop walking. It does **not** fully equalize a 100-pin idle veteran vs a new walker. That is the formula as specified.

## E — Stars + reviews

- `web/js/ratings.js` — 1–5 after a check-in exists.
- Average on the place file. 4.5+ boosts search (`searchBoost`).
- Server: `POST /v1/ratings`.

## F — Location visit tiers

| Tier | Threshold | Unlocks |
|------|-----------|---------|
| T1 | 0–3 visits | Base XP |
| T2 | 4–10 visits | Insight (player tip) |
| T3 | 11–50 visits | Trending in search |
| T4 | 50+ **unique** visitors | Landmark, sponsorship-eligible |

New players hit T2 in four distinct visits. Landmark needs a crowd, not self-farming.

## G — Neighbourhood completion

- Conquest display bonus default 0 (no zero-sum cost inflate).
- 20 unique check-in pins in a named neighbourhood → cosmetic badge + 5 NCN once.

## H — Rank unlocks (non-cosmetic)

Uses existing sigil thresholds on **composite score**:

- Scout (50): bookmark
- Pathfinder (200): photo tips
- Warden (500): host photo challenges
- Marshal+ (1000): apply for partner location

## I — Sponsorship (optional)

- Eligible at landmark (50 unique).
- Monthly featured pin; search boost.
- Split of listed amount: platform 30%, curator (top stakeholder) 10%.

## Schema

`schema/progression.sql` → `hosting/lvfe-save/data/lvfe-game.sqlite`.

## Tests

```
node scripts/test_progression.js
node scripts/test_endowment.js
node scripts/test_conquest.js
node scripts/test_pass_toll_marks.js
node scripts/test_game_economy.js
```

Toll exploration-distance is a field metric (not unit-testable here). 24h spam and rank formula are covered in `test_progression.js`.
