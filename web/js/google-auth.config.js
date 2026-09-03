/* Google Identity (Sign-In / Gmail OAuth). NOT Maps / Places / Photorealistic 3D.
   Leave WEB_CLIENT_ID empty until a human pastes a real Web client ID from
   Google Cloud Console. Do not invent secrets. */
(function (global) {
  const WEB_CLIENT_ID = "730640559588-i03q4imeb8cl8lonr3j6iliaefmr1sa6.apps.googleusercontent.com";
  const ANDROID_PACKAGE = "com.lvfe.xperience";
  const BLOCKER_CODE = "oauth_not_configured";
  const BLOCKER_TITLE = "Google sign-in is not wired yet.";
  const BLOCKER_STEPS = [
    "Google Cloud Console → create or select a project (Identity / OAuth only — do not enable Maps SDK, Places, or Photorealistic 3D).",
    "APIs & Services → OAuth consent screen: External or Internal. App name Lvfe. Scopes: openid, email, profile only.",
    "Credentials → Create credentials → OAuth client ID → Application type: Web application.",
    "Authorized JavaScript origins (exact origins, no path): https://iconiaglobal.com and https://www.iconiaglobal.com if used. PWA lives at https://iconiaglobal.com/lvfe/ — origin is still https://iconiaglobal.com (path does not change the origin). Local GIS tests: http://localhost and http://127.0.0.1. Android Credential Manager uses the Android OAuth client (package + SHA-1), not a JS origin. Add Authorized redirect URIs only if your GIS / Credential Manager docs require them.",
    "Copy the Client ID (…apps.googleusercontent.com). Paste into web/js/google-auth.config.js as WEB_CLIENT_ID AND android/app/src/main/res/values/strings.xml as google_web_client_id (same value).",
    "Also create OAuth client ID → Android. Package: com.lvfe.xperience. SHA-1 from debug keystore (re-verify: keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android — prior: 2E:48:31:66:B1:07:A2:4C:FB:25:35:EE:EA:9C:B6:B3:E5:E4:35:E5).",
    "Rebuild the APK. Set the same Web client ID on the save host as GOOGLE_WEB_CLIENT_ID (hosting/lvfe-save/config.local.php or Netlify env). Then set LVFE_ALLOW_DEV_AUTH=0. Username is permanent once chosen and bound to the Google sub on the save API — Gmail is the account key, not the display name.",
  ];

  function isConfigured(id) {
    const s = String(id == null ? WEB_CLIENT_ID : id).trim();
    if (!s) return false;
    if (/YOUR_|REPLACE|PASTE|placeholder|CHANGEME/i.test(s)) return false;
    return /\.apps\.googleusercontent\.com$/.test(s);
  }

  function blockerMessage() {
    return BLOCKER_TITLE + " " + BLOCKER_STEPS.join(" ");
  }

  const api = {
    WEB_CLIENT_ID,
    ANDROID_PACKAGE,
    BLOCKER_CODE,
    BLOCKER_TITLE,
    BLOCKER_STEPS,
    isConfigured,
    blockerMessage,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.LvfeGoogleAuthConfig = api;
})(typeof window !== "undefined" ? window : globalThis);
