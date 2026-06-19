import authReducer from "@adapters/slices/auth/authSlice";
import userSettingsReducer from "@adapters/slices/user-settings/settingsSlice";
import { configureStore } from "@reduxjs/toolkit";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    userSettings: userSettingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
