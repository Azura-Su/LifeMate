import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { colors } from '../../theme';
import { styles } from './RegisterScreen.styles';
import type { useRegisterScreen } from './useRegisterScreen';

type Model = ReturnType<typeof useRegisterScreen>;

export function RegisterCompletion({ model }: { model: Model }) {
  const account = model.created;
  if (!account) return null;
  const primaryIsCheck = account.verificationSent;
  const primaryAction = primaryIsCheck
    ? model.checkVerification
    : model.resendVerification;
  const secondaryAction = primaryIsCheck
    ? model.resendVerification
    : model.checkVerification;
  const secondaryTitle = primaryIsCheck
    ? 'Gửi lại thư xác nhận'
    : 'Tôi đã xác nhận';

  return (
    <View style={styles.status}>
      <View style={styles.statusIcon}>
        <Feather name="mail" size={26} color={colors.sunlight} />
      </View>
      <View style={styles.statusIntro}>
        <Text style={styles.statusEyebrow}>TÀI KHOẢN ĐÃ TẠO</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Kiểm tra email của bạn
        </Text>
        <Text style={styles.statusLine}>
          {account.verificationSent
            ? 'Chúng tôi đã gửi thư xác nhận tới:'
            : 'Chưa gửi được thư xác nhận tới:'}
        </Text>
      </View>

      <View style={styles.recipient}>
        <Feather name="at-sign" size={18} color={colors.sky} />
        <Text selectable style={styles.recipientEmail}>
          {account.email || model.email.trim()}
        </Text>
      </View>

      <Text style={styles.instructions}>
        Mở email, nhấn liên kết xác nhận, rồi quay lại đây. Nếu chưa thấy thư,
        hãy kiểm tra cả mục Thư rác.
      </Text>

      {!account.profileSaved && (
        <View style={styles.profileWarning}>
          <Text style={styles.warning}>Tên hiển thị chưa được lưu.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thử lưu tên hiển thị"
            disabled={!!model.busy}
            onPress={() => void model.retryProfile()}
            style={styles.textAction}
          >
            <Text style={styles.textActionLabel}>
              {model.busy === 'profile' ? 'Đang lưu...' : 'Thử lại'}
            </Text>
          </Pressable>
        </View>
      )}

      {model.error && (
        <Text accessibilityRole="alert" style={styles.warning}>
          {model.error}
        </Text>
      )}

      <View style={styles.statusActions}>
        <Button
          title={primaryIsCheck ? 'Tôi đã xác nhận' : 'Gửi thư xác nhận'}
          loading={model.busy === (primaryIsCheck ? 'check' : 'send')}
          disabled={!!model.busy}
          onPress={() => void primaryAction()}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={secondaryTitle}
          disabled={!!model.busy}
          onPress={() => void secondaryAction()}
          style={styles.textAction}
        >
          <Text style={styles.textActionLabel}>
            {model.busy === (primaryIsCheck ? 'send' : 'check')
              ? primaryIsCheck
                ? 'Đang gửi...'
                : 'Đang kiểm tra...'
              : secondaryTitle}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vào LifeMate trước khi xác nhận email"
          disabled={!!model.busy}
          onPress={model.continueToApp}
          style={styles.enterLater}
        >
          <Text style={styles.enterLaterLabel}>Vào LifeMate trước</Text>
          <Feather name="arrow-right" size={17} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}
