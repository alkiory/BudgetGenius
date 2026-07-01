import { app as firebaseApp } from "@infrastructure/firebaseConfig";
import { isNativePlatform } from "@infrastructure/platform";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import type { GoogleLoginStrategy } from "./google-login-strategy";

let initializationPromise: Promise<void> | null = null;

/**
 * Capacitor error fingerprint for the SHA-1 fingerprint registration
 * gap that produces "Account reauth failed" on Android. The Google
 * Sign-In native SDK surfaces this as a GetCredentialException with a
 * numeric StatusCode (16 = GoogleSignInStatusCodes.SIGN_IN_FAILED /
 * Account reauth failed) and a string message of the form
 * "Google Sign-In failed: [16] Account reauth failed.".
 *
 * Matcher design:
 *   - Numeric code === 16  → load-bearing for any plugin version
 *     that exposes a typed code/statusCode/getCode() on the error.
 *   - Text "(account AND reauth) in same message" → fall-back for
 *     versions that only expose a wrapped string. Both required —
 *     single-substring matches would trigger on unrelated errors
 *     (create-account, Firebase session reauth flow post-exchange).
 *   - We deliberately do NOT match 'api_not_connected' (that's
 *     StatusCode 17, a different bug class — Play Services availability)
 *     nor bare '[16]' (too brittle in unrelated log strings).
 *
 * The matcher survives minor-version drift because it tests the
 * union of the numeric AND text fingerprints.
 */
function isAccountReauthError(error: unknown): boolean {
  if (extractErrorCode(error) === 16) return true;
  const message = extractErrorMessage(error).toLowerCase();
  return message.includes("account") && message.includes("reauth");
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function extractErrorCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const directCandidate =
    (error as { code?: unknown }).code ??
    (error as { statusCode?: unknown }).statusCode;
  if (typeof directCandidate === "number") return directCandidate;
  if (typeof directCandidate === "string") {
    const parsed = Number(directCandidate);
    if (Number.isFinite(parsed)) return parsed;
  }
  const getCode = (error as { getCode?: () => unknown }).getCode;
  if (typeof getCode === "function") {
    try {
      const result = getCode.call(error);
      if (typeof result === "number") return result;
      if (typeof result === "string") {
        const parsed = Number(result);
        if (Number.isFinite(parsed)) return parsed;
      }
    } catch {
      /* some Play Services classes have getCode() that throws when
         internal state isn't initialized; treat as unrecognized */
    }
  }
  // No warn here on purpose: most error objects in this catch path
  // (Firebase auth, axios, plain Object) legitimately don't expose any
  // of code/statusCode/getCode(), AND Firebase Error subclasses DO carry
  // a string `code` like 'auth/network-request-failed' that would trip
  // a "looks like a Sign-In exception" predicate but is unrelated to
  // Account reauth [16]. The text fingerprint in isAccountReauthError
  // (account + reauth in same message) is the load-bearing fallback
  // for any non-numeric shape. If both the numeric AND text paths
  // miss, the error is correctly NOT a SHA-1 registration gap and
  // should propagate raw. Diagnostic logging is already handled by
  // the `console.error('Error during native Google login:', error)`
  // in the outer catch block above.
  return undefined;
}

/**
 * Short marker string re-thrown to the React error UI / toast /
 * Sentry when the [code=16] Account reauth failed condition fires.
 *
 * Kept SHORT on purpose:
 *   - Mirrors Toast / Ant Design / react-hot-toast error UIs that
 *     truncate long messages.
 *   - Keeps Sentry breadcrumbs short for triage clarity.
 *   - Delegates the operator-facing multi-line playbook to
 *     apps/mobile/README.md (single source of truth — no drift).
 *
 * The original cause is preserved via the Error `cause` property
 * (ES2022 spec — set post-construction so we don't depend on the
 * `new Error(msg, options)` constructor signature that some TS lib
 * configs reject).
 */
function buildAccountReauthRethrow(originalError: unknown): Error {
  const originalCause = extractErrorMessage(originalError);
  const err = new Error(
    `nativegoogle: Account reauth failed [code=16]. ` +
      `See apps/mobile/README.md → 'Account reauth failed' for the ` +
      `5-step SHA-1 registration playbook. (original-cause: ${originalCause})`,
  );
  // ES2022 Error `cause` — set post-construction to stay compatible
  // with older TS lib configs that lack the ErrorOptions constructor
  // signature. Sentry and log aggregators reading `.cause` preserve
  // the original stack in the breadcrumb.
  (err as Error & { cause?: unknown }).cause = originalError;
  return err;
}

