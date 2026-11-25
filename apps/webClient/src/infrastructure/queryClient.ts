import { QueryClient } from "@tanstack/react-query";

/**
 * The app-wide React Query client.
 *
 * It lives in its own module (instead of being created inside `main.tsx`)
 * so non-React code can reach it too. Specifically, the axios 401
 * interceptor in `api.config.ts` calls `queryClient.clear()` when a
 * session turns out to be unrecoverable: that is what cancels the
 * `retry: 3` loops that used to keep firing 401s (and stacking "session
 * expired" toasts) after the session was already dead.
 *
 * `QueryClient` is stateful, so this module must stay a singleton — do
 * not instantiate another client anywhere else.
 */
export const queryClient = new QueryClient();
