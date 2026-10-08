import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../theme';

type Props = PropsWithChildren<{
  visible?: boolean;
  onRequestClose?: () => void;
  style?: StyleProp<ViewStyle>;
}>;

// Centered card over a dimmed backdrop, lifted above the keyboard on iOS.
export function DialogModal({
  visible = true,
  onRequestClose,
  style,
  children,
}: Props) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.card, style]} accessibilityViewIsModal>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.scrim,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    gap: 16,
    padding: 24,
    borderRadius: 24,
    backgroundColor: colors.background,
  },
});
