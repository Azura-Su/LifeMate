import { StyleSheet, Text, View } from 'react-native';
import { typography } from '../theme';
import { DialogCloseButton } from './DialogCloseButton';

type Props = {
  title: string;
  eyebrow?: string;
  accessibilityLabel: string;
  disabled?: boolean;
  onClose: () => void;
};

export function ModalHeader({
  title,
  eyebrow,
  accessibilityLabel,
  disabled = false,
  onClose,
}: Props) {
  return (
    <View testID="modal-header" style={styles.row}>
      <View accessible={false} style={styles.side} />
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
      <View style={styles.side}>
        <DialogCloseButton
          accessibilityLabel={accessibilityLabel}
          disabled={disabled}
          onPress={onClose}
        />
      </View>
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
});
