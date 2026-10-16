import { Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { typography } from '../../theme';
import { styles } from './RegisterScreen.styles';
import type { useRegisterScreen } from './useRegisterScreen';

type Model = ReturnType<typeof useRegisterScreen>;

export function RegisterCompletion({ model }: { model: Model }) {
  const account = model.created;
  if (!account) return null;
  return (
    <View style={styles.status}>
      <Text accessibilityRole="header" style={styles.title}>
        Tài khoản đã được tạo
      </Text>
      <Text style={styles.statusLine}>
        Bạn có thể tiếp tục dùng LifeMate. Xác nhận email để kết bạn và chia sẻ
        Ký ức.
      </Text>
      {!account.profileSaved && (
        <>
          <Text style={styles.warning}>Tên hiển thị chưa được lưu.</Text>
          <Button
            title="Thử lưu tên"
            variant="secondary"
            loading={model.busy === 'profile'}
            disabled={!!model.busy}
            onPress={() => void model.retryProfile()}
          />
        </>
      )}
      <Text style={typography.small}>
        {account.emailVerified
          ? 'Email đã được xác nhận.'
          : account.verificationSent
            ? 'Yêu cầu gửi thư xác nhận đã được tiếp nhận. Hãy kiểm tra hộp thư.'
            : 'Chưa gửi được thư xác nhận. Bạn có thể gửi lại.'}
      </Text>
      {!account.emailVerified && (
        <View style={styles.actionGroup}>
          <Button
            title="Gửi lại email"
            variant="secondary"
            loading={model.busy === 'send'}
            disabled={!!model.busy}
            onPress={() => void model.resendVerification()}
          />
          <Button
            title="Tôi đã xác nhận"
            variant="secondary"
            loading={model.busy === 'check'}
            disabled={!!model.busy}
            onPress={() => void model.checkVerification()}
          />
        </View>
      )}
      {model.error && (
        <Text accessibilityRole="alert" style={styles.warning}>
          {model.error}
        </Text>
      )}
      <Button
        title="Tiếp tục vào LifeMate"
        disabled={!!model.busy}
        onPress={model.continueToApp}
      />
    </View>
  );
}
