import { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { prefersReducedMotion } from '../utils/motion';

type Props = {
  /** 0-100. */
  percent: number;
  style?: StyleProp<ViewStyle>;
};

/** Progress bar fill whose width eases to the new percentage. */
export function AnimatedFill({ percent, style }: Props) {
  const progress = useRef(new Animated.Value(percent)).current;
  useEffect(() => {
    if (prefersReducedMotion()) {
      progress.setValue(percent);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: percent,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [percent, progress]);
  const width = progress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });
  return <Animated.View style={[style, { width }]} />;
}
