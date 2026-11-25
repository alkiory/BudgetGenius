import { Sparkles, Wallet } from "@presentation/components/ui/animated-icons";
import { useTranslation } from "react-i18next";

export default function LoadingPage() {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t("common.loading")}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-teal-400/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 bottom-1/4 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl"
      />

      <div className="relative flex flex-col items-center">
        <div className="brand-loader-mark relative grid h-16 w-16 place-items-center rounded-2xl">
          <span aria-hidden="true" className="brand-loader-halo" />
          <Wallet
            className="relative z-10 h-8 w-8 text-teal-600 dark:text-teal-300"
            strokeWidth={1.8}
          />
          <Sparkles
            aria-hidden="true"
            className="absolute -right-1.5 -top-1.5 h-4 w-4 text-cyan-500 dark:text-cyan-300"
            strokeWidth={2}
          />
        </div>

        <div className="mt-5 flex items-baseline gap-1.5 text-2xl font-semibold tracking-tight">
          <span className="text-slate-800 dark:text-slate-100">Budget</span>
          <span className="text-teal-600 dark:text-teal-300">Genius</span>
        </div>

        <div className="brand-loader-track mt-5 h-1.5 w-56 overflow-hidden rounded-full">
          <div className="brand-loader-bar h-full rounded-full" />
        </div>

        <p className="mt-4 flex items-center text-sm text-muted-foreground">
          {t("common.loading")}
          <span aria-hidden="true" className="ml-1.5 inline-flex items-end gap-1">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="brand-loader-dot"
                style={{ animationDelay: `${index * 0.16}s` }}
              />
            ))}
          </span>
        </p>
      </div>
    </div>
  );
}
