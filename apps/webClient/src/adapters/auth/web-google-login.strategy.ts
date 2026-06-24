import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { app as firebaseApp } from '@infrastructure/firebaseConfig';
import type { GoogleLoginStrategy } from './google-login-strategy';

/**
 * Estrategia de Google Login para entorno web.
 *
 * Usa Firebase JS SDK con signInWithPopup para abrir una ventana emergente
 * de autenticación de Google. Funciona en navegadores web estándar.
 *
 * Nota: require que firebaseApp esté inicializado (variables de entorno configuradas).
 * Si Firebase no está configurado, lanza un error claro.
 */
export class WebGoogleLoginStrategy implements GoogleLoginStrategy {
  async login(): Promise<{ idToken: string }> {
    if (!firebaseApp) {
      throw new Error(
        'Google login is not available: Firebase is not configured.',
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
