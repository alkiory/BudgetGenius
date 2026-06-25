import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { app as firebaseApp } from "@infrastructure/firebaseConfig";
import { isNativePlatform } from "@infrastructure/platform";
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import type { GoogleLoginStrategy } from "./google-login-strategy";

export class WebGoogleLoginStrategy implements GoogleLoginStrategy {
  async login(): Promise<{ idToken: string }> {
    if (!firebaseApp) {
      throw new Error(
        "Google login is not available: Firebase is not configured. Please use email and password to sign in.",
      );
    }

    // 1. SI ES UNA PLATAFORMA NATIVA (Android/iOS)
    if (isNativePlatform()) {
      try {
        // Leemos el Web Client ID de las variables de entorno de Vite de forma segura
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

        if (!clientId) {
          throw new Error(
            "Falta la variable de entorno VITE_GOOGLE_CLIENT_ID",
          );
        }

        const result = await FirebaseAuthentication.signInWithGoogle({
          clientId,
        });

        if (!result.credential?.idToken) {
          throw new Error(
            "No se recibió el idToken del proveedor nativo de Google.",
          );
        }

        return { idToken: result.credential.idToken };
      } catch (error) {
        console.error("Error en el inicio de sesión nativo de Google:", error);
        throw error;
      }
    }

    // 2. ENTORNO WEB STANDARD
    const auth = getAuth(firebaseApp);
    const provider = new GoogleAuthProvider();

    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();
    return { idToken };
  }
}
