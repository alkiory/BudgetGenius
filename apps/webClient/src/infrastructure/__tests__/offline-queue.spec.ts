import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type QueuedWrite,
  clearQueue,
  enqueueRequest,
  flushQueue,
  resumeQueue,
} from "../offline-queue";

const stubStorage = (): Map<string, string> => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
  return store;
};

const readQueue = (store: Map<string, string>): QueuedWrite[] => {
  const raw = store.get("offline_queue");
  if (!raw) return [];
  return JSON.parse(raw) as QueuedWrite[];
};

type MockPost = (
  url: string,
  data?: unknown,
  config?: { timeout?: number; headers?: Record<string, string> },
) => Promise<unknown>;

const makeClient = (post: MockPost) => ({
  post,
  put: post,
  patch: post,
  delete: post,
});

const throttled = (retryAfter?: string) => ({
  response: {
    status: 429,
    headers: retryAfter ? { "retry-after": retryAfter } : {},
  },
});

/**
 * The queue is purged when the session ends, so the next account that uses the
 * browser profile cannot read the previous one's pending movements.
 */
describe("clearQueue", () => {
  afterEach(() => {
    resumeQueue();
    vi.unstubAllGlobals();
  });

  it("removes the persisted queue", () => {
    const store = stubStorage();

    clearQueue();

    expect(store.get("offline_queue")).toBeUndefined();
  });

  it("refuses to queue until the next sign-in", () => {
    const store = stubStorage();

    clearQueue();
    expect(enqueueRequest("POST", "/transactions", { amount: 10 })).toBe(false);
    expect(store.get("offline_queue")).toBeUndefined();

    resumeQueue();
    expect(enqueueRequest("POST", "/transactions", { amount: 10 })).toBe(true);
    expect(store.get("offline_queue")).toContain("10");
  });
});

/**
 * Replay behaviour. A queued write is the only copy of what the user did while
 * offline, so it must survive throttling, interruptions and reloads.
 */
