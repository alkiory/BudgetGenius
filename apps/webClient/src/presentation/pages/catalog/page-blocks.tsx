import { CatalogBlock } from "@adapters/http/catalog.repository";
import {
  useContributeToSavings,
  useCreateBudget,
  useFetchBudgets,
} from "@adapters/query/dashboard";
import { useOverview } from "@adapters/query/reports/reportsQuery";
import { RootState } from "@adapters/store/rootStore";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  FileText,
  Info,
  Link2,
  PiggyBank,
  Plus,
  Send,
} from "@presentation/components/ui/animated-icons";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { resolveMediaUrl } from "@infrastructure/media-url";
import { RoutePaths } from "@presentation/utils/routes";
import { useMemo, useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router";

/** Name of the savings budget the planner creates and later recognises. */
const EMERGENCY_GOAL = "Fondo de emergencia";

/** Calendar date in the user's timezone (never the UTC day). */
const localIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const inner =
  "rounded-lg border border-slate-200/80 bg-white/60 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]";

const str = (value: unknown): string =>
  typeof value === "string" ? value : "";

const rows = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object",
      )
    : [];

/** Only same-app paths, http(s) and mailto links ever become anchors. */
const safeHref = (value: string): string | null => {
  const href = value.trim();
  if (!href) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return href;
  return null;
};

function Title({ children }: { children: string }) {
  if (!children) return null;
  return (
    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
      {children}
    </h3>
  );
}

const CALLOUT_TONES: Record<
  string,
  { box: string; icon: string; Icon: typeof Info }
> = {
  info: {
    box: "border-sky-400/30 bg-sky-500/[0.08] text-sky-800 dark:text-sky-100",
    icon: "text-sky-500 dark:text-sky-300",
    Icon: Info,
  },
  success: {
    box: "border-emerald-400/30 bg-emerald-500/[0.08] text-emerald-800 dark:text-emerald-100",
    icon: "text-emerald-500 dark:text-emerald-300",
    Icon: CheckCircle2,
  },
  warning: {
    box: "border-amber-400/30 bg-amber-500/[0.08] text-amber-800 dark:text-amber-100",
    icon: "text-amber-500 dark:text-amber-300",
    Icon: AlertTriangle,
  },
  critical: {
    box: "border-rose-400/30 bg-rose-500/[0.08] text-rose-800 dark:text-rose-100",
    icon: "text-rose-500 dark:text-rose-300",
    Icon: AlertTriangle,
  },
};

