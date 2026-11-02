import { useEffect, useRef, type PropsWithChildren } from 'react';
import {
  Animated,
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
import { colors, radius } from '../theme';
import { prefersReducedMotion } from '../utils/motion';

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
  const pop = useRef(
    new Animated.Value(prefersReducedMotion() || !visible ? 1 : 0),
  ).current;
  useEffect(() => {
    if (!visible || prefersReducedMotion()) {
      pop.setValue(1);
      return;
    }
    pop.setValue(0);
    const animation = Animated.spring(pop, {
      toValue: 1,
      damping: 15,
      stiffness: 190,
      mass: 0.8,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [visible, pop]);
  const popStyle = {
    opacity: pop.interpolate({
      inputRange: [0, 0.6, 1],
      outputRange: [0, 1, 1],
      extrapolate: 'clamp' as const,
    }),
    transform: [
      {
        scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }),
      },
      {
        translateY: pop.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
    ],
  };
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
          <Animated.View
            testID="dialog-content"
            accessible={false}
            style={[styles.card, style, popStyle]}
            accessibilityViewIsModal
          >
            {children}
          </Animated.View>
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
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
});
