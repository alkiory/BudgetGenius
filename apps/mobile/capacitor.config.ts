import type { CapacitorConfig } from '@capacitor/cli';

// Toggle this to `false` for production builds that load from local assets.
// When `true`, the WebView loads from the Vite dev server (hot-reload).
const DEV_MODE = process.env.CAP_DEV === 'true';

const config: CapacitorConfig = {
  appId: 'com.budgetgenius.mobile',
  appName: 'BudgetGenius',
  webDir: '../webClient/dist',
  android: {
    allowMixedContent: true,
  },
  server: DEV_MODE
    ? {
      url: 'http://10.0.2.2:5173',
      cleartext: true,
    }
    : {
      androidScheme: 'https',
    },
  plugins: {
    // @capgo/capacitor-social-login (replaced @capacitor-firebase/authentication
    // in v1.2.0 — see docs/changelog.md). Renders an Android Credential
    // Manager bottom sheet inside the app, returns an idToken to JS so the
    // existing /auth/firebase-login backend endpoint can verify it.
    //
    // The Google provider requires:
    //   - `VITE_GOOGLE_WEB_CLIENT_ID` set in the webClient env (a `*.apps.
    //     googleusercontent.com` string).
    //   - An Android OAuth Client registered in Google Cloud Console with
    //     the SHA-1 fingerprint of the keystore that produced app-release.
    //     apk. Without it the bottom sheet opens but every account selection
    //     returns "Developer Error". Google_Client_ID is NOT a runtime config
    //     value (it's used internally by Credential Manager); the Web Client
    //     ID is what JS passes to `SocialLogin.initialize({ google: { webClientId }})`.
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
    },
    // StatusBar: ensure the WebView extends behind the OS status bar so
    // `env(safe-area-inset-*)` resolves to the correct inset on notched
    // devices. The webClient must honor `env(safe-area-inset-top)` in
    // its sticky header (and `safe-area-inset-bottom` in the mobile FAB).
    // `DEFAULT` follows the OS theme; the webClient does not call
    // `StatusBar.setStyle()` from JS yet, so a programmatic theme sync
    // (dark/light) is still a TODO.
    StatusBar: {
      overlaysWebView: true,
      style: 'DEFAULT',
    },
  },
};

export default config;
