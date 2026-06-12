import { logoutAction } from "@adapters/slices/auth/authSlice";
import { store } from "@adapters/store/rootStore";
import { AuthRepository } from "@domain/auth/AuthRepository";
import { User } from "@domain/index";
import api from "@infrastructure/api.config";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

export const authRepository: AuthRepository = {
  async login(email: string, password: string) {
    try {
      const response = await api.post('/auth/login', { email, password });

      return response.data;
    } catch (error: any) {
      console.error('Error:', error.message);
      throw error;
    }
  },

  async logout() {
    await api.post('/auth/logout');
    store.dispatch(logoutAction());
    window.location.href = '/login';
  },

  async signup(user: Omit<User, "id">) {
    const response = await api.post('/auth/signup', user);
    return response.data;
  },

  async forgotPassword(email: string) {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  async resetPassword(newPassword: string, token: string) {
    const response = await api.post('/auth/reset-password', { newPassword, token });
    return response.data;
  },

  async refreshToken(refreshToken: string) {
    const response = await api.post('/auth/refresh', { refreshToken });
    return response.data;
  },

  async googleLogin() {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const idToken = await user.getIdToken(); // Token JWT de Firebase

      const response = await api.post('/auth/firebase-login', { idToken });

      return response.data;
    } catch (error) {
      console.error("Error during Google login:", error);
      throw error;
    }
  },

  async googleAuthRedirect(code: string) {
    return await api.get('/auth/google-callback', { params: { code } });
    // return response.data;
  },

  async githubLogin() {
    const response = await api.get('/auth/github-login');
    return response.data;
  },
};
