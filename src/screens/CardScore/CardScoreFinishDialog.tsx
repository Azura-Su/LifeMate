import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { DialogModal } from '../../components/DialogModal';
import { colors } from '../../theme';
import { styles } from './CardScoreScreen.styles';

type Props = {
  visible: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function CardScoreFinishDialog({
  visible,
  busy,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <DialogModal
      visible={visible}
      onRequestClose={() => !busy && onCancel()}
      style={styles.finishDialog}
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
        Bàn sẽ được lưu vào lịch sử để bạn xem lại sau.
      </Text>
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
    </DialogModal>
  );
}
