import {
  loginAction,
  setAuthReady,
  setUser,
} from "@adapters/slices/auth/authSlice";
import api from "@infrastructure/api.config";
import { isNativePlatform } from "@infrastructure/platform";
import CTAPage from "@presentation/pages/cta";
import { RoutePaths } from "@presentation/utils/routes";
import { Sparkles, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";

/** Total time the splash is visible before auto-redirecting. */
const SPLASH_DURATION_MS = 1800;

const AUTH_READY_FALLBACK_MS = 3000;

/**
 * Android APK audit, 2026-06: after a successful `/auth/verify`
 * the splash needs to decide whether to send the user to the
 * dashboard or the onboarding wizard. We chain a `/user-settings`
 * fetch onto the existing verify+profile round-trip. The cost is
 * one extra signed request on cold start; the win is zero
 * navigation flicker (no "/app/dashboard" → "/app/onboarding"
 * bounce on the first paint).
 */
async function fetchHasCompletedOnboarding(userId: number): Promise<boolean> {
  try {
    // We don't have access to the React Query cache from inside the
    // splash — its `queryFn` parameter is an axios call against the
    // shared `api` instance, which already attaches the auth token
    // and X-Device-Id header. Treat a 200 as truth; treat a 4xx/5xx
    // as "let OnboardingGuard decide later" (it has the
    // same React Query with onSuccess wiring for a second chance).
    const response = await api.get("/user-settings", { _retry: true });
    const flag = response?.data?.hasCompletedOnboarding;
    if (typeof flag === "boolean") {
      return flag;
    }
    // Server responded but the field is missing / malformed —
    // err toward "needs onboarding" so the wizard picks up the
    // user rather than dropping them on an uncustomised dashboard.
    console.warn(
      "🔶 Splash: /user-settings returned without hasCompletedOnboarding; defaulting to needs-onboarding.",
      response?.data,
    );
    return false;
  } catch (error) {
    console.error("🔴 Splash: failed to fetch /user-settings:", error);
    return false;
  }
}

export default function SplashPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAuthenticated = useSelector(
    (state: { auth: { isAuthenticated: boolean } }) =>
      state.auth.isAuthenticated,
  );

  const authReady = useSelector(
    (state: { auth: { authReady: boolean } }) => state.auth.authReady,
  );
  // `dispatch` is needed to drive the auth slice from the cold-start verify:
  // setUser + loginAction on 200, setAuthReady in finally so the splash
  // navigation no longer has to wait the AUTH_READY_FALLBACK_MS.
  // Without this binding the splash threw `ReferenceError: dispatch is not
  // defined` on mobile cold start, and the ErrorBoundary then showed the
  // ErrorPage (the "stuck on error page" symptom reported in production).
  const dispatch = useDispatch();

  // Stage of the entrance animation so we can compose multiple delays.
  // 0 = pre-mount (logo hidden), 1 = logo in, 2 = tagline in, 3 = complete.
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!isNativePlatform()) {
      return;
    }

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

    let navigated = false;
    const go = (onboardingComplete: boolean | null) => {
      if (navigated) return;
      navigated = true;
      let target: string;
      if (isAuthenticated) {
        // `onboardingComplete === true`  -> dashboard
        // `onboardingComplete === false` -> onboarding wizard
        // `onboardingComplete === null`  -> couldn't reach /user-settings;
        //                                  default to onboarding so the
        //                                  wizard picks up the user rather
        //                                  than dropping them on the
        //                                  dashboard with hard-coded UTC.
        target =
          onboardingComplete === false
            ? `${RoutePaths.App}/${RoutePaths.Onboarding}`
            : `${RoutePaths.App}/${RoutePaths.Dashboard}`;
      } else {
        target = `${RoutePaths.Auth}/${RoutePaths.Login}`;
      }
      navigate(target, { replace: true });
    };

    if (authReady || isAuthenticated) {
      go(null);
      return;
    }

    let cancelled = false;
    const fallbackTimer: number | undefined = window.setTimeout(() => {
      if (!cancelled) go(null);
    }, AUTH_READY_FALLBACK_MS);

    (async () => {
      try {
        const response = await api.get("/auth/verify", { _retry: true });
        if (cancelled) return;
        let profile: { id: number } | null = null;
        if (response.status === 200) {
          const userProfile = await api.get("/user/profile", {
            _retry: true,
          });
          if (cancelled) return;
          profile = userProfile?.data ?? null;
          if (profile) {
            dispatch(setUser(profile));
            dispatch(loginAction());
          }
        }
        // Android APK audit, 2026-06: chain a /user-settings fetch
        // so the splash knows whether to land the user on the
        // dashboard or the onboarding wizard, without the second
        // flicker that would happen if we routed to /app/dashboard
        // and let `OnboardingGuard` catch the redirect to
        // /app/onboarding on its first paint.
        let onboardingComplete: boolean | null = null;
        if (profile?.id && response.status === 200) {
          onboardingComplete = await fetchHasCompletedOnboarding(profile.id);
        }
        if (cancelled) return;
        go(onboardingComplete);
      } catch (error) {
        console.error("🔴 Error validating session from splash:", error);
        if (!cancelled) go(null);
      } finally {
        if (cancelled) return;
        window.clearTimeout(fallbackTimer);
        dispatch(setAuthReady());
      }
    })();

    return () => {
      cancelled = true;
      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer);
      }
    };
  }, [stage, isAuthenticated, authReady, navigate, dispatch]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t("splash.loading")}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-purple-700 via-purple-800 to-fuchsia-900 text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
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
        className={`absolute h-44 w-44 rounded-full border-2 border-white/20 transition-all duration-700 ease-out ${stage >= 1 ? "scale-100 opacity-100" : "scale-50 opacity-0"
          }`}
      />
      <div
        aria-hidden="true"
        className={`absolute h-56 w-56 rounded-full border border-white/10 transition-all duration-700 ease-out ${stage >= 2 ? "scale-100 opacity-100" : "scale-75 opacity-0"
          }`}
      />

      {/* Logo cluster. We use a brighter inline mark here so the splash reads
          strongly even before the existing dark-mode-aware Logo finishes its
          entrance animation. */}
      <div
        className={`relative z-10 flex flex-col items-center gap-3 transition-all duration-700 ease-out ${stage >= 1 ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
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
            className={`mt-1 text-xs uppercase tracking-[0.2em] text-white/70 transition-opacity duration-500 ${stage >= 2 ? "opacity-100" : "opacity-0"
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
        className={`relative z-10 mt-10 h-1 w-48 overflow-hidden rounded-full bg-white/15 transition-opacity duration-500 ${stage >= 1 ? "opacity-100" : "opacity-0"
          }`}
      >
        <div
          className="absolute left-0 top-0 h-full w-1/3 rounded-full bg-fuchsia-300"
          style={{ animation: "loading 1.2s ease-in-out infinite" }}
        />
      </div>

      <p
        className={`mt-3 text-xs text-white/60 transition-opacity duration-500 ${stage >= 2 ? "opacity-100" : "opacity-0"
          }`}
      >
        {t("splash.loading")}
      </p>
    </div>
  );
}

export function RootRoute() {
  if (typeof window === "undefined") {
    // Build-time / SSR — defer; the route rule won't run.
    return null;
  }
  // Module-scope lazy cache in @infrastructure/native: the 3-tier Capacitor
  // detection runs at most once per module load; this call is an O(1) hit.
  const native = isNativePlatform();
  const alreadyShown = sessionStorage.getItem("mobile.splash.shown") === "1";
  if (native && !alreadyShown) {
    return <SplashPage />;
  }
  return <CTAPage />;
}
