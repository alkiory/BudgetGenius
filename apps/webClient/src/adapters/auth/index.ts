import { isNativePlatform } from "@infrastructure/platform";
import { HybridGoogleLoginStrategy } from "./hybrid-google-login.strategy";
// Local binding for the type alias — `export { type X } from "..."` does
// NOT create a local binding usable inside the same module (it creates
// an export binding only). Without this explicit import, the
// `createGoogleLoginStrategy()` factory below would TS2552 on
// `GoogleLoginStrategy` (load-bearing: the factory's return-type
// annotation must reference the canonical interface, not
// `HybridGoogleLoginStrategy`, so callers stay dispatched through the
// factory rather than instantiating a concrete class).
import { type GoogleLoginStrategy } from "./google-login-strategy";

export { isNativePlatform } from "@infrastructure/platform";
export { type GoogleLoginStrategy } from "./google-login-strategy";
export { WebGoogleLoginStrategy } from "./web-google-login.strategy";
export { NativeGoogleLoginStrategy } from "./native-google-login.strategy";
export { HybridGoogleLoginStrategy } from "./hybrid-google-login.strategy";

/**
 * Idempotent Google-plugin initializer. Call once at app startup (we
 * wire it from `App.tsx` alongside `useRestoreSession`) so the
 * Credential Manager UI shows up instantly on the first tap of the
 * Google button — no "please wait while we initialize" delay.
 *
 * Safe to call multiple times: the first call kicks off
 * `SocialLogin.initialize(...)` and stashes the promise at module
 * scope in `native-google-login.strategy.ts`; subsequent calls
 * (including from React StrictMode double-mounts) await the *same*
 * promise instead of re-initializing and re-throwing the underlying
 * GoogleAuthException for credential state.
 *
 * On non-native (web) builds this is a no-op so the dev server
 * doesn't import a Capacitor-only module eagerly.
 */
export async function initializeGoogleAuth(): Promise<void> {
  if (!isNativePlatform()) return;
  const { ensureSocialLoginInitialized } = await import(
    "./native-google-login.strategy"
  );
  await ensureSocialLoginInitialized();
}

/**
 * Factory used by `apps/webClient/src/adapters/http/auth.repository.ts`
 * → `authRepository.googleLogin()`. Returns a fresh dispatcher per
 * login so each call carries its own error state (no module-scope
 * leaks between concurrent calls).
 *
 * The class itself lives in `hybrid-google-login.strategy.ts` so
 * vitest can import and `vi.spyOn` the producer/consumer chain. The
 * §6.8.4 invariant (typed-sentinel pre-check) is annotated there.
 */
export function createGoogleLoginStrategy(): GoogleLoginStrategy {
  return new HybridGoogleLoginStrategy();
}

