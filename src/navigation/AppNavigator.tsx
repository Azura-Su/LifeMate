import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { LoginScreen } from '../screens/Login/LoginScreen';
import { MainTabs } from './MainTabs';
import { BrandAvatar } from '../components/BrandAvatar';
import { colors, typography } from '../theme';

export function AppNavigator() {
  const user = useAuthStore((state) => state.user);
  const initializing = useAuthStore((state) => state.initializing);
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
  return user ? <MainTabs key={user.uid} /> : <LoginScreen />;
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
