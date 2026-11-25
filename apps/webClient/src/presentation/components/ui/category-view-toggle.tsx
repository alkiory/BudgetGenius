import { useTranslation } from "react-i18next";

interface Props {
  /** Whether the chart is currently folding small categories together. */
  grouped: boolean;
  onToggle: () => void;
}

/**
 * Small pill that switches a category chart between the grouped view (top
 * categories + one "others" slice) and the full list. Mirrors the version
 * badge pill so it reads as part of the same surface language.
 */
export function CategoryViewToggle({ grouped, onToggle }: Props) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={grouped}
      className="rounded-full border border-slate-200/70 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-500 transition-colors hover:border-teal-400/40 hover:text-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400 dark:border-white/10 dark:text-slate-400 dark:hover:text-teal-300"
    >
      {t(grouped ? "charts.showAll" : "charts.group")}
    </button>
  );
}
