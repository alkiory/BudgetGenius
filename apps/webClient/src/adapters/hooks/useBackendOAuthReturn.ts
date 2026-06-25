import { resolveBackendOAuth } from "@adapters/auth/backend-google-login";
import { isNativePlatform } from "@infrastructure/platform";
import { useEffect, useRef } from "react";

/**
 * Hook that listens for the `appUrlOpen` Capacitor event when the user
 * returns from the backend's Google OAuth flow via the `bgg://auth/success`
 * custom scheme redirect.
 *
 * When the URL matches, it extracts the `accessToken` and `refreshToken`
 * from the query string and passes them to `resolveBackendOAuth`, which
 * then sets cookies, fetches the user profile, and dispatches the auth
 * slice (see `backend-google-login.ts`).
 *
 * This hook must be mounted in App.tsx so it's active throughout the
 * entire app lifecycle.
 */
export function useBackendOAuthReturn(): void {
  const handled = useRef(false);

  useEffect(() => {
    // Only needed on Capacitor native platforms.
    if (!isNativePlatform()) {
      return;
    }

    // Belt-and-suspenders: stamp the ref so the effect runs at most once
    // even under React 19 StrictMode double-mount.
    if (handled.current) {
      return;
    }
    handled.current = true;

    let cancelled = false;

    (async () => {
      try {
        const { App } = await import("@capacitor/app");

        await App.addListener("appUrlOpen", (data) => {
          if (cancelled) return;

          // Only handle URLs from our backend OAuth redirect.
          const url = data.url;
          if (!url.startsWith("bgg://auth/success")) {
            return;
          }

          try {
            const parsedUrl = new URL(url);
            const accessToken = parsedUrl.searchParams.get("accessToken");
            const refreshToken = parsedUrl.searchParams.get("refreshToken");

            if (accessToken && refreshToken) {
              resolveBackendOAuth({ accessToken, refreshToken });
            }
          } catch (err) {
            console.error(
              "Failed to parse backend OAuth redirect URL:",
              url,
              err,
            );
          }
        });
      } catch (err) {
        // Capacitor App plugin not available (e.g. running in browser) —
        // this is expected on non-native platforms.
        if (isNativePlatform()) {
          console.error(
            "Failed to set up Capacitor appUrlOpen listener:",
            err,
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
