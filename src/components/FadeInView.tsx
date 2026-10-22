import { useEffect, useRef, type PropsWithChildren } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { prefersReducedMotion } from '../utils/motion';

type Props = PropsWithChildren<{
  /** Stagger delay in ms. */
  delay?: number;
  /** Starting vertical offset in px. */
  offset?: number;
  style?: StyleProp<ViewStyle>;
}>;

/** Fades and lifts its content in once, on mount. */
export function FadeInView({ delay = 0, offset = 10, style, children }: Props) {
  const reduced = prefersReducedMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 320,
      delay,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress, reduced]);
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
