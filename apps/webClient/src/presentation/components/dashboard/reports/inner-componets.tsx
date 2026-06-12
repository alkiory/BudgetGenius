const ChartContainer = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
    <h3 className="mb-4 text-lg font-medium">{title}</h3>
    <div className="h-80">{children}</div>
  </div>
);

const InsightBox = ({ title, value, description }: {
  title: string;
  value: React.ReactNode;
  description: string
}) => (
  <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
    <h4 className="font-medium">{title}</h4>
    <div className="mt-1 text-2xl font-bold">{value}</div>
    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
  </div>
);

const ProgressBar = ({ value, color }: { value: number; color: string }) => (
  <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
    <div
      className="h-2 rounded-full"
      style={{ width: `${value}%`, backgroundColor: color }}
    />
  </div>
);

export { ChartContainer, InsightBox, ProgressBar };