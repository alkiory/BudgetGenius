/**
 * GoogleLoginStrategy interface.
 *
 * Strategy Pattern: permite alternar entre el login con popup web (Firebase JS SDK)
 * y el login nativo (plugin Capacitor) según la plataforma donde se ejecute la app.
 */
export interface GoogleLoginStrategy {
  /**
   * Ejecuta el flujo de autenticación con Google.
   * @returns ID token de Firebase para intercambiar con el backend
   */
  login(): Promise<{ idToken: string }>;
}
