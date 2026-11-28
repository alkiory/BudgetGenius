export interface QueuedRequest {
  id: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  data?: unknown;
  /**
   * Deadline of the original request. A spreadsheet import allows 120 s, and
   * replaying it with the 30 s default would abandon a request the server is
   * still processing.
   */
  timeout?: number;
  /**
   * Sent as `Idempotency-Key` on every replay. Endpoints that store a receipt
   * (the transaction import) then answer with the stored outcome instead of
   * inserting the rows a second time.
   */
  idempotencyKey?: string;
  /**
   * Earliest moment this row may be retried. A throttled request waits for
   * the window the API announced instead of hammering the endpoint.
   */
  nextAttemptAt?: number;
  timestamp: number;
  retryCount: number;
}

const STORAGE_KEY = "offline_queue";
const MAX_RETRIES = 5;

/** Body fields that make a request a credential, never queueable. */
const CREDENTIAL_FIELDS = ["password", "currentPassword", "newPassword"];

/**
 * Whether a request body carries a credential.
 *
 * The queue persists bodies in `localStorage` so they survive a reload, which
 * is right for a transaction and wrong for a password: any other profile that
 * uses the same browser could read it after logout. Credential requests are
 * rejected instead of queued, so the caller sees the network error.
 */
export function carriesCredentials(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const record = data as Record<string, unknown>;
  return CREDENTIAL_FIELDS.some((field) => field in record);
}

function getQueue(): QueuedRequest[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed)) return [];
    // Drop credential rows left by older builds: they must never be replayed
    // nor read back out of storage.
    return (parsed as QueuedRequest[]).filter(
      (request) => !carriesCredentials(request.data),
    );
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedRequest[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

let flushInProgress = false;

/**
 * Bumped by `clearQueue`, and read by an in-flight flush. A flush that started
 * before logout must not write the previous account's rows back afterwards.
 */
let queueVersion = 0;

/**
 * Set when the session ends. Nothing is queued until the next successful auth
 * round-trip (`resumeQueue`), so a request that was already in flight cannot
 * repopulate the queue after logout.
 */
let queueBlocked = false;

export function resumeQueue(): void {
  queueBlocked = false;
}

/**
 * Add a failed request to the offline queue.
 */
export function enqueueRequest(
  method: string,
  url: string,
  data?: unknown,
  options?: { timeout?: number; idempotencyKey?: string },
): void {
  if (queueBlocked || carriesCredentials(data)) return;

  const queue = getQueue();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    method: method as QueuedRequest["method"],
    url,
    data,
    timestamp: Date.now(),
    retryCount: 0,
    timeout: options?.timeout,
    idempotencyKey: options?.idempotencyKey,
  });
  saveQueue(queue);
}

/** Options that must survive a replay: deadline and idempotency key. */
type ReplayConfig = {
  timeout?: number;
  headers?: Record<string, string>;
};

type ReplayClient = {
  post: (
    url: string,
    data?: unknown,
    config?: ReplayConfig,
  ) => Promise<unknown>;
  put: (url: string, data?: unknown, config?: ReplayConfig) => Promise<unknown>;
  patch: (
    url: string,
    data?: unknown,
    config?: ReplayConfig,
  ) => Promise<unknown>;
  delete: (url: string, config?: ReplayConfig) => Promise<unknown>;
};

/** The API throttled the request: the write is valid, only too soon. */
const RATE_LIMIT_STATUS = 429;
/** Only for a 429 that arrives without a usable `Retry-After`. */
const DEFAULT_RATE_LIMIT_WAIT_MS = 10_000;
/**
 * setTimeout overflows past 2^31-1 ms. A longer deadline stays in the row
 * (`nextAttemptAt`), and the capped wake-up only re-reads it: nothing is sent
 * before the server said it would accept the write.
 */
const MAX_TIMER_MS = 2_147_483_000;
/** Floor for a wake-up: a zero delay would spin while the API is unreachable. */
const MIN_RETRY_WAIT_MS = 1_000;

type ReplayVerdict = {
  /** Milliseconds to wait before sending it again. */
  waitMs: number;
  /** Whether this attempt spends the row's retry budget. */
  counts: boolean;
};

