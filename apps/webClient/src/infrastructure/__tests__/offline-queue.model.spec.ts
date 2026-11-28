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
  withDeadline,
} from "../offline-queue.model";

const NOW = 1_800_000_000_000;

const write = (overrides: Partial<QueuedWrite> = {}): QueuedWrite => ({
  id: "w1",
  sequence: 1,
  resourceKey: "PUT /transactions 42",
  method: "PUT",
  url: "/transactions",
  data: { id: 42 },
  state: "ready",
  retryCount: 0,
  ...overrides,
});

describe("deadline helper", () => {
  it("is the single writer of state and deadline", () => {
    const waiting = withDeadline(write(), NOW + 5_000, NOW);
    expect(waiting.state).toBe("waiting");
    expect(waiting.nextAttemptAt).toBe(NOW + 5_000);

    const ready = withDeadline(waiting, undefined, NOW);
    expect(ready.state).toBe("ready");
    expect(ready.nextAttemptAt).toBeUndefined();

    // A deadline in the past is not a deadline: the row is due and the stale
    // value is cleared instead of lingering next to a `ready` state.
    const expired = withDeadline(write(), NOW - 1, NOW);
    expect(expired.state).toBe("ready");
    expect(expired.nextAttemptAt).toBeUndefined();
  });
});

describe("resource identity", () => {
  it("groups edits of one transaction and separates the rest", () => {
    const first = deriveResourceKey("PUT", "/transactions", { id: 42 });

    expect(deriveResourceKey("PUT", "/transactions", { id: 42 })).toBe(first);
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

  it("reads the id from the JSON string axios actually queues", () => {
    // The interceptor hands over `config.data` after serialisation.
    expect(
      deriveResourceKey("PUT", "/transactions", '{"id":42,"amount":20}'),
    ).toBe("PUT /transactions 42");
    expect(deriveResourceKey("PUT", "/transactions", "not json")).toBe(
      "PUT /transactions ",
    );
  });
});

describe("credentials", () => {
  it("detects password fields in objects and serialised bodies", () => {
    expect(carriesCredentials({ email: "a@b.com", password: "secret" })).toBe(
      true,
    );
    expect(carriesCredentials('{"email":"a@b.com","password":"secret"}')).toBe(
      true,
    );
  });

  it("ignores ordinary bodies", () => {
    expect(carriesCredentials({ name: "Rent" })).toBe(false);
    expect(carriesCredentials('{"amount":10}')).toBe(false);
    expect(carriesCredentials(undefined)).toBe(false);
    expect(carriesCredentials(["password"])).toBe(false);
  });
});

describe("due rule", () => {
  it("sends only rows the helper left ready", () => {
    expect(isDue(write())).toBe(true);
    expect(isDue(write({ state: "waiting" }))).toBe(false);
  });
});

describe("replay decisions", () => {
  it("drops permanent client errors", () => {
    for (const status of [400, 403, 404, 409, 413]) {
      expect(decideReplay({ response: { status } }, write())).toEqual({
        action: "drop",
      });
    }
  });

  it("keeps a throttled write and waits for the window the API announced", () => {
    expect(
      decideReplay(
        { response: { status: 429, headers: { "retry-after": "7" } } },
        write(),
      ),
    ).toEqual({ action: "retry", waitMs: 7_000, counts: false });
  });

  it("honours a throttling window longer than a minute", () => {
    expect(
      decideReplay(
        { response: { status: 429, headers: { "retry-after": "3600" } } },
        write(),
      ),
    ).toEqual({ action: "retry", waitMs: 3_600_000, counts: false });
  });

  it("falls back to ten seconds for a 429 without a usable header", () => {
    for (const headers of [{}, { "retry-after": "later" }]) {
      expect(
        decideReplay({ response: { status: 429, headers } }, write()),
      ).toEqual({ action: "retry", waitMs: 10_000, counts: false });
    }
  });

  it("drops a timeout whose outcome is unknown", () => {
    expect(decideReplay({ code: "ECONNABORTED" }, write())).toEqual({
      action: "drop",
    });
  });

  it("replays a keyed timeout, because the receipt makes it safe", () => {
    expect(
      decideReplay(
        { code: "ETIMEDOUT" },
        write({ idempotencyKey: "key-123456", retryCount: 2 }),
      ),
    ).toEqual({ action: "retry", waitMs: 4_000, counts: true });
  });

  it("gives up on a transport failure after the retry budget", () => {
    expect(
      decideReplay({ code: "ERR_NETWORK" }, write({ retryCount: 5 })),
    ).toEqual({ action: "drop" });
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
    nextAttemptAt: NOW + 11_000,
    state: "waiting",
  });
  const newer = write({
    id: "newer",
    sequence: 2,
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
  it("returns nothing for missing or broken storage", () => {
    expect(hydrateQueue(null, NOW)).toEqual([]);
    expect(hydrateQueue("{not json", NOW)).toEqual([]);
  });

  it("migrates the array an older bundle wrote: sequence and key are derived", () => {
    const rows = hydrateQueue(
      JSON.stringify([
        { id: "a", method: "PUT", url: "/transactions", data: { id: 42 } },
        {
          id: "b",
          method: "POST",
          url: "/transactions",
          data: '{"amount":10}',
          nextAttemptAt: NOW + 5_000,
        },
      ]),
      NOW,
    );

    expect(rows.map((row) => row.sequence)).toEqual([1, 2]);
    expect(rows[0].resourceKey).toBe("PUT /transactions 42");
    expect(rows[1].resourceKey).toBe("POST /transactions ");
    expect(rows[1].state).toBe("waiting");
    expect(rows[1].nextAttemptAt).toBe(NOW + 5_000);
  });

  it("still reads the object shape an intermediate build produced", () => {
    const rows = hydrateQueue(
      JSON.stringify({
        version: 2,
        nextSequence: 3,
        writes: [{ id: "a", method: "POST", url: "/x", sequence: 9 }],
      }),
      NOW,
    );

    expect(rows.map((row) => row.id)).toEqual(["a"]);
    expect(rows[0].sequence).toBe(9);
  });

  it("drops credential bodies left by an older build", () => {
    const rows = hydrateQueue(
      JSON.stringify([
        {
          id: "a",
          method: "POST",
          url: "/auth/login",
          data: '{"email":"a@b.com","password":"secret"}',
        },
      ]),
      NOW,
    );

    expect(rows).toEqual([]);
  });

  it("sorts by sequence whatever order the JSON had", () => {
    const rows = hydrateQueue(
      JSON.stringify([
        { id: "b", sequence: 7, method: "POST", url: "/x" },
        { id: "a", sequence: 3, method: "POST", url: "/y" },
      ]),
      NOW,
    );

    expect(rows.map((row) => row.id)).toEqual(["a", "b"]);
  });
});
