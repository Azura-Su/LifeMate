import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  name: keyof typeof Feather.glyphMap;
  focused: boolean;
  color: string;
};

/**
 * Bottom-bar icon with a soft pill that grows in behind the active tab and a
 * small lift/scale on the icon. Native-driver only (opacity + transform).
 */
export function TabBarIcon({ name, focused, color }: Props) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(progress, {
      toValue: focused ? 1 : 0,
      damping: 16,
      stiffness: 220,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [focused, progress]);
  const pillStyle = {
    opacity: progress,
    transform: [
      {
        scaleX: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.5, 1],
          extrapolate: 'clamp',
        }),
      },
    ],
  };
  const iconStyle = {
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -1],
        }),
      },
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.08],
        }),
      },
    ],
  };
  return (
    <View testID={`tab-icon-${name}`} style={styles.wrap}>
      <Animated.View pointerEvents="none" style={[styles.pill, pillStyle]} />
      <Animated.View style={iconStyle}>
        <Feather name={name} size={20} color={color} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 56,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 15,
    backgroundColor: colors.primary,
  },
});
