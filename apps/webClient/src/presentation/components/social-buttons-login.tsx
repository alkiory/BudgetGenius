import {
  isAccountReauthError,
  type AccountReauthError,
} from "@adapters/auth/hybrid-google-login.strategy";
import { loginAction, setUser } from "@adapters/slices/auth/authSlice";
import { googleLogin } from "@application/auth/auth.service";
import { RoutePaths } from "@presentation/utils/routes";
import { errorToast, successToast } from "@presentation/utils/toast";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router";
import { GoogleAccountReauthModal } from "./auth/GoogleAccountReauthModal";
import { BrandDots } from "./loader";
import { Button } from "./ui/button";

export function SocialLoginButtons() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  // v1.7.3 — held in component state rather than a toast because
  // the Account reauth error is auth-blocking and must survive the
  // 5-second toast-dismiss timer. Modal renders conditionally on
  // this state; clearing it via Close or Retry handlers hides the
  // overlay.
  const [reauthError, setReauthError] = useState<AccountReauthError | null>(
    null,
  );

  const { mutate: signInWithGoogle } = useMutation({
    mutationKey: ["google-auth"],
    mutationFn: googleLogin,
    onSuccess: (data: any) => {
      if (data?.user) {
        dispatch(setUser(data.user));
      }
      dispatch(loginAction());
      successToast("Autenticación exitosa");
      setLoading(true);
      setTimeout(() => {
        navigate(RoutePaths.App + "/" + RoutePaths.Dashboard);
        setLoading(false);
      }, 1000);
    },
    onError: (error) => {
      // §6.8.4 — typed sentinel path: surface Modal, NOT a toast
      // (and definitely NOT a signInWithRedirect, which is what the
      // pre-fix Hybrid did). Predicate is imported from the strategy
      // so this surface shares ONE source of truth with the
      // dispatcher (no drift).
      if (isAccountReauthError(error)) {
        setReauthError(error);
        return;
      }
      // Pre-existing path: raw error message in a toast. Kept
      // verbatim for user-cancelled / network / Firebase errors.
      errorToast(error?.message ?? String(error));
    },
  });

  const handleLoginWithGoogle = () => {
    try {
      signInWithGoogle();
    } catch (error) {
      console.error("Google auth error:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-10 w-full items-center justify-center py-1.5">
        <BrandDots
          size="lg"
          label={t("common.loading")}
          className="text-teal-600 dark:text-teal-300"
        />
      </div>
    );
  }

  return (
    <div className="flex">
      <Button
        onClick={handleLoginWithGoogle}
        variant="outline"
        className="bg-white w-full"
        data-testid="google-button"
      >
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
          <path d="M1 1h22v22H1z" fill="none" />
        </svg>
        Google
      </Button>
      {/* v1.7.3 — Modal renders via createPortal inside the
          component, so the overlay is anchored on document.body above
          any parent stacking context. Cleared via Close or Retry. */}
      {reauthError && (
        <GoogleAccountReauthModal
          error={reauthError}
          onClose={() => setReauthError(null)}
          onRetry={() => {
            setReauthError(null);
            handleLoginWithGoogle();
          }}
        />
      )}
    </div>
  );
}
