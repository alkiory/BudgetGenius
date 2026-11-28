import { describe, expect, it } from "vitest";
import {
  type QueuedWrite,
  carriesCredentials,
  decideReplay,
  deriveResourceKey,
  firstPerResource,
  hydrateQueue,
  isDue,
  nextWakeDelayMs,
  transportBackoffMs,
} from "../offline-queue.model";

const write = (overrides: Partial<QueuedWrite> = {}): QueuedWrite => ({
  id: "w1",
  sequence: 1,
  resourceKey: "PUT /transactions 42",
  method: "PUT",
  url: "/transactions",
  data: { id: 42 },
  state: "ready",
  timestamp: 0,
  retryCount: 0,
  ...overrides,
});

const NOW = 1_800_000_000_000;

describe("resource identity", () => {
  it("groups edits of one transaction and separates the rest", () => {
    const first = deriveResourceKey("PUT", "/transactions", { id: 42 });
    const second = deriveResourceKey("PUT", "/transactions", { id: 42 });

    expect(first).toBe(second);
    expect(deriveResourceKey("PUT", "/transactions", { id: 43 })).not.toBe(
      first,
    );
    expect(deriveResourceKey("DELETE", "/transactions", { id: 42 })).not.toBe(
      first,
    );
    expect(deriveResourceKey("POST", "/transactions", { amount: 10 })).toBe(
      "POST /transactions ",
    );
  });

  it("accepts transactionId as the id field", () => {
    expect(
      deriveResourceKey("PUT", "/transactions", { transactionId: 7 }),
    ).toBe("PUT /transactions 7");
  });
});

describe("due rule", () => {
  it("only sends ready rows whose deadline has passed", () => {
    expect(isDue(write(), NOW)).toBe(true);
    expect(isDue(write({ state: "waiting" }), NOW)).toBe(false);
    expect(isDue(write({ nextAttemptAt: NOW + 1 }), NOW)).toBe(false);
    expect(isDue(write({ nextAttemptAt: NOW }), NOW)).toBe(true);
  });
});

describe("replay decisions", () => {
  it("drops permanent client errors", () => {
    for (const status of [400, 403, 404, 409, 413]) {
      expect(decideReplay({ response: { status } }, write())).toEqual({
        action: "drop",
        reason: "permanent",
      });
    }
  });

  it("keeps a throttled write and waits for the window the API announced", () => {
    const decision = decideReplay(
      { response: { status: 429, headers: { "retry-after": "7" } } },
      write(),
    );

    expect(decision).toEqual({
      action: "retry",
      reason: "throttled",
      waitMs: 7_000,
      counts: false,
    });
  });

  it("honours a throttling window longer than a minute", () => {
    const decision = decideReplay(
      { response: { status: 429, headers: { "retry-after": "3600" } } },
      write(),
    );

    expect(decision).toMatchObject({ action: "retry", waitMs: 3_600_000 });
  });

  it("falls back to ten seconds for a 429 without a usable header", () => {
    expect(
      decideReplay({ response: { status: 429, headers: {} } }, write()),
    ).toMatchObject({ action: "retry", waitMs: 10_000 });

    expect(
      decideReplay(
        { response: { status: 429, headers: { "retry-after": "later" } } },
        write(),
      ),
    ).toMatchObject({ action: "retry", waitMs: 10_000 });
  });

  it("drops a timeout whose outcome is unknown", () => {
    expect(
      decideReplay({ code: "ECONNABORTED" }, write({ retryCount: 0 })),
    ).toEqual({ action: "drop", reason: "unknown-outcome" });
  });

  it("replays a keyed timeout, because the receipt makes it safe", () => {
    const decision = decideReplay(
      { code: "ETIMEDOUT" },
      write({ idempotencyKey: "key-123456", retryCount: 2 }),
    );

    expect(decision).toEqual({
      action: "retry",
      reason: "transport",
      waitMs: 4_000,
      counts: true,
    });
  });

  it("gives up on a transport failure after the retry budget", () => {
    expect(
      decideReplay({ code: "ERR_NETWORK" }, write({ retryCount: 5 })),
    ).toEqual({ action: "drop", reason: "exhausted" });
  });
});

describe("transport backoff", () => {
  it("doubles from one second and caps at thirty", () => {
    expect(transportBackoffMs(0)).toBe(0);
    expect(transportBackoffMs(1)).toBe(1_000);
    expect(transportBackoffMs(2)).toBe(2_000);
    expect(transportBackoffMs(3)).toBe(4_000);
    expect(transportBackoffMs(10)).toBe(30_000);
  });
});

describe("ordering and wake-ups", () => {
  const older = write({
    id: "older",
    sequence: 1,
    resourceKey: "PUT /transactions 42",
    nextAttemptAt: NOW + 11_000,
    state: "waiting",
  });
  const newer = write({
    id: "newer",
    sequence: 2,
    resourceKey: "PUT /transactions 42",
    nextAttemptAt: NOW + 10_000,
    state: "waiting",
  });

  it("keeps the first pending write of every resource", () => {
    expect(firstPerResource([older, newer]).map((row) => row.id)).toEqual([
      "older",
    ]);
  });

  it("wakes for the blocked predecessor, not the earlier successor", () => {
    expect(nextWakeDelayMs([older, newer], NOW)).toBe(11_000);
  });

  it("never wakes sooner than a second nor later than the timer limit", () => {
    expect(nextWakeDelayMs([write()], NOW)).toBe(1_000);
    expect(
      nextWakeDelayMs(
        [write({ nextAttemptAt: NOW + 30 * 24 * 3600_000 })],
        NOW,
      ),
    ).toBe(2_147_483_000);
    expect(nextWakeDelayMs([], NOW)).toBeNull();
  });
});

describe("stored queue", () => {
  it("returns an empty queue for missing or broken storage", () => {
    expect(hydrateQueue(null, NOW).writes).toEqual([]);
    expect(hydrateQueue("{not json", NOW).writes).toEqual([]);
  });

  it("migrates the v1 array: sequence from position, key from the payload", () => {
    const store = hydrateQueue(
      JSON.stringify([
        { id: "a", method: "PUT", url: "/transactions", data: { id: 42 } },
        {
          id: "b",
          method: "POST",
          url: "/transactions",
          data: { amount: 10 },
          nextAttemptAt: NOW + 5_000,
        },
      ]),
      NOW,
    );

    expect(store.version).toBe(2);
    expect(store.writes.map((row) => row.sequence)).toEqual([1, 2]);
    expect(store.writes[0].resourceKey).toBe("PUT /transactions 42");
    expect(store.writes[1].resourceKey).toBe("POST /transactions ");
    expect(store.writes[1].state).toBe("waiting");
    expect(store.nextSequence).toBe(3);
  });

  it("drops credential bodies left by an older build", () => {
    const store = hydrateQueue(
      JSON.stringify([
        {
          id: "a",
          method: "POST",
          url: "/auth/login",
          data: { email: "a@b.com", password: "secret" },
        },
      ]),
      NOW,
    );

    expect(store.writes).toEqual([]);
    expect(carriesCredentials({ password: "x" })).toBe(true);
  });

  it("sorts by sequence and keeps nextSequence ahead of every row", () => {
    const store = hydrateQueue(
      JSON.stringify({
        version: 2,
        nextSequence: 2,
        writes: [
          { id: "b", sequence: 7, method: "POST", url: "/x" },
          { id: "a", sequence: 3, method: "POST", url: "/y" },
        ],
      }),
      NOW,
    );

    expect(store.writes.map((row) => row.id)).toEqual(["a", "b"]);
    expect(store.nextSequence).toBe(8);
  });
});
