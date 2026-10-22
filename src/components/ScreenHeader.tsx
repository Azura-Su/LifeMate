import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, layout, radius, spacing, typography } from '../theme';

type Props = {
  title: string;
  subtitle?: string;
  onBack: () => void;
  backLabel?: string;
  /** Trailing actions, typically HeaderIconButton(s). */
  right?: ReactNode;
};

/** Standard header for screens opened from Home: back · title · actions. */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  backLabel = 'Quay về Home',
  right,
}: Props) {
  return (
    <View style={styles.header}>
      <HeaderIconButton
        icon="arrow-left"
        label={backLabel}
        onPress={onBack}
        tone="plain"
      />
      <View style={styles.titleGroup}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={typography.screenTitle}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        )}
      </View>
      {right ?? <View style={styles.spacer} />}
    </View>
  );
}

/**
 * Header for the main tabs (Tài chính, Danh sách nghe, Dòng ký ức):
 * large title, optional subtitle, round action buttons on the right.
 */
export function TabHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.tabHeader}>
      <View style={styles.titleGroup}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          ellipsizeMode="tail"
          style={styles.tabTitle}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

export function HeaderIconButton({
  icon,
  label,
  onPress,
  disabled,
  busy,
  tone = 'tinted',
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** `plain` for back buttons, `tinted` (round, soft fill) for actions. */
  tone?: 'plain' | 'tinted';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={
        disabled === undefined && busy === undefined
          ? undefined
          : { disabled: !!disabled, busy: !!busy }
      }
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.icon,
        tone === 'tinted' && styles.tinted,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Feather
        name={icon}
        size={tone === 'tinted' ? 19 : 21}
        color={colors.earth}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  tabHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tabTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: colors.ink,
  },
  titleGroup: { flex: 1, minWidth: 0 },
  subtitle: { ...typography.small, marginTop: 1 },
  icon: {
    width: layout.hitSize,
    height: layout.hitSize,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tinted: {
    borderRadius: layout.hitSize / 2,
    backgroundColor: colors.sunlightSoft,
  },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
  spacer: { width: layout.hitSize },
});
