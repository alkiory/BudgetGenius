import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  ChevronDown,
  CreditCard,
  DollarSign,
  Home,
  PieChart,
  Plus,
  Settings,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useTranslation } from "react-i18next";

export function MobileDemo() {
  const { t } = useTranslation();
  return (
    <div className="w-full max-w-md text-primary dark:text-neutral">
      <div className="rounded-lg border bg-card p-6 shadow-xl">
        <h3 className="mb-4 text-xl font-bold">{t("demo.mobileExperience")}</h3>
        <p className="mb-6 text-muted-foreground">
          {t("demo.mobileExperienceDesc")}
        </p>

        {/* Mobile App Preview */}
        <div className="mx-auto w-[320px] rounded-[32px] border-8 border-slate-800 bg-background p-2 shadow-xl">
          {/* Status Bar */}
          <div className="flex items-center justify-between px-4 py-2 text-xs">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-slate-800"></div>
              <div className="h-2 w-2 rounded-full bg-slate-800"></div>
              <div className="h-2 w-2 rounded-full bg-slate-800"></div>
            </div>
          </div>

          {/* App Header */}
          <div className="flex items-center justify-between border-b p-3 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <span className="font-semibold">{t("app.name")}</span>
            </div>
            <div className="h-7 w-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-medium dark:bg-purple-900 dark:text-purple-400">
              JD
            </div>
          </div>

          {/* App Content */}
          <div className="h-[500px] overflow-y-auto p-3">
            {/* Date Selector */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{t("sidebar.dashboard")}</h2>
              <div className="flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded-full dark:bg-slate-800">
                <Calendar className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                <span>April</span>
                <ChevronDown className="h-3 w-3 text-slate-500 dark:text-slate-400" />
              </div>
            </div>

            {/* Balance Card */}
            <div className="mb-4 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 p-4 text-white dark:from-purple-700 dark:to-indigo-800">
              <p className="text-xs text-white/80">{t("demo.totalBalance")}</p>
              <h3 className="mb-1 text-2xl font-bold">$4,250.00</h3>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" />
                  <span>Income: $5,240</span>
                </div>
                <div className="flex items-center gap-1">
                  <ArrowDownRight className="h-3 w-3" />
                  <span>Expenses: $3,890</span>
                </div>
              </div>
            </div>

            {/* Budget Progress */}
            <div className="mb-4 rounded-lg border bg-card p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium">{t("demo.monthlyBudget")}</h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t("demo.percentUsed", { percent: 70 })}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-2 w-[70%] rounded-full bg-purple-500 relative">
                  <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-purple-500 dark:border-slate-800"></div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>$0</span>
                <span>$1,400 of $2,000</span>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium">
                  {t("dashboard.recentTransactions")}
                </h3>
                <button className="text-xs text-purple-600 dark:text-purple-400">
                  {t("common.viewAll")}
                </button>
              </div>
              <div className="space-y-2">
                <div className="rounded-lg border bg-card p-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center dark:bg-red-900">
                        <CreditCard className="h-4 w-4 text-red-500 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Grocery Store</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Apr 12
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-red-500 dark:text-red-400">
                      -$84.32
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border bg-card p-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center dark:bg-green-900">
                        <DollarSign className="h-4 w-4 text-green-500 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Salary Deposit</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Apr 10
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-green-500 dark:text-green-400">
                      +$2,750.00
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border bg-card p-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center dark:bg-red-900">
                        <CreditCard className="h-4 w-4 text-red-500 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Coffee Shop</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Apr 9
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-red-500 dark:text-red-400">
                      -$4.50
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Savings Goals */}
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium">{t("savings.title")}</h3>
                <button className="text-xs text-purple-600 dark:text-purple-400">
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <div className="space-y-2">
                <div className="rounded-lg border bg-card p-2 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">Vacation</p>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      80%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                    <div className="h-1.5 w-[80%] rounded-full bg-green-500"></div>
                  </div>
                  <p className="mt-1 text-xs text-right text-slate-500 dark:text-slate-400">
                    $4,000/$5,000
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-2 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">New Car</p>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      45%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                    <div className="h-1.5 w-[45%] rounded-full bg-amber-500"></div>
                  </div>
                  <p className="mt-1 text-xs text-right text-slate-500 dark:text-slate-400">
                    $9,000/$20,000
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Navigation */}
          <div className="flex items-center justify-around border-t p-2 dark:border-slate-700">
            <button className="flex flex-col items-center text-purple-600 dark:text-purple-400">
              <Home className="h-5 w-5" />
              <span className="text-[10px]">{t("demo.home")}</span>
            </button>
            <button className="flex flex-col items-center text-slate-400">
              <PieChart className="h-5 w-5" />
              <span className="text-[10px]">{t("demo.budgetNav")}</span>
            </button>
            <button className="flex flex-col items-center text-slate-400">
              <BarChart3 className="h-5 w-5" />
              <span className="text-[10px]">{t("sidebar.reports")}</span>
            </button>
            <button className="flex flex-col items-center text-slate-400">
              <Settings className="h-5 w-5" />
              <span className="text-[10px]">{t("sidebar.settings")}</span>
            </button>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-4 shadow-sm bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
              <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="mb-1 text-base font-semibold">
              {t("demo.onTheGoAccess")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("demo.onTheGoAccessDesc")}
            </p>
          </div>
          <div className="rounded-lg border p-4 shadow-sm bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
              <Plus className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="mb-1 text-base font-semibold">
              {t("demo.quickAdd")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("demo.quickAddDesc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
