import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  pressScale?: number;
};

export function Button({
  title,
  onPress,
  loading,
  disabled,
  compact = false,
  variant = 'primary',
  pressScale,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        compact && styles.compact,
        pressed && styles.pressed,
        (disabled || loading) && styles.dim,
        pressed && pressScale ? { transform: [{ scale: pressScale }] } : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'primary'
              ? colors.onPrimary
              : variant === 'danger'
                ? colors.danger
                : colors.earth
          }
        />
      ) : (
        <Text
          style={[
            styles.text,
            compact && styles.compactText,
            variant === 'primary' && styles.primaryText,
            variant === 'secondary' && styles.secondaryText,
            variant === 'danger' && styles.dangerText,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Primary: warm filled call to action.
  primary: {
    backgroundColor: colors.sunlightAction,
    borderWidth: 1,
    borderColor: colors.sunlightBorder,
  },
  // Secondary: quiet outlined button.
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  danger: { backgroundColor: colors.dangerSoft },
  compact: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  text: { fontSize: 15, fontWeight: '700', color: colors.ink },
  compactText: { fontSize: 14 },
  primaryText: { color: colors.onPrimary },
  secondaryText: { color: colors.earth, fontWeight: '600' },
  dangerText: { color: colors.danger },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  dim: { opacity: 0.45 },
});
