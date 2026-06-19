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

function getQueue(): QueuedRequest[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedRequest[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

let flushInProgress = false;

/**
 * Add a failed request to the offline queue.
 */
export function enqueueRequest(
  method: string,
  url: string,
  data?: unknown,
): void {
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
