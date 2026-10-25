import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { DialogModal } from '../../components/DialogModal';
import { colors } from '../../theme';
import { styles } from './CardScoreScreen.styles';

type Props = {
  visible: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  onDismiss?: () => void;
  localOnly?: boolean;
};

export function CardScoreFinishDialog({
  visible,
  busy,
  error,
  onCancel,
  onConfirm,
  onDismiss,
  localOnly = false,
}: Props) {
  return (
    <DialogModal
      visible={visible}
      onRequestClose={() => !busy && onCancel()}
      onDismiss={onDismiss}
      style={styles.finishDialog}
    >
      <View
        testID="card-score-finish-content"
        style={styles.finishDialogContent}
      >
        <View style={styles.finishDialogHeading}>
          <View style={styles.finishDialogIcon}>
            <Feather name="archive" size={20} color={colors.earth} />
          </View>
          <Text accessibilityRole="header" style={styles.finishDialogTitle}>
            Kết thúc bàn chơi?
          </Text>
        </View>
        <Text style={styles.finishDialogMessage}>
          {localOnly
            ? 'Bảng điểm sẽ được lưu vào lịch sử trên thiết bị này. Phòng và bảng điểm chung vẫn tiếp tục.'
            : 'Bàn sẽ được lưu vào lịch sử để bạn xem lại sau.'}
        </Text>
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <View style={styles.finishDialogActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tiếp tục chơi"
            disabled={busy}
            onPress={onCancel}
            style={({ pressed }) => [
              styles.finishCancelButton,
              pressed && !busy && styles.createButtonPressed,
            ]}
          >
            <Text style={styles.finishCancelText}>Tiếp tục chơi</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xác nhận kết thúc bàn"
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.finishConfirmButton,
              (pressed || busy) && styles.createButtonPressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.finishConfirmText}>Kết thúc</Text>
            )}
          </Pressable>
        </View>
      </View>
    </DialogModal>
  );
}
