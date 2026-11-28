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

/**
 * Whether a rejected replay may be sent again.
 *
 * A 4xx answers the same way on every attempt, and a timeout on a write that
 * carries no idempotency key has an unknown outcome: the server may have
 * committed it, so resending is exactly how a spreadsheet import ends up in
 * the account twice.
 */
function shouldReplay(error: unknown, request: QueuedRequest): boolean {
  const status = (error as { response?: { status?: number } })?.response
    ?.status;
  if (status && status >= 400 && status < 500) return false;

  const code = (error as { code?: string })?.code;
  const timedOut = code === "ECONNABORTED" || code === "ETIMEDOUT";
  if (timedOut && !request.idempotencyKey) return false;

  return request.retryCount < MAX_RETRIES;
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
 * Process queued requests sequentially with exponential backoff.
 */
export async function flushQueue(apiInstance: ReplayClient): Promise<void> {
  if (flushInProgress) return;
  flushInProgress = true;

  const startedAtVersion = queueVersion;
  const queue = getQueue();
  if (queue.length === 0) {
    flushInProgress = false;
    return;
  }

  const remaining: QueuedRequest[] = [];

  for (const req of queue) {
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
      if (shouldReplay(error, req)) {
        remaining.push({ ...req, retryCount: req.retryCount + 1 });
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

  saveQueue(remaining);
  flushInProgress = false;

  // If there are remaining items, schedule a retry with exponential backoff
  if (remaining.length > 0) {
    const minRetry = Math.min(...remaining.map((r) => r.retryCount));
    const delay = Math.min(1000 * Math.pow(2, minRetry), 30000);
    setTimeout(() => flushQueue(apiInstance), delay);
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
