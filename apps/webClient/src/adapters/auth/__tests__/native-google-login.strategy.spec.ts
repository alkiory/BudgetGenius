import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Vitest regression suite for the Account reauth [code=16] matcher in
 * `apps/webClient/src/adapters/auth/native-google-login.strategy.ts`.
 *
 * Why this exists: the matcher is load-bearing in production — when
 * `@capgo/capacitor-social-login` raises "Google Sign-In failed: [16]
 * Account reauth failed." on the Android APK (SHA-1 fingerprint
 * registration gap), the matcher decides whether to surface an
 * actionable marker pointing the operator at the registration playbook
 * (good UX) or let the raw wrapped exception land in the React error
 * UI / Sentry (bad UX, operator has no idea what to do).
 *
 * Four contract branches pinned by these specs:
 *
 *   Branch 1 (positive) — simulated native ApiException with
 *     `code: 16` AT-message "Google Sign-In failed: [16] Account
 *     reauth failed."  → MUST be rethrown with the Account reauth
 *     marker that references apps/mobile/README.md.
 *   Branch 2 (positive) — Error whose message contains BOTH "account"
 *     AND "reauth" but has no numeric code  → MUST be rethrown with
 *     the Account reauth marker (text-fingerprint fallback).
 *   Branch 3 (NEGATIVE) — Firebase Error subclass carrying a STRING
 *     code like `'auth/network-request-failed'`  → MUST NOT be
 *     rethrown with the Account reauth marker. (If it did, every
 *     transient Firebase network error would tell the operator to
 *     chase the SHA-1 playbook.)
 *   Brance 4 (NEGATIVE) — a plain TypeError  → MUST NOT be rethrown
 *     with the Account reauth marker.
 *
 * Branches 3 and 4 are the negative cases that catch the regression
 * I almost shipped in the round-3 attempt: a `looksLikeNativeError`
 * predicate that fired on any error with `code !== undefined` would
 * have false-positived on Firebase errors. The matcher here uses
 * `extractErrorCode` (numeric-only) AND a strict "account AND reauth"
 * substring AND-fall-through, which is what we want to lock in.
 */

// ────────────────────────────────────────────────────────────────────────
// vi.hoisted makes `nativeMocks` available to the vi.mock factories
// (which are themselves hoisted above this module's body).
// ────────────────────────────────────────────────────────────────────────

const nativeMocks = vi.hoisted(() => ({
  SocialLogin: {
    initialize: vi.fn().mockResolvedValue(undefined),
    login: vi.fn(),
  },
}));

vi.mock("@infrastructure/platform", () => ({
  isNativePlatform: () => true,
}));

vi.mock("@capgo/capacitor-social-login", () => ({
  SocialLogin: nativeMocks.SocialLogin,
}));

vi.mock("@infrastructure/firebaseConfig", () => ({
  app: null,
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signInWithCredential: vi.fn(),
}));

// Import the strategy AFTER all vi.mock calls so the mocks are
// in place when native-google-login.strategy.ts is loaded.
import { NativeGoogleLoginStrategy } from "../native-google-login.strategy";

const VALID_WEB_CLIENT_ID =
  "fake-web-client-id.apps.googleusercontent.com";

class FakeNativeApiException extends Error {
  public readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = "ApiException";
    this.code = code;
  }
}

class FakeFirebaseError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "FirebaseError";
    this.code = code;
  }
}

describe("NativeGoogleLoginStrategy.login() — Account reauth [code=16] matcher", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GOOGLE_WEB_CLIENT_ID", VALID_WEB_CLIENT_ID);
    nativeMocks.SocialLogin.login.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Branch 1: numeric code === 16 — Capacitor wraps the native
  // GetCredentialException with code=16 + a human-readable message of
  // the form "Google Sign-In failed: [16] Account reauth failed." and
  // forwards it raw to our catch block.
  it("rethrows with the Account reauth marker when native code === 16", async () => {
    nativeMocks.SocialLogin.login.mockRejectedValue(
      new FakeNativeApiException(
        16,
        "Google Sign-In failed: [16] Account reauth failed.",
      ),
    );

    const strategy = new NativeGoogleLoginStrategy();
    await expect(strategy.login()).rejects.toThrow(
      /Account reauth failed \[code=16\]/,
    );
    // MUST also reference the README so the operator is directed to
    // the SHA-1 registration playbook.
    await expect(strategy.login()).rejects.toThrow(/apps\/mobile\/README\.md/);
  });

  // Branch 2: text fingerprint (account + reauth in same message,
  // case-insensitive) when the plugin doesn't surface a typed
  // StatusCode. Catches the user's symptom even when code !== 16
  // (because some plugin versions wrap only the message).
  it("rethrows with the Account reauth marker on text-fingerprint match", async () => {
    nativeMocks.SocialLogin.login.mockRejectedValue(
      new Error("Account reauth required — please sign in again."),
    );

    const strategy = new NativeGoogleLoginStrategy();
    await expect(strategy.login()).rejects.toThrow(
      /Account reauth failed \[code=16\]/,
    );
    await expect(strategy.login()).rejects.toThrow(/apps\/mobile\/README\.md/);
  });

  // Branch 3 (NEGATIVE): a FirebaseError carrying the STRING code
  // 'auth/network-request-failed'. The matcher must NOT
  // re-route the error to the Account reauth playbook — the operator
  // would chase SHA-1 registration for an unrelated transient
  // network failure and Sentry would ingest a false-positive warning
  // per failed login.
  it("does NOT rethrow the Account reauth marker on FirebaseError with string 'auth/network-request-failed' code", async () => {
    nativeMocks.SocialLogin.login.mockRejectedValue(
      new FakeFirebaseError(
        "auth/network-request-failed",
        "A network error has occurred.",
      ),
    );

    const strategy = new NativeGoogleLoginStrategy();
    // The raw Firebase message should propagate intact.
    await expect(strategy.login()).rejects.toThrow(
      /A network error has occurred/,
    );
    // The Account reauth marker MUST NOT be added.
    await expect(strategy.login()).rejects.not.toThrow(
      /Account reauth failed \[code=16\]/,
    );
  });

  // Branch 4 (NEGATIVE): a generic TypeError with completely
  // unrelated content. The matcher must NOT fire; the original
  // TypeError class and message should propagate.
  it("does NOT rethrow the Account reauth marker on a generic TypeError", async () => {
    const typeError = new TypeError(
      "Cannot read properties of undefined (reading 'foo')",
    );
    nativeMocks.SocialLogin.login.mockRejectedValue(typeError);

    const strategy = new NativeGoogleLoginStrategy();
    await expect(strategy.login()).rejects.toBeInstanceOf(TypeError);
    await expect(strategy.login()).rejects.toThrow(
      /Cannot read properties of undefined/,
    );
    await expect(strategy.login()).rejects.not.toThrow(
      /Account reauth failed \[code=16\]/,
    );
  });
});
