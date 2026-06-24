import { isNativePlatform } from "@infrastructure/platform";
export { isNativePlatform } from "@infrastructure/platform";
export { type GoogleLoginStrategy } from "./google-login-strategy";
export { WebGoogleLoginStrategy } from "./web-google-login.strategy";
export { NativeGoogleLoginStrategy } from "./native-google-login.strategy";

/**
 * Crea la estrategia de Google Login adecuada según la plataforma.
 *
 * En entorno web (navegador), usa el popup de Firebase JS SDK.
 * En entorno nativo (Capacitor Android/iOS), usa el plugin nativo de
 * `@capacitor-firebase/authentication` para evitar los problemas de popups
 * dentro de WebView.
 *
 * La detección de plataforma se centraliza en `@infrastructure/platform`
 * para que ambos sitios (splash y estrategias de auth) compartan la misma
 * fuente de verdad y caigan a los mismos fallbacks si Vite árbol-elimina
 * `@capacitor/core` de la entrada principal.
 */
export function createGoogleLoginStrategy(): GoogleLoginStrategy {
  if (isNativePlatform()) {
    return new NativeGoogleLoginStrategy();
  }

  return new WebGoogleLoginStrategy();
}
