# Buy NCN (Paystack)

Players buy **NairaCoin** into their IOU wallet. **1 NCN = USD $1.**

Provider default: **Paystack** (Nigeria-friendly Checkout/Popup, fast). Flutterwave can share the same `/v1/buy/verify` credit path later. Stripe Checkout is optional only if you prefer pure USD and already have Stripe — not wired by default.

## Flow

1. Wallet hub → **Buy NCN** → client `POST /v1/buy/init` (auth same as save).
2. Paystack Inline Popup opens with `reference` + amount (NGN kobo or USD cents).
3. On success → client `POST /v1/buy/verify` → server calls Paystack verify API.
4. Server credits `pack.wallets["lvfe.nc.iou.v1.<playerKey>"].atomic` (+ `purchases[ref]` for idempotency).
5. Client credits local IOU + activity log + save push.
6. Optional webhook `POST /v1/buy/webhook` (`charge.success`) credits if the client never verifies.

## Keys (never commit secrets)

### Client (public only)

Edit `web/js/buy-ncn.config.js`:

```js
const PAYSTACK_PUBLIC_KEY = "pk_test_…";  // or pk_live_… after sandbox works
```

### Host PHP (`https://iconiaglobal.com/lvfe-save`)

Edit **host-only** `hosting/lvfe-save/config.local.php` (gitignored), from `config.example.php`:

```php
'PAYSTACK_PUBLIC_KEY' => 'pk_test_…',
'PAYSTACK_SECRET_KEY' => 'sk_test_…',
'PAYSTACK_WEBHOOK_SECRET' => '', // optional; else HMAC uses secret key
'PAYSTACK_CURRENCY' => 'NGN',
'NGN_PER_USD' => '1500', // kobo = NCN * NGN_PER_USD * 100
```

Webhook URL in Paystack Dashboard:

`https://iconiaglobal.com/lvfe-save/v1/buy/webhook`

### Local Node (`server/`)

Copy `server/.env.example` → `server/.env` and set the same `PAYSTACK_*` vars.

## Sandbox vs live

| Mode | Keys | UI |
|------|------|-----|
| Sandbox | `pk_test_` + `sk_test_` | Checkout works with Paystack test cards |
| Not configured | empty / missing | Clear blocker + setup steps (no silent fail) |
| Live | `pk_live_` + `sk_live_` | Only after sandbox verify+credit works |

Mismatched live/test pairs → `live_keys_missing` blocker.

## Currency

- Game price is always **1 NCN = $1 USD**.
- Paystack settlement often uses **NGN**: amount in kobo = `NCN × NGN_PER_USD × 100`.
- Or set `PAYSTACK_CURRENCY=USD` (cents = `NCN × 100`) if your Paystack account supports USD.

## Dev mock (no keys)

`?mockBuy=1` or `localStorage.lvfe.mockBuy=1` + `LvfeBuyNcn.mockBuy({ playerKey, ncnAmount })` credits locally only. Do not use in production builds as a payment substitute.

## Health

`GET /health` includes:

```json
"buyNcn": { "provider": "paystack", "configured": false, "sandbox": false, "ncnPerUsd": 1 }
```
