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
    // Buy NCN (Paystack). 1 NCN = USD $1. Never commit real keys.
    // Sandbox: pk_test_… / sk_test_…  Live: pk_live_… / sk_live_… only after sandbox works.
    'PAYSTACK_PUBLIC_KEY' => '',
    'PAYSTACK_SECRET_KEY' => '',
    // Optional; if empty, webhook HMAC uses PAYSTACK_SECRET_KEY
    'PAYSTACK_WEBHOOK_SECRET' => '',
    // Settlement currency for Checkout (NGN kobo or USD cents)
    'PAYSTACK_CURRENCY' => 'NGN',
    // When currency=NGN: charge kobo = NCN * NGN_PER_USD * 100
    'NGN_PER_USD' => '1500',
];
