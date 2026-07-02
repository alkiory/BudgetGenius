import {
  isAccountReauthError,
  type AccountReauthError,
} from "@adapters/auth/hybrid-google-login.strategy";
import { Button } from "@presentation/components/ui/button";
import { Card } from "@presentation/components/ui/card";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

// `AccountReauthError` is imported for typing only — do NOT re-export it
// here. Re-exporting would create a second producer surface that
// downstream consumers might import thinking it's a "Modal version" of
// the type, breaking §6.8.4's "single source of truth" invariant. If a
// consumer needs the type, import it from
// `@adapters/auth/hybrid-google-login.strategy.ts` directly.

interface GoogleAccountReauthModalProps {
  error: AccountReauthError;
  onClose: () => void;
  onRetry: () => void;
}

/**
 * Sticky in-app overlay rendered when the native Google plugin
 * surfaces the Account reauth [code=16] signature (most commonly: SHA-1
 * fingerprint of the keystore was not registered in Firebase / Google
 * Cloud). The previous behavior was to silently fall back to
 * `signInWithRedirect`, opening the phone's browser and stranding the
 * user in a hanging Chrome Custom Tab (see
 * `rpi/mobile-google-login-regression/research.md` §A). This modal
 * shows the canonical 5-step playbook inline so the user can recover
 * without leaving the app.
 *
 * Why a Modal, not a Toast — auth-blocking errors deserve a surface
 * that survives the 5-second toast-dismiss timer in
 * `apps/webClient/src/infrastructure/toast.config.tsx`. The Modal
 * also escapes the login card's viewport, so the Capacitor WebView's
 * `vh` quirks (keyboard offset, status-bar overlap) cannot push the
 * explanation off-screen.
 *
 * Why `createPortal` to `document.body` — pushes the overlay above
 * the parent Card's stacking context so a Card with `z-index` cannot
 * cut off the modal. Backed by a `<div role="dialog"
 * aria-modal="true">` so screen readers announce it correctly.
 */
export function GoogleAccountReauthModal({
  error,
  onClose,
  onRetry,
}: GoogleAccountReauthModalProps) {
  const { t } = useTranslation();

  // Defense-in-depth narrowing — `GoogleAccountReauthModalProps` already
  // types `error` as `AccountReauthError`, but the explicit check keeps
  // the surface resilient to callers that pass a generic Error and
  // re-cast at the call site. Returns null (not throw) so a misuse
  // cannot HMR-crash the parent.
  if (!isAccountReauthError(error)) {
    return null;
  }

  // a11y — Escape closes the modal; the primary "Try again" CTA receives
  // focus on open so keyboard users land on the recovery action
  // immediately (vs the "Close" CTA, which the user has to actively
  // seek for keyboard nav). Both are cheap additions; no new deps.
  const retryButtonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    retryButtonRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") {
    // SSR/build-time guard. The webClient is pure CSR (Vite SPA) per
    // knowledge.md §3 — this is defense-in-depth for the rare
    // codesplit path that might evaluate during prerender. Lives so
    // createPortal is never invoked with a `null` target.
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-account-reauth-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      data-testid="google-account-reauth-modal"
    >
      <Card className="w-full max-w-lg p-6 bg-card text-neutral shadow-xl">
        <h2
          id="google-account-reauth-title"
          className="text-lg font-semibold mb-2"
        >
          {t("auth.accountReauth.title")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("auth.accountReauth.body")}
        </p>
        <ol
          className="text-sm space-y-2 list-decimal list-inside text-left mb-6"
          data-testid="google-account-reauth-steps"
        >
          <li>{t("auth.accountReauth.step1")}</li>
          <li>{t("auth.accountReauth.step2")}</li>
          <li>{t("auth.accountReauth.step3")}</li>
          <li>{t("auth.accountReauth.step4")}</li>
          <li>{t("auth.accountReauth.step5")}</li>
        </ol>
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            onClick={onClose}
            data-testid="google-account-reauth-close"
          >
            {t("auth.accountReauth.ctaClose")}
          </Button>
          <Button
            variant="secondary"
            onClick={onRetry}
            ref={retryButtonRef}
            data-testid="google-account-reauth-retry"
          >
            {t("auth.accountReauth.ctaRetry")}
          </Button>
        </div>
        {/* Original error message preserved as a hidden-by-default
            detail for screenshot-triage by operators. Not user-visible
            in its raw i18n-keyless form — the Modal's t(...) strings
            drive the visible UX. */}
        <p className="sr-only" data-error-detail>
          {error.message}
        </p>
      </Card>
    </div>,
    document.body,
  );
}
