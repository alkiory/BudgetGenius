import { User } from "@domain/index";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  /**
   * True once `useRestoreSession` has completed its first `/auth/verify` call
   * (success or failure). Allows SplashPage to wait for the auth slice to
   * settle before deciding whether to send a returning user to the dashboard
   * or the login page — without this, a returning user with valid refresh
   * cookies gets bounced to `/auth/login` because the verify response hadn't
   * landed by the time the splash animation finished.
   */
  authReady: boolean;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  authReady: false,
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Se actualiza el estado tras un login exitoso
    loginAction: (state) => {
      state.isAuthenticated = true;
      // Login is an explicit user action — we now know the auth state, so mark
      // the slice ready. Any code that was waiting on `authReady` can resolve.
      state.authReady = true;
    },
    // Se usa tras verificar el token y obtener el usuario
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    // Logout: Limpia todo el estado
    logoutAction: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      // Logout is also an explicit conclusion — auth state is now known.
      state.authReady = true;
    },
    // Marks `authReady` true. Dispatched by `useRestoreSession` (and any other
    // caller that just finished probing the auth state) so consumers like
    // SplashPage can stop waiting.
    setAuthReady: (state) => {
      state.authReady = true;
    },
    // Se usa cuando el usuario edita su perfil
    updateUserAction: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
});

export const {
  setUser,
  loginAction,
  logoutAction,
  updateUserAction,
  setAuthReady,
} = authSlice.actions;
export default authSlice.reducer;
