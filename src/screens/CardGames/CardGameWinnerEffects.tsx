import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../../theme';
import { claimCardPresentation } from './cardTableMotion';

const bursts = [
  { x: 12, y: 24 },
  { x: 48, y: 20 },
];
const directions = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
];
const particleColors = [colors.sunlight, '#E8B85B', '#FFF4CF', colors.earth];

export function CardGameWinnerEffects({
  playerUID,
  animationKey,
  animate = true,
}: {
  playerUID: string;
  animationKey: string;
  animate?: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [showParticles, setShowParticles] = useState(false);

  useEffect(() => {
    if (!animate || !claimCardPresentation(`winner:${animationKey}`)) {
      setShowParticles(false);
      progress.setValue(1);
      return;
    }
    setShowParticles(true);
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 1900,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) setShowParticles(false);
    });
    return () => animation.stop();
  }, [animate, animationKey, progress]);

  return (
    <View
      pointerEvents="none"
      accessibilityLabel="Pháo hoa chúc mừng người thắng"
      testID={`winner-effects-${playerUID}`}
      style={styles.anchor}
    >
      {showParticles && (
        <View testID="winner-fireworks" style={StyleSheet.absoluteFill} />
      )}
      {showParticles &&
        bursts.map((burst, burstIndex) =>
          directions.map(([x, y], particleIndex) => {
            const delay = burstIndex * 0.12;
            return (
              <Animated.View
                key={`${burstIndex}-${particleIndex}`}
                style={[
                  styles.particle,
                  {
                    left: burst.x,
                    top: burst.y,
                    backgroundColor:
                      particleColors[
                        (burstIndex + particleIndex) % particleColors.length
                      ],
                    opacity: progress.interpolate({
                      inputRange: [0, 0.14 + delay, 0.78, 1],
                      outputRange: [0, 1, 0.9, 0],
                      extrapolate: 'clamp',
                    }),
                    transform: [
                      {
                        translateX: progress.interpolate({
                          inputRange: [0, 0.14 + delay, 0.78, 1],
                          outputRange: [
                            0,
                            0,
                            x * 0.6 + x * 16,
                            x * 0.6 + x * 19,
                          ],
                          extrapolate: 'clamp',
                        }),
                      },
                      {
                        translateY: progress.interpolate({
                          inputRange: [0, 0.14 + delay, 0.78, 1],
                          outputRange: [10, 0, y * 16 + 5, y * 19 + 13],
                          extrapolate: 'clamp',
                        }),
                      },
                      {
                        scale: progress.interpolate({
                          inputRange: [0, 0.14 + delay, 0.35, 1],
                          outputRange: [0.3, 0.7, 1, 0.2],
                          extrapolate: 'clamp',
                        }),
                      },
                    ],
                  },
                ]}
              />
            );
          }),
        )}
      {showParticles &&
        directions.slice(0, 6).map(([x, y], index) => (
          <Animated.View
            key={`glitter-${index}`}
            style={[
              styles.glitter,
              {
                left: 23 + index * 3,
                opacity: progress.interpolate({
                  inputRange: [0.35, 0.5, 0.85, 1],
                  outputRange: [0, 0.9, 0.65, 0],
                  extrapolate: 'clamp',
                }),
                transform: [
                  {
                    translateY: progress.interpolate({
                      inputRange: [0.35, 1],
                      outputRange: [0, 18 + Math.abs(y) * 3],
                      extrapolate: 'clamp',
                    }),
                  },
                  {
                    translateX: progress.interpolate({
                      inputRange: [0.35, 1],
                      outputRange: [0, x * 10],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    zIndex: 5,
    top: -30,
    left: -29,
    width: 82,
    height: 64,
    overflow: 'visible',
  },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  glitter: {
    position: 'absolute',
    top: 28,
    width: 3,
    height: 5,
    borderRadius: 1,
    backgroundColor: '#FFF4CF',
  },
});
