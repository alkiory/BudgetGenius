import { RootState } from "@adapters/store/rootStore";
import api from "@infrastructure/api.config";
import { shouldRetryQuery } from "@infrastructure/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";

/** Query roots that hold account data rendered by the dashboard and reports. */
const SYNCED_QUERY_KEYS = [
  "dashboard",
  "transactions",
  "budgets",
  "budget-categories",
  "budget-reconciliation",
  "expense-categories",
  "recent-summary",
  "reports",
  "announcements",
  "user-settings",
] as const;

/**
 * Keeps every open client of one account in step.
 *
 * Polls `GET /sync/revision` (a tiny aggregate query) instead of opening a
 * socket: the Capacitor WebView cannot share cross-origin cookies, and a
 * polling contract behaves identically in the APK, the SPA and multiple tabs.
 * When the revision changes, the account queries are invalidated and React
 * Query refetches the active ones, so a transaction created on the phone shows
 * up on the desktop without a page refresh.
 */
export function useCrossDeviceSync() {
  const auth = useSelector((state: RootState) => state.auth);
  const user = auth.user;
  const queryClient = useQueryClient();
  const previous = useRef<string | null>(null);

  const { data } = useQuery({
    queryKey: ["sync", "revision"],
    queryFn: async () => {
      const { data } = await api.get<{ revision: string }>("/sync/revision");
      return data;
    },
    enabled: Boolean(user),
    staleTime: 0,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    retry: shouldRetryQuery,
  });

  useEffect(() => {
    if (!data?.revision) return;
    // The first answer is the baseline, not a change.
    if (previous.current === null) {
      previous.current = data.revision;
      return;
    }
    if (previous.current === data.revision) return;
    previous.current = data.revision;

    SYNCED_QUERY_KEYS.forEach((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    );
  }, [data?.revision, queryClient]);

  // A WebView that was backgrounded for a while should reconcile on return
  // instead of waiting for the next tick.
  useEffect(() => {
    if (!user) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        queryClient.invalidateQueries({ queryKey: ["sync", "revision"] });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [queryClient, user]);
}
