import Feather from '@expo/vector-icons/Feather';
import { Text, View } from 'react-native';
import { BrandAvatar } from '../../components/BrandAvatar';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { colors, typography } from '../../theme';
import { useSettingsScreen } from './useSettingsScreen';
import { styles } from './SettingsScreen.styles';

export function SettingsScreen() {
  const model = useSettingsScreen();
  const pushReady = model.permission === 'granted' && !!model.token;
  const notificationDescription = pushReady
    ? 'Đang bật trên thiết bị này.'
    : model.permission === 'denied'
      ? 'Đang tắt. Mở cài đặt để bật.'
      : 'Bật để nhận cập nhật từ LifeMate.';

  return (
    <Screen
      fixedHeader={
        <Text accessibilityRole="header" style={typography.title}>
          Cài đặt
        </Text>
      }
      fixedHeaderStyle={styles.fixedHeader}
      contentStyle={styles.content}
    >
      <View style={styles.profileCard}>
        <BrandAvatar size={48} />
        <View style={styles.profileText}>
          <Text style={styles.profileName}>{model.name}</Text>
          <Text selectable style={typography.small}>
            {model.user?.email}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.notificationRow}>
          <View style={[styles.iconBadge, styles.notificationIcon]}>
            <Feather name="bell" size={18} color={colors.sky} />
          </View>
          <View style={styles.notificationText}>
            <Text style={styles.cardTitle}>Thông báo</Text>
            <Text numberOfLines={2} style={typography.small}>
              {notificationDescription}
            </Text>
          </View>
          {!pushReady && (
            <Button
              compact
              title={model.permission === 'denied' ? 'Mở cài đặt' : 'Bật'}
              onPress={model.enablePush}
              loading={model.busy === 'push'}
              disabled={model.busy === 'logout'}
              variant="secondary"
            />
          )}
        </View>
        {model.pushError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {model.pushError}
          </Text>
        )}
        {__DEV__ && model.token && (
          <Button
            compact
            title={
              model.copied
                ? 'Đã sao chép FCM token'
                : 'Sao chép FCM token để kiểm thử'
            }
            onPress={model.copyToken}
            variant="secondary"
          />
        )}
      </View>

      <View style={styles.accountCard}>
        <View style={[styles.iconBadge, styles.accountIcon]}>
          <Feather name="log-out" size={18} color={colors.danger} />
        </View>
        <View style={styles.accountText}>
          <Text style={styles.cardTitle}>Tài khoản</Text>
          <Text style={typography.small}>Đăng xuất khỏi thiết bị này.</Text>
        </View>
        <Button
          compact
          title="Đăng xuất"
          onPress={model.signOut}
          loading={model.busy === 'logout'}
          disabled={model.busy === 'push'}
          variant="danger"
        />
      </View>

      {model.error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {model.error}
        </Text>
      )}
      <Text style={styles.footer}>LifeMate · 1.0.0</Text>
    </Screen>
  );
}