/** `Retry-After` is either delta-seconds or an HTTP date. */
function readRetryAfterMs(headers?: Record<string, unknown>): number | null {
  const raw = headers?.["retry-after"];
  if (raw === undefined || raw === null) return null;

  const text = String(raw).trim();
  const seconds = Number(text);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const date = Date.parse(text);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

/**
 * How long to wait before replaying a rejected request, or null to drop it.
 *
 * - 429: the write is valid and must not be lost. It stays queued, waits for
 *   the window the API announced, and does not spend the retry budget, so a
 *   batch of offline records is not trimmed to the throttler limit.
 * - any other 4xx: permanent, the answer cannot change.
 * - timeout without an idempotency key: unknown outcome, and resending is how
 *   a spreadsheet import ends up in the account twice.
 * - everything else: bounded exponential backoff.
 */
function replayVerdict(
  error: unknown,
  request: QueuedRequest,
): ReplayVerdict | null {
  const response = (
    error as {
      response?: { status?: number; headers?: Record<string, unknown> };
    }
  )?.response;
  const status = response?.status;

  if (status === RATE_LIMIT_STATUS) {
    // The server deadline wins. A password-recovery bucket asks for an hour,
    // and retrying after a minute only spends requests against it.
    return {
      waitMs: readRetryAfterMs(response?.headers) ?? DEFAULT_RATE_LIMIT_WAIT_MS,
      counts: false,
    };
  }

  if (status && status >= 400 && status < 500) return null;

  const code = (error as { code?: string })?.code;
  const timedOut = code === "ECONNABORTED" || code === "ETIMEDOUT";
  if (timedOut && !request.idempotencyKey) return null;

  if (request.retryCount >= MAX_RETRIES) return null;

  return {
    waitMs: Math.min(1000 * Math.pow(2, request.retryCount), 30_000),
    counts: true,
  };
}

/**
 * Drops every queued request.
 *
 * Called when the session ends: queued bodies carry the previous account's
 * amounts and descriptions in `localStorage`, and the next person to use this
 * browser profile must not find them.
 */
export function clearQueue(): void {
  queueVersion += 1;
  queueBlocked = true;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable — nothing was persisted either */
  }
}

/**
 * Wakes the queue for the earliest deadline in `pending`.
 *
 * Scheduling from the merged list, not only from the rows this pass rejected,
 * is what makes a write the interceptor re-queued mid-flush retry once the
 * network is back, without waiting for an `online` event that may never fire.
 */
function scheduleFlush(
  apiInstance: ReplayClient,
  pending: QueuedRequest[],
): void {
  const now = Date.now();
  const dueAt = Math.min(...pending.map((req) => req.nextAttemptAt ?? now));
  const wait = Math.min(Math.max(dueAt - now, MIN_RETRY_WAIT_MS), MAX_TIMER_MS);
  setTimeout(() => void flushQueue(apiInstance), wait);
}

/**
 * Process queued requests sequentially with exponential backoff.
 */
export async function flushQueue(apiInstance: ReplayClient): Promise<void> {
  if (flushInProgress) return;
  flushInProgress = true;

  const startedAtVersion = queueVersion;
  const now = Date.now();
  const queue = getQueue();
  if (queue.length === 0) {
    flushInProgress = false;
    return;
  }

  // A row waiting on a deadline that outlived a reload must not be sent just
  // because a flush was requested: only the due ones are attempted.
  const due = queue.filter((req) => (req.nextAttemptAt ?? 0) <= now);
  const waiting = queue.filter((req) => (req.nextAttemptAt ?? 0) > now);
  const snapshotIds = new Set(queue.map((req) => req.id));
  const remaining: QueuedRequest[] = [...waiting];

  for (const req of due) {
    const config: ReplayConfig = {};
    if (req.timeout) {
      config.timeout = req.timeout;
    }
    if (req.idempotencyKey) {
      config.headers = { "Idempotency-Key": req.idempotencyKey };
    }

    try {
      switch (req.method) {
        case "POST":
          await apiInstance.post(req.url, req.data, config);
          break;
        case "PUT":
          await apiInstance.put(req.url, req.data, config);
          break;
        case "PATCH":
          await apiInstance.patch(req.url, req.data, config);
          break;
        case "DELETE":
          await apiInstance.delete(req.url, config);
          break;
      }
      // Success — request is done, don't add it back
    } catch (error) {
      const verdict = replayVerdict(error, req);
      if (verdict) {
        remaining.push({
          ...req,
          retryCount: req.retryCount + (verdict.counts ? 1 : 0),
          nextAttemptAt: Date.now() + verdict.waitMs,
        });
      }
      // Otherwise drop it: retrying cannot change the answer, or the outcome of
      // an unkeyed write is unknown and a resend could duplicate it.
    }
  }

  // The session ended while this flush was running: drop the rows instead of
  // writing the previous account's data back to storage.
  if (queueVersion !== startedAtVersion) {
    flushInProgress = false;
    return;
  }

  // The interceptor re-queues a write that hits the network again mid-flush and
  // resolves it, so that row is in neither `due` nor `remaining`. Overwriting
  // storage with this snapshot would erase it and leave the write unsynced
  // until an event that may never come, so keep what appeared and replace only
  // what this pass took.
  const addedMeanwhile = getQueue().filter((req) => !snapshotIds.has(req.id));
  const pending = [...remaining, ...addedMeanwhile];

  saveQueue(pending);
  flushInProgress = false;

  if (pending.length > 0) {
    scheduleFlush(apiInstance, pending);
  }
}

/**
 * Check if there are queued requests.
 */
export function hasQueuedRequests(): boolean {
  return getQueue().length > 0;
}

/**
 * Register the online event listener to auto-flush the queue
 * when connectivity is restored. Call this once at app startup
 * with the axios api instance.
 */
export function registerOnlineListener(apiInstance: ReplayClient): void {
  window.addEventListener("online", () => {
    flushQueue(apiInstance);
  });
  // Also flush immediately in case we came online while the page was open
  if (navigator.onLine && hasQueuedRequests()) {
    flushQueue(apiInstance);
  }
}
