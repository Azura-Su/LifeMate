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
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Feather name="x" size={20} color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
});
