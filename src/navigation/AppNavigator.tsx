import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useConfigStore } from '../store/configStore';
import { LoginScreen } from '../screens/Login/LoginScreen';
import { RegisterScreen } from '../screens/Register/RegisterScreen';
import { MainTabs } from './MainTabs';
import { BrandAvatar } from '../components/BrandAvatar';
import { colors, typography } from '../theme';

export function AppNavigator() {
  const user = useAuthStore((state) => state.user);
  const initializing = useAuthStore((state) => state.initializing);
  const authView = useAuthStore((state) => state.authView);
  const registrationPhase = useAuthStore((state) => state.registrationPhase);
  const registrationEnabled = useConfigStore(
    (state) => state.registrationEnabled,
  );
  useEffect(() => {
    if (!registrationEnabled && registrationPhase === 'idle')
      useAuthStore.getState().closeRegistration();
  }, [registrationEnabled, registrationPhase]);
  if (initializing)
    return (
      <View style={styles.loading}>
        <BrandAvatar size={88} />
        <Text style={typography.heading}>LifeMate</Text>
        <ActivityIndicator
          accessibilityLabel="Đang khôi phục phiên đăng nhập"
          color={colors.earth}
        />
      </View>
    );
  // Separate trees discard tab history when the Firebase session ends.
  // https://reactnavigation.org/docs/auth-flow/
  if (registrationPhase !== 'idle') return <RegisterScreen />;
  if (user) return <MainTabs key={user.uid} />;
  return authView === 'register' && registrationEnabled ? (
    <RegisterScreen />
  ) : (
    <LoginScreen />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    gap: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
