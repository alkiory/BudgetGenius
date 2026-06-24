import type { CapacitorConfig } from '@capacitor/cli';

// Toggle this to `false` for production builds that load from local assets.
// When `true`, the WebView loads from the Vite dev server (hot-reload).
const DEV_MODE = process.env.CAP_DEV === 'true';

const config: CapacitorConfig = {
  appId: 'com.budgetgenius.mobile',
  appName: 'BudgetGenius',
  webDir: '../webClient/dist',
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
  },
};

export default config;