function Callout({ props }: { props: Record<string, unknown> }) {
  const tone = CALLOUT_TONES[str(props.tone)] ?? CALLOUT_TONES.info;
  const title = str(props.title);
  const body = str(props.body);
  if (!title && !body) return null;
  return (
    <div className={`flex gap-3 rounded-lg border p-4 ${tone.box}`}>
      <tone.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.icon}`} />
      <div className="min-w-0">
        <Title>{title}</Title>
        {body && (
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
            {body}
          </p>
        )}
      </div>
    </div>
  );
}

function Stats({ props }: { props: Record<string, unknown> }) {
  const items = rows(props.items).filter(
    (item) => str(item.label) && str(item.value),
  );
  if (!items.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={`${str(item.label)}-${index}`}
          className={`${inner} flex flex-col justify-between`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            {str(item.label)}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {str(item.value)}
          </p>
          {str(item.hint) && (
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {str(item.hint)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function Steps({ props }: { props: Record<string, unknown> }) {
  const title = str(props.title);
  const items = rows(props.items).filter((item) => str(item.title));
  if (!title && !items.length) return null;
  return (
    <div className={inner}>
      <Title>{title}</Title>
      <ol className="mt-3 space-y-3">
        {items.map((item, index) => (
          <li key={`${str(item.title)}-${index}`} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-500/15 text-[11px] font-semibold text-teal-700 dark:text-teal-300">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {str(item.title)}
              </p>
              {str(item.body) && (
                <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {str(item.body)}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Checklist({ props }: { props: Record<string, unknown> }) {
  const title = str(props.title);
  const items = rows(props.items).filter((item) => str(item.label));
  if (!title && !items.length) return null;
  return (
    <div className={inner}>
      <Title>{title}</Title>
      <ul className="mt-3 space-y-2">
        {items.map((item, index) => (
          <li key={`${str(item.label)}-${index}`} className="flex gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-500 dark:text-teal-300" />
            <div className="min-w-0">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                {str(item.label)}
              </p>
              {str(item.hint) && (
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {str(item.hint)}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Links({ props }: { props: Record<string, unknown> }) {
  const title = str(props.title);
  const items = rows(props.items).filter(
    (item) => str(item.label) && safeHref(str(item.href)),
  );
  if (!title && !items.length) return null;
  return (
    <div className="space-y-3">
      <Title>{title}</Title>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item, index) => {
          const href = safeHref(str(item.href)) as string;
          const body: ReactNode = (
            <>
              <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-500 dark:text-teal-300" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                  {str(item.label)}
                </span>
                {str(item.description) && (
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {str(item.description)}
                  </span>
                )}
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" />
            </>
          );
          const className = `${inner} flex items-start gap-2.5 transition-colors hover:border-teal-400/40`;
          return href.startsWith("/") ? (
            <Link key={`${href}-${index}`} to={href} className={className}>
              {body}
            </Link>
          ) : (
            <a
              key={`${href}-${index}`}
              href={href}
              target="_blank"
              rel="noreferrer"
              className={className}
            >
              {body}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function Faq({ props }: { props: Record<string, unknown> }) {
  const title = str(props.title);
  const items = rows(props.items).filter((item) => str(item.question));
  if (!title && !items.length) return null;
  return (
    <div className={inner}>
      <Title>{title}</Title>
      <div className="mt-2 divide-y divide-slate-200/80 dark:divide-white/[0.08]">
        {items.map((item, index) => (
          <details
            key={`${str(item.question)}-${index}`}
            className="group py-2.5"
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-slate-800 marker:hidden dark:text-slate-100 [&::-webkit-details-marker]:hidden">
              <FileText className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1">{str(item.question)}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            {str(item.answer) && (
              <p className="mt-2 whitespace-pre-line pl-6 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {str(item.answer)}
              </p>
            )}
          </details>
        ))}
      </div>
    </div>
  );
}

function Cta({ props }: { props: Record<string, unknown> }) {
  const title = str(props.title);
  const body = str(props.body);
  const actionLabel = str(props.actionLabel);
  const href = safeHref(str(props.actionHref));
  if (!title && !body) return null;
  return (
    <div className="relative overflow-hidden rounded-lg border border-teal-400/30 bg-teal-500/[0.07] p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full bg-teal-400/20 blur-2xl"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Title>{title}</Title>
          {body && (
            <p className="mt-1 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {body}
            </p>
          )}
        </div>
        {actionLabel &&
          href &&
          (href.startsWith("/") ? (
            <Link
              to={href}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
            >
              <Send className="h-3.5 w-3.5" />
              {actionLabel}
            </Link>
          ) : (
            <a
              href={href}
              target={href.startsWith("mailto:") ? undefined : "_blank"}
              rel={href.startsWith("mailto:") ? undefined : "noreferrer"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
            >
              <Send className="h-3.5 w-3.5" />
              {actionLabel}
            </a>
          ))}
      </div>
    </div>
  );
}

function Image({ props }: { props: Record<string, unknown> }) {
  const safe = safeHref(str(props.src));
  // `/api/media/…` is an upload served by the API; mailto is never an image.
  if (!safe || safe.startsWith("mailto:")) return null;
  const src = resolveMediaUrl(safe);
  const alt = str(props.alt);
  return (
    <figure className="overflow-hidden rounded-lg border border-slate-200/80 dark:border-white/[0.08]">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="h-auto w-full object-cover"
      />
      {str(props.caption) && (
        <figcaption className="border-t border-slate-200/80 bg-white/60 px-4 py-2 text-xs text-slate-500 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-400">
          {str(props.caption)}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * A live emergency-fund planner.
 *
 * The page is authored in the backoffice, but this block is a tool: it reads
 * the account's own expenses for the last quarter, proposes the monthly figure
 * and lets the reader change it and their current savings. The result is the
 * 3- and 6-month cushion, with a direct way to create the savings budget.
 */
function EmergencyFund({ props }: { props: Record<string, unknown> }) {
  const { t } = useTranslation();
  const settings = useSelector(
    (state: RootState) => state.userSettings.settings,
  );
  const currency = (settings?.currency || "EUR") as Currency;
  const money = (value: number) =>
    currencyService.formatCurrency(value, currency, false).formatted;

  // Last six calendar months, the window this planner averages over. Only
  // months with expenses count, so an uneven history still yields a figure.
  // The API treats `end` as exclusive, so pass tomorrow: passing today used
  // to drop today's (and the last day of the range's) transactions. Building
  // the strings locally avoids the UTC shift that pulled in the previous
  // month's last day east of UTC.
  const range = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { start: localIsoDate(start), end: localIsoDate(end) };
  }, []);
  const { data } = useOverview(range);
  const monthsWithExpenses = useMemo(
    () =>
      (Array.isArray(data)
        ? (data as Array<Record<string, unknown>>)
        : []
      ).filter((row) => Number(row.expenses) > 0),
    [data],
  );
  const typical = monthsWithExpenses.length
    ? monthsWithExpenses.reduce(
        (sum, row) => sum + Number(row.expenses || 0),
        0,
      ) / monthsWithExpenses.length
    : 0;

  const [monthlyInput, setMonthlyInput] = useState("");
  const [savedInput, setSavedInput] = useState("");
  const [contribution, setContribution] = useState("");
  const [contributionDate, setContributionDate] = useState(() =>
    localIsoDate(new Date()),
  );
  // Money inputs accept the user's decimal comma, like every other form.
  const parseMoney = (value: string): number => {
    const parsed = currencyService.parseAmountInput(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const monthly =
    monthlyInput === ""
      ? Math.round(typical)
      : Math.max(0, parseMoney(monthlyInput));
  const minimum = monthly * 3;
  const solid = monthly * 6;

  // The goal lives in the real budgets feature: creating it here means the
  // user can open Presupuestos and add money to it like any other goal.
  const { data: budgets, isLoading: budgetsLoading } = useFetchBudgets();
  const createGoal = useCreateBudget();
  const contribute = useContributeToSavings();
  const [justCreated, setJustCreated] = useState(false);
  // Find the goal by its savings nature, not only by its original name: a
  // renamed goal must stay linked instead of being recreated as a duplicate.
  const savingsBudgets = (budgets ?? []).filter(
    (budget) => budget.type === "savings",
  );
  const existingGoal =
    savingsBudgets.find(
      (budget) =>
        budget.name === EMERGENCY_GOAL ||
        budget.categories?.some((category) => category.name === EMERGENCY_GOAL),
    ) ?? (savingsBudgets.length === 1 ? savingsBudgets[0] : undefined);
  const goalCategory =
    existingGoal?.categories?.find(
      (category) => category.name === EMERGENCY_GOAL,
    ) ?? existingGoal?.categories?.[0];
  const goalReady = Boolean(existingGoal) || justCreated;
  // An existing budget is the single source of truth for how much is saved:
  // deposits made in Presupuestos (or here) show up without re-entering it.
  const saved = existingGoal
    ? Math.max(0, Number(goalCategory?.spent ?? existingGoal.totalSpent ?? 0))
    : Math.max(0, parseMoney(savedInput));
  const goalTarget = existingGoal
    ? Number(existingGoal.totalAllocated) || solid
    : solid;
  const covered = monthly > 0 ? saved / monthly : 0;
  const progress =
    goalTarget > 0 ? Math.min(100, Math.round((saved / goalTarget) * 100)) : 0;
  const title = str(props.title);
  const body = str(props.body);
  const budgetsHref = `${RoutePaths.App}/${RoutePaths.Budgets}`;

  const createEmergencyGoal = () => {
    if (goalReady || createGoal.isPending || solid <= 0) return;
    const start = new Date();
    const end = new Date(
      start.getFullYear() + 1,
      start.getMonth(),
      start.getDate(),
    );
    createGoal.mutate(
      {
        name: EMERGENCY_GOAL,
        period: "Yearly",
        type: "savings",
        startDate: start,
        endDate: end,
        totalAllocated: solid,
        totalSpent: saved,
        categories: [
          {
            budgetId: 0,
            name: EMERGENCY_GOAL,
            allocated: solid,
            spent: saved,
            manualSpent: saved,
          },
        ],
      },
      {
        onSuccess: () => {
          setJustCreated(true);
          toast.success(
            t("catalog.emergencyFund.goalCreated", { amount: money(solid) }),
          );
        },
        onError: () => toast.error(t("catalog.emergencyFund.goalError")),
      },
    );
  };

  /**
   * One API call adds the deposit to the goal and writes its ledger
   * transaction with the chosen date, so both always agree.
   */
  const contributeToGoal = () => {
    const amount = Math.round(parseMoney(contribution) * 100) / 100;
    if (
      !goalCategory?.id ||
      amount <= 0 ||
      !contributionDate ||
      contribute.isPending
    )
      return;
    contribute.mutate(
      {
        categoryId: Number(goalCategory.id),
        amount,
        date: contributionDate,
        description: t("catalog.emergencyFund.transactionDescription"),
      },
      {
        onSuccess: () => {
          setContribution("");
          toast.success(
            t("catalog.emergencyFund.contributed", { amount: money(amount) }),
          );
        },
        onError: () =>
          toast.error(t("catalog.emergencyFund.contributionError")),
      },
    );
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-teal-400/30 bg-gradient-to-br from-teal-500/[0.09] via-transparent to-sky-500/[0.06] p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-14 -top-20 h-44 w-44 rounded-full bg-teal-400/20 blur-3xl"
      />
      <div className="relative space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 text-teal-600 ring-1 ring-inset ring-teal-500/25 dark:text-teal-300">
            <PiggyBank className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <Title>{title || t("catalog.emergencyFund.title")}</Title>
            {body && (
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {body}
              </p>
            )}
          </div>
        </div>

        {typical > 0 ? (
          <p className="rounded-lg border border-teal-400/25 bg-white/50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
            {t("catalog.emergencyFund.detected", {
              amount: money(typical),
              count: monthsWithExpenses.length,
            })}
          </p>
        ) : (
          <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
            {t("catalog.emergencyFund.noData")}{" "}
            <Link
              to={`${RoutePaths.App}/${RoutePaths.Transactions}`}
              className="font-semibold underline underline-offset-2"
            >
              {t("catalog.emergencyFund.noDataCta")}
            </Link>
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
              {t("catalog.emergencyFund.monthlyLabel")}
            </span>
            <input
              inputMode="decimal"
              value={monthlyInput}
              onChange={(event) => setMonthlyInput(event.target.value)}
              placeholder={String(Math.round(typical))}
              className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-teal-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
            />
            <span className="block text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
              {t("catalog.emergencyFund.monthlyHint")}
            </span>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
              {t("catalog.emergencyFund.savedLabel")}
            </span>
            {existingGoal ? (
              <p className="rounded-lg border border-teal-400/25 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-900 dark:bg-white/[0.04] dark:text-white">
                {money(saved)}
              </p>
            ) : (
              <input
                inputMode="decimal"
                value={savedInput}
                onChange={(event) => setSavedInput(event.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-teal-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
              />
            )}
            <span className="block text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
              {existingGoal
                ? t("catalog.emergencyFund.savedSynced")
                : t("catalog.emergencyFund.savedHint")}
            </span>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200/80 bg-white/60 p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              {t("catalog.emergencyFund.minimumLabel")}
            </p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {money(minimum)}
            </p>
          </div>
          <div className="rounded-lg border border-teal-400/30 bg-teal-500/[0.07] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-300">
              {existingGoal
                ? t("catalog.emergencyFund.goalLabel")
                : t("catalog.emergencyFund.solidLabel")}
            </p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {money(goalTarget)}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>
              {existingGoal
                ? t("catalog.emergencyFund.goalProgressLabel")
                : t("catalog.emergencyFund.progressLabel")}
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {t("catalog.emergencyFund.covered", {
                months: covered.toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                }),
              })}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-teal-500 transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {existingGoal && (
          <div className="rounded-lg border border-teal-400/25 bg-white/50 p-3 dark:bg-white/[0.04]">
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 space-y-1">
                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  {t("catalog.emergencyFund.contributionLabel")}
                </span>
                <input
                  inputMode="decimal"
                  value={contribution}
                  onChange={(event) => setContribution(event.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-teal-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  {t("catalog.emergencyFund.contributionDate")}
                </span>
                <input
                  type="date"
                  value={contributionDate}
                  max={localIsoDate(new Date())}
                  onChange={(event) => setContributionDate(event.target.value)}
                  className="min-w-[9.5rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-teal-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                />
              </label>
              <button
                type="button"
                onClick={contributeToGoal}
                disabled={
                  contribute.isPending ||
                  !(parseMoney(contribution) > 0) ||
                  !contributionDate
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-500/10 px-3.5 py-2 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:text-teal-300"
              >
                <Plus className="h-3.5 w-3.5" />
                {contribute.isPending
                  ? t("catalog.emergencyFund.contributing")
                  : t("catalog.emergencyFund.contribute")}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
              {t("catalog.emergencyFund.contributionHint")}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {goalReady ? (
            <Link
              to={budgetsHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t("catalog.emergencyFund.viewGoal")}
            </Link>
          ) : (
            <button
              type="button"
              onClick={createEmergencyGoal}
              disabled={createGoal.isPending || budgetsLoading || solid <= 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
            >
              <PiggyBank className="h-3.5 w-3.5" />
              {createGoal.isPending
                ? t("catalog.emergencyFund.creatingGoal")
                : t("catalog.emergencyFund.createGoal")}
            </button>
          )}
          <Link
            to={`${RoutePaths.App}/${RoutePaths.Transactions}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-teal-400/50 hover:text-teal-700 dark:border-white/10 dark:text-slate-300 dark:hover:text-teal-300"
          >
            {t("catalog.emergencyFund.addExpense")}
          </Link>
        </div>

        {goalReady && (
          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t("catalog.emergencyFund.goalExists", {
              amount: money(goalTarget),
            })}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Renders the blocks authored in the backoffice, in their saved order.
 *
 * Each block is a small, self-contained surface: the page only decides where
 * it goes. Unknown block types render nothing (the save path rejects them), so
 * a future block type cannot break an older client.
 */
export function PageBlocks({ blocks }: { blocks: CatalogBlock[] }) {
  if (!blocks.length) return null;
  return (
    <div className="mt-3 space-y-3">
      {blocks.map((block) => {
        switch (block.type) {
          case "callout":
            return <Callout key={block.id} props={block.props} />;
          case "stats":
            return <Stats key={block.id} props={block.props} />;
          case "steps":
            return <Steps key={block.id} props={block.props} />;
          case "checklist":
            return <Checklist key={block.id} props={block.props} />;
          case "links":
            return <Links key={block.id} props={block.props} />;
          case "faq":
            return <Faq key={block.id} props={block.props} />;
          case "cta":
            return <Cta key={block.id} props={block.props} />;
          case "image":
            return <Image key={block.id} props={block.props} />;
          case "emergency-fund":
            return <EmergencyFund key={block.id} props={block.props} />;
          case "divider":
            return (
              <hr
                key={block.id}
                className="border-slate-200/80 dark:border-white/[0.08]"
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
