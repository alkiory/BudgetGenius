import { configureStore } from '@reduxjs/toolkit';
import userSettingsReducer from '@adapters/slices/user-settings/settingsSlice';
import authReducer from '@adapters/slices/auth/authSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    userSettings: userSettingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
