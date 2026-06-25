import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { app as firebaseApp } from "@infrastructure/firebaseConfig";
import { isNativePlatform } from "@infrastructure/platform";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import type { GoogleLoginStrategy } from "./google-login-strategy";

export class WebGoogleLoginStrategy implements GoogleLoginStrategy {
  async login(): Promise<{ idToken: string }> {
    if (!firebaseApp) {
      throw new Error(
        "Google login is not available: Firebase is not configured. Please use email and password to sign in.",
      );
    }

    // Validación definitiva: Forzada por entorno estático o detección dinámica por fallback
    const isMobileWebView =
      import.meta.env.VITE_IS_MOBILE_BUILD === "true" ||
      isNativePlatform() ||
      (typeof window !== "undefined" &&
        (window as any).Capacitor?.isNativePlatform());

    // 1. ENTORNO NATIVO APK (Si se cumple cualquiera de las condiciones)
    if (isMobileWebView) {
      try {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

        if (!clientId) {
          throw new Error("Falta la variable de entorno VITE_GOOGLE_CLIENT_ID");
        }

        // Invocamos el puente 100% nativo de Android
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
