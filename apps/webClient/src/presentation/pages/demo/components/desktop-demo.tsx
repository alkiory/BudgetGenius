import {
  BarChart3,
  Calendar,
  ChevronDown,
  CreditCard,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useTranslation } from "react-i18next";

export function DesktopDemo() {
  const { t } = useTranslation();
  return (
    <div className="w-full max-w-5xl">
      <div className="rounded-lg border p-6 shadow-xl bg-card dark:bg-card">
        <h3 className="mb-4 text-xl font-bold text-primary dark:text-neutral">
          {t("demo.desktopExperience")}
        </h3>
        <p className="mb-6 text-muted-foreground">
          {t("demo.desktopExperienceDesc")}
        </p>

        {/* App Preview */}
        <div className="mt-16 rounded-lg border p-4 shadow-xl bg-background">
          <div className="flex items-center justify-between mb-4 px-2 dark:text-slate-100">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-purple-600" />
              <span className="font-semibold text-lg dark:text-white">
                Budget Genius Dashboard
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-sm bg-slate-100 px-3 py-1 rounded-full dark:bg-slate-700">
                <Calendar className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span>April 2023</span>
                <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              </div>
              <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 dark:bg-purple-900 dark:text-purple-300 font-medium">
                JD
              </div>
            </div>
          </div>

          <div className="aspect-[16/9] overflow-hidden rounded-md bg-slate-50 dark:bg-slate-900">
            <div className="grid h-full grid-cols-3 gap-4 p-6">
              <div className="col-span-2 rounded-md bg-white p-4 shadow-sm dark:bg-slate-800 dark:text-slate-100">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {t("demo.monthlyOverview")}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t("demo.incomeVsExpenses")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <div className="h-3 w-3 rounded-full bg-purple-500"></div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {t("demo.income")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-3 w-3 rounded-full bg-cyan-400"></div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {t("demo.expenses")}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="h-[220px] rounded-md bg-slate-50 p-4 relative dark:bg-slate-900">
                  {/* Chart grid lines */}
                  <div className="absolute inset-x-4 inset-y-4 grid grid-rows-4 gap-y-[calc((100%-16px)/4)]">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="border-t border-slate-200 -mt-px dark:border-slate-700"
                      ></div>
                    ))}
                  </div>

                  {/* Y-axis labels */}
                  <div className="absolute left-0 inset-y-4 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400">$6k</span>
                    <span className="text-[10px] text-slate-400">$4.5k</span>
                    <span className="text-[10px] text-slate-400">$3k</span>
                    <span className="text-[10px] text-slate-400">$1.5k</span>
                    <span className="text-[10px] text-slate-400">$0</span>
                  </div>

                  {/* X-axis labels */}
                  <div className="absolute bottom-0 inset-x-4 flex justify-between">
                    {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"].map(
                      (month) => (
                        <span
                          key={month}
                          className="text-[10px] text-slate-400"
                        >
                          {month}
                        </span>
                      ),
                    )}
                  </div>

                  {/* Chart bars */}
                  <div className="absolute inset-x-4 bottom-6 top-4 flex items-end justify-between">
                    {/* Each month has two bars - income and expenses */}
                    <div className="flex gap-1">
                      <div
                        className="w-4 rounded-t bg-purple-500"
                        style={{ height: "40%" }}
                      ></div>
                      <div
                        className="w-4 rounded-t bg-cyan-400"
                        style={{ height: "30%" }}
                      ></div>
                    </div>
                    <div className="flex gap-1">
                      <div
                        className="w-4 rounded-t bg-purple-500"
                        style={{ height: "50%" }}
                      ></div>
                      <div
                        className="w-4 rounded-t bg-cyan-400"
                        style={{ height: "45%" }}
                      ></div>
                    </div>
                    <div className="flex gap-1">
                      <div
                        className="w-4 rounded-t bg-purple-500"
                        style={{ height: "60%" }}
                      ></div>
                      <div
                        className="w-4 rounded-t bg-cyan-400"
                        style={{ height: "50%" }}
                      ></div>
                    </div>
                    <div className="flex gap-1">
                      <div
                        className="w-4 rounded-t bg-purple-500"
                        style={{ height: "75%" }}
                      ></div>
                      <div
                        className="w-4 rounded-t bg-cyan-400"
                        style={{ height: "55%" }}
                      ></div>
                    </div>
                    <div className="flex gap-1">
                      <div
                        className="w-4 rounded-t bg-purple-500"
                        style={{ height: "65%" }}
                      ></div>
                      <div
                        className="w-4 rounded-t bg-cyan-400"
                        style={{ height: "60%" }}
                      ></div>
                    </div>
                    <div className="flex gap-1">
                      <div
                        className="w-4 rounded-t bg-purple-500"
                        style={{ height: "80%" }}
                      ></div>
                      <div
                        className="w-4 rounded-t bg-cyan-400"
                        style={{ height: "65%" }}
                      ></div>
                    </div>
                    <div className="flex gap-1">
                      <div
                        className="w-4 rounded-t bg-purple-500"
                        style={{ height: "90%" }}
                      ></div>
                      <div
                        className="w-4 rounded-t bg-cyan-400"
                        style={{ height: "70%" }}
                      ></div>
                    </div>
                  </div>

                  {/* Highlight for current month */}
                  <div className="absolute right-[calc(12.5%-8px)] bottom-0 h-1.5 w-10 bg-purple-600 rounded"></div>
                </div>
                {/* Recent Transactions */}{" "}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">
                      {t("dashboard.recentTransactions")}
                    </h4>
                    <button className="text-xs text-purple-600 hover:underline dark:text-purple-400">
                      {t("common.viewAll")}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center dark:bg-red-900">
                          <CreditCard className="h-4 w-4 text-red-500 dark:text-red-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Grocery Store</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Apr 12, 2023
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-red-500 dark:text-red-400">
                        -$84.32
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center dark:bg-green-900">
                          <DollarSign className="h-4 w-4 text-green-500 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Salary Deposit</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Apr 10, 2023
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-green-500 dark:text-green-400">
                        +$2,750.00
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 dark:text-slate-100">
                {/* Monthly Summary Card */}
                <div className="rounded-md bg-white p-4 shadow-sm dark:bg-slate-800">
                  <h3 className="mb-3 font-semibold flex items-center justify-between">
                    <span>{t("demo.monthlySummary")}</span>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center dark:bg-green-900">
                          <TrendingUp className="h-4 w-4 text-green-500 dark:text-green-400" />
                        </div>
                        <span className="text-sm">{t("demo.income")}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">$5,240</span>
                        <ArrowUpRight className="h-3 w-3 text-green-500 dark:text-green-400" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center dark:bg-red-900">
                          <ArrowDownRight className="h-4 w-4 text-red-500 dark:text-red-400" />
                        </div>
                        <span className="text-sm">{t("demo.expenses")}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">$3,890</span>
                        <ArrowUpRight className="h-3 w-3 text-red-500 dark:text-red-400" />
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {t("common.balance")}
                        </span>
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          +$1,350
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Budget Card */}
                <div className="rounded-md bg-white p-4 shadow-sm dark:bg-slate-800">
                  {" "}
                  <h3 className="mb-2 font-semibold flex items-center justify-between">
                    <span>{t("demo.budgetNav")}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {t("demo.percentUsed", { percent: 70 })}
                    </span>
                  </h3>
                  <div className="space-y-3">
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                      <div className="h-2 w-[70%] rounded-full bg-purple-500 relative">
                        <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white bg-purple-500 dark:border-slate-800"></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>$0</span>
                      <span>$2,000</span>
                    </div>
                    <div className="pt-1">
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        $1,400 spent of $2,000 monthly budget
                      </p>
                    </div>{" "}
                    <button className="w-full text-center text-xs text-purple-600 hover:underline dark:text-purple-400">
                      {t("demo.adjustBudget")}
                    </button>
                  </div>
                </div>

                {/* Savings Card */}
                <div className="rounded-md bg-white p-4 shadow-sm dark:bg-slate-800">
                  {" "}
                  <h3 className="mb-2 font-semibold">{t("savings.title")}</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Vacation</p>
                        <div className="mt-1 h-1.5 w-32 rounded-full bg-slate-100 dark:bg-slate-700">
                          <div className="h-1.5 w-[80%] rounded-full bg-green-500"></div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          80%
                        </span>
                        <p className="text-sm font-medium">$4,000/$5,000</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">New Car</p>
                        <div className="mt-1 h-1.5 w-32 rounded-full bg-slate-100 dark:bg-slate-700">
                          <div className="h-1.5 w-[45%] rounded-full bg-amber-500"></div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          45%
                        </span>
                        <p className="text-sm font-medium">$9,000/$20,000</p>
                      </div>
                    </div>{" "}
                    <button className="flex items-center justify-center w-full text-xs text-purple-600 hover:underline gap-1 mt-1 dark:text-purple-400">
                      <Plus className="h-3 w-3" />
                      <span>{t("common.addNewGoal")}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-lg border shadow bg-slate-50 p-6 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
            <div className="mb-4 inline-grid h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
              <BarChart3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">
              {t("demo.comprehensiveDashboard")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("demo.comprehensiveDashboardDesc")}
            </p>
          </div>
          <div className="rounded-lg border shadow bg-slate-50 p-6 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
            <div className="mb-4 inline-grid h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
              <CreditCard className="h-5 w-5 text-primary-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">
              {t("demo.transactionTracking")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("demo.transactionTrackingDesc")}
            </p>
          </div>
          <div className="rounded-lg border shadow bg-slate-50 p-6 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
            <div className="mb-4 inline-grid h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">
              {t("demo.financialInsights")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("demo.financialInsightsDesc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
