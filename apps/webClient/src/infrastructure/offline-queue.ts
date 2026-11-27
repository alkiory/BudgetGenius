export interface QueuedRequest {
  id: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  data?: unknown;
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
  });
  saveQueue(queue);
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
export async function flushQueue(apiInstance: {
  post: (url: string, data?: unknown) => Promise<unknown>;
  put: (url: string, data?: unknown) => Promise<unknown>;
  patch: (url: string, data?: unknown) => Promise<unknown>;
  delete: (url: string) => Promise<unknown>;
}): Promise<void> {
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
    try {
      switch (req.method) {
        case "POST":
          await apiInstance.post(req.url, req.data);
          break;
        case "PUT":
          await apiInstance.put(req.url, req.data);
          break;
        case "PATCH":
          await apiInstance.patch(req.url, req.data);
          break;
        case "DELETE":
          await apiInstance.delete(req.url);
          break;
      }
      // Success — request is done, don't add it back
    } catch {
      if (req.retryCount < MAX_RETRIES) {
        remaining.push({ ...req, retryCount: req.retryCount + 1 });
      }
      // If max retries exceeded, drop the request silently
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
export function registerOnlineListener(apiInstance: {
  post: (url: string, data?: unknown) => Promise<unknown>;
  put: (url: string, data?: unknown) => Promise<unknown>;
  patch: (url: string, data?: unknown) => Promise<unknown>;
  delete: (url: string) => Promise<unknown>;
}): void {
  window.addEventListener("online", () => {
    flushQueue(apiInstance);
  });
  // Also flush immediately in case we came online while the page was open
  if (navigator.onLine && hasQueuedRequests()) {
    flushQueue(apiInstance);
  }
}
