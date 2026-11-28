import {
  type QueuedMethod,
  type QueuedWrite,
  carriesCredentials,
  decideReplay,
  deriveResourceKey,
  highestExplicitSequence,
  hydrateQueue,
  isDue,
  needsOwnReplay,
  nextWakeDelayMs,
  toStoredRow,
  transportBackoffMs,
  withDeadline,
} from "./offline-queue.model";

export type { QueuedWrite } from "./offline-queue.model";

/**
 * Storage and replay loop for the offline queue.
 *
 * The rules — resource identity, order, idempotency, state and deadlines — live
 * in `offline-queue.model.ts`; this module persists rows, walks them in order
 * and talks to the API.
 *
 * Two keys, on purpose:
 *
 * - `offline_queue` is a plain JSON array of rows an older bundle can replay
 *   faithfully (method, URL, body). A tab still running the previous bundle
 *   reads that array, appends to it and drains it, exactly as it does today, so
 *   an update in another tab cannot make it overwrite pending writes.
 * - `offline_queue:replay` holds the rows that need this bundle: a request with
 *   an idempotency key or a longer deadline. An older bundle sends neither, and
 *   replaying a keyed import without its key inserts the batch twice, so those
 *   rows live where no older bundle looks.
 *
 * Only inputs are persisted. `resourceKey` and `state` are derived on read, so
 * they cannot go stale in storage (see `hydrateQueue`).
 */

const QUEUE_KEY = "offline_queue";
const REPLAY_KEY = "offline_queue:replay";

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

/**
 * Which account is signed in, as far as the queue is concerned. Rows carry the
 * account that queued them and are never replayed into another one.
 */
let ownerOf: () => string | undefined = () => undefined;

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Storage can be unavailable (incognito, sandboxed iframe); an empty queue
    // is the only safe answer.
    return null;
  }
}

/**
 * Every pending row, oldest first, across both keys.
 *
 * The sequence floor is taken from both values at once: a row an older bundle
 * appended has no number, and numbering it inside its own key would let it tie
 * with, and sort before, a row numbered in the other.
 */
function readAll(at = Date.now()): QueuedWrite[] {
  const sharedRaw = readRaw(QUEUE_KEY);
  const ownRaw = readRaw(REPLAY_KEY);
  const floor = highestExplicitSequence(sharedRaw, ownRaw);

  return [
    ...hydrateQueue(sharedRaw, at, floor),
    ...hydrateQueue(ownRaw, at, floor),
  ].sort((a, b) => a.sequence - b.sequence);
}

