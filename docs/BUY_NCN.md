# Buy NCN (Paystack + Flutterwave)

Players buy **NairaCoin** into their IOU wallet. **1 NCN = USD $1.**

**Paystack** is primary (Nigeria-friendly Checkout/Popup). **Flutterwave** is an optional alternate on the same `/v1/buy/init|verify` credit path. OPay Cashier remains on the host but is deprioritized (not shown in Buy UI). Settlement stays on each merchant dashboard — no separate payout rail required.

## Flow

1. Wallet hub → pick provider (if both keys set) → **Buy NCN** → client `POST /v1/buy/init` (auth same as save).
2. Paystack Inline Popup **or** Flutterwave Checkout opens with `reference` / `tx_ref` + amount.
3. On success → client `POST /v1/buy/verify` → server calls provider verify API.
4. Server credits `pack.wallets["lvfe.nc.iou.v1.<playerKey>"].atomic` (+ `purchases[ref]` / `receipts[ref]` for idempotency).
5. Client credits local IOU + activity log + save push (purchases/receipts sync in the save pack).
6. Optional webhooks credit if the client never verifies:
   - Paystack `POST /v1/buy/webhook` (`charge.success`)
   - Flutterwave `POST /v1/buy/flw-webhook` (`verif-hash` header)

## Keys (never commit secrets)

### Client (public only)

Edit `web/js/buy-ncn.config.js`:

```js
const PAYSTACK_PUBLIC_KEY = "pk_test_…";  // or pk_live_… after sandbox works
const FLW_PUBLIC_KEY = "FLWPUBK_TEST_…";  // optional alternate
```

### Host PHP (`https://iconiaglobal.com/lvfe-save`)

Edit **host-only** `hosting/lvfe-save/config.local.php` (gitignored), from `config.example.php`:

```php
'PAYSTACK_PUBLIC_KEY' => 'pk_test_…',
'PAYSTACK_SECRET_KEY' => 'sk_test_…',
'PAYSTACK_WEBHOOK_SECRET' => '', // optional; else HMAC uses secret key
'PAYSTACK_CURRENCY' => 'NGN',
'NGN_PER_USD' => '1500', // Paystack kobo = NCN * NGN_PER_USD * 100
'FLW_PUBLIC_KEY' => 'FLWPUBK_TEST_…',
'FLW_SECRET_KEY' => 'FLWSECK_TEST_…',
'FLW_SECRET_HASH' => '…', // Dashboard → Settings → Webhooks
'FLW_CURRENCY' => 'NGN',  // Flutterwave amount = NCN * NGN_PER_USD (major units)
'BUY_MERCHANT_EMAIL' => 'you@example.com', // optional BCC on PHP mail receipts
```

Webhook URLs:

- Paystack: `https://iconiaglobal.com/lvfe-save/v1/buy/webhook`
- Flutterwave: `https://iconiaglobal.com/lvfe-save/v1/buy/flw-webhook`

### Local Node (`server/`)

Copy `server/.env.example` → `server/.env` and set the same `PAYSTACK_*` / `FLW_*` vars.

## Sandbox vs live

| Mode | Keys | UI |
|------|------|-----|
| Sandbox | `pk_test_` + `sk_test_` and/or `FLWPUBK_TEST_` + `FLWSECK_TEST_` | Checkout works with provider test cards |
| Not configured | empty / missing | Clear blocker + setup steps (no silent fail) |
| Live | `pk_live_` / `sk_live_` or live FLW pair | Only after sandbox verify+credit works |

Mismatched live/test pairs → `live_keys_missing` / `flutterwave_live_keys_missing` blocker.

## Currency

- Game price is always **1 NCN = $1 USD**.
- **Paystack NGN:** amount in **kobo** = `NCN × NGN_PER_USD × 100`.
- **Flutterwave NGN:** amount in **naira** (major) = `NCN × NGN_PER_USD`.
- Or set currency `USD` if the merchant account supports it (Paystack cents / Flutterwave dollars).

## Dev mock (no keys)

`?mockBuy=1` or `localStorage.lvfe.mockBuy=1` + `LvfeBuyNcn.mockBuy({ playerKey, ncnAmount })` credits locally only. Do not use in production builds as a payment substitute.

## Health

`GET /health` includes:

```json
"buyNcn": {
  "provider": "paystack",
  "configured": false,
  "sandbox": false,
  "ncnPerUsd": 1,
  "paystack": { "configured": false, "sandbox": false },
  "flutterwave": { "configured": false, "sandbox": false }
}
```
