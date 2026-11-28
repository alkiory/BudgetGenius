import { useUserSettings } from "@adapters/hooks/useUserSettings";
import {
  useFetchBudgets,
  useFetchDashboard,
  useFetchExpenseCategories,
} from "@adapters/query/dashboard";
import api, { LONG_REQUEST_TIMEOUT_MS } from "@infrastructure/api.config";
import { BrandDots } from "@presentation/components/loader";
import {
  AlertTriangle,
  ArrowUpRight,
  KeyRound,
  Moon,
  PanelRightClose,
  PiggyBank,
  RefreshCw,
  Send,
  TrendingUp,
  X,
} from "@presentation/components/ui/animated-icons";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FinnyAvatar, FinnyMood } from "./finny-avatar";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/** Set when the API reports a problem with Finny's own key, so the rail can
 * explain the fix instead of pretending the model failed. */
type SetupIssue = "missing" | "invalid";

/** `GET /ai/status`: no provider call, just whether a usable key exists. */
type FinnyStatus = {
  available: boolean;
  reason:
    | "FINNY_NOT_CONFIGURED"
    | "FINNY_INVALID_KEY"
    | "FINNY_PROVIDER_ERROR"
    | null;
  checkedAt: string;
};

/**
 * The setup banner exposes server-side configuration (env file, key name), so
 * it is reserved for the app's super admin. There is no admin role or panel
 * yet; until it ships, every account gets the generic assistant error instead.
 * TODO: derive this from the signed-in super admin once the admin feature lands.
 */
const CAN_VIEW_FINNY_SETUP = false;

const DESKTOP_QUERY = "(min-width: 1280px)";

/** Persisted desktop launcher position, measured from the viewport corners. */
const LAUNCHER_POSITION_KEY = "bg_finny_launcher_position";
const DEFAULT_LAUNCHER_OFFSET: LauncherOffset = { right: 24, bottom: 24 };
const EDGE_MARGIN = 8;
/** How much of the launcher must stay on screen when it is clamped. */
const LAUNCHER_MIN_VISIBLE = 96;
/** Movement below this is a click, not a drag. */
const DRAG_THRESHOLD = 4;

type LauncherOffset = { right: number; bottom: number };

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  right: number;
  bottom: number;
  moved: boolean;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const clampOffset = (offset: LauncherOffset): LauncherOffset => ({
  right: clamp(
    offset.right,
    EDGE_MARGIN,
    Math.max(EDGE_MARGIN, window.innerWidth - LAUNCHER_MIN_VISIBLE),
  ),
  bottom: clamp(
    offset.bottom,
    EDGE_MARGIN,
    Math.max(EDGE_MARGIN, window.innerHeight - LAUNCHER_MIN_VISIBLE),
  ),
});

function readLauncherOffset(): LauncherOffset {
  if (typeof window === "undefined") return DEFAULT_LAUNCHER_OFFSET;
  try {
    const raw = window.localStorage.getItem(LAUNCHER_POSITION_KEY);
    if (!raw) return DEFAULT_LAUNCHER_OFFSET;
    const parsed = JSON.parse(raw) as Partial<LauncherOffset>;
    if (
      typeof parsed?.right !== "number" ||
      typeof parsed?.bottom !== "number"
    ) {
      return DEFAULT_LAUNCHER_OFFSET;
    }
    return clampOffset({ right: parsed.right, bottom: parsed.bottom });
  } catch {
    return DEFAULT_LAUNCHER_OFFSET;
  }
}

function writeLauncherOffset(offset: LauncherOffset): void {
  try {
    window.localStorage.setItem(LAUNCHER_POSITION_KEY, JSON.stringify(offset));
  } catch {
    // Storage unavailable: the position simply does not survive a reload.
  }
}

