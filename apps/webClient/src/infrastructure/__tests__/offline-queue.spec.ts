import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  carriesCredentials,
  clearQueue,
  enqueueRequest,
  flushQueue,
  resumeQueue,
  type QueuedWrite,
} from "../offline-queue";

/**
 * The queue persists request bodies in `localStorage`, so a credential body
 * would survive logout and be readable by any other profile on the browser.
 * Login, signup and password change all carry one.
 */
describe("carriesCredentials", () => {
  it("detects the password-change payload", () => {
    expect(
      carriesCredentials({
        currentPassword: "#Password123",
        newPassword: "#NewPass456",
      }),
    ).toBe(true);
  });

  it("detects login and signup payloads", () => {
    expect(carriesCredentials({ email: "a@b.com", password: "secret" })).toBe(
      true,
    );
  });

  it("ignores ordinary mutation bodies", () => {
    expect(carriesCredentials({ name: "Alk", surname: "Campbell" })).toBe(
      false,
    );
    expect(
      carriesCredentials({
        amount: 10,
        category: "food",
        description: "lunch",
      }),
    ).toBe(false);
  });

  it("handles bodies that are not objects", () => {
    expect(carriesCredentials(undefined)).toBe(false);
    expect(carriesCredentials(null)).toBe(false);
    expect(carriesCredentials("password")).toBe(false);
    expect(carriesCredentials(["password"])).toBe(false);
  });
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
    const removeItem = vi.fn();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem,
    });

    clearQueue();

    expect(removeItem).toHaveBeenCalledWith("offline_queue");
  });

  it("does not throw when storage is unavailable", () => {
    expect(() => clearQueue()).not.toThrow();
  });

  it("refuses to queue until the next sign-in", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    });

    clearQueue();
    enqueueRequest("POST", "/transactions", { amount: 10 });
    expect(store.get("offline_queue")).toBeUndefined();

    resumeQueue();
    enqueueRequest("POST", "/transactions", { amount: 10 });
    expect(store.get("offline_queue")).toContain("10");
  });
});

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
  return (JSON.parse(raw) as { writes: QueuedWrite[] }).writes;
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
 * Replay behaviour. A throttled or interrupted write must survive: it is the
 * only copy of what the user recorded while offline.
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
    expect((row.nextAttemptAt ?? 0) - Date.now()).toBe(3_600_000);

    // A flush requested before the deadline (a reload, another write) must not
    // resend it: the stored deadline wins over the wake-up.
    await flushQueue(makeClient(post));
    expect(calls).toBe(1);
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
          method: "PUT",
          url: "/transactions",
          data: { id: 42, amount: 20 },
          timestamp: start,
          retryCount: 0,
          nextAttemptAt: start + 11_000,
        },
        {
          id: "edit-25",
          method: "PUT",
          url: "/transactions",
          data: { id: 42, amount: 25 },
          timestamp: start + 1,
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

    // The newer edit is due, but the edit it depends on is not: it must not
    // overtake it, or the older amount would be the one that sticks.
    vi.setSystemTime(start + 10_500);
    await flushQueue(makeClient(post));
    expect(written).toEqual([]);

    vi.setSystemTime(start + 11_500);
    await flushQueue(makeClient(post));

    expect(written).toEqual([20, 25]);
    expect(readQueue(store)).toHaveLength(0);
  });

  it("never writes a credential body to storage", () => {
    const store = stubStorage();

    enqueueRequest("POST", "/auth/login", {
      email: "a@b.com",
      password: "secret",
    });

    expect(store.get("offline_queue")).toBeUndefined();
  });

  it("persists the deadline as a waiting row and revives it once it passes", async () => {
    const store = stubStorage();
    enqueueRequest("POST", "/transactions", { amount: 1 });

    await flushQueue(
      makeClient(async () => {
        throw throttled("60");
      }),
    );

    const [row] = readQueue(store);
    expect(row.state).toBe("waiting");
    expect(row.nextAttemptAt).toBe(Date.now() + 60_000);

    // A reload re-reads the stored deadline: the row is due again by then.
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

  it("backs off exponentially while replay keeps hitting an unreachable API", async () => {
    const store = stubStorage();

    // A clean pass resets the failure streak.
    store.delete("offline_queue");
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
});
