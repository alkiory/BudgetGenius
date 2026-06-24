import type { GoogleLoginStrategy } from './google-login-strategy';

/**
 * Estrategia de Google Login para entorno nativo (Capacitor).
 *
 * Usa el plugin @capacitor-firebase/authentication para invocar el login de Google
 * a través del SDK nativo de Android/iOS, evitando los problemas de popups en WebView.
 *
 * El plugin se importa dinámicamente para no romper el bundle web (donde Capacitor
 * no está disponible). En entorno web, `Capacitor.isNativePlatform()` retorna false
 * y se usa WebGoogleLoginStrategy en su lugar.
 */
export class NativeGoogleLoginStrategy implements GoogleLoginStrategy {
  async login(): Promise<{ idToken: string }> {
    try {
      // Importación dinámica: el módulo @capacitor-firebase/authentication solo
      // existe en el contexto de Capacitor (apps/mobile). En web no está instalado,
      // por lo que se importa dinámicamente para evitar errores de resolución.
      const { FirebaseAuthentication } = await import(
        '@capacitor-firebase/authentication'
      );

      const result = await FirebaseAuthentication.signInWithGoogle();

      const idToken = result.credential?.idToken;
      if (!idToken) {
        throw new Error('No ID token received from Google native sign-in');
      }

      return { idToken };
    } catch (error) {
      console.error('Error during native Google login:', error);
      throw error;
    }
  }
}
