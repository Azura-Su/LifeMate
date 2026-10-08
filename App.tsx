import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NotificationBanner } from './src/components/NotificationBanner';
import { useAppBootstrap } from './src/hooks/useAppBootstrap';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useAuthStore } from './src/store/authStore';
import { colors } from './src/theme';
import { isHeadlessLaunch } from './src/services/firebase/messagingService';

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.ink,
    border: colors.line,
  },
};

function LifeMate() {
  useAppBootstrap();
  const signedIn = useAuthStore((state) => !!state.user);
  return (
    <NavigationContainer theme={theme}>
      <AppNavigator />
      {signedIn && <NotificationBanner />}
    </NavigationContainer>
  );
}

export default function App({ isHeadless }: { isHeadless?: boolean }) {
  const [headless, setHeadless] = useState<boolean | null>(isHeadless ?? null);
  useEffect(() => {
    if (isHeadless !== undefined) return;
    let active = true;
    void isHeadlessLaunch()
      .then((value) => {
        if (active) setHeadless(value);
      })
      .catch(() => {
        if (active) setHeadless(false);
      });
    return () => {
      active = false;
    };
  }, [isHeadless]);
  // Expo does not inject RNFirebase's isHeadless prop; query the native module
  // before mounting effects so silent iOS pushes cannot restore screens/session.
  if (headless !== false) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <LifeMate />
    </SafeAreaProvider>
  );
}
