import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  carriesCredentials,
  clearQueue,
  enqueueRequest,
  flushQueue,
  resumeQueue,
  type QueuedRequest,
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

const readQueue = (store: Map<string, string>): QueuedRequest[] =>
  JSON.parse(store.get("offline_queue") ?? "[]") as QueuedRequest[];

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
});