/** Matches the `xl` breakpoint at which the rail stops being a sheet. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const handleChange = () => setIsDesktop(media.matches);
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  return isDesktop;
}

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
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  const [activeInsightIndex, setActiveInsightIndex] = useState(0);
  const [isHoveringCollapsed, setIsHoveringCollapsed] = useState(false);
  const isDesktop = useIsDesktop();
  const scrollRef = useRef<HTMLDivElement>(null);
  const launchTimerRef = useRef<number | null>(null);
  const [launcherOffset, setLauncherOffset] =
    useState<LauncherOffset>(readLauncherOffset);
  const dragRef = useRef<DragState | null>(null);
  /** Timestamp until which a click means "the drag just ended", not "open". */
  const suppressLaunchUntilRef = useRef(0);

  /**
   * Finny's readiness is asked for up front. The rail used to look dead only
   * after a prompt failed; knowing beforehand lets it sleep visibly and
   * explain itself instead of collecting questions it cannot answer.
   */
  const {
    data: aiStatus,
    refetch: refetchStatus,
    isFetching: isCheckingStatus,
  } = useQuery({
    queryKey: ["ai", "status"],
    queryFn: async () =>
      (await api.get<FinnyStatus>("/ai/status")).data as FinnyStatus,
    staleTime: 60_000,
    // While asleep, look again once a minute: a rotated key wakes it up.
    refetchInterval: (query) =>
      query.state.data?.available === false ? 60_000 : false,
    retry: false,
  });

  const statusOffline = aiStatus ? !aiStatus.available : false;
  const isOffline = setupIssue !== null || serviceUnavailable || statusOffline;
  const composerDisabled = setupIssue !== null || statusOffline;

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

  const insights = useMemo(
    () => [
      {
        tone: (overBudget.length > 0 ? "amber" : "teal") as FinnyMood,
        icon: overBudget.length > 0 ? AlertTriangle : TrendingUp,
        title:
          overBudget.length > 0
            ? t("finny.budgetRisk", { count: overBudget.length })
            : t("finny.onTrack"),
        description:
          overBudget.length > 0
            ? overBudget
                .slice(0, 2)
                .map((budget) => budget.name)
                .join(" · ")
            : t("finny.onTrackDesc"),
      },
      {
        tone: "cyan" as FinnyMood,
        icon: ArrowUpRight,
        title: t("finny.topCategory", {
          category: topCategory?.name ?? t("common.noData"),
        }),
        description: t("finny.topCategoryDesc", {
          amount: topCategoryAmount,
        }),
      },
      {
        tone: (savingsRate >= 0 ? "teal" : "rose") as FinnyMood,
        icon: PiggyBank,
        title: t("finny.savings", { rate: savingsRate }),
        description: t("finny.savingsDesc"),
      },
    ],
    [overBudget, savingsRate, t, topCategory?.name, topCategoryAmount],
  );

  useEffect(() => {
    if (!isDesktop || !isCollapsed || isHoveringCollapsed) return;
    const timer = window.setInterval(() => {
      setActiveInsightIndex((previous) => (previous + 1) % insights.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [isDesktop, isCollapsed, isHoveringCollapsed, insights.length]);

  const activeInsight = insights[activeInsightIndex] ?? insights[0];
  const avatarMood: FinnyMood = isOffline
    ? "rose"
    : isDesktop && isCollapsed
    ? activeInsight.tone
    : "cyan";

  const mutation = useMutation({
    mutationFn: async (text: string) => {
      const { data } = await api.post<string>(
        "/ai/analysis",
        {
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
        },
        { timeout: LONG_REQUEST_TIMEOUT_MS },
      );
      return data;
    },
    onSuccess: (reply) => {
      setSetupIssue(null);
      setServiceUnavailable(false);
      // The answer proves a key works again; drop a stale "asleep" badge.
      void refetchStatus();
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
        if (CAN_VIEW_FINNY_SETUP) {
          setSetupIssue(
            code === "FINNY_NOT_CONFIGURED" ? "missing" : "invalid",
          );
          return;
        }
        // Regular users only see the generic assistant failure; the key
        // diagnostics (env file, key name) must never reach their screen.
        setServiceUnavailable(true);
        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: t("finny.error") },
        ]);
        return;
      }
      setServiceUnavailable(true);
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
  }, [messages, mutation.isPending, panelOpen]);

  // The mobile sheet behaves like a modal: Escape and backdrop close it and
  // the page behind must not scroll. On desktop, Escape folds the floating
  // chat back into the floating Finny launcher.
  useEffect(() => {
    if (isDesktop) {
      if (isCollapsed) return;
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") setIsCollapsed(true);
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
    if (!panelOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanelOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [panelOpen, isDesktop, isCollapsed]);

  useEffect(() => {
    return () => {
      if (launchTimerRef.current !== null) {
        window.clearTimeout(launchTimerRef.current);
      }
    };
  }, []);

  // Keep a stored position reachable after the window shrinks.
  useEffect(() => {
    if (!isDesktop) return;
    const handleResize = () =>
      setLauncherOffset((previous) => clampOffset(previous));
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isDesktop]);

  // Draggable on desktop: anchored bottom-right, the launcher used to cover the
  // budget detail's "add expense" controls in web. Moving it (and remembering
  // where) keeps Finny available without blocking the page underneath.
  const handleLauncherPointerDown = (
    event: React.PointerEvent<HTMLElement>,
  ) => {
    if (!isDesktop || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      right: launcherOffset.right,
      bottom: launcherOffset.bottom,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleLauncherPointerMove = (
    event: React.PointerEvent<HTMLElement>,
  ) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    setLauncherOffset(
      clampOffset({ right: drag.right - dx, bottom: drag.bottom - dy }),
    );
  };

  const handleLauncherPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag.moved) return;
    // The click that follows this pointerup belongs to the drag, not to the
    // launcher. A short window (instead of a one-shot flag) cannot leak into
    // the next real click if the browser skips the event.
    suppressLaunchUntilRef.current = performance.now() + 300;
    const next = clampOffset({
      right: drag.right - (event.clientX - drag.startX),
      bottom: drag.bottom - (event.clientY - drag.startY),
    });
    setLauncherOffset(next);
    writeLauncherOffset(next);
  };

  // Shared by the avatar and the insight card so the whole launcher can be
  // dragged from either handle.
  const launcherDragHandlers = {
    onPointerDown: handleLauncherPointerDown,
    onPointerMove: handleLauncherPointerMove,
    onPointerUp: handleLauncherPointerUp,
    onPointerCancel: handleLauncherPointerUp,
  };

  const handleLaunch = () => {
    if (performance.now() < suppressLaunchUntilRef.current) return;
    if (isLaunching) return;
    setIsLaunching(true);
    launchTimerRef.current = window.setTimeout(() => {
      setIsLaunching(false);
      if (isDesktop) {
        setIsCollapsed(false);
      } else {
        setPanelOpen(true);
      }
    }, 280);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || mutation.isPending || composerDisabled) return;

    setMessages((previous) => [...previous, { role: "user", content: text }]);
    setPrompt("");
    mutation.mutate(text);
  };

  // Recovery path: after removing or replacing the rejected key in the
  // backoffice the rail was stuck offline. Retrying clears the banner and
  // re-enables the composer.
  const handleRetry = () => {
    if (mutation.isPending) return;
    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");
    setSetupIssue(null);
    if (lastUserMessage) mutation.mutate(lastUserMessage.content);
  };

  // Waking Finny re-checks the key chain instead of resending a prompt that
  // already failed, which is what the backoffice key list is for.
  const handleWake = () => {
    setSetupIssue(null);
    setServiceUnavailable(false);
    void refetchStatus();
  };

  const collapsedDesktop = isDesktop && isCollapsed;
  const ActiveInsightIcon = activeInsight.icon;

  const floatingLauncher = (
    <div
      onMouseEnter={() => setIsHoveringCollapsed(true)}
      onMouseLeave={() => setIsHoveringCollapsed(false)}
      style={{ right: launcherOffset.right, bottom: launcherOffset.bottom }}
      className="pointer-events-none fixed z-40 flex touch-none select-none items-end gap-3"
    >
      <div className="pointer-events-auto flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={handleLaunch}
          {...launcherDragHandlers}
          className={`group max-w-[16.5rem] touch-none rounded-2xl border bg-white/90 px-3.5 py-2.5 text-left shadow-xl backdrop-blur-xl transition dark:bg-[#070d18]/90 ${
            isOffline
              ? "border-rose-300/70 hover:border-rose-400/60 dark:border-rose-400/25"
              : "border-slate-200/80 hover:border-teal-400/50 dark:border-white/10"
          }`}
        >
          <div
            key={activeInsightIndex}
            className="flex items-start gap-2.5 animate-finny-insight"
          >
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-teal-500/25 bg-teal-500/10 text-teal-600 dark:text-teal-300">
              <ActiveInsightIcon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-snug text-slate-800 dark:text-slate-100">
                {activeInsight.title}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                {activeInsight.description}
              </p>
            </div>
          </div>
        </button>

        <div
          className="flex items-center gap-1.5 pr-1"
          role="tablist"
          aria-label={t("finny.insightsTitle")}
        >
          {insights.map((insight, index) => (
            <button
              key={insight.title}
              type="button"
              role="tab"
              aria-selected={index === activeInsightIndex}
              aria-label={insight.title}
              onClick={() => setActiveInsightIndex(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === activeInsightIndex
                  ? "w-4 bg-teal-400"
                  : "w-1.5 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500"
              }`}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        data-tour="finny"
        onClick={handleLaunch}
        aria-label={t("finny.open")}
        title={
          isDesktop
            ? `${t("finny.open")} · ${t("finny.dragHint")}`
            : t("finny.open")
        }
        {...launcherDragHandlers}
        className={`pointer-events-auto relative shrink-0 cursor-grab touch-none rounded-full active:cursor-grabbing focus:outline-none ${
          isLaunching
            ? "animate-finny-fly"
            : "transition-transform duration-200 hover:scale-105 active:scale-95"
        }`}
      >
        <FinnyAvatar
          mood={avatarMood}
          asleep={isOffline}
          className={`h-14 w-14 ${
            isOffline
              ? "drop-shadow-[0_10px_24px_rgb(251_113_133_/_0.45)]"
              : "drop-shadow-[0_12px_28px_rgb(34_211_238_/_0.45)]"
          }`}
        />
        <span
          className={`absolute right-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-[#070d18] ${
            isOffline ? "bg-rose-400" : "bg-emerald-400"
          }`}
        />
      </button>
    </div>
  );

  const panel = (
    <aside
      role="dialog"
      aria-modal={!isDesktop}
      aria-hidden={isDesktop ? collapsedDesktop : !panelOpen}
      aria-label={t("finny.title")}
      className={
        isDesktop
          ? "finny-rail fixed bottom-5 right-5 top-5 z-50 flex w-[22rem] flex-col overflow-hidden rounded-2xl border shadow-2xl animate-finny-insight"
          : `finny-rail fixed right-0 top-0 z-[70] flex h-[100dvh] max-h-[100dvh] w-full max-w-md flex-col overflow-hidden border-l shadow-2xl transition-[transform,opacity,visibility] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
              panelOpen
                ? "visible translate-y-0 opacity-100"
                : "invisible pointer-events-none translate-y-full opacity-0"
            }`
      }
    >
      <header
        className={`flex items-center gap-3 border-b border-slate-200/80 px-5 dark:border-white/[0.07] ${
          isDesktop ? "py-4" : "pb-4 pt-[max(env(safe-area-inset-top),1.25rem)]"
        }`}
      >
        <div className="relative shrink-0">
          <FinnyAvatar
            mood={avatarMood}
            asleep={isOffline}
            className="h-10 w-10"
          />
          <span
            className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[#070d18] ${
              isOffline ? "bg-rose-400" : "bg-emerald-400"
            }`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
              {t("finny.title")}
            </h2>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                isOffline
                  ? "border-rose-400/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                  : "border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300"
              }`}
            >
              {setupIssue !== null
                ? t("finny.setup.badge")
                : statusOffline
                ? t("finny.sleep.badge")
                : serviceUnavailable
                ? t("finny.offline")
                : t("finny.online")}
            </span>
          </div>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {t("finny.subtitle")}
          </p>
        </div>
        {isDesktop ? (
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            aria-label={t("finny.collapse")}
            title={t("finny.collapse")}
            className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            aria-label={t("finny.close")}
            className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
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
                Backoffice · API keys
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

      {!setupIssue && isOffline && (
        <div className="mx-4 mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3">
          <div className="flex items-start gap-2.5">
            <Moon className="mt-0.5 h-4 w-4 shrink-0 text-rose-500 dark:text-rose-300" />
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-200">
                {t("finny.sleep.title")}
              </p>
              <p className="text-[11px] leading-relaxed text-rose-600/90 dark:text-rose-200/80">
                {t("finny.sleep.body")}
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleWake}
                  disabled={isCheckingStatus}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-200"
                >
                  {isCheckingStatus ? (
                    <BrandDots size="sm" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  {t("finny.sleep.wake")}
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
        className={`border-t border-slate-200/80 px-4 dark:border-white/[0.07] ${
          isDesktop ? "py-4" : "pb-[max(env(safe-area-inset-bottom),1rem)] pt-4"
        }`}
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
            disabled={composerDisabled}
            placeholder={
              setupIssue
                ? t("finny.setup.placeholder")
                : statusOffline
                ? t("finny.sleep.placeholder")
                : t("finny.ask")
            }
            className="max-h-28 min-h-[2.5rem] flex-1 resize-none bg-transparent px-1 py-1 text-xs leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={!prompt.trim() || mutation.isPending || composerDisabled}
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

  return (
    <>
      {!isDesktop && !panelOpen && (
        <button
          type="button"
          data-tour="finny"
          onClick={handleLaunch}
          aria-label={t("finny.open")}
          className={`fixed bottom-[calc(max(env(safe-area-inset-bottom),1rem)+9rem)] right-4 z-40 rounded-full focus:outline-none md:bottom-6 md:right-6 ${
            isLaunching
              ? "animate-finny-fly"
              : "transition-transform duration-200 hover:scale-105 active:scale-95"
          }`}
        >
          <FinnyAvatar
            mood={avatarMood}
            asleep={isOffline}
            className={`h-12 w-12 md:h-14 md:w-14 ${
              isOffline
                ? "drop-shadow-[0_10px_24px_rgb(251_113_133_/_0.45)]"
                : "drop-shadow-[0_10px_24px_rgb(34_211_238_/_0.45)]"
            }`}
          />
          <span
            className={`absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[#070d18] ${
              isOffline ? "bg-rose-400" : "bg-emerald-400"
            }`}
          />
        </button>
      )}

      {typeof document !== "undefined" &&
        createPortal(
          isDesktop ? (
            collapsedDesktop ? (
              floatingLauncher
            ) : (
              panel
            )
          ) : (
            <>
              <div
                className={`fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none ${
                  panelOpen
                    ? "visible opacity-100"
                    : "invisible pointer-events-none opacity-0"
                }`}
                onClick={() => setPanelOpen(false)}
                aria-hidden="true"
              />
              {panel}
            </>
          ),
          document.body,
        )}
    </>
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
