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
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
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
