import { ExpenseBreakdown } from "@domain/dashboard/dashboard.entity";
import { COLORS } from "@presentation/utils/color";
import { timezoneToLocale } from "@presentation/utils/localeInspector";
import { useTranslation } from "react-i18next";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

interface Props {
  total: string;
  byCategory: ExpenseBreakdown["byCategory"];
  largest: ExpenseBreakdown["largest"];
  timezone: string;
  period: string;
}

export function ExpenseCategories({
  total,
  byCategory,
  largest,
  timezone,
  period,
}: Props) {
  const { t } = useTranslation();
  const formattedLocale = timezoneToLocale(timezone);

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">
          {t("dashboard.expenseBreakdown")}
        </h2>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {period}
        </span>
      </div>
      {byCategory.length > 0 ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={byCategory}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {byCategory?.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={COLORS[i % COLORS.length]}
                    name={entry.name}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => [
                  `${v.toLocaleString(formattedLocale, {
                    timeZone: timezone,
                  })}`,
                  "Amount",
                ]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("common.noData")}
          </p>
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-700">
          <p className="text-sm text-slate-500">
            {t("dashboard.totalExpenses")}
          </p>
          <p className="text-xl font-bold">{total}</p>
        </div>
        <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-700">
          <p className="text-sm text-slate-500">
            {t("dashboard.largestCategory")}
          </p>
          <p className="text-xl font-bold">{largest.name}</p>
        </div>
      </div>
    </div>
  );
}
