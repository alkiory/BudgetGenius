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
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DEFAULT',
    },
    CapacitorCookies: {
      enabled: true,
    },
  },
};

export default config;
