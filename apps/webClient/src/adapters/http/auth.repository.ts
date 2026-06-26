import { logoutAction } from "@adapters/slices/auth/authSlice";
import { store } from "@adapters/store/rootStore";
import { AuthRepository } from "@domain/auth/AuthRepository";
import { User } from "@domain/index";
import api from "@infrastructure/api.config";
import { createGoogleLoginStrategy } from "@adapters/auth";

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
    // Strategy Pattern: pick the right implementation for the platform
    // automatically (Hybrid gatekeeper). Native → @capgo/capacitor-social-
    // login's Credential Manager bottom sheet (no Chrome Custom Tab, no
    // localhost redirect, no app re-launch). Web → Firebase JS SDK popup.
    // The backend endpoint is identical in both cases — /auth/firebase-
    // login verifies the Google idToken with Firebase Admin.
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
