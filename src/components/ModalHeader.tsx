import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors, typography } from '../theme';

type Props = {
  title: string;
  eyebrow?: string;
  accessibilityLabel: string;
  disabled?: boolean;
  onBack: () => void;
};

export function ModalHeader({
  title,
  eyebrow,
  accessibilityLabel,
  disabled = false,
  onBack,
}: Props) {
  return (
    <View testID="modal-header" style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Quay lại màn hình trước"
        disabled={disabled}
        onPress={onBack}
        style={[styles.side, disabled && styles.disabled]}
      >
        <Feather
          testID="modal-header-back-icon"
          name="arrow-left"
          size={24}
          color={colors.ink}
        />
      </Pressable>
      <View style={styles.titleContainer}>
        {eyebrow && (
          <Text
            numberOfLines={1}
            style={[typography.eyebrow, styles.eyebrow, styles.center]}
          >
            {eyebrow}
          </Text>
        )}
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[typography.title, styles.title, styles.center]}
        >
          {title}
        </Text>
      </View>
      <View accessible={false} style={styles.side} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  side: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    paddingHorizontal: 8,
  },
  eyebrow: { fontSize: 10, lineHeight: 14, letterSpacing: 1.5 },
  title: { fontSize: 24, lineHeight: 30 },
  center: { width: '100%', flexShrink: 1, textAlign: 'center' },
  disabled: { opacity: 0.4 },
});
