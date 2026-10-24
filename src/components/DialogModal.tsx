import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ModalProps,
  type StyleProp,
  type ViewStyle,
  type ViewProps,
} from 'react-native';
import { colors } from '../theme';

type Props = PropsWithChildren<{
  visible?: boolean;
  onRequestClose?: () => void;
  onBackdropPress?: () => void;
  onDismiss?: () => void;
  onShow?: () => void;
  animationType?: ModalProps['animationType'];
  supportedOrientations?: ModalProps['supportedOrientations'];
  overlayStyle?: StyleProp<ViewStyle>;
  onTouchEnd?: ViewProps['onTouchEnd'];
  style?: StyleProp<ViewStyle>;
}>;

// Centered card over a dimmed backdrop, kept above the keyboard on iOS.
export function DialogModal({
  visible = true,
  onRequestClose,
  onBackdropPress,
  onDismiss,
  onShow,
  animationType = 'fade',
  supportedOrientations,
  overlayStyle,
  onTouchEnd,
  style,
  children,
}: Props) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType={animationType}
      supportedOrientations={supportedOrientations}
      onRequestClose={onRequestClose}
      onDismiss={onDismiss}
      onShow={onShow}
    >
      <KeyboardAvoidingView
        onTouchEnd={onTouchEnd}
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View testID="dialog-overlay" style={[styles.overlay, overlayStyle]}>
          {/* Keep the dismiss target behind the card so it cannot claim scroll gestures. */}
          <Pressable
            testID="dialog-backdrop"
            accessible={false}
            style={StyleSheet.absoluteFill}
            onPress={onBackdropPress}
          />
          <View
            testID="dialog-content"
            accessible={false}
            style={[styles.card, style]}
            accessibilityViewIsModal
          >
            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoiding: { flex: 1 },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.scrim,
  },
  // One shell for every popup: white card, soft lift, 24 radius.
  card: {
    width: '100%',
    maxWidth: 420,
    gap: 14,
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
});
