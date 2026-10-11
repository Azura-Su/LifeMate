import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Switch, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import type { useFinancePrivacy } from '../../hooks/useFinancePrivacy';
import { colors, typography } from '../../theme';
import { styles } from './FinanceLockSetting.styles';

type Props = {
  privacy: ReturnType<typeof useFinancePrivacy>;
  disabled: boolean;
  compact?: boolean;
};
export function FinanceLockSetting({
  privacy,
  disabled,
  compact = false,
}: Props) {
  const busy = privacy.loading || privacy.authenticating || privacy.changing;
  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <View
        style={[
          styles.notificationRow,
          compact && styles.compactNotificationRow,
        ]}
      >
        <View
          style={[
            styles.iconBadge,
            styles.securityIcon,
            compact && styles.compactIconBadge,
          ]}
        >
          <Feather name="shield" size={18} color={colors.earth} />
        </View>
        <View style={styles.notificationText}>
          <Text style={[styles.cardTitle, compact && styles.compactCardTitle]}>
            Face ID cho tóm tắt Home
          </Text>
          {!(compact && privacy.enabled === false) && (
            <Text
              style={[typography.small, compact && styles.compactDescription]}
            >
              {privacy.enabled === null
                ? 'Đang kiểm tra thiết lập'
                : `${privacy.biometricLabel} · đang bật`}
            </Text>
          )}
        </View>
        {busy ? (
          <ActivityIndicator
            accessibilityLabel="Đang xử lý khóa tóm tắt Home"
            color={colors.earth}
          />
        ) : (
          <Switch
            accessibilityLabel="Ẩn tóm tắt tài chính trên Home bằng xác thực thiết bị"
            value={privacy.enabled === true}
            disabled={
              disabled ||
              !privacy.ready ||
              (!privacy.enabled && !privacy.canEnable)
            }
            onValueChange={(value) => {
              if (privacy.uid) void privacy.setEnabled(privacy.uid, value);
            }}
            trackColor={{ false: colors.line, true: colors.earth }}
            thumbColor={colors.surface}
          />
        )}
      </View>
      <Text style={[typography.small, compact && styles.compactDescription]}>
        {compact
          ? privacy.ready && !privacy.enabled && !privacy.canEnable
            ? 'Thiết lập Face ID hoặc vân tay để ẩn tóm tắt Home.'
            : 'Chỉ khóa tóm tắt trên Home. Tab Tài chính luôn mở trực tiếp.'
          : privacy.ready && !privacy.enabled && !privacy.canEnable
            ? 'Thiết lập Face ID hoặc vân tay trong cài đặt thiết bị để ẩn tóm tắt Home.'
            : 'Khóa này chỉ ẩn tóm tắt trên Home. Tab Tài chính luôn mở trực tiếp. Áp dụng cho tài khoản này trên thiết bị này.'}
      </Text>
      {privacy.error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {privacy.error}
        </Text>
      )}
      {!privacy.loading && privacy.enabled === null && (
        <Button
          compact
          title="Thử lại thiết lập bảo mật"
          variant="secondary"
          onPress={() => {
            if (privacy.uid) void privacy.load(privacy.uid);
          }}
        />
      )}
    </View>
  );
}
