/**
 * The offline write queue, as a model.
 *
 * A row is a write the API has not confirmed yet. Five properties are explicit
 * and every rule in this module reads them — nothing is inferred from the
 * payload at send time:
 *
 * - `resourceKey` — what the write touches. Rows that share it are replayed in
 *   `sequence` order, because the server applies the last PUT it receives and
 *   an older amount must never overwrite a newer edit.
 * - `sequence` — enqueue order, assigned once and never reused.
 * - `idempotencyKey` — makes a resend safe: the API stores a receipt and
 *   answers with it instead of writing the rows twice.
 * - `state` — `ready` (due now) or `waiting` (a deadline in the future). A row
 *   in flight is never persisted: if the tab dies mid-send it reloads as
 *   `ready`, and the idempotency key keeps the outcome single.
 * - `nextAttemptAt` — the deadline: the window the API announced
 *   (`Retry-After`) or the backoff this queue chose.
 *
 * Storage and the flush loop live in `offline-queue.ts`; this module stays
 * pure so the invariants can be tested without a browser.
 */

/** Current persisted schema. v1 was a bare array with no sequence or key. */
export const QUEUE_STORAGE_VERSION = 2;

export type QueuedMethod = "POST" | "PUT" | "PATCH" | "DELETE";

export type QueuedState = "ready" | "waiting";

export interface QueuedWrite {
  id: string;
  /** Enqueue order. Immutable; the flush loop walks writes by it. */
  sequence: number;
  /** What the write touches; rows sharing it keep their order. */
  resourceKey: string;
  method: QueuedMethod;
  url: string;
  data?: unknown;
  /** Sent again on every replay so the API can answer from its receipt. */
  idempotencyKey?: string;
  /** Deadline of the original request, preserved for the replay. */
  timeout?: number;
  state: QueuedState;
  nextAttemptAt?: number;
  timestamp: number;
  /** Failed attempts that spent the budget (a 429 does not). */
  retryCount: number;
}

export interface QueuedStore {
  version: typeof QUEUE_STORAGE_VERSION;
  /** Next sequence to hand out; never reused, survives a reload. */
  nextSequence: number;
  writes: QueuedWrite[];
}

/** Base of the exponential backoff applied to transport failures. */
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
/**
 * setTimeout overflows past 2^31-1 ms. A longer deadline stays in the row and
 * the capped wake-up only re-reads it: nothing is sent before the server said
 * it would accept the write.
 */
const MAX_TIMER_MS = 2_147_483_000;
/** Floor for a wake-up: a zero delay would spin while the API is unreachable. */
const MIN_WAIT_MS = 1_000;
/** Only for a 429 that arrives without a usable `Retry-After`. */
const DEFAULT_RATE_LIMIT_WAIT_MS = 10_000;
const RATE_LIMIT_STATUS = 429;
const MAX_RETRIES = 5;

/** Body fields that make a write a credential, never queueable. */
const CREDENTIAL_FIELDS = ["password", "currentPassword", "newPassword"];

/**
 * Whether a body carries a credential.
 *
 * The queue persists bodies, which is right for a transaction and wrong for a
 * password: any other profile on this browser could read it after logout.
 * Credential writes are rejected instead of queued, so the caller sees the
 * network error.
 */
export function carriesCredentials(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const record = data as Record<string, unknown>;
  return CREDENTIAL_FIELDS.some((field) => field in record);
}

/**
 * Identity of the resource a write touches.
 *
 * The method is part of it (a DELETE and a PUT on one id are unrelated), and so
 * is the id from the body, because every edit of a transaction travels as
 * `PUT /transactions` with the id inside the payload.
 */
export function deriveResourceKey(
  method: string,
  url: string,
  data?: unknown,
): string {
  const body = data as { id?: unknown; transactionId?: unknown } | undefined;
  const id = body?.id ?? body?.transactionId ?? "";
  return `${method} ${url} ${String(id)}`;
}

/** A row may be sent only when it is `ready` and its deadline has passed. */
export function isDue(write: QueuedWrite, now: number): boolean {
  return write.state === "ready" && (write.nextAttemptAt ?? 0) <= now;
}

/**
 * First pending write of every resource, in sequence order.
 *
 * Only these rows can be sent next: a successor has to wait for the write it
 * would overwrite, whatever its own deadline says.
 */
export function firstPerResource(
  writes: readonly QueuedWrite[],
): QueuedWrite[] {
  const seen = new Set<string>();
  const heads: QueuedWrite[] = [];
  for (const write of writes) {
    if (seen.has(write.resourceKey)) continue;
    seen.add(write.resourceKey);
    heads.push(write);
  }
  return heads;
}

/**
 * How long to sleep before the next flush, or null when nothing is pending.
 *
 * Measured from the first eligible write of each resource: waking for a blocked
 * successor whose deadline is earlier than the one it must wait for would only
 * produce a flush with nothing to do.
 */
export function nextWakeDelayMs(
  writes: readonly QueuedWrite[],
  now: number,
): number | null {
  if (writes.length === 0) return null;

  const dueAt = Math.min(
    ...firstPerResource(writes).map((write) => write.nextAttemptAt ?? now),
  );
  return Math.min(Math.max(dueAt - now, MIN_WAIT_MS), MAX_TIMER_MS);
}

/**
 * Backoff for a replay the API never received.
 *
 * `streak` counts consecutive flushes that only produced writes the interceptor
 * had to queue again: one second, two, four… capped at thirty.
 */
