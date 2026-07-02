import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Vitest regression suite for the §6.8.4 invariant in
 * `apps/webClient/src/adapters/auth/hybrid-google-login.strategy.ts`.
 *
 * Why this exists: the typed sentinel (`isAccountReauth === true`) was
 * introduced to decouple the Account reauth producer from the Web SDK
 * fallback ladder. If the dispatcher's order-of-checks regresses (e.g.
 * the sentinel check moves AFTER the substring ladder, or is dropped
 * entirely), the mobile browser-open regression recurs in production.
 * These specs lock the dispatcher behavior so a future refactor cannot
 * re-couple the producer to the fallback.
 *
 * Five contract branches pinned by these specs:
 *
 *   Branch 1 (positive) — Native throws an Error tagged
 *     `isAccountReauth: true`  → Hybrid rethrows raw WITHOUT
 *     instantiating `WebGoogleLoginStrategy`. This is the load-bearing
 *     branch for the regression fix.
 *
 *   Branch 2 (load-bearing) — Native throws a generic Error whose
 *     message contains `not implemented` (e.g. an older plugin build
 *     that surfaces only the i18n-key string) → Hybrid falls back to
 *     `WebGoogleLoginStrategy`. Locks the pre-existing substring
 *     ladder for legitimate fallback cases.
 *
 *   Branch 3 (load-bearing) — Native throws a generic Error whose
 *     message contains `no credentials available`. As Branch 2.
 *
 *   Branch 4 (load-bearing) — Native throws an Error whose message
 *     contains `nativegoogle:` but is NOT tagged `isAccountReauth`
 *     (this is the init-failure producer at
 *     `native-google-login.strategy.ts:128`). Hybrid falls back to
 *     Web SDK. This is the negative-space lock: the substring ladder
 *     is STILL active for other producers even though the
 *     `nativegoogle:` substring is shared.
 *
 *   Branch 5 (negative) — Native throws a plain TypeError whose
 *     message matches none of the substrings. Hybrid rethrows raw
 *     WITHOUT fallback. Pins pre-existing behavior for unrelated
 *     errors.
 */

// ────────────────────────────────────────────────────────────────────────
// vi.hoisted makes these stubs available to vi.mock factories (which
// are themselves hoisted above this module's body).
// ────────────────────────────────────────────────────────────────────────
const dispatcherMocks = vi.hoisted(() => ({
  nativeLogin: vi.fn(),
  webLogin: vi.fn(),
}));

vi.mock("@infrastructure/platform", () => ({
  isNativePlatform: () => true,
}));

vi.mock("../native-google-login.strategy", () => ({
  NativeGoogleLoginStrategy: class MockNative {
    login = dispatcherMocks.nativeLogin;
  },
}));

vi.mock("../web-google-login.strategy", () => ({
  WebGoogleLoginStrategy: class MockWeb {
    login = dispatcherMocks.webLogin;
  },
}));

// Import AFTER all vi.mock calls so the mocks are in place when
// hybrid-google-login.strategy.ts is loaded.
import { HybridGoogleLoginStrategy } from "../hybrid-google-login.strategy";

function makeAccountReauthError(message?: string): Error & {
  isAccountReauth: true;
} {
  const err = new Error(
    message ?? "nativegoogle: Account reauth failed [code=16]. ...",
  ) as Error & { isAccountReauth?: true };
  err.isAccountReauth = true;
  return err as Error & { isAccountReauth: true };
}

describe("HybridGoogleLoginStrategy.login() — §6.8.4 invariant", () => {
  beforeEach(() => {
    dispatcherMocks.nativeLogin.mockReset();
    dispatcherMocks.webLogin.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Branch 1 — POSITIVE. The typed sentinel short-circuits to a
  // rethrow without ever invoking WebGoogleLoginStrategy. This is
  // the regression fix.
  it("rethrows isAccountReauth errors without falling back to Web SDK", async () => {
    const reauth = makeAccountReauthError();
    dispatcherMocks.nativeLogin.mockRejectedValue(reauth);

    const strategy = new HybridGoogleLoginStrategy();
    await expect(strategy.login()).rejects.toMatchObject({
      isAccountReauth: true,
    });

    expect(dispatcherMocks.nativeLogin).toHaveBeenCalledTimes(1);
    // Load-bearing: Web SDK must NOT be instantiated.
    expect(dispatcherMocks.webLogin).not.toHaveBeenCalled();
  });

  // Branch 2 — load-bearing for substring ladder preservation.
  it("falls back to Web SDK on 'not implemented' substring (no isAccountReauth)", async () => {
    dispatcherMocks.nativeLogin.mockRejectedValue(
      new Error("SocialLogin: not implemented on this platform"),
    );
    dispatcherMocks.webLogin.mockResolvedValue({
      idToken: "fake-web-id-token",
    });

    const strategy = new HybridGoogleLoginStrategy();
    const result = await strategy.login();
    expect(result).toEqual({ idToken: "fake-web-id-token" });
    expect(dispatcherMocks.webLogin).toHaveBeenCalledTimes(1);
  });

  // Branch 3 — load-bearing for substring ladder preservation.
  it("falls back to Web SDK on 'no credentials available' substring (no isAccountReauth)", async () => {
    dispatcherMocks.nativeLogin.mockRejectedValue(
      new Error("CredentialManager: no credentials available for this user"),
    );
    dispatcherMocks.webLogin.mockResolvedValue({
      idToken: "fake-web-id-token",
    });

    const strategy = new HybridGoogleLoginStrategy();
    const result = await strategy.login();
    expect(result).toEqual({ idToken: "fake-web-id-token" });
    expect(dispatcherMocks.webLogin).toHaveBeenCalledTimes(1);
  });

  // Branch 4 — load-bearing: substring ladder remains active for
  // OTHER 'nativegoogle:' producers (init failures, missing env var).
  // Locks the negative space — if this fails, the dispatcher is
  // either over-eager (dropping fallback entirely) or over-restrictive
  // (only the sentinel triggers fallback).
  it("falls back to Web SDK on 'nativegoogle:' substring WITHOUT isAccountReauth (init failure)", async () => {
    dispatcherMocks.nativeLogin.mockRejectedValue(
      new Error("nativegoogle: SocialLogin.initialize failed: missing import"),
    );
    dispatcherMocks.webLogin.mockResolvedValue({
      idToken: "fake-web-id-token",
    });

    const strategy = new HybridGoogleLoginStrategy();
    const result = await strategy.login();
    expect(result).toEqual({ idToken: "fake-web-id-token" });
    expect(dispatcherMocks.webLogin).toHaveBeenCalledTimes(1);
  });

  // Branch 5 — NEGATIVE. Generic errors with no matching substrings
  // rethrow raw WITHOUT Web SDK fallback. Pre-existing behavior.
  it("rethrows generic TypeError without falling back to Web SDK", async () => {
    const typeError = new TypeError(
      "Cannot read properties of undefined (reading 'foo')",
    );
    dispatcherMocks.nativeLogin.mockRejectedValue(typeError);

    const strategy = new HybridGoogleLoginStrategy();
    await expect(strategy.login()).rejects.toBeInstanceOf(TypeError);
    await expect(strategy.login()).rejects.toThrow(
      /Cannot read properties of undefined/,
    );
    // Web SDK must NOT be instantiated for unrelated errors.
    expect(dispatcherMocks.webLogin).not.toHaveBeenCalled();
  });
});
