/**
 * @module onboardingPage
 *
 * Android APK audit, 2026-06: first-login wizard for the three
 * preferences that drive the rest of the app's time / money /
 * language handling.
 *
 * Flow:
 *   - Fresh user or returning user with `hasCompletedOnboarding ===
 *     false` lands here after signup / login.
 *   - All three cards pre-fill from device detection
 *     (`@presentation/utils/deviceCapabilities`), but the user
 *     can override each one. **Currency** stays selection-only
 *     (no preselection) when the device language doesn't match a
 *     known mapping — see `detectBrowserCurrency()`.
 *   - The form is not skippable (no Skip button). Submit only
 *     enables when all three fields are non-empty.
 *   - On submit we PATCH `/user-settings` with the three values
 *     and `hasCompletedOnboarding: true`, then `<Navigate>` to
 *     `/app/dashboard`. The Dashboard page hydrates Redux from
 *     `useGetSettings()` on mount, so the chosen currency /
 *     language / timezone pick up instantly.
 *
 * No `useState`-based "settled" race: the page reads directly
 * from React Query so `useGetSettings().data` updates the moment
 * the mutation invalidates and re-fetches. If the user already
 * finished onboarding (legacy migration edge-case), the same
 * `hasCompletedOnboarding === true` redirect fires.
 */

import { useGetSettings } from "@adapters/query/userQuery";
import { setSettingsAction } from "@adapters/slices/user-settings/settingsSlice";
import { RootState } from "@adapters/store/rootStore";
import { updateUserSettings } from "@application/user/user.service";
import { Button } from "@presentation/components/ui/button";
import { PageHeader } from "@presentation/components/ui/page-header";
import { Currency } from "@presentation/utils/currencyService";
import {
  COMMON_TIMEZONES,
  SUPPORTED_CURRENCIES,
  SUPPORTED_LOCALE_TAGS,
  detectBrowserCurrency,
  detectBrowserLanguage,
  detectTimezone,
  prefersReducedMotion,
} from "@presentation/utils/deviceCapabilities";
import { APP_PATHS } from "@presentation/utils/routes";
import { errorToast, successToast } from "@presentation/utils/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Coins, Globe } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { Navigate } from "react-router";

const CURRENCY_LABELS: Record<Currency, string> = {
  USD: "US Dollar (USD)",
  EUR: "Euro (EUR)",
  COP: "Colombian Peso (COP)",
};

const LOCALE_LABELS: Record<(typeof SUPPORTED_LOCALE_TAGS)[number], string> = {
  "en-US": "English",
  "es-CO": "Español",
};

