import { useSuperAdminOverview } from "@adapters/query/superadmin";
import Loader from "@presentation/components/loader";
import { BarChart3 } from "@presentation/components/ui/animated-icons";
import { useTranslation } from "react-i18next";
import { panel } from "./shared";

const number = (value: number) => value.toLocaleString();

function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className={panel}>
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
        {value}
      </p>
      {note && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {note}
        </p>
      )}
    </div>
  );
}

export function OverviewTab() {
  const { t } = useTranslation();
  const { data, isLoading } = useSuperAdminOverview();

  if (isLoading) return <Loader />;
  if (!data) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {t("common.noData")}
      </p>
    );
  }

  const peak = Math.max(...data.activity.map((row) => row.transactions), 1);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("superadmin.overview.users")}
          value={number(data.users.total)}
          note={t("superadmin.overview.usersNote", {
            count: number(data.users.last30d),
          })}
        />
        <StatCard
          label={t("superadmin.overview.transactions")}
          value={number(data.transactions.total)}
          note={t("superadmin.overview.transactionsNote", {
            count: number(data.transactions.last24h),
          })}
        />
        <StatCard
          label={t("superadmin.overview.modules")}
          value={`${number(data.modules.active)} / ${number(
            data.modules.total,
          )}`}
          note={t("superadmin.overview.modulesBreakdown", {
            modules: number(data.modules.byKind.module),
            components: number(data.modules.byKind.component),
            integrations: number(data.modules.byKind.integration),
            pages: number(data.modules.byKind.page),
            tabs: number(data.modules.byKind.tab),
          })}
        />
        <StatCard
          label={t("superadmin.overview.apiKeys")}
          value={`${number(data.apiKeys.active)} / ${number(
            data.apiKeys.total,
          )}`}
          note={t("superadmin.overview.keysNote")}
        />
      </div>

      <div className={panel}>
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-teal-500 dark:text-teal-300" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t("superadmin.overview.activity")}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {t("superadmin.overview.activityHint")}
            </p>
          </div>
        </div>
        {data.activity.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("superadmin.overview.activityEmpty")}
          </p>
        ) : (
          <ul className="space-y-2">
            {data.activity.map((row) => (
              <li key={row.month} className="flex items-center gap-3 text-xs">
                <span className="w-16 shrink-0 font-medium text-slate-500 dark:text-slate-400">
                  {row.month}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/[0.07]">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-500"
                    style={{
                      width: `${Math.max(
                        (row.transactions / peak) * 100,
                        row.transactions > 0 ? 4 : 0,
                      )}%`,
                    }}
                  />
                </span>
                <span className="w-20 shrink-0 text-right text-slate-500 dark:text-slate-400">
                  {number(row.transactions)}{" "}
                  <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {t("superadmin.overview.movements")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
