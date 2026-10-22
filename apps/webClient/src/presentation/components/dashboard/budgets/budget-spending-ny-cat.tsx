import { RootState } from "@adapters/store/rootStore";
import { BudgetType } from "@domain/dashboard/budgets/budget.entity";
import {
  OverBudgetContainer,
  OverBudgetHeader,
} from "@presentation/components/ui/budget-status";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Cell,
  BarChart,
} from "recharts";

interface ChartEntry {
  name: string;
  allocated: number;
  spent: number;
  percentUsed: number;
}

export default function BudgetSpendingByCategory({
  chartData,
  budgetType = "spending",
}: {
  chartData: ChartEntry[];
  budgetType?: BudgetType;
}) {
  const { t } = useTranslation();
  const settings = useSelector(
    (state: RootState) => state.userSettings.settings,
  );
  const currency = (settings?.currency || "EUR") as Currency;
  const formatCurrency = (value: number) =>
    currencyService.formatCurrency(value, currency, false).formatted;
  const isSavings = budgetType === "savings";
  // Savings goals don't go "over" — the bar simply reaches 100%.
  const overBudgetCount = isSavings
    ? 0
    : chartData.filter((d) => d.percentUsed > 100).length;
  const hasOverBudget = overBudgetCount > 0;
  const amountLabel = isSavings
    ? t("budgets.goalLabel")
    : t("budgets.limitLabel");
  const progressLabel = isSavings
    ? t("budgets.savedLabel")
    : t("budgets.spentLabel");

  return (
    <OverBudgetContainer isOverBudget={hasOverBudget}>
      <OverBudgetHeader
        isOverBudget={hasOverBudget}
        title={
          isSavings
            ? t("budgets.savingsByCategory")
            : t("budgets.spendingByCategory")
        }
        iconSize="md"
        badge={
          hasOverBudget
            ? t("budgets.categoriesOverBudget", { count: overBudgetCount })
            : undefined
        }
      />

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={100} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const entry = chartData.find((d) => d.name === label);
                if (!entry) return null;
                const isOver = !isSavings && entry.percentUsed > 100;
                const overAmount = entry.spent - entry.allocated;

                return (
                  <div className="rounded-lg border bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                    <p className="mb-1 font-medium">{label}</p>
                    {payload.map((p, i) => (
                      <p key={i} className="text-sm">
                        <span className="font-medium">{p.name}:</span>{" "}
                        {formatCurrency(Number(p.value))}
                      </p>
                    ))}
                    {isOver && (
                      <p className="mt-1 text-sm font-medium text-red-600 dark:text-red-400">
                        {t("budgets.chartOverBy", {
                          amount: formatCurrency(overAmount),
                        })}
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <Bar dataKey="allocated" name={amountLabel} fill="#8884d8" />
            <Bar dataKey="spent" name={progressLabel} fill="#82ca9d">
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    !isSavings && entry.percentUsed > 100
                      ? "#ef4444"
                      : !isSavings && entry.percentUsed > 90
                      ? "#f59e0b"
                      : "#10b981"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </OverBudgetContainer>
  );
}
