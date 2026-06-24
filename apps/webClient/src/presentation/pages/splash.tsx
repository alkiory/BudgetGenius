import { isNativePlatform } from "@infrastructure/platform";
import CTAPage from "@presentation/pages/cta";
import { RoutePaths } from "@presentation/utils/routes";
import { Sparkles, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router";

/** Total time the splash is visible before auto-redirecting. */
const SPLASH_DURATION_MS = 1800;

/**
 * Maximum time SplashPage will wait for `auth.authReady` to flip true after
 * the animation has finished. Acts as a safety net so a slow /auth/verify
 * (or a network drop from a flaky AP) doesn't strand the user on the splash
 * forever — after this timeout the splash navigates to the safe default
 * (login). Returning users whose verify completes within this window skip
 * the login page and land straight on the dashboard.
 */
const AUTH_READY_FALLBACK_MS = 3000;

/**
 * Splash screen shown on cold start of the Capacitor mobile APK.
 *
 * Why this exists: the SPA's `/` route normally renders the marketing CTAPage
 * (`apps/webClient/src/presentation/pages/cta.tsx`) which is wrong for a user
 * who just installed the app — they need to land on auth, not a landing page.
 *
 * Behaviour:
 *  - On native (Capacitor) AND first cold-start of a session, renders an
 *    animated logo + brand mark and auto-redirects to `/auth/login` (or to the
 *    protected dashboard if the session was already restored). The flag is
 *    stored in `sessionStorage` so the splash only appears on cold start.
 *  - On web, returns null so the route falls through to CTAPage as if nothing
 *    was here (handled by RootRoute, which wraps this).
 */
export default function SplashPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAuthenticated = useSelector(
    (state: { auth: { isAuthenticated: boolean } }) =>
      state.auth.isAuthenticated,
  );
  // `authReady` flips true once `useRestoreSession` finishes its first
  // `/auth/verify` call (success or failure). Without waiting on it, the
  // splash would navigate based on the stale `isAuthenticated` from before
  // app launch, sending returning users to the login page even when their
  // refresh cookie is still valid.
  const authReady = useSelector(
    (state: { auth: { authReady: boolean } }) => state.auth.authReady,
  );

  // Stage of the entrance animation so we can compose multiple delays.
  // 0 = pre-mount (logo hidden), 1 = logo in, 2 = tagline in, 3 = complete.
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!isNativePlatform()) {
      return;
    }

    // Mark the splash as shown for the lifetime of this session so a hot
    // navigation back to `/` doesn't redisplay the splash. Cold start (new
    // WebView) wipes sessionStorage so the splash returns — exactly what we
    // want for an installed app coming back from the launcher.
    sessionStorage.setItem("mobile.splash.shown", "1");

    const stage1 = window.setTimeout(() => setStage(1), 60);
    const stage2 = window.setTimeout(() => setStage(2), 320);
    const stage3 = window.setTimeout(() => setStage(3), SPLASH_DURATION_MS);

    return () => {
      window.clearTimeout(stage1);
      window.clearTimeout(stage2);
      window.clearTimeout(stage3);
    };
  }, []);

  useEffect(() => {
    if (stage < 3) {
      return;
    }
    if (!isNativePlatform()) {
      return;
    }

    // Picks the destination based on the freshly restored session. Returns
    // true when navigation fired so the effect can stop waiting.
    const go = () => {
      const target = isAuthenticated
        ? `${RoutePaths.App}/${RoutePaths.Dashboard}`
        : `${RoutePaths.Auth}/${RoutePaths.Login}`;
      navigate(target, { replace: true });
    };

    // Auth state already known — the verify call landed before the animation
    // finished (the common case on a fast network). Navigate immediately.
    if (authReady) {
      go();
      return;
    }

    // Auth state still unknown (slow network, backend timeout). Wait up to
    // AUTH_READY_FALLBACK_MS for `authReady` to flip via the `useEffect`
    // dependency below; if it never does, the fallback timer fires and we
    // navigate to the safe default (login). The fallback also clears on
    // unmount so a hot navigation away from `/` doesn't leave a dangling
    // timer behind.
    const fallbackTimer = window.setTimeout(go, AUTH_READY_FALLBACK_MS);
    return () => window.clearTimeout(fallbackTimer);
  }, [stage, isAuthenticated, authReady, navigate]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t("splash.loading")}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-purple-700 via-purple-800 to-fuchsia-900 text-white"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Soft animated blobs behind the logo to mimic a gradient sweep. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-32 h-72 w-72 rounded-full bg-purple-400/30 blur-3xl animate-pulse"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-fuchsia-400/30 blur-3xl animate-pulse"
        style={{ animationDelay: "0.7s" }}
      />

      {/* Animated ring behind the logo. */}
      <div
        aria-hidden="true"
        className={`absolute h-44 w-44 rounded-full border-2 border-white/20 transition-all duration-700 ease-out ${
          stage >= 1 ? "scale-100 opacity-100" : "scale-50 opacity-0"
        }`}
      />
      <div
        aria-hidden="true"
        className={`absolute h-56 w-56 rounded-full border border-white/10 transition-all duration-700 ease-out ${
          stage >= 2 ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      />

      {/* Logo cluster. We use a brighter inline mark here so the splash reads
          strongly even before the existing dark-mode-aware Logo finishes its
          entrance animation. */}
      <div
        className={`relative z-10 flex flex-col items-center gap-3 transition-all duration-700 ease-out ${
          stage >= 1
            ? "translate-y-0 opacity-100"
            : "translate-y-4 opacity-0"
        }`}
      >
        <div className="relative">
          <div className="rounded-full bg-gradient-to-br from-purple-300 to-fuchsia-400 p-3 shadow-2xl shadow-purple-900/40">
            <Wallet className="h-12 w-12 text-white" strokeWidth={2.2} />
          </div>
          <Sparkles
            className="absolute -right-2 -top-2 h-6 w-6 text-purple-200 animate-pulse"
            strokeWidth={2.2}
          />
        </div>

        <div className="flex flex-col items-center">
          <span className="text-3xl font-bold tracking-tight">
            Budget<span className="text-fuchsia-300">Genius</span>
          </span>
          <span
            className={`mt-1 text-xs uppercase tracking-[0.2em] text-white/70 transition-opacity duration-500 ${
              stage >= 2 ? "opacity-100" : "opacity-0"
            }`}
          >
            {t("app.tagline")}
          </span>
        </div>
      </div>

      {/* Loading bar — keeps with the existing brand style (matches the bar in
          loading.tsx) so the splash feels like a deliberately louder version of
          that loading state. */}
      <div
        className={`relative z-10 mt-10 h-1 w-48 overflow-hidden rounded-full bg-white/15 transition-opacity duration-500 ${
          stage >= 1 ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className="absolute left-0 top-0 h-full w-1/3 rounded-full bg-fuchsia-300"
          style={{ animation: "loading 1.2s ease-in-out infinite" }}
        />
      </div>

      <p
        className={`mt-3 text-xs text-white/60 transition-opacity duration-500 ${
          stage >= 2 ? "opacity-100" : "opacity-0"
        }`}
      >
        {t("splash.loading")}
      </p>
    </div>
  );
}

/**
 * Root helper that decides whether to render the splash or the marketing
 * landing page at the `/` route. Extracted from route-config.tsx so the cold
 * start logic stays in one place and the routes config stays declarative.
 *
 * Decision tree:
 *  - If sessionStorage says the splash has already played this session, fall
 *    through to CTAPage so the splash doesn't re-render on subsequent visits.
 *  - If we're in a Capacitor native WebView and the splash hasn't been shown
 *    yet this session, render SplashPage (which auto-redirects to auth).
 *  - Otherwise, render the marketing landing page (CTAPage).
 */
export function RootRoute() {
  if (typeof window === "undefined") {
    // Build-time / SSR — defer; the route rule won't run.
    return null;
  }
  const native = isNativePlatform();
  const alreadyShown = sessionStorage.getItem("mobile.splash.shown") === "1";
  if (native && !alreadyShown) {
    return <SplashPage />;
  }
  return <CTAPage />;
}
