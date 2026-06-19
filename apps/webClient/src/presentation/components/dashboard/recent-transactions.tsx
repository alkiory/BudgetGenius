import { useFetchRecentSummary } from "@adapters/query/dashboard";
import { RootState } from "@adapters/store/rootStore";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { RoutePaths } from "@presentation/utils/routes";
import {
  DollarSign,
  ShoppingBag,
  Home,
  Utensils,
  Heart,
  Car,
  ShoppingCart,
  Banknote,
  Pizza,
  Film,
  Plus,
  Wallet,
  Landmark,
  Bus,
  Wifi,
  Activity,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router";

// Mapeo de categorías a iconos
const CATEGORY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  Shopping: ShoppingBag,
  Income: DollarSign,
  "Food & Drink": Utensils,
  Housing: Home,
  Entertainment: Film,
  Transportation: Car,
  Utilities: Wifi,
  Healthcare: Activity,
  Other: Wallet,
  Rent: Home,
  Salary: Banknote,
  Dining: Pizza,
  Groceries: ShoppingCart,
  Insurance: Landmark,
  "Public Transport": Bus,
  Donation: Heart,
};

// Colores y fondos para los iconos
const CATEGORY_STYLES: Record<string, { color: string; bg: string }> = {
  Income: { color: "text-green-500", bg: "bg-green-100 dark:bg-green-900" },
  Shopping: { color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900" },
  Food: { color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-900" },
  Housing: { color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-900" },
  default: { color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-700" },
  Transportation: {
    color: "text-cyan-500",
    bg: "bg-cyan-100 dark:bg-cyan-900",
  },
  Entertainment: { color: "text-pink-500", bg: "bg-pink-100 dark:bg-pink-900" },
  Utilities: {
    color: "text-yellow-500",
    bg: "bg-yellow-100 dark:bg-yellow-900",
  },
  Healthcare: { color: "text-rose-500", bg: "bg-rose-100 dark:bg-rose-900" },
};

export function RecentTransactions() {
  const { t } = useTranslation();
  const getTransactionIcon = (category: string) => {
    const IconComponent = CATEGORY_ICONS[category] || Plus;
    const { color, bg } = CATEGORY_STYLES[category] || CATEGORY_STYLES.default;
    return { IconComponent, color, bg };
  };

  // Recent slice returned by GET /dashboard/recent-summary (already DESC).
  const { data, isSuccess } = useFetchRecentSummary(50);

  const userSetting = useSelector((state: RootState) => state.userSettings);

  const { settings } = userSetting;

  const recentTransactions = (data?.transactions ?? []).slice(0, 3);

  const targetCurrency = (settings?.currency || "USD") as Currency;
  const renderAmount = (raw: number) =>
    currencyService.formatCurrency(raw, "USD" as Currency, targetCurrency);

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">
          {t("dashboard.recentTransactions")}
        </h2>
        <Link
          to={`${RoutePaths.App}/${RoutePaths.Transactions}`}
          className="text-sm text-purple-600 hover:underline dark:text-purple-400"
        >
          {t("common.viewAll")}
        </Link>
      </div>

      <div className="space-y-4">
        {isSuccess && recentTransactions.length > 0 ? (
          <>
            {recentTransactions.map((transaction) => {
              const { IconComponent, color, bg } = getTransactionIcon(
                transaction.category,
              );
              const formatted = renderAmount(transaction.amount);

              return (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-full p-2 ${bg}`}>
                      <IconComponent className={`h-5 w-5 ${color}`} />
                    </div>
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {transaction.category} •{" "}
                        {new Date(transaction.date).toDateString()}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`font-medium ${
                      transaction.amount >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatted.formatted}
                  </span>
                </div>
              );
            })}
          </>
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className={`rounded-full p-2 ${CATEGORY_STYLES.default.bg}`}>
                <Plus className={`h-5 w-5 ${CATEGORY_STYLES.default.color}`} />
              </div>
              <div className="flex items-center justify-center">
                <span className="text-muted-foreground">
                  {t("dashboard.noTransactionsYet")}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
