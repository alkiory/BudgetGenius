import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UserSettings } from '@domain/user/userSettings';

interface UserSettingsState {
  settings: UserSettings
}

const initialState: UserSettingsState = {
  settings: {
    id: 0,
    timezone: '',
    currency: 'USD',
    locale: '',
  }
};

export const settingsSlice = createSlice({
  name: 'user-settings',
  initialState,
  reducers: {
    // Se actualiza el estado tras un login exitoso
    setSettingsAction: (state, action: PayloadAction<UserSettings>) => {
      state.settings = action.payload;
    },
    // Se usa cuando el usuario edita su perfil
    updateSettingsAction: (state, action: PayloadAction<Partial<UserSettings>>) => {
      if (state.settings) {
        state.settings = { ...state.settings, ...action.payload };
      }
    },
  },
});

export const { setSettingsAction, updateSettingsAction } = settingsSlice.actions;
export default settingsSlice.reducer;
