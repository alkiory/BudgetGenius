import { ArrowDownRight, ArrowUpRight, DollarSign } from "lucide-react";
import { useTranslation } from "react-i18next";

interface OverviewCardProps {
  balance: string;
  income: string;
  expenses: string;
  period: Date;
}

export function OverviewCard({
  balance,
  income,
  expenses,
  period,
}: OverviewCardProps) {
  const { t } = useTranslation();
  const periodDate = new Date(period);

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{t("dashboard.overview")}</h2>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {periodDate.toDateString()}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-purple-50 p-4 dark:bg-slate-700">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-900">
              <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-sm font-medium">{t("common.balance")}</span>
          </div>
          <p className="mt-2 text-2xl font-bold">{balance}</p>
        </div>
        <div className="rounded-lg bg-green-50 p-4 dark:bg-slate-700">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-green-100 p-2 dark:bg-green-900">
              <ArrowUpRight className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-sm font-medium">
              {t("dashboard.summaryIncome")}
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-green-600 dark:text-green-400">
            {income}
          </p>
        </div>
        <div className="rounded-lg bg-red-50 p-4 dark:bg-slate-700">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-red-100 p-2 dark:bg-red-900">
              <ArrowDownRight className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-sm font-medium">
              {t("dashboard.totalExpenses")}
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">
            {expenses}
          </p>
        </div>
      </div>
    </div>
  );
}
