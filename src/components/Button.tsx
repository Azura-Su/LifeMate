import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { colors, shadows, radius } from '../theme';
import { PressableScale } from './PressableScale';

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
    <PressableScale
      pressedScale={pressScale ?? 0.97}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.base,
        styles[variant],
        compact && styles.compact,
        (disabled || loading) && styles.dim,
      ]}
      pressedStyle={styles.pressed}
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
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: radius.lg,
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
    ...shadows.card,
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
  pressed: { opacity: 0.88 },
  dim: { opacity: 0.45 },
});
