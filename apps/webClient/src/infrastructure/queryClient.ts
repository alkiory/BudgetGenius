import { QueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";

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

/**
 * Transport failures and 5xx deserve a couple of attempts; a 4xx does not.
 *
 * React Query's default is three retries for every error, so one denied
 * backoffice request became four (`overview` ×4, `modules` ×3, `api-keys` ×2
 * in production) and the retries are what the operator sees as "the app fires
 * a burst of requests". A 403, 404, 415 or 429 answers the same way on the
 * fourth attempt: repeating it only adds load to an API that is already
 * refusing the call.
 */
export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
): boolean {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    if (status && status >= 400 && status < 500) {
      return false;
    }
  }

  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: shouldRetryQuery },
  },
});
