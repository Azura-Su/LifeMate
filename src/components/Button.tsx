import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
};

export function Button({
  title,
  onPress,
  loading,
  disabled,
  compact = false,
  variant = 'primary',
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
        (pressed || disabled || loading) && styles.dim,
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
    minHeight: 54,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.sunlightAction,
    borderWidth: 1,
    borderColor: colors.sunlightBorder,
  },
  secondary: {
    backgroundColor: colors.sunlightSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  danger: { backgroundColor: colors.dangerSoft },
  compact: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  text: { fontSize: 16, fontWeight: '700', color: colors.ink },
  compactText: { fontSize: 14 },
  primaryText: { color: colors.onPrimary },
  dangerText: { color: colors.danger },
  dim: { opacity: 0.6 },
});
