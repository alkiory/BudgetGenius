const TONES: Record<string, { tile: string; value: string }> = {
  green: {
    tile: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    value: "text-emerald-600 dark:text-emerald-300",
  },
  red: {
    tile: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300",
    value: "text-rose-600 dark:text-rose-300",
  },
  blue: {
    tile: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300",
    value: "text-sky-600 dark:text-sky-300",
  },
  teal: {
    tile: "border-teal-500/30 bg-teal-500/10 text-teal-600 dark:text-teal-300",
    value: "text-teal-600 dark:text-teal-300",
  },
};

export default function SummaryCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}) {
  const tone = TONES[color] ?? TONES.blue;

  return (
    <div className="group glass-panel hover-glow rounded-xl p-5">
      <div className="flex items-start justify-between">
        <span
          className={`grid h-10 w-10 place-items-center rounded-lg border ${tone.tile}`}
        >
          <Icon className="h-[1.1rem] w-[1.1rem]" />
        </span>
        <span className="mt-1 text-right text-[10px] font-medium uppercase tracking-[0.13em] text-slate-400 dark:text-slate-500">
          {title}
        </span>
      </div>
      <p
        className={`mt-5 truncate text-2xl font-semibold tracking-tight ${tone.value}`}
      >
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}
