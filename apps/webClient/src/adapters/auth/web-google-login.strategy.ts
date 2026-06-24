import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { isNativePlatform } from '@infrastructure/platform';
import { app as firebaseApp } from '@infrastructure/firebaseConfig';
import type { GoogleLoginStrategy } from './google-login-strategy';

/**
 * Estrategia de Google Login para entorno web (navegador estándar).
 *
 * Usa Firebase JS SDK con `signInWithPopup` para abrir una ventana emergente
 * de autenticación de Google. Funciona en navegadores web estándar.
 *
 * Si se instancia por error dentro de la app móvil (Capacitor), el método
 * `login` rechaza con un mensaje que sugiere reinstalar la app o usar el
 * inicio de sesión con email/contraseña — el backend aún lo acepta vía
 * `/auth/firebase-login` una vez la estrategia nativa entrega un idToken.
 */
export class WebGoogleLoginStrategy implements GoogleLoginStrategy {
  async login(): Promise<{ idToken: string }> {
    if (isNativePlatform()) {
      // Detector de seguridad: estamos dentro del WebView nativo de Capacitor
      // pero por alguna razón la estrategia web terminó seleccionada. Esto
      // puede ocurrir si Vite árbol-eliminó `@capacitor/core` antes de que
      // la inyección de `window.Capacitor` se evalúe; en ese caso la mejor
      // guía para el usuario es usar el login de email/contraseña, igual de
      // válido, mientras investigamos el bundle.
      throw new Error(
        'Google sign-in is not available in the mobile app right now. Please use email and password to sign in.',
      );
    }

    if (!firebaseApp) {
      throw new Error(
        'Google login is not available: Firebase is not configured. Please use email and password to sign in.',
      );
    }

    const auth = getAuth(firebaseApp);
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const idToken = await user.getIdToken();

      return { idToken };
    } catch (error) {
      console.error('Error during Google login:', error);
      throw error;
    }
  }
}