export default function OnboardingPage() {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  // Show the heading fade-in only when the user hasn't asked for
  // reduced motion at the OS level. SSR-safe via util guard.
  const [headingAnimated, setHeadingAnimated] = useState(false);
  useEffect(() => {
    if (prefersReducedMotion()) {
      // Skip the animation entirely.
      setHeadingAnimated(true);
      return;
    }
    const handle = window.setTimeout(() => setHeadingAnimated(true), 60);
    return () => window.clearTimeout(handle);
  }, []);

  // Settings source-of-truth: the React Query cache. We do NOT
  // also read from Redux here because the wizard's source-of-truth
  // is "what the server said" — the dashboard's hydrate-from-
  // Redux effect happens *after* this redirect lands, so reading
  // Redux would risk a stale slice hiding an in-flight PATCH.
  const { data: settings, isLoading } = useGetSettings();
  const user = useSelector((s: RootState) => s.auth.user);

  // Best-effort detected defaults. Computed once on first render
  // so they don't churn while the user edits the form.
  const detected = useMemo(
    () => ({
      timezone: detectTimezone(),
      language: detectBrowserLanguage(),
      // `null` here means "force the user to pick" — see util docs.
      currency: detectBrowserCurrency(),
    }),
    [],
  );

  // Form state initialised from server > detected > hard fallback.
  // `|| ""` is safe here because <select>s need a string to match.
  const [timezone, setTimezone] = useState("");
  const [currency, setCurrency] = useState("");
  const [locale, setLocale] = useState("");
  const [feInitialised, setFeInitialised] = useState(false);

  useEffect(() => {
    if (feInitialised || isLoading) return;
    setTimezone(
      settings?.timezone && COMMON_TIMEZONES.includes(settings.timezone)
        ? settings.timezone
        : detected.timezone,
    );
    // For currency: server value wins if it matches a supported
    // code; otherwise detected (or empty to force selection).
    setCurrency(
      settings?.currency && SUPPORTED_CURRENCIES.includes(settings.currency)
        ? settings.currency
        : detected.currency ?? "",
    );
    setLocale(
      settings?.locale && SUPPORTED_LOCALE_TAGS.includes(settings.locale)
        ? settings.locale
        : detected.language,
    );
    setFeInitialised(true);
  }, [settings, isLoading, detected, feInitialised]);

  // Persist the chosen language immediately when it changes so the
  // wizard labels and the chosen locale stay in sync, instead of
  // waiting for the submit click.
  useEffect(() => {
    if (locale && i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale, i18n]);

  // Mutation. We capture the complete UserSettings object so the
  // refresh after `invalidateQueries(["user-settings"])` doesn't
  // have to round-trip the server to surface the written values.
  const { mutate: saveOnboarding, isPending: isSaving } = useMutation({
    mutationFn: updateUserSettings,
    onSuccess: (data) => {
      // Mirror the server response into the Redux slice so
      // downstream consumers (Dashboard page redirects,
      // RecentTransactions currency, etc.) see the new values
      // without re-fetching.
      if (data) dispatch(setSettingsAction(data));
      queryClient.invalidateQueries({ queryKey: ["user-settings"] });
      successToast(t("onboarding.savedSuccess"), 3000, "onboarding");
    },
    onError: (err: Error) => {
      errorToast(err.message || t("onboarding.saveError"), 3000, "onboarding");
    },
  });

  // Android APK dev audit, 2026-07 (v1.7.0) — gate `canSubmit` on
  // STRICT `=== false` so a finished user whose `/user-settings`
  // line transiently faults (data stays `undefined`) can NOT
  // click submit and overwrite their previously-saved
  // timezone/currency/locale with detected defaults. Combined
  // with the strict-positive `=== true` bounce-back above, the
  // wizard cannot write to settings without a positive-confirmation
  // signal from the server that this user is in fact still in the
  // pre-onboarding state. See knowledge.md §6.8.3.
  const canSubmit =
    Boolean(timezone) &&
    Boolean(currency) &&
    Boolean(locale) &&
    settings?.hasCompletedOnboarding === false &&
    !isSaving;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    saveOnboarding({
      timezone,
      currency: currency as Currency,
      locale,
      hasCompletedOnboarding: true,
    });
  };

  // Once the server confirms `hasCompletedOnboarding === true`,
  // bounce out to the dashboard. We render nothing while the
  // server response is in flight; React Query will re-trigger
  // `useGetSettings()` and this page will re-evaluate.
  //
  // Android APK dev audit, 2026-07 (v1.7.0 regression fix): tighten
  // the truthy check to STRICT `=== true`. The previous truthy
  // (`settings?.hasCompletedOnboarding`) check matched any non-falsy
  // value (e.g. `true` ONLY) but ALSO swallowed `false` / `undefined`,
  // letting a finished user with a transient /user-settings failure
  // see the wizard for 1 frame — and on the next click of "Submit"
  // their previously-selected timezone/currency/locale got overwritten
  // by detected defaults. With strict `=== true`, EITHER signal
  // (positive-confirmation `true`) triggers the safe redirect.
  // Strict-positive here is the SYMMETRIC counterpart to
  // OnboardingGuard's strict-`!== true` redirect (knowledge.md
  // §6.8.2 codification entry).
  if (!isLoading && settings?.hasCompletedOnboarding === true) {
    return <Navigate to={APP_PATHS.dashboard} replace />;
  }

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center text-slate-500">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div
        className={`transition-all duration-500 ease-out ${headingAnimated
            ? "translate-y-0 opacity-100"
            : "translate-y-3 opacity-0"
          }`}
      >
        <PageHeader
          title={t("onboarding.title")}
          description={t("onboarding.subtitle", {
            name: user?.name ?? "",
          })}
        />
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {/* Timezone card */}
        <section
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900"
          aria-labelledby="onb-timezone"
        >
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-purple-50 p-2 text-purple-600 dark:bg-slate-800 dark:text-purple-300">
              <Clock className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2
              id="onb-timezone"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              {t("onboarding.timezone")}
            </h2>
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t("onboarding.timezoneHelp")}
          </p>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            required
            className="mt-3 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </section>

        {/* Currency card */}
        <section
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900"
          aria-labelledby="onb-currency"
        >
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-purple-50 p-2 text-purple-600 dark:bg-slate-800 dark:text-purple-300">
              <Coins className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2
              id="onb-currency"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              {t("onboarding.currency")}
            </h2>
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {detected.currency
              ? t("onboarding.currencyHelpDetected", {
                currency: detected.currency,
              })
              : t("onboarding.currencyHelpUndetected")}
          </p>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            required
            className="mt-3 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="" disabled>
              {t("onboarding.currencyPlaceholder")}
            </option>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_LABELS[c]}
              </option>
            ))}
          </select>
        </section>

        {/* Language card */}
        <section
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900"
          aria-labelledby="onb-language"
        >
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-purple-50 p-2 text-purple-600 dark:bg-slate-800 dark:text-purple-300">
              <Globe className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2
              id="onb-language"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              {t("onboarding.language")}
            </h2>
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t("onboarding.languageHelp")}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SUPPORTED_LOCALE_TAGS.map((l) => {
              const active = l === locale;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLocale(l)}
                  aria-pressed={active}
                  className={`flex items-center justify-between rounded-md border px-4 py-3 text-left transition-colors ${active
                      ? "border-purple-500 bg-purple-50 text-purple-700 dark:border-purple-400 dark:bg-purple-900/30 dark:text-purple-200"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    }`}
                >
                  <span className="text-sm font-medium">
                    {LOCALE_LABELS[l]}
                  </span>
                  {active && (
                    <Check
                      className="h-4 w-4 text-purple-600 dark:text-purple-300"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={!canSubmit} size="lg">
            {isSaving ? t("common.loading") : t("onboarding.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
