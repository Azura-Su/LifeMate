import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  onDismiss?: () => void;
  onShow?: () => void;
  animationType?: ModalProps['animationType'];
  overlayStyle?: StyleProp<ViewStyle>;
  onTouchEnd?: ViewProps['onTouchEnd'];
  style?: StyleProp<ViewStyle>;
}>;

// Centered card over a dimmed backdrop, kept above the keyboard on iOS.
export function DialogModal({
  visible = true,
  onRequestClose,
  onDismiss,
  onShow,
  animationType = 'fade',
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
      onRequestClose={onRequestClose}
      onDismiss={onDismiss}
      onShow={onShow}
    >
      <KeyboardAvoidingView
        onTouchEnd={onTouchEnd}
        style={[styles.overlay, overlayStyle]}
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