export function ensureSocialLoginInitialized(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = import("@capgo/capacitor-social-login")
      .then(({ SocialLogin }) =>
        SocialLogin.initialize({
          google: {
            // Web Client ID — NOT the Android Client ID. The Android
            // Client ID is for app identification only; the Web Client
            // ID is what lets Firebase signInWithCredential() exchange
            // the Google idToken for a Firebase session.
            webClientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID,
            // Pin mode='online' explicitly. v7.x default IS 'online',
            // but a future capgo default-flip to 'offline' would silently
            // produce a serverAuthCode response that our existing
            // result.responseType !== 'online' guard below catches as
            // a hard error. Pin for defense-in-depth.
            //
            // NOTE: 'offline' and 'forceCodeForRefreshToken' are NOT
            // accepted by @capgo/capacitor-social-login's current
            // TypeScript definitions even though the underlying SDK
            // supports them — leaving them off to keep the typecheck
            // green; the runtime guard after login() catches backwards.
            mode: "online",
          },
        }),
      )
      .catch((err) => {
        initializationPromise = null;
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(
          `nativegoogle: SocialLogin.initialize failed: ${reason}`,
        );
      });
  }
  return initializationPromise;
}

export class NativeGoogleLoginStrategy implements GoogleLoginStrategy {
  async login(): Promise<{ idToken: string }> {
    if (!isNativePlatform()) {
      throw new Error(
        "NativeGoogleLoginStrategy was called on a non-native runtime — this is a wiring bug. Use WebGoogleLoginStrategy in the browser.",
      );
    }

    if (!import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID) {
      throw new Error(
        "nativegoogle: VITE_GOOGLE_WEB_CLIENT_ID is not set. Set it in apps/webClient/.env.{development,production} before invoking the native Google login.",
      );
    }

    try {
      await ensureSocialLoginInitialized();
      // Dynamic import — see module-level comment for why.
      const { SocialLogin } = await import("@capgo/capacitor-social-login");
      const response = await SocialLogin.login({
        provider: "google",
        options: {
          scopes: ["email", "profile"],
          style: "bottom",
          filterByAuthorizedAccounts: false,
        },
      });

      const { result } = response;
      if (result.responseType !== "online") {
        throw new Error(
          "nativegoogle: Google native sign-in returned serverAuthCode (offline mode) instead of idToken. Configure SocialLogin.initialize({ google: { mode: 'online' } }) explicitly if you want to defend against a future capgo default flip.",
        );
      }
      const googleIdToken = result.idToken;
      if (!googleIdToken) {
        throw new Error(
          "nativegoogle: Native Google sign-in returned no idToken. Verify the Android OAuth Client is registered with the keystore SHA-1 in Google Cloud Console, and google-services.json points at the Firebase project.",
        );
      }

      if (!firebaseApp) {
        throw new Error(
          "nativegoogle: Firebase no está configurado para el intercambio de credenciales.",
        );
      }

      const auth = getAuth(firebaseApp);
      const credential = GoogleAuthProvider.credential(googleIdToken);

      // Iniciamos sesión en el SDK local de Firebase
      const userCredential = await signInWithCredential(auth, credential);

      // Extraemos el token firmado por Firebase
      const firebaseIdToken = await userCredential.user.getIdToken();

      return { idToken: firebaseIdToken };
    } catch (error) {
      console.error("Error during native Google login:", error);
      // v1.7.2 interception: the Capacitor plugin wraps the native
      // GetCredentialException with message of the form "Google
      // Sign-In failed: [16] Account reauth failed." and forwards it
      // raw to the UI. The v1.7.1 backend hot-fix does NOT help this
      // case — the HTTPS round-trip is bypassed because Credential
      // Manager blocks the auth attempt pre-network. We catch the
      // [code=16] family here and re-throw a SHORT marker that
      // delegates to apps/mobile/README.md for the registration
      // playbook.
      if (isAccountReauthError(error)) {
        throw buildAccountReauthRethrow(error);
      }
      throw error;
    }
  }
}
