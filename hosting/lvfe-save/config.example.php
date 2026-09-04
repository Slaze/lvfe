<?php
/**
 * Copy to config.local.php on the host (never commit real secrets).
 * Rotate SAVE_SECRET: replace value → re-upload config.local.php →
 * clients using Bearer SAVE_SECRET must be updated (dev auth uses playerKey).
 */
return [
    // Shared Bearer for ops / future client secret auth
    'SAVE_SECRET' => '',
    // "1" until Google Web client ID is live; set "0" in production after OAuth
    'LVFE_ALLOW_DEV_AUTH' => '1',
    // Identity OAuth Web client ID only — not Maps / Places / Photorealistic 3D
    'GOOGLE_WEB_CLIENT_ID' => '',
    // Buy NCN — Paystack primary. 1 NCN = USD $1. Never commit real keys.
    // Dashboard: Settings → API Keys & Webhooks
    // Sandbox: pk_test_… / sk_test_…  Live: pk_live_… / sk_live_… only after sandbox works.
    'PAYSTACK_PUBLIC_KEY' => '',
    'PAYSTACK_SECRET_KEY' => '',
    // Optional; if empty, webhook HMAC uses PAYSTACK_SECRET_KEY
    'PAYSTACK_WEBHOOK_SECRET' => '',
    // Settlement currency for Checkout (NGN kobo or USD cents)
    'PAYSTACK_CURRENCY' => 'NGN',
    // When currency=NGN: Paystack kobo = NCN * NGN_PER_USD * 100; Flutterwave major = NCN * NGN_PER_USD
    'NGN_PER_USD' => '1500',
    // Flutterwave alternate. Dashboard: Settings → API Keys
    // Sandbox: FLWPUBK_TEST_… / FLWSECK_TEST_… (+ Secret Hash → FLW_SECRET_HASH)
    'FLW_PUBLIC_KEY' => '',
    'FLW_SECRET_KEY' => '',
    'FLW_SECRET_HASH' => '',
    'FLW_CURRENCY' => 'NGN',
    // BCC for PHP mail() receipts (optional)
    'BUY_MERCHANT_EMAIL' => 'ugidentity@gmail.com',
    // OPay Cashier — deprioritized (not shown in Buy UI). Soft-fail until set.
    'OPAY_MERCHANT_ID' => '',
    'OPAY_PUBLIC_KEY' => '',
    'OPAY_SECRET_KEY' => '',
    'OPAY_SANDBOX' => '1',
    'OPAY_CURRENCY' => 'NGN',
    'OPAY_PAYOUT_ACCOUNT' => '7035474827',
    'OPAY_PAYOUT_NAME' => 'Okogeri Ugochukwu O',
    'OPAY_MERCHANT_EMAIL' => 'ugidentity@gmail.com',
];
