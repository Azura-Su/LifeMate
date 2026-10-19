import { useEffect } from 'react';
import { AppState, Keyboard, Platform } from 'react-native';
import { setVisibilityAsync } from 'expo-navigation-bar';

export function useAndroidNavigationBar() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const hide = () => {
      void setVisibilityAsync('hidden').catch(() => undefined);
    };
    const hideWhileActive = () => {
      if (AppState.currentState === 'active') hide();
    };
    hideWhileActive();
    const state = AppState.addEventListener('change', (next) => {
      if (next === 'active') hide();
    });
    const focus = AppState.addEventListener('focus', hideWhileActive);
    const keyboard = Keyboard.addListener('keyboardDidHide', hideWhileActive);
    return () => {
      state.remove();
      focus.remove();
      keyboard.remove();
    };
  }, []);
}