describe("flushQueue", () => {
  beforeEach(() => {
    // Fake timers keep a scheduled wake from firing in the middle of an
    // assertion; moving the clock with `setSystemTime` releases the deadline
    // without running the callbacks.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    resumeQueue();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reports whether the row reached storage", () => {
    const store = stubStorage();

    expect(enqueueRequest("POST", "/budgets", { name: "Rent" })).toBe(true);
    expect(readQueue(store)).toHaveLength(1);

    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    });

    // The interceptor only answers "saved offline" when this is true.
    expect(enqueueRequest("POST", "/budgets", { name: "Food" })).toBe(false);
  });

  it("never writes a credential body to storage", () => {
    const store = stubStorage();

    expect(
      enqueueRequest("POST", "/auth/login", {
        email: "a@b.com",
        password: "secret",
      }),
    ).toBe(false);
    expect(store.get("offline_queue")).toBeUndefined();
  });

  it("keeps a row an older bundle appends to the shared array", async () => {
    const store = stubStorage();
    expect(enqueueRequest("POST", "/budgets", { name: "Rent" })).toBe(true);

    // A tab still running the previous bundle reads the array and appends its
    // own row without sequence or resource key.
    const rows = JSON.parse(store.get("offline_queue") ?? "[]") as unknown[];
    expect(Array.isArray(rows)).toBe(true);
    rows.push({
      id: "old-row",
      method: "POST",
      url: "/transactions",
      data: { amount: 5 },
      timestamp: 1,
      retryCount: 0,
    });
    store.set("offline_queue", JSON.stringify(rows));

    const sent: string[] = [];
    await flushQueue(
      makeClient(async (url) => {
        sent.push(url);
        return { data: {} };
      }),
    );

    expect(sent).toEqual(["/budgets", "/transactions"]);
    expect(readQueue(store)).toHaveLength(0);
  });

  it("keeps a write throttled more than five times and clears it once accepted", async () => {
    const store = stubStorage();
    enqueueRequest("POST", "/transactions", { amount: 10 });

    let attempts = 0;
    const post: MockPost = async () => {
      attempts += 1;
      if (attempts <= 6) throw throttled("30");
      return { data: { id: 1 } };
    };

    for (let pass = 0; pass < 7; pass += 1) {
      await flushQueue(makeClient(post));
      // Past the announced window, so the next pass is allowed to send again.
      vi.setSystemTime(Date.now() + 31_000);
    }

    expect(attempts).toBe(7);
    expect(readQueue(store)).toHaveLength(0);
  });

  it("waits for the deadline the server announced, even past a minute", async () => {
    const store = stubStorage();
    enqueueRequest("POST", "/auth/forgot-password", { email: "a@b.com" });

    let calls = 0;
    const post: MockPost = async () => {
      calls += 1;
      throw throttled("3600");
    };

    await flushQueue(makeClient(post));

    const [row] = readQueue(store);
    expect(row.retryCount).toBe(0);
    expect(row.state).toBe("waiting");
    expect((row.nextAttemptAt ?? 0) - Date.now()).toBe(3_600_000);

    // A reload, or a wake, before the deadline must not resend it.
    await flushQueue(makeClient(post));
    expect(calls).toBe(1);
  });

  it("revives a waiting row once its deadline passes", async () => {
    const store = stubStorage();
    enqueueRequest("POST", "/transactions", { amount: 1 });

    await flushQueue(
      makeClient(async () => {
        throw throttled("60");
      }),
    );
    expect(readQueue(store)[0].state).toBe("waiting");

    vi.setSystemTime(Date.now() + 61_000);
    const sent: unknown[] = [];
    await flushQueue(
      makeClient(async (_url, data) => {
        sent.push(data);
        return { data: {} };
      }),
    );

    expect(sent).toHaveLength(1);
    expect(readQueue(store)).toHaveLength(0);
  });

  it("reschedules a write the interceptor re-queued during the flush", async () => {
    const store = stubStorage();
    enqueueRequest("POST", "/transactions", { amount: 6 });

    const post: MockPost = async () => {
      // The interceptor queues the replacement and resolves the request, so
      // this pass sees a success.
      enqueueRequest("POST", "/transactions", { amount: 7 });
      return { data: {} };
    };

    await flushQueue(makeClient(post));

    expect(
      readQueue(store).map((row) => (row.data as { amount: number }).amount),
    ).toEqual([7]);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });

  it("replays edits to one transaction in the order they were made", async () => {
    const store = stubStorage();
    const start = Date.now();

    // The newer edit carries the earlier deadline, as happens when the API
    // answers two throttled PUTs with different windows.
    store.set(
      "offline_queue",
      JSON.stringify([
        {
          id: "edit-20",
          sequence: 1,
          method: "PUT",
          url: "/transactions",
          data: { id: 42, amount: 20 },
          retryCount: 0,
          nextAttemptAt: start + 11_000,
        },
        {
          id: "edit-25",
          sequence: 2,
          method: "PUT",
          url: "/transactions",
          data: { id: 42, amount: 25 },
          retryCount: 0,
          nextAttemptAt: start + 10_000,
        },
      ]),
    );

    const written: number[] = [];
    const post: MockPost = async (_url, data) => {
      written.push((data as { amount: number }).amount);
      return { data: {} };
    };

    await flushQueue(makeClient(post));
    expect(written).toEqual([]);

    // The newer edit is due, but the edit it depends on is not: overtaking it
    // would leave the older amount as the one that sticks.
    vi.setSystemTime(start + 10_500);
    await flushQueue(makeClient(post));
    expect(written).toEqual([]);

    vi.setSystemTime(start + 11_500);
    await flushQueue(makeClient(post));

    expect(written).toEqual([20, 25]);
    expect(readQueue(store)).toHaveLength(0);
  });

  it("backs off exponentially while replay keeps hitting an unreachable API", async () => {
    const store = stubStorage();

    // A send that lands is the only thing that resets the streak.
    enqueueRequest("POST", "/transactions", { amount: 0 });
    await flushQueue(makeClient(async () => ({ data: {} })));

    enqueueRequest("POST", "/transactions", { amount: 1 });

    const post: MockPost = async () => {
      // What the interceptor does when the connection drops mid-replay.
      enqueueRequest("POST", "/transactions", { amount: 1 });
      return { data: {} };
    };

    const waits: number[] = [];
    for (let pass = 0; pass < 3; pass += 1) {
      await flushQueue(makeClient(post));
      const pending = readQueue(store);
      waits.push(
        Math.min(...pending.map((row) => row.nextAttemptAt ?? 0)) - Date.now(),
      );
      vi.setSystemTime(Date.now() + 31_000);
    }

    expect(waits).toEqual([1_000, 2_000, 4_000]);
  });

  it("does not reset the outage backoff on a wake that sends nothing", async () => {
    const store = stubStorage();
    // The streak is module state shared with the tests above; a send that lands
    // is the only thing that clears it, so start from a known zero.
    enqueueRequest("POST", "/transactions", { amount: 0 });
    await flushQueue(makeClient(async () => ({ data: {} })));

    enqueueRequest("POST", "/transactions", { amount: 1 });

    const post: MockPost = async () => {
      enqueueRequest("POST", "/transactions", { amount: 1 });
      return { data: {} };
    };

    await flushQueue(makeClient(post)); // streak 1, successor waits one second
    await flushQueue(makeClient(post)); // nothing due: no evidence either way
    expect(readQueue(store)).toHaveLength(1);

    vi.setSystemTime(Date.now() + 1_000);
    await flushQueue(makeClient(post)); // streak 2

    expect(readQueue(store)).toHaveLength(1);
    const next =
      Math.min(...readQueue(store).map((row) => row.nextAttemptAt ?? 0)) -
      Date.now();
    expect(next).toBe(2_000);
  });
});
