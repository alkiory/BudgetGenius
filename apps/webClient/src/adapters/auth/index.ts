export { type GoogleLoginStrategy } from './google-login-strategy';
export { WebGoogleLoginStrategy } from './web-google-login.strategy';
export { NativeGoogleLoginStrategy } from './native-google-login.strategy';

/**
 * Crea la estrategia de Google Login adecuada según la plataforma.
 *
 * En entorno web (navegador), usa el popup de Firebase JS SDK.
 * En entorno nativo (Capacitor Android/iOS), usa el plugin nativo.
 *
 * La detección de plataforma usa Capacitor.isNativePlatform() cuando está disponible.
 * En web, Capacitor no está definido y se usa WebGoogleLoginStrategy por defecto.
 */
export function createGoogleLoginStrategy(): GoogleLoginStrategy {
  const isNative =
    typeof (globalThis as any).Capacitor !== 'undefined' &&
    (globalThis as any).Capacitor.isNativePlatform();

  if (isNative) {
    return new NativeGoogleLoginStrategy();
  }

  return new WebGoogleLoginStrategy();
}
