import { isNativePlatform } from "@infrastructure/platform";
import { NativeGoogleLoginStrategy } from "./native-google-login.strategy";
import { WebGoogleLoginStrategy } from "./web-google-login.strategy";

export { isNativePlatform } from "@infrastructure/platform";
export { type GoogleLoginStrategy } from "./google-login-strategy";
export { NativeGoogleLoginStrategy } from "./native-google-login.strategy";
export { WebGoogleLoginStrategy } from "./web-google-login.strategy";

export function createGoogleLoginStrategy(): GoogleLoginStrategy {
  if (isNativePlatform()) {
    return new NativeGoogleLoginStrategy();
  }

  return new WebGoogleLoginStrategy();
}
