import { User } from "@domain/index";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Se actualiza el estado tras un login exitoso
    loginAction: (state) => {
      state.isAuthenticated = true;
    },
    // Se usa tras verificar el token y obtener el usuario
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    // Logout: Limpia todo el estado
    logoutAction: (state) => {
      state.isAuthenticated = false;
      state.user = null;
    },
    // Se usa cuando el usuario edita su perfil
    updateUserAction: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
});

export const { setUser, loginAction, logoutAction, updateUserAction } =
  authSlice.actions;
export default authSlice.reducer;
