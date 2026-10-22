import { UserSettings } from "@domain/user/userSettings";
import { APP_CURRENCY } from "@presentation/utils/currencyService";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UserSettingsState {
  settings: UserSettings;
}

const initialState: UserSettingsState = {
  settings: {
    id: 0,
    timezone: "",
    // Euro is the only currency the app exposes. The slice is the
    // app-wide source for the symbol/precision, so forcing it here means
    // every consumer renders € regardless of legacy DB values.
    currency: APP_CURRENCY,
    locale: "",
    // Android APK audit, 2026-06: explicit `false` here so the
    // first paint after signup/refresh has a known state for the
    // onboarding gate. Both `OnboardingGuard` and `splash.tsx`
    // consume this field; treating it as `false` until the slice
    // receives a server response keeps the user from being
    // bounced to the wizard after a server crash (we err toward
    // "needs onboarding" rather than "wrong default").
    hasCompletedOnboarding: false,
  },
};

export const settingsSlice = createSlice({
  name: "user-settings",
  initialState,
  reducers: {
    // Se actualiza el estado tras un login exitoso
    setSettingsAction: (state, action: PayloadAction<UserSettings>) => {
      // Ignore any legacy non-EUR value coming from the server. The
      // currency is no longer user-selectable (see AccountSettings /
      // onboarding), so the UI must always show €.
      state.settings = { ...action.payload, currency: APP_CURRENCY };
    },
    // Se usa cuando el usuario edita su perfil
    updateSettingsAction: (
      state,
      action: PayloadAction<Partial<UserSettings>>,
    ) => {
      if (state.settings) {
        state.settings = {
          ...state.settings,
          ...action.payload,
          currency: APP_CURRENCY,
        };
      }
    },
  },
});

export const { setSettingsAction, updateSettingsAction } =
  settingsSlice.actions;
export default settingsSlice.reducer;
