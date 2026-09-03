# OPay Buy NCN

Players can buy **NairaCoin** via **OPay Cashier** (alongside Paystack). **1 NCN = USD $1.**

Paid NGN (or other) converts at **current `NGN_PER_USD`** (or USD cents): credited NCN = USD equivalent of the payment. Settlement destination for ops: **7035474827 · Okogeri Ugochukwu O**.

## Flow

1. Wallet → Buy NCN (OPay path when keys configured).
2. Client `POST /v1/opay/init` → server creates Cashier order (staging or live).
3. Player completes OPay checkout (`cashierUrl`).
4. Client `POST /v1/opay/verify` **or** OPay `callbackUrl` webhook → credit IOU + activity + receipt in save pack.
5. Receipt email: PHP `mail()` to payer Gmail + BCC merchant (`OPAY_MERCHANT_EMAIL`). If mail fails, receipt stays in `pack.receipts[ref]`.

## Keys (never commit)

Host-only `hosting/lvfe-save/config.local.php`:

```php
'OPAY_MERCHANT_ID' => '',
'OPAY_PUBLIC_KEY' => '',
'OPAY_SECRET_KEY' => '',
'OPAY_SANDBOX' => '1',
'OPAY_CURRENCY' => 'NGN',
'NGN_PER_USD' => '1500',
'OPAY_PAYOUT_ACCOUNT' => '7035474827',
'OPAY_PAYOUT_NAME' => 'Okogeri Ugochukwu O',
'OPAY_MERCHANT_EMAIL' => 'ugidentity@gmail.com',
```

Endpoints (OPay international cashier):

- Staging: `https://testapi.opaycheckout.com/api/v1/international/cashier/create`
- Live: `https://liveapi.opaycheckout.com/api/v1/international/cashier/create`
- Webhook: `https://iconiaglobal.com/lvfe-save/v1/opay/webhook`

Auth: create uses Bearer **public key** + `MerchantId`; status/verify uses HMAC-SHA512 of JSON payload with **secret key**.

## Soft fail

If keys are empty, `/v1/opay/init` returns `503` + `opay_not_configured` and the Wallet UI shows a player-facing “Buy NCN isn’t available yet” (debug shows setup steps).

## Gmail API

Not wired. Prefer PHP `mail()` / host SMTP. Blocker: no Gmail API credentials in config — receipts still stored in the save pack.

## Related

- `docs/BUY_NCN.md` — Paystack path (still supported)
- `hosting/lvfe-save/opay.php`
