import { useEffect, useRef, type PropsWithChildren } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { motion } from '../theme';
import { usePrefersReducedMotion } from '../utils/motion';

type Props = PropsWithChildren<{
  /** Stagger delay in ms. */
  delay?: number;
  /** Starting vertical offset in px. */
  offset?: number;
  /** Render in place, without animating (rows already shown once). */
  skip?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

/** Fades and lifts its content in once, on mount. */
export function FadeInView({
  delay = 0,
  offset = 16,
  skip = false,
  style,
  children,
}: Props) {
  const reduced = usePrefersReducedMotion();
  const skipOnMount = useRef(skip).current;
  const progress = useRef(
    new Animated.Value(reduced || skipOnMount ? 1 : 0),
  ).current;
  useEffect(() => {
    if (reduced || skipOnMount) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motion.slow,
      easing: Easing.out(Easing.cubic),
      delay,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress, reduced, skipOnMount]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [offset, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