export function transportBackoffMs(streak: number): number {
  if (streak <= 0) return 0;
  return Math.min(BASE_BACKOFF_MS * Math.pow(2, streak - 1), MAX_BACKOFF_MS);
}

export type ReplayDecision =
  | {
      action: "drop";
      reason: "permanent" | "unknown-outcome" | "exhausted";
    }
  | {
      action: "retry";
      reason: "throttled" | "transport";
      waitMs: number;
      /** Whether the attempt spends the row's retry budget. */
      counts: boolean;
    };

/**
 * What to do with a rejected replay.
 *
 * - 429: the write is valid and must not be lost. It stays queued, waits for
 *   the window the API announced (no cap: a recovery bucket asks for an hour),
 *   and spends no budget, so a batch of offline records is not trimmed to the
 *   throttler limit.
 * - any other 4xx: permanent, the answer cannot change.
 * - timeout without an idempotency key: unknown outcome, and resending is how a
 *   spreadsheet import ends up in the account twice.
 * - everything else: bounded exponential backoff.
 */
export function decideReplay(
  error: unknown,
  write: QueuedWrite,
): ReplayDecision {
  const response = (
    error as {
      response?: { status?: number; headers?: Record<string, unknown> };
    }
  )?.response;
  const status = response?.status;

  if (status === RATE_LIMIT_STATUS) {
    return {
      action: "retry",
      reason: "throttled",
      waitMs: readRetryAfterMs(response?.headers) ?? DEFAULT_RATE_LIMIT_WAIT_MS,
      counts: false,
    };
  }

  if (status && status >= 400 && status < 500) {
    return { action: "drop", reason: "permanent" };
  }

  const code = (error as { code?: string })?.code;
  const timedOut = code === "ECONNABORTED" || code === "ETIMEDOUT";
  if (timedOut && !write.idempotencyKey) {
    return { action: "drop", reason: "unknown-outcome" };
  }

  if (write.retryCount >= MAX_RETRIES) {
    return { action: "drop", reason: "exhausted" };
  }

  return {
    action: "retry",
    reason: "transport",
    waitMs: Math.min(
      BASE_BACKOFF_MS * Math.pow(2, write.retryCount),
      MAX_BACKOFF_MS,
    ),
    counts: true,
  };
}

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
 * Reads whatever a previous build stored and returns the current schema.
 *
 * v1 was a bare array: order came from the array position, the resource key did
 * not exist, and credential bodies could still be sitting there. Those rows are
 * migrated in place — sequence from the position, key derived from the payload,
 * state from the deadline — and the credential ones are dropped.
 */
export function hydrateQueue(raw: string | null, now: number): QueuedStore {
  const empty: QueuedStore = {
    version: QUEUE_STORAGE_VERSION,
    nextSequence: 1,
    writes: [],
  };
  if (!raw) return empty;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return empty;
  }

  const isCurrentSchema =
    typeof parsed === "object" &&
    parsed !== null &&
    (parsed as { version?: unknown }).version === QUEUE_STORAGE_VERSION &&
    Array.isArray((parsed as { writes?: unknown }).writes);

  const rows = Array.isArray(parsed)
    ? parsed
    : isCurrentSchema
    ? (parsed as { writes: unknown[] }).writes
    : null;
  if (!rows) return empty;

  const writes: QueuedWrite[] = [];

  rows.forEach((row, index) => {
    if (!row || typeof row !== "object") return;

    const candidate = row as Partial<QueuedWrite>;
    if (carriesCredentials(candidate.data)) return;

    const sequence =
      typeof candidate.sequence === "number" &&
      Number.isFinite(candidate.sequence)
        ? candidate.sequence
        : index + 1;
    const method = (candidate.method ?? "POST") as QueuedMethod;
    const url = candidate.url ?? "";
    const nextAttemptAt =
      typeof candidate.nextAttemptAt === "number"
        ? candidate.nextAttemptAt
        : undefined;

    writes.push({
      id: typeof candidate.id === "string" ? candidate.id : String(sequence),
      sequence,
      resourceKey:
        typeof candidate.resourceKey === "string" && candidate.resourceKey
          ? candidate.resourceKey
          : deriveResourceKey(method, url, candidate.data),
      method,
      url,
      data: candidate.data,
      idempotencyKey: candidate.idempotencyKey,
      timeout: candidate.timeout,
      timestamp:
        typeof candidate.timestamp === "number" ? candidate.timestamp : now,
      retryCount:
        typeof candidate.retryCount === "number" ? candidate.retryCount : 0,
      nextAttemptAt,
      // A row persisted mid-send is not trusted as in flight: the reload cannot
      // know whether the API applied it, and the idempotency key is what makes
      // the resend safe.
      state: (nextAttemptAt ?? 0) > now ? "waiting" : "ready",
    });
  });

  writes.sort((a, b) => a.sequence - b.sequence);

  const storedNextSequence = isCurrentSchema
    ? (parsed as { nextSequence?: unknown }).nextSequence
    : undefined;
  const highest = writes.reduce(
    (max, write) => Math.max(max, write.sequence),
    0,
  );
  const nextSequence =
    typeof storedNextSequence === "number" &&
    Number.isFinite(storedNextSequence)
      ? Math.max(storedNextSequence, highest + 1)
      : highest + 1;

  return { version: QUEUE_STORAGE_VERSION, nextSequence, writes };
}
