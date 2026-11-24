import { useUserSettings } from "@adapters/hooks/useUserSettings";
import {
  useFetchBudgets,
  useFetchDashboard,
  useFetchExpenseCategories,
} from "@adapters/query/dashboard";
import api from "@infrastructure/api.config";
import { BrandDots } from "@presentation/components/loader";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  KeyRound,
  PiggyBank,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/** Set when the API reports a problem with Finny's own key, so the rail can
 * explain the fix instead of pretending the model failed. */
type SetupIssue = "missing" | "invalid";

/**
 * Right-hand “Finny” rail — the rebranded replacement for the reference
 * design's “AI Insights” column. Insights are derived from the same
 * React Query caches the dashboard already uses, and the composer talks
 * to the existing authenticated `POST /ai/analysis` endpoint. The agent
 * token never reaches the browser: it stays in the API process.
 */
export function FinnyRail() {
  const { t } = useTranslation();
  const settings = useUserSettings();
  const currency = (settings?.currency || "EUR") as Currency;

  const { data: overview } = useFetchDashboard();
  const { data: budgets } = useFetchBudgets();
  const { data: breakdown } = useFetchExpenseCategories();

  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [setupIssue, setSetupIssue] = useState<SetupIssue | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isOffline = setupIssue !== null;

  const overBudget = useMemo(
    () =>
      (budgets ?? []).filter(
        (budget) =>
          budget.type !== "savings" &&
          budget.totalSpent > budget.totalAllocated,
      ),
    [budgets],
  );

  const savingsRate = useMemo(() => {
    const income = overview?.income ?? 0;
    if (!income) return 0;
    return Math.round(((income - (overview?.expenses ?? 0)) / income) * 100);
  }, [overview]);

  const topCategory = breakdown?.largest;

  const topCategoryAmount = currencyService.formatCurrency(
    topCategory?.value ?? 0,
    currency,
    false,
  ).formatted;

  const mutation = useMutation({
    mutationFn: async (text: string) => {
      const { data } = await api.post<string>("/ai/analysis", {
        prompt: text,
        context: {
          balance: overview?.balance ?? 0,
          income: overview?.income ?? 0,
          expenses: overview?.expenses ?? 0,
          topCategory: topCategory?.name ?? null,
          totalSpent: breakdown?.total ?? 0,
          budgets: (budgets ?? []).map((budget) => ({
            name: budget.name,
            type: budget.type,
            spent: budget.totalSpent,
            allocated: budget.totalAllocated,
          })),
        },
      });
      return data;
    },
    onSuccess: (reply) => {
      setSetupIssue(null);
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            typeof reply === "string" && reply.trim().length > 0
              ? reply
              : t("finny.error"),
        },
      ]);
    },
    onError: (error: unknown) => {
      const code = (error as { response?: { data?: { code?: string } } })
        .response?.data?.code;
      if (code === "FINNY_NOT_CONFIGURED" || code === "FINNY_INVALID_KEY") {
        setSetupIssue(code === "FINNY_NOT_CONFIGURED" ? "missing" : "invalid");
        return;
      }
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: t("finny.error") },
      ]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, mutation.isPending]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || mutation.isPending || isOffline) return;

    setMessages((previous) => [...previous, { role: "user", content: text }]);
    setPrompt("");
    mutation.mutate(text);
  };

  // Recovery path: after rotating AGENT_API_KEY the rail was stuck
  // offline. Retrying clears the banner, re-enables the composer and, when
  // there is a previous question, sends it again.
  const handleRetry = () => {
    if (mutation.isPending) return;
    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");
    setSetupIssue(null);
    if (lastUserMessage) mutation.mutate(lastUserMessage.content);
  };

  return (
    <aside className="finny-rail sticky top-0 z-10 hidden h-screen w-[21rem] shrink-0 flex-col border-l xl:flex">
      <header className="flex items-center gap-3 border-b border-slate-200/80 px-5 py-5 dark:border-white/[0.07]">
        <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal-400/25 to-cyan-500/20 ring-1 ring-inset ring-teal-400/30">
          <Sparkles className="h-5 w-5 text-teal-500 dark:text-teal-300" />
          <span
            className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[#070d18] ${
              isOffline ? "bg-amber-400" : "bg-emerald-400"
            }`}
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
              {t("finny.title")}
            </h2>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                isOffline
                  ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  : "border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300"
              }`}
            >
              {isOffline ? t("finny.setup.badge") : t("finny.online")}
            </span>
          </div>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {t("finny.subtitle")}
          </p>
        </div>
      </header>

      {setupIssue && (
        <div className="mx-4 mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex items-start gap-2.5">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                {t(`finny.setup.${setupIssue}.title`)}
              </p>
              <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-200/80">
                {t(`finny.setup.${setupIssue}.body`)}
              </p>
              <code className="inline-block rounded bg-slate-900/5 px-1.5 py-0.5 font-mono text-[10px] text-amber-800 dark:bg-white/10 dark:text-amber-100">
                apps/api/.env · AGENT_API_KEY
              </code>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={mutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-200"
                >
                  {mutation.isPending ? (
                    <BrandDots size="sm" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  {t("finny.setup.retry")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
          {t("finny.insightsTitle")}
        </p>

        <FinnyInsight
          tone={overBudget.length > 0 ? "amber" : "teal"}
          icon={overBudget.length > 0 ? AlertTriangle : TrendingUp}
          title={
            overBudget.length > 0
              ? t("finny.budgetRisk", { count: overBudget.length })
              : t("finny.onTrack")
          }
          description={
            overBudget.length > 0
              ? overBudget
                  .slice(0, 2)
                  .map((budget) => budget.name)
                  .join(" · ")
              : t("finny.onTrackDesc")
          }
        />

        <FinnyInsight
          tone="cyan"
          icon={ArrowUpRight}
          title={t("finny.topCategory", {
            category: topCategory?.name ?? t("common.noData"),
          })}
          description={t("finny.topCategoryDesc", {
            amount: topCategoryAmount,
          })}
        />

        <FinnyInsight
          tone={savingsRate >= 0 ? "teal" : "rose"}
          icon={PiggyBank}
          title={t("finny.savings", { rate: savingsRate })}
          description={t("finny.savingsDesc")}
        />

        {messages.length > 0 && (
          <div className="space-y-2.5 pt-2">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              {t("finny.conversation")}
            </p>
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={
                  message.role === "user"
                    ? "ml-6 rounded-xl rounded-br-sm border border-teal-500/25 bg-teal-500/10 px-3 py-2 text-xs leading-relaxed text-slate-700 dark:text-teal-50"
                    : "mr-2 rounded-xl rounded-bl-sm border border-slate-200 bg-white/80 px-3 py-2 text-xs leading-relaxed text-slate-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300"
                }
              >
                {message.content}
              </div>
            ))}
            {mutation.isPending && (
              <div className="mr-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-400">
                <BrandDots
                  size="sm"
                  className="text-teal-600 dark:text-teal-300"
                />
                {t("finny.thinking")}
              </div>
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-200/80 p-4 dark:border-white/[0.07]"
      >
        <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white/80 p-2 transition focus-within:border-teal-400/50 focus-within:shadow-[0_0_0_3px_rgb(45_212_191_/_0.1)] dark:border-white/10 dark:bg-white/[0.035]">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={2}
            disabled={isOffline}
            placeholder={
              isOffline ? t("finny.setup.placeholder") : t("finny.ask")
            }
            className="max-h-28 min-h-[2.5rem] flex-1 resize-none bg-transparent px-1 py-1 text-xs leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={!prompt.trim() || mutation.isPending || isOffline}
            aria-busy={mutation.isPending}
            aria-label={t("finny.send")}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-teal-400 to-cyan-500 text-slate-950 shadow-[0_0_20px_-6px_rgb(45_212_191_/_0.9)] transition hover:brightness-110 disabled:cursor-not-allowed ${
              mutation.isPending ? "" : "disabled:opacity-40"
            }`}
          >
            {mutation.isPending ? (
              <BrandDots size="sm" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-2 px-1 text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
          {t("finny.disclaimer")}
        </p>
      </form>
    </aside>
  );
}

function FinnyInsight({
  icon: Icon,
  title,
  description,
  tone,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  tone: "teal" | "cyan" | "amber" | "rose";
}) {
  const toneClasses = {
    teal: "border-teal-500/25 bg-teal-500/10 text-teal-600 dark:text-teal-300",
    cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300",
    amber:
      "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    rose: "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300",
  };

  return (
    <div className="glow-row group rounded-xl border border-slate-200/80 bg-white/60 p-3 dark:border-white/[0.07] dark:bg-white/[0.025]">
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${toneClasses[tone]}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-snug text-slate-800 dark:text-slate-100">
            {title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