/** Persists one key. Returns false when storage rejects the write. */
function writeKey(key: string, writes: QueuedWrite[]): boolean {
  try {
    if (writes.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(writes.map(toStoredRow)));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Persists the rows, each in the store that can replay it. Returns whether both
 * writes were accepted.
 */
function writeAll(writes: QueuedWrite[]): boolean {
  const shared = writes.filter((write) => !needsOwnReplay(write));
  const own = writes.filter(needsOwnReplay);
  // Both calls run: a failed one must not prevent the other from being saved.
  const sharedOk = writeKey(QUEUE_KEY, shared);
  const ownOk = writeKey(REPLAY_KEY, own);
  return sharedOk && ownOk;
}

/**
 * Whether the signed-in account may replay this row.
 *
 * Fails closed. Before the account is known nothing is replayed: the token the
 * browser holds at that moment may belong to whoever signed in last, and these
 * rows are the previous user's financial records. A row that carries an account
 * is only replayed into the same one, and a keyed row with no account is never
 * replayed at all — it cannot be attributed, and a resend writes rows.
 */
function replayable(write: QueuedWrite, owner: string | undefined): boolean {
  if (owner === undefined) return false;
  if (write.owner !== undefined) return write.owner === owner;
  return !needsOwnReplay(write);
}

export function resumeQueue(): void {
  queueBlocked = false;
}

/**
 * Add a failed write to the offline queue.
 *
 * The sequence and the resource key are assigned here, once: they are what
 * keeps two edits of one transaction in the order the user made them.
 *
 * Returns whether the row was persisted. The queue is the only copy of a write
 * the API never received, so a caller that reports success must have got `true`.
 */
export function enqueueRequest(
  method: string,
  url: string,
  data?: unknown,
  options?: { timeout?: number; idempotencyKey?: string },
): boolean {
  // Rejected before anything is written: a password must never reach storage,
  // not even for the moment between enqueue and the next read.
  if (queueBlocked || carriesCredentials(data)) return false;

  const writes = readAll();
  const sequence =
    writes.reduce((highest, write) => Math.max(highest, write.sequence), 0) + 1;

  writes.push(
    withDeadline(
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        sequence,
        resourceKey: deriveResourceKey(method, url, data),
        method: method as QueuedMethod,
        url,
        data,
        idempotencyKey: options?.idempotencyKey,
        timeout: options?.timeout,
        state: "ready",
        retryCount: 0,
        owner: ownerOf(),
      },
      undefined,
      Date.now(),
    ),
  );

  return writeAll(writes);
}

/**
 * Drops every queued write.
 *
 * Called when the session ends: queued bodies carry the previous account's
 * amounts and descriptions, and the next person to use this browser profile
 * must not find them. Both stores go, including rows an older bundle would not
 * have cleaned up.
 */
export function clearQueue(): void {
  queueVersion += 1;
  queueBlocked = true;
  for (const key of [QUEUE_KEY, REPLAY_KEY]) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* storage unavailable — nothing was persisted either */
    }
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
 * Ordering contract, covered by the specs:
 *   1. rows are walked by `sequence`;
 *   2. a resource whose earlier write has not landed is blocked for the rest of
 *      the pass, even if the successor is due earlier;
 *   3. a successful head releases its successors in the same pass, in order.
 */
export async function flushQueue(apiInstance: ReplayClient): Promise<void> {
  if (flushInProgress) return;
  flushInProgress = true;

  try {
    await drain(apiInstance);
  } finally {
    // A thrown or rejected persistence call must not leave the queue locked for
    // the rest of the session.
    flushInProgress = false;
  }
}

async function drain(apiInstance: ReplayClient): Promise<void> {
  const startedAtVersion = queueVersion;
  const owner = ownerOf();
  // No account yet: hold every row instead of sending it into a session we
  // cannot identify. The moment the account appears, `flushQueue` runs again.
  if (owner === undefined) return;

  const stored = readAll();
  // Rows queued by another account are dropped here rather than replayed into
  // the current one.
  const writes = stored.filter((write) => replayable(write, owner));
  if (writes.length === 0) {
    if (stored.length > 0) writeAll([]);
    return;
  }

  const snapshotIds = new Set(writes.map((write) => write.id));
  const blocked = new Set<string>();
  const pending: QueuedWrite[] = [];
  let sent = 0;

  for (const write of writes) {
    if (blocked.has(write.resourceKey) || !isDue(write)) {
      blocked.add(write.resourceKey);
      pending.push(write);
      continue;
    }

    try {
      await send(apiInstance, write);
      sent += 1;
      // The head landed: successors of the same resource may follow now, which
      // the loop reaches in sequence order.
    } catch (error) {
      const decision = decideReplay(error, write);
      if (decision.action === "retry") {
        const at = Date.now();
        pending.push(
          withDeadline(
            {
              ...write,
              retryCount: write.retryCount + (decision.counts ? 1 : 0),
            },
            at + decision.waitMs,
            at,
          ),
        );
      }
      // Otherwise the row is dropped: the answer cannot change, or the outcome
      // of an unkeyed write is unknown and a resend could duplicate it.
      blocked.add(write.resourceKey);
    }
  }

  // The session ended while this flush was running: drop the rows instead of
  // writing the previous account's data back to storage.
  if (queueVersion !== startedAtVersion) return;

  // The interceptor re-queues a write that hits the network again mid-flush and
  // resolves it, so that row is in neither `pending` nor the snapshot.
  const added = readAll().filter(
    (write) => !snapshotIds.has(write.id) && replayable(write, owner),
  );

  // A row the interceptor had to queue again is proof the API was not reached,
  // even though the request itself resolved. A send with nothing added is proof
  // it was. A wake that sends nothing (the `online` event fires before any
  // deadline) is no evidence either way and must not reset the outage backoff.
  if (added.length > 0) {
    transportFailures += 1;
  } else if (sent > 0) {
    transportFailures = 0;
  }

  const backoff = transportBackoffMs(transportFailures);
  const at = Date.now();
  const merged = [
    ...pending,
    // Rows the interceptor queued arrive `ready` with no deadline; without a
    // backoff the wake floor (one second) would hammer an unreachable API.
    ...added.map((write) =>
      backoff > 0 ? withDeadline(write, at + backoff, at) : write,
    ),
  ];

  writeAll(merged);

  const wait = nextWakeDelayMs(merged, Date.now());
  if (wait !== null) {
    setTimeout(() => void flushQueue(apiInstance), wait);
  }
}

/**
 * Check if there are queued requests.
 */
export function hasQueuedRequests(): boolean {
  return readAll().length > 0;
}

/**
 * Register the online event listener to auto-flush the queue
 * when connectivity is restored. Call this once at app startup
 * with the axios api instance, and a getter for the signed-in account.
 */
export function registerOnlineListener(
  apiInstance: ReplayClient,
  getOwner?: () => string | undefined,
): void {
  if (getOwner) {
    ownerOf = getOwner;
  }
  window.addEventListener("online", () => {
    void flushQueue(apiInstance);
  });
  // Also flush immediately in case we came online while the page was open
  if (navigator.onLine && hasQueuedRequests()) {
    void flushQueue(apiInstance);
  }
}
