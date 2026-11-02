import { useRef, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { usePrefersReducedMotion } from '../utils/motion';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  /** Scale while the finger is down. */
  pressedScale?: number;
  style?: StyleProp<ViewStyle>;
  /** Extra layout for the scaling wrapper. Margins, alignSelf, position and flex from `style` are mirrored there automatically. */
  wrapperStyle?: StyleProp<ViewStyle>;
  /** Style applied to the pressable surface itself while pressed. */
  pressedStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

const SPRING = { damping: 14, stiffness: 320, mass: 0.6 } as const;

const WRAPPER_KEYS = [
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'position',
  'top',
  'bottom',
  'left',
  'right',
] as const;

/** Layout keys of `style` that must also apply to the scaling wrapper. */
function pickWrapperLayout(style: StyleProp<ViewStyle>): ViewStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  const picked: Record<string, unknown> = {};
  for (const key of WRAPPER_KEYS) {
    if (flat[key] !== undefined) picked[key] = flat[key];
  }
  return picked as ViewStyle;
}

/** `style` without the keys that already live on the scaling wrapper. */
function omitWrapperLayout(style: StyleProp<ViewStyle>): ViewStyle {
  const flat: Record<string, unknown> = { ...(StyleSheet.flatten(style) ?? {}) };
  for (const key of WRAPPER_KEYS) delete flat[key];
  return flat as ViewStyle;
}

/**
 * Pressable that springs down on touch and bounces back on release.
 * Native-driver only (transform), interruptible, skipped for reduced motion.
 */
export function PressableScale({
  pressedScale = 0.96,
  style,
  wrapperStyle,
  pressedStyle,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const reduced = usePrefersReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (toValue: number) => {
    if (reduced) return;
    Animated.spring(scale, {
      toValue,
      ...SPRING,
      useNativeDriver: true,
    }).start();
  };
  return (
    <Animated.View
      style={[pickWrapperLayout(style), wrapperStyle, { transform: [{ scale }] }]}
    >
      <Pressable
        {...rest}
        onPressIn={(event: GestureResponderEvent) => {
          spring(pressedScale);
          onPressIn?.(event);
        }}
        onPressOut={(event: GestureResponderEvent) => {
          spring(1);
          onPressOut?.(event);
        }}
        style={({ pressed }) => [
          omitWrapperLayout(style),
          styles.fill,
          pressed && pressedStyle,
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // The wrapper owns flex, margins and position; the surface just fills it.
  fill: { flexGrow: 1, alignSelf: 'stretch' },
});
