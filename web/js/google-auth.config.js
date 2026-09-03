/* Google Identity (Sign-In / Gmail OAuth). NOT Maps / Places / Photorealistic 3D.
   Leave WEB_CLIENT_ID empty until a human pastes a real Web client ID from
   Google Cloud Console. Do not invent secrets. */
(function (global) {
  const WEB_CLIENT_ID = "";
  const ANDROID_PACKAGE = "com.lvfe.xperience";
  const BLOCKER_CODE = "oauth_not_configured";
  const BLOCKER_TITLE = "Google sign-in is not wired yet.";
  const BLOCKER_STEPS = [
    "Open Google Cloud Console → APIs & Services → Credentials.",
    "OAuth consent screen: External (or Internal). App name Lvfe. Scopes: openid, email, profile. Do not add Maps SDK, Places, or Photorealistic 3D.",
    "Create OAuth client ID → Web application. Copy the Client ID (…apps.googleusercontent.com).",
    "Paste that Web client ID into web/js/google-auth.config.js (WEB_CLIENT_ID) AND android/app/src/main/res/values/strings.xml (google_web_client_id). Same value in both.",
    "Create OAuth client ID → Android. Package name: com.lvfe.xperience. SHA-1: debug keystore (this machine: 2E:48:31:66:B1:07:A2:4C:FB:25:35:EE:EA:9C:B6:B3:E5:E4:35:E5 — keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android).",
    "Rebuild the APK. Tap Sign in with Google again. Username stays a unique in-game name — Gmail is the account key, not the display name.",
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
