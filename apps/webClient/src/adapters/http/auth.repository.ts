import { logoutAction } from "@adapters/slices/auth/authSlice";
import { store } from "@adapters/store/rootStore";
import { AuthRepository } from "@domain/auth/AuthRepository";
import { User } from "@domain/index";
import api from "@infrastructure/api.config";
import { createGoogleLoginStrategy, isNativePlatform } from "@adapters/auth";

export const authRepository: AuthRepository = {
  async login(email: string, password: string) {
    try {
      const response = await api.post("/auth/login", { email, password });

      return response.data;
    } catch (error: any) {
      console.error("Error:", error.message);
      throw error;
    }
  },

  async logout() {
    await api.post("/auth/logout");
    store.dispatch(logoutAction());
    window.location.href = "/login";
  },

  async signup(user: Omit<User, "id">) {
    const response = await api.post("/auth/signup", user);
    return response.data;
  },

  async forgotPassword(email: string) {
    const response = await api.post("/auth/forgot-password", { email });
    return response.data;
  },

  async resetPassword(newPassword: string, token: string) {
    const response = await api.post("/auth/reset-password", {
      newPassword,
      token,
    });
    return response.data;
  },

  async refreshToken(refreshToken: string) {
    const response = await api.post("/auth/refresh", { refreshToken });
    return response.data;
  },

  async googleLogin() {
    // Capacitor native: use the backend's own OAuth flow via @capacitor/browser
    // instead of Firebase Auth's signInWithRedirect (which opens the system
    // browser and doesn't return to the app).
    if (isNativePlatform()) {
      const { initiateCapacitorGoogleLogin } = await import(
        "@adapters/auth/backend-google-login"
      );
      await initiateCapacitorGoogleLogin();
      // The initiate function sets cookies, fetches profile, and dispatches
      // the auth state. Just return a successful result — the Redux store
      // is already updated.
      return { message: "🔓 Google login successful" };
    }

    // Web: use Firebase Auth (signInWithPopup for snappy UX).
    const strategy = createGoogleLoginStrategy();
    const { idToken } = await strategy.login();

    const response = await api.post("/auth/firebase-login", { idToken });
    return response.data;
  },

  async googleAuthRedirect(code: string) {
    return await api.get("/auth/google-callback", { params: { code } });
    // return response.data;
  },
};
