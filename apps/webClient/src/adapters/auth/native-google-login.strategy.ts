import { app as firebaseApp } from "@infrastructure/firebaseConfig";
import { isNativePlatform } from "@infrastructure/platform";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import type { GoogleLoginStrategy } from "./google-login-strategy";

let initializationPromise: Promise<void> | null = null;

export function ensureSocialLoginInitialized(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = import("@capgo/capacitor-social-login")
      .then(({ SocialLogin }) =>
        SocialLogin.initialize({
          google: {
            // Web Client ID — NOT the Android Client ID.
            webClientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID,
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
      throw error;
    }
  }
}
