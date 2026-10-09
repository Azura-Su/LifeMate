import { useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { NavigationContext } from '@react-navigation/native';

// True only while this screen is focused and the app is in the foreground.
// Use it to pause UI-only work (progress ticks, decorative animations) that
// nobody can see, which otherwise keeps the CPU/GPU busy and warms the phone.
// Outside a navigator (e.g. tests) focus is treated as true.
export function useScreenActive() {
  const navigation = useContext(NavigationContext);
  const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);
  const [appActive, setAppActive] = useState(
    () => AppState.currentState !== 'background',
  );

  useEffect(() => {
    if (!navigation) return;
    setFocused(navigation.isFocused());
    const offFocus = navigation.addListener('focus', () => setFocused(true));
    const offBlur = navigation.addListener('blur', () => setFocused(false));
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) =>
      setAppActive(state === 'active'),
    );
    return () => sub.remove();
  }, []);

  return focused && appActive;
}
