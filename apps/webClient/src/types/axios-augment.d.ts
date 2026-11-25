/**
 * Axios request-config augmentation.
 *
 * `api.config.ts` tags requests with `_retry` (caller opts out of the
 * refresh-on-401 path), `_sessionRetry` (this request already consumed a
 * refresh) and `_retryCount`. Those flags are internal to the interceptors,
 * but they are passed through the public `AxiosRequestConfig` type, which
 * did not declare them — every call site (`useLoadUser`, `splash`) failed
 * `tsc -b` with TS2353.
 *
 * Augmenting the interface here keeps the flags typed everywhere instead of
 * casting at each call site.
 */
import "axios";

declare module "axios" {
  export interface AxiosRequestConfig {
    /** Caller opt-out: never attempt a token refresh for this request. */
    _retry?: boolean;
    /** Set by the response interceptor once the request consumed a refresh. */
    _sessionRetry?: boolean;
    /** Optional retry counter used by callers that loop. */
    _retryCount?: number;
  }
}
