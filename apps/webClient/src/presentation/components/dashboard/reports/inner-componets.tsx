const ChartContainer = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
    <h3 className="mb-4 text-lg font-medium">{title}</h3>
    <div className="h-80">{children}</div>
  </div>
);

const InsightBox = ({
  title,
  value,
  description,
}: {
  title: string;
  value: React.ReactNode;
  description: string;
}) => (
  <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
    <h4 className="font-medium">{title}</h4>
    <div className="mt-1 text-2xl font-bold">{value}</div>
    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
      {description}
    </p>
  </div>
);

const ProgressBar = ({ value, color }: { value: number; color: string }) => {
  // Phase 6.8 (Bug C): for over-spent categories, `(category.amount /
  // totalExpenses) * 100` can exceed 100%. Clamp the rendered width
  // to the track width so the bar visually matches the track. The
  // over-budget signal is rendered by the parent (categories-tab.tsx)
  // as an explicit 'over by X%' text label, NOT by flipping this
  // bar's color — preserving the per-category color semantics for
  // the tab's breakdown list.
  const safeWidth = Math.max(0, Math.min(value, 100));
  return (
    <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
      <div
        className="h-2 rounded-full"
        style={{ width: `${safeWidth}%`, backgroundColor: color }}
      />
    </div>
  );
};

export { ChartContainer, InsightBox, ProgressBar };
