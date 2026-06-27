import { useLocale } from "@adapters/hooks/useLocale";
import {
  useFetchDashboard,
  useFetchExpenseCategories,
} from "@adapters/query/dashboard";
import { useGetSettings } from "@adapters/query/userQuery";
import { setSettingsAction } from "@adapters/slices/user-settings/settingsSlice";
import { RootState } from "@adapters/store/rootStore";
import { BudgetProgress } from "@presentation/components/dashboard/budget-progress";
import DashboardLoading from "@presentation/components/dashboard/dashboard-loading";
import { ExpenseCategories } from "@presentation/components/dashboard/expense-categories";
import { OverviewCard } from "@presentation/components/dashboard/overview/overview-card";
import { RecentTransactions } from "@presentation/components/dashboard/recent-transactions";
import { PageHeader } from "@presentation/components/ui/page-header";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

export default function DashboardPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);

  const { data: userSettings } = useGetSettings();

  const { data: overview, isLoading } = useFetchDashboard();

  const { data: breackdown, isLoading: isloadingExpenseCat } =
    useFetchExpenseCategories();

  const targetCurrency = (userSettings?.currency || "USD") as Currency;

  // Shared dashboard-wide locale. Reads `state.userSettings.settings.locale`
  // (BCP-47 tag) via the same `useLocale()` hook used by the four
  // sibling files, so the page and its five presentational children
  // cannot drift between two sources. `"en-US"` is the fallback while
  // the sync effect below runs on first render.
  const locale = useLocale();

  const formattedBalance = currencyService.formatCurrency(
    overview?.balance ?? 0,
    "USD" as Currency,
    targetCurrency,
  );

  const formattedExpences = currencyService.formatCurrency(
    overview?.expenses ?? 0,
    "USD" as Currency,
    targetCurrency,
    false,
  );

  const formattedIncome = currencyService.formatCurrency(
    overview?.income ?? 0,
    "USD" as Currency,
    targetCurrency,
    false,
  );

  const rawBreackdownCategories = breackdown?.byCategory;

  const rawBreackdownLargest = breackdown?.largest?.value
    ? {
        largest: {
          name: breackdown.largest.name,
          value: breackdown.largest.value,
        },
      }
    : {
        largest: {
          name: t("common.noData"),
          value: 0,
        },
      };

  const formattedBreackdown = {
    total: currencyService.formatCurrency(
      breackdown?.total ?? 0,
      "USD" as Currency,
      targetCurrency,
      false,
    ),
  };

  useEffect(() => {
    if (user && userSettings) {
      dispatch(setSettingsAction(userSettings));
    }
  }, [dispatch, user, userSettings]);

  if (isLoading || isloadingExpenseCat) {
    return <DashboardLoading />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.welcomeBack", { name: user?.name })}
      />

      <OverviewCard
        balance={formattedBalance.formatted}
        income={formattedIncome.formatted}
        expenses={formattedExpences.formatted}
        period={overview?.period ?? new Date()}
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="md:col-span-2 lg:col-span-2">
          <RecentTransactions />
        </div>

        <div className="md:col-span-1 lg:col-span-1">
          <BudgetProgress />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ExpenseCategories
          total={formattedBreackdown.total.formatted}
          byCategory={rawBreackdownCategories ?? []}
          largest={{
            name: rawBreackdownLargest?.largest.name,
            value: rawBreackdownLargest?.largest.value,
          }}
          timezone={userSettings?.timezone ?? "Europe/Paris"}
          period={breackdown?.period ?? new Date().toLocaleDateString(locale)}
        />
      </div>
    </div>
  );
}
