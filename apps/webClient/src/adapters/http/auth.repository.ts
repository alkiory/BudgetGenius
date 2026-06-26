import { createGoogleLoginStrategy } from "@adapters/auth";
import { logoutAction } from "@adapters/slices/auth/authSlice";
import { store } from "@adapters/store/rootStore";
import { AuthRepository } from "@domain/auth/AuthRepository";
import { User } from "@domain/index";
import api from "@infrastructure/api.config";

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
    const strategy = createGoogleLoginStrategy();
    const { idToken } = await strategy.login();

    const response = await api.post("/auth/firebase-login", { idToken });
    // Backend now returns `{ user, message }` symmetric with
    // /auth/login and /auth/signup (see apps/api/src/adapters/auth/http/
    // auth.controller.ts @Post('firebase-login')). No client-side
    // reshaping needed — consumers read `data.user` directly.
    return response.data;
  },

  async googleAuthRedirect(code: string) {
    return await api.get("/auth/google-callback", { params: { code } });
    // return response.data;
  },
};
