import {
  type QueuedMethod,
  type QueuedStore,
  type QueuedWrite,
  carriesCredentials,
  decideReplay,
  deriveResourceKey,
  hydrateQueue,
  isDue,
  nextWakeDelayMs,
  transportBackoffMs,
} from "./offline-queue.model";

export { carriesCredentials } from "./offline-queue.model";
export type {
  QueuedMethod,
  QueuedState,
  QueuedWrite,
} from "./offline-queue.model";

/**
 * Storage and replay loop for the offline queue.
 *
 * The rules — resource identity, order, idempotency, state and deadlines — live
 * in `offline-queue.model.ts`; this module only persists rows, walks them in
 * order and talks to the API. Every decision it takes is delegated, so the
 * invariants stay testable without a browser.
 */

const STORAGE_KEY = "offline_queue";

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

let flushInProgress = false;

/**
 * Bumped by `clearQueue`, and read by an in-flight flush. A flush that started
 * before logout must not write the previous account's rows back afterwards.
 */
let queueVersion = 0;

/**
 * Set when the session ends. Nothing is queued until the next successful auth
 * round-trip (`resumeQueue`), so a write that was already in flight cannot
 * repopulate the queue after logout.
 */
let queueBlocked = false;

/** Consecutive flushes that only produced writes the interceptor re-queued. */
let transportFailures = 0;

function readStore(now = Date.now()): QueuedStore {
  try {
    return hydrateQueue(localStorage.getItem(STORAGE_KEY), now);
  } catch {
    // Storage can be unavailable (incognito, sandboxed iframe); an empty queue
    // is the only safe answer.
    return hydrateQueue(null, now);
  }
}

function writeStore(store: QueuedStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* nothing was persisted, and nothing can be */
  }
}

export function resumeQueue(): void {
  queueBlocked = false;
}

/**
 * Add a failed write to the offline queue.
 *
 * The sequence and the resource key are assigned here, once: they are what
 * keeps two edits of one transaction in the order the user made them.
 */
export function enqueueRequest(
  method: string,
  url: string,
  data?: unknown,
  options?: { timeout?: number; idempotencyKey?: string },
): void {
  // Rejected before anything is written: a password must never reach storage,
  // not even for the moment between enqueue and the next read.
  if (queueBlocked || carriesCredentials(data)) return;
  const store = readStore();
  const sequence = store.nextSequence;

  store.writes.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    sequence,
    resourceKey: deriveResourceKey(method, url, data),
    method: method as QueuedMethod,
    url,
    data,
    idempotencyKey: options?.idempotencyKey,
    timeout: options?.timeout,
    state: "ready",
    timestamp: Date.now(),
    retryCount: 0,
  });

  writeStore({ ...store, nextSequence: sequence + 1 });
}

/**
 * Drops every queued write.
 *
 * Called when the session ends: queued bodies carry the previous account's
 * amounts and descriptions, and the next person to use this browser profile
 * must not find them.
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

async function send(
  apiInstance: ReplayClient,
  write: QueuedWrite,
): Promise<void> {
  const config: ReplayConfig = {};
  if (write.timeout) {
    config.timeout = write.timeout;
  }
  if (write.idempotencyKey) {
    config.headers = { "Idempotency-Key": write.idempotencyKey };
  }

  switch (write.method) {
    case "POST":
      await apiInstance.post(write.url, write.data, config);
      return;
    case "PUT":
      await apiInstance.put(write.url, write.data, config);
      return;
    case "PATCH":
      await apiInstance.patch(write.url, write.data, config);
      return;
    case "DELETE":
      await apiInstance.delete(write.url, config);
      return;
  }
}

/**
 * Replays the queue in enqueue order.
 *
 * Ordering contract, enforced here and covered by the specs:
 *   1. rows are walked by `sequence`;
 *   2. a resource whose earlier write has not landed is blocked for the rest of
 *      the pass, even if the successor is due earlier;
 *   3. a successful head releases its successors in the same pass, in order.
 */
export async function flushQueue(apiInstance: ReplayClient): Promise<void> {
  if (flushInProgress) return;
  flushInProgress = true;

  const startedAtVersion = queueVersion;
  const store = readStore();
  if (store.writes.length === 0) {
    transportFailures = 0;
    flushInProgress = false;
    return;
  }

  const snapshotIds = new Set(store.writes.map((write) => write.id));
  const blocked = new Set<string>();
  const pending: QueuedWrite[] = [];
  const now = Date.now();

  for (const write of store.writes) {
    if (blocked.has(write.resourceKey) || !isDue(write, now)) {
      blocked.add(write.resourceKey);
      pending.push(write);
      continue;
    }

    try {
      await send(apiInstance, write);
      // The head landed: successors of the same resource may follow now, which
      // the loop reaches in sequence order.
    } catch (error) {
      const decision = decideReplay(error, write);
      if (decision.action === "retry") {
        pending.push({
          ...write,
          retryCount: write.retryCount + (decision.counts ? 1 : 0),
          nextAttemptAt: Date.now() + decision.waitMs,
          state: "waiting",
        });
      }
      // Otherwise it is dropped: the answer cannot change, or the outcome of an
      // unkeyed write is unknown and a resend could duplicate it.
      blocked.add(write.resourceKey);
    }
  }

  // The session ended while this flush was running: drop the rows instead of
  // writing the previous account's data back to storage.
  if (queueVersion !== startedAtVersion) {
    flushInProgress = false;
    return;
  }

  // The interceptor re-queues a write that hits the network again mid-flush and
  // resolves it, so that row is in neither `pending` nor the snapshot. Keep it,
  // and read the store again so its `nextSequence` is the one persisted.
  const latest = readStore();
  const added = latest.writes.filter((write) => !snapshotIds.has(write.id));

  transportFailures = added.length > 0 ? transportFailures + 1 : 0;
  const backoff = transportBackoffMs(transportFailures);

  // Those rows arrive ready and with no deadline; without a backoff the wake
  // floor (one second) would hammer an API that is still unreachable.
  const requeued = added.map((write) =>
    write.state === "ready" && write.nextAttemptAt === undefined
      ? {
          ...write,
          nextAttemptAt: Date.now() + backoff,
          state: "waiting" as const,
        }
      : write,
  );

  const merged = [...pending, ...requeued];
  writeStore({ ...latest, writes: merged });
  flushInProgress = false;

  if (merged.length > 0) {
    const wait = nextWakeDelayMs(merged, Date.now());
    if (wait !== null) {
      setTimeout(() => void flushQueue(apiInstance), wait);
    }
  }
}

/**
 * Check if there are queued requests.
 */
export function hasQueuedRequests(): boolean {
  return readStore().writes.length > 0;
}

/**
 * Register the online event listener to auto-flush the queue
 * when connectivity is restored. Call this once at app startup
 * with the axios api instance.
 */
export function registerOnlineListener(apiInstance: ReplayClient): void {
  window.addEventListener("online", () => {
    void flushQueue(apiInstance);
  });
  // Also flush immediately in case we came online while the page was open
  if (navigator.onLine && hasQueuedRequests()) {
    void flushQueue(apiInstance);
  }
}
