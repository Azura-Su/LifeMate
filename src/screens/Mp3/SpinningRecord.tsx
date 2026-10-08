import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../../theme';

type Props = {
  playing: boolean;
  // false hides it from screen readers when a nearby label already says it.
  visible?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

const BASE_SIZE = 28;

export function SpinningRecord({
  playing,
  visible = true,
  size = BASE_SIZE,
  style,
}: Props) {
  const scale = size / BASE_SIZE;
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!playing) {
      rotation.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [playing, rotation]);

  return (
    <Animated.View
      accessible={visible}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'yes' : 'no-hide-descendants'}
      accessibilityRole="image"
      accessibilityLabel={
        visible ? (playing ? 'Đĩa đang phát' : 'Đĩa tạm dừng') : undefined
      }
      testID="spinning-record"
      style={[
        styles.record,
        style,
        {
          // Scale keeps the groove proportions; the negative margin shrinks
          // the layout box to the requested size.
          margin: scale === 1 ? undefined : (size - BASE_SIZE) / 2,
          transform: [
            ...(scale === 1 ? [] : [{ scale }]),
            {
              rotate: rotation.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.outerGroove} />
      <View style={styles.innerGroove} />
      <View style={styles.label}>
        <View style={styles.labelHole} />
      </View>
      <View testID="record-spin-marker" style={styles.spinMarker} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  record: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.record,
    borderWidth: 1,
    borderColor: colors.earth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerGroove: {
    position: 'absolute',
    width: 23,
    height: 23,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.recordGroove,
  },
  innerGroove: {
    position: 'absolute',
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.recordGroove,
  },
  label: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelHole: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.ink,
  },
  spinMarker: {
    position: 'absolute',
    top: 3,
    left: 12,
    width: 3,
    height: 7,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
});
