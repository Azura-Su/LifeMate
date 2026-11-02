import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { usePrefersReducedMotion } from '../utils/motion';

export function BrandAvatar({ size = 56 }: { size?: number }) {
  const reduced = usePrefersReducedMotion();
  const pop = useRef(
    new Animated.Value(reduced ? 1 : 0),
  ).current;
  useEffect(() => {
    if (reduced) return;
    const animation = Animated.spring(pop, {
      toValue: 1,
      damping: 8,
      stiffness: 140,
      mass: 0.8,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [pop, reduced]);
  return (
    <Animated.Image
      source={require('../../assets/icon.png')}
      accessibilityLabel="Biểu tượng LifeMate"
      style={[
        styles.image,
        { width: size, height: size, borderRadius: size / 3 },
        {
          opacity: pop.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, 1, 1],
            extrapolate: 'clamp',
          }),
          transform: [
            {
              scale: pop.interpolate({
                inputRange: [0, 1],
                outputRange: [0.4, 1],
              }),
            },
            {
              rotate: pop.interpolate({
                inputRange: [0, 1],
                outputRange: ['-12deg', '0deg'],
              }),
            },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.background },
});
