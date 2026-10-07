import { styles } from './SettingsScreen.styles';
import Feather from '@expo/vector-icons/Feather';
import { Text, View } from 'react-native';
import { BrandAvatar } from '../../components/BrandAvatar';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { colors, typography } from '../../theme';
import { useSettingsScreen } from './useSettingsScreen';

export function SettingsScreen() {
  const model = useSettingsScreen();
  const pushReady = model.permission === 'granted' && !!model.token;
  return (
    <Screen>
      <View style={styles.section}>
        <Text style={typography.eyebrow}>THEO CÁCH CỦA BẠN</Text>
        <Text accessibilityRole="header" style={typography.title}>
          Setting
        </Text>
      </View>
      <View style={styles.profile}>
        <BrandAvatar size={64} />
        <View style={styles.profileText}>
          <Text style={typography.heading}>{model.name}</Text>
          <Text selectable style={typography.small}>
            {model.user?.email}
          </Text>
        </View>
      </View>
      <View style={styles.section}>
        <View style={styles.row}>
          <Feather name="bell" size={22} color={colors.green} />
          <Text style={typography.heading}>Thông báo</Text>
        </View>
        <Text style={typography.body}>
          {pushReady
            ? 'Thông báo đã sẵn sàng trên thiết bị này.'
            : model.permission === 'denied'
              ? 'Thông báo đang tắt. Bạn có thể bật lại trong cài đặt thiết bị.'
              : 'Nhận những thông báo mới từ LifeMate khi bạn muốn.'}
        </Text>
        {model.pushError && (
          <Text style={typography.small}>{model.pushError}</Text>
        )}
        {!pushReady && (
          <Button
            title={
              model.permission === 'denied'
                ? 'Mở cài đặt thiết bị'
                : 'Bật thông báo'
            }
            onPress={model.enablePush}
            loading={model.busy === 'push'}
            disabled={model.busy === 'logout'}
            variant="secondary"
          />
        )}
        {__DEV__ && model.token && (
          <Button
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
      <View style={styles.divider} />
      <View style={styles.section}>
        <Text style={typography.heading}>Tài khoản</Text>
        <Text style={typography.body}>Hẹn gặp lại bạn, bất cứ khi nào.</Text>
        <Button
          title="Đăng xuất"
          onPress={model.signOut}
          loading={model.busy === 'logout'}
          disabled={model.busy === 'push'}
          variant="danger"
        />
        {model.error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {model.error}
          </Text>
        )}
      </View>
      <Text style={styles.footer}>
        LifeMate · 1.0.0{'\n'}Người bạn đồng hành mỗi ngày.
      </Text>
    </Screen>
  );
}
