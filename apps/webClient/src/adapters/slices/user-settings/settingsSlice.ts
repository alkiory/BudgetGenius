import { UserSettings } from "@domain/user/userSettings";
import { APP_CURRENCY, toCurrency } from "@presentation/utils/currencyService";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UserSettingsState {
  settings: UserSettings;
}

const initialState: UserSettingsState = {
  settings: {
    id: 0,
    timezone: "",
    // Euro is the app-wide default until `/user-settings` returns the
    // user's own choice (set by the onboarding wizard).
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
      // The user's chosen currency (onboarding or a legacy row) is the
      // app-wide source for the symbol/precision. `toCurrency` keeps an
      // unknown/missing server value from reaching the formatters.
      state.settings = {
        ...action.payload,
        currency: toCurrency(action.payload.currency),
      };
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
          currency: toCurrency(
            action.payload.currency ?? state.settings.currency,
          ),
        };
      }
    },
  },
});

export const { setSettingsAction, updateSettingsAction } =
  settingsSlice.actions;
export default settingsSlice.reducer;
