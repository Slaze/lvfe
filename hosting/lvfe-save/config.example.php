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
];
