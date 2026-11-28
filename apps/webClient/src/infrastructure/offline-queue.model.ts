/**
 * The offline write queue, as a model.
 *
 * A row is a write the API has not confirmed yet. Five properties are explicit
 * and every rule here reads them — nothing is inferred from the payload at send
 * time:
 *
 * - `resourceKey` — what the write touches. Rows that share it are replayed in
 *   `sequence` order, because the server applies the last PUT it receives and
 *   an older amount must never overwrite a newer edit.
 * - `sequence` — enqueue order, assigned once and never reused.
 * - `idempotencyKey` — makes a resend safe: the API stores a receipt and
 *   answers with it instead of writing the rows twice.
 * - `state` / `nextAttemptAt` — `waiting` means the row has a deadline in the
 *   future, `ready` means it may be sent now. Both are written only by
 *   `withDeadline`, so they cannot disagree.
 *
 * A row in flight is never persisted: if the tab dies mid-send it reloads as
 * `ready`, and the idempotency key keeps the outcome single.
 *
 * Storage and the flush loop live in `offline-queue.ts`; this module stays pure
 * so the invariants can be tested without a browser.
 */

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
  /** Failed attempts that spent the budget (a 429 does not). */
  retryCount: number;
  /** Account that queued the row, when the app knew it. */
  owner?: string;
}

/**
 * What is persisted: the inputs, never the derived values.
 *
 * `resourceKey` and `state` are computed from `method`/`url`/`data` and from
 * `nextAttemptAt`, so storing them would only create a second version of the
 * truth — the shape that let an old key split two edits of one transaction.
 */
export type StoredWrite = Omit<QueuedWrite, "state" | "resourceKey">;

