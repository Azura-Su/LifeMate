import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme';

type Props = {
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
};

export function DialogCloseButton({
  accessibilityLabel,
  onPress,
  disabled = false,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Đóng hộp thoại"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Feather name="x" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Soft round close button, the same in every popup.
  button: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.skySoft,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
});
