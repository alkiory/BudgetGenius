import { WebGoogleLoginStrategy } from "./web-google-login.strategy";

export { isNativePlatform } from "@infrastructure/platform";
export { type GoogleLoginStrategy } from "./google-login-strategy";
export { WebGoogleLoginStrategy } from "./web-google-login.strategy";
// `NativeGoogleLoginStrategy` remains re-exported for the day the Android
// project is set up with `google-services.json` + SHA fingerprints in the
// Firebase project. Until then, offering it as the default broke mobile
// Google login with "No Credentials available". We keep the export so this
// module's surface area is unchanged.
export { NativeGoogleLoginStrategy } from "./native-google-login.strategy";

export function createGoogleLoginStrategy(): GoogleLoginStrategy {
  // Always use the web SDK path. On native it now falls through to
  // `signInWithRedirect`, which works inside the Capacitor WebView. The
  // resulting full-page navigation is reconciled on return by
  // `useFirebaseRedirectReturn` (mounted in App.tsx).
  return new WebGoogleLoginStrategy();
}