export function toStoredRow(write: QueuedWrite): StoredWrite {
  const row: Partial<QueuedWrite> = { ...write };
  delete row.state;
  delete row.resourceKey;
  return row as StoredWrite;
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
 * The only place that writes `state` and `nextAttemptAt`.
 *
 * A deadline in the future makes the row `waiting`; anything else clears it and
 * makes the row `ready`. Having one constructor for the pair is what keeps
 * "one source of truth" from decaying into two fields that drift.
 */
export function withDeadline(
  write: QueuedWrite,
  nextAttemptAt: number | undefined,
  now: number,
): QueuedWrite {
  const waiting = nextAttemptAt !== undefined && nextAttemptAt > now;

  return {
    ...write,
    nextAttemptAt: waiting ? nextAttemptAt : undefined,
    state: waiting ? "waiting" : "ready",
  };
}

/**
 * The body as an object, whichever form it arrives in.
 *
 * The interceptor queues `config.data` after axios has serialised it, so real
 * rows carry a JSON string. Reading only objects would miss the id (every edit
 * of every transaction would share one resource key) and — worse — would let a
 * serialised login body past the credential check.
 */
function asRecord(data: unknown): Record<string, unknown> | null {
  if (typeof data === "string") {
    try {
      const parsed: unknown = JSON.parse(data);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  return data && typeof data === "object"
    ? (data as Record<string, unknown>)
    : null;
}

/**
 * Whether a body carries a credential.
 *
 * The queue persists bodies, which is right for a transaction and wrong for a
 * password: any other profile on this browser could read it after logout.
 * Credential writes are rejected instead of queued, so the caller sees the
 * network error.
 */
export function carriesCredentials(data: unknown): boolean {
  const record = asRecord(data);
  return record ? CREDENTIAL_FIELDS.some((field) => field in record) : false;
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
  const body = asRecord(data);
  const id = body?.id ?? body?.transactionId ?? "";
  return `${method} ${url} ${String(id)}`;
}

/** Only a `ready` row may be sent; `withDeadline` owns that field. */
export function isDue(write: QueuedWrite): boolean {
  return write.state === "ready";
}

/**
 * First pending write of every resource, in sequence order.
 *
 * Only these rows can be sent next: a successor waits for the write it would
 * overwrite, whatever its own deadline says.
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
  | { action: "drop" }
  | {
      action: "retry";
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
      waitMs: readRetryAfterMs(response?.headers) ?? DEFAULT_RATE_LIMIT_WAIT_MS,
      counts: false,
    };
  }

  if (status && status >= 400 && status < 500) {
    return { action: "drop" };
  }

  const code = (error as { code?: string })?.code;
  const timedOut = code === "ECONNABORTED" || code === "ETIMEDOUT";
  if (timedOut && !write.idempotencyKey) {
    return { action: "drop" };
  }

  if (write.retryCount >= MAX_RETRIES) {
    return { action: "drop" };
  }

  return {
    action: "retry",
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
  return Number.isNaN(date) ? null : Math.max(0, date - now());
}

function now(): number {
  return Date.now();
}

/**
 * Rows that only this bundle can replay faithfully.
 *
 * An older bundle replays a row as method, URL and body. That is enough for a
 * write it would have made itself, and not enough for one that carries replay
 * metadata: dropping the `Idempotency-Key` turns a retried import that already
 * committed into a second copy of the batch. Such rows are kept apart, in a
 * place an older bundle does not read.
 */
export function needsOwnReplay(write: QueuedWrite): boolean {
  return write.idempotencyKey !== undefined || write.timeout !== undefined;
}

/**
 * Rows in a stored value, in either shape that has ever been written.
 *
 * A build in this branch persisted `{ version, nextSequence, writes }`; the
 * array is what every other build writes. Both are read, so a queue saved by
 * one of them is not overwritten as if it were empty.
 */
function parseRows(raw: string | null): unknown[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (Array.isArray(parsed)) return parsed;

  const writes = (parsed as { writes?: unknown } | null)?.writes;
  return Array.isArray(writes) ? writes : [];
}

/**
 * Highest sequence explicitly stored in any of the given values.
 *
 * The queue lives in two keys, and a row without a sequence can be appended to
 * either one. Assigning it a number from only its own key would let it collide
 * with — and sort before — a row already numbered in the other, which is how a
 * newer import could overtake one still waiting for its retry window.
 */
export function highestExplicitSequence(...raws: (string | null)[]): number {
  return raws.reduce((highest, raw) => {
    for (const row of parseRows(raw)) {
      const sequence = (row as Partial<QueuedWrite> | null)?.sequence;
      if (typeof sequence === "number" && Number.isFinite(sequence)) {
        highest = Math.max(highest, sequence);
      }
    }
    return highest;
  }, 0);
}

/**
 * Reads a stored value and returns the current rows.
 *
 * Only the inputs are trusted: `resourceKey` is derived here from method, URL
 * and body — including for rows an older bundle wrote — so two edits of one
 * transaction always land in the same group, and `state` comes from the stored
 * deadline through `withDeadline`.
 *
 * Rows an older bundle appended have no `sequence`; they go after every
 * explicit one, in array order, because that is the order they were made in.
 * Credential rows left by an older build are dropped.
 */
export function hydrateQueue(
  raw: string | null,
  at: number,
  startAt = 0,
): QueuedWrite[] {
  const parsed = parseRows(raw);
  if (parsed.length === 0) return [];

  let next = parsed.reduce((highest: number, row: unknown) => {
    const sequence = (row as Partial<QueuedWrite> | null)?.sequence;
    return typeof sequence === "number" && Number.isFinite(sequence)
      ? Math.max(highest, sequence)
      : highest;
  }, startAt);

  const writes: QueuedWrite[] = [];

  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;

    const candidate = row as Partial<QueuedWrite>;
    if (carriesCredentials(candidate.data)) continue;

    const sequence =
      typeof candidate.sequence === "number" &&
      Number.isFinite(candidate.sequence)
        ? candidate.sequence
        : ++next;
    const method = (candidate.method ?? "POST") as QueuedMethod;
    const url = candidate.url ?? "";

    writes.push(
      withDeadline(
        {
          id:
            typeof candidate.id === "string" ? candidate.id : String(sequence),
          sequence,
          resourceKey: deriveResourceKey(method, url, candidate.data),
          method,
          url,
          data: candidate.data,
          idempotencyKey: candidate.idempotencyKey,
          timeout: candidate.timeout,
          retryCount:
            typeof candidate.retryCount === "number" ? candidate.retryCount : 0,
          owner:
            typeof candidate.owner === "string" ? candidate.owner : undefined,
          state: "ready",
        },
        typeof candidate.nextAttemptAt === "number"
          ? candidate.nextAttemptAt
          : undefined,
        at,
      ),
    );
  }

  return writes.sort((a, b) => a.sequence - b.sequence);
}
