import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  View,
} from 'react-native';
import { colors } from '../../theme';

const settledMatchAnimations = new Set<string>();

function markAnimationSettled(animationKey: string) {
  settledMatchAnimations.delete(animationKey);
  settledMatchAnimations.add(animationKey);
  if (settledMatchAnimations.size > 64) {
    const oldestKey = settledMatchAnimations.values().next().value;
    if (oldestKey) settledMatchAnimations.delete(oldestKey);
  }
}

function formatBalance(value: number, unit: 'đ' | 'điểm') {
  return `${value > 0 ? '+' : ''}${value.toLocaleString('vi-VN')} ${unit}`;
}

export function CardGameMoneyCounter({
  balance,
  delta = 0,
  unit = 'đ',
  animate = false,
  testID,
  balanceStyle,
  animationKey,
}: {
  balance: number;
  delta?: number;
  unit?: 'đ' | 'điểm';
  animate?: boolean;
  testID: string;
  balanceStyle?: StyleProp<TextStyle>;
  animationKey: string;
}) {
  const startBalance = balance - delta;
  const alreadySettled = settledMatchAnimations.has(animationKey);
  const [displayedBalance, setDisplayedBalance] = useState(
    animate && !alreadySettled ? startBalance : balance,
  );
  const [showDelta, setShowDelta] = useState(
    animate && delta !== 0 && !alreadySettled,
  );
  const count = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  const flight = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    count.stopAnimation();
    reveal.stopAnimation();
    flight.stopAnimation();
    pulse.stopAnimation();
    count.setValue(0);
    reveal.setValue(0);
    flight.setValue(0);
    pulse.setValue(1);

    if (!animate || delta === 0 || settledMatchAnimations.has(animationKey)) {
      setDisplayedBalance(balance);
      setShowDelta(false);
      return;
    }

    setDisplayedBalance(startBalance);
    setShowDelta(true);
    const listener = count.addListener(({ value }) => {
      setDisplayedBalance(Math.round(startBalance + delta * value));
    });
    const sequence = Animated.sequence([
      Animated.parallel([
        Animated.timing(reveal, {
          toValue: 1,
          duration: 210,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(100),
      Animated.timing(flight, {
        toValue: 1,
        duration: 590,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(count, {
          toValue: 1,
          duration: 780,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.12,
            duration: 110,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]);
    sequence.start(({ finished }) => {
      if (finished) {
        setDisplayedBalance(balance);
        markAnimationSettled(animationKey);
        setShowDelta(false);
      }
    });

    return () => {
      count.removeListener(listener);
      sequence.stop();
      markAnimationSettled(animationKey);
    };
  }, [
    animate,
    animationKey,
    balance,
    count,
    delta,
    flight,
    pulse,
    reveal,
    startBalance,
  ]);

  const deltaColor = delta > 0 ? colors.success : colors.danger;

  return (
    <View style={styles.counter} testID={`${testID}-counter`}>
      <Animated.Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        accessibilityLabel={`Số dư ${displayedBalance} ${unit === 'đ' ? 'đồng' : unit}`}
        testID={testID}
        style={[
          styles.balance,
          balanceStyle,
          displayedBalance > 0 && styles.positive,
          displayedBalance < 0 && styles.negative,
          { transform: [{ scale: pulse }] },
        ]}
      >
        {formatBalance(displayedBalance, unit)}
      </Animated.Text>
      {showDelta && (
        <Animated.View
          pointerEvents="none"
          testID={`${testID}-delta`}
          style={[
            styles.deltaFloat,
            {
              opacity: Animated.multiply(
                reveal,
                flight.interpolate({
                  inputRange: [0, 0.8, 1],
                  outputRange: [1, 1, 0],
                }),
              ),
              transform: [
                {
                  translateY: flight.interpolate({
                    inputRange: [0, 1],
                    outputRange: [22, 0],
                  }),
                },
                {
                  scale: flight.interpolate({
                    inputRange: [0, 0.8, 1],
                    outputRange: [1, 0.82, 0.55],
                  }),
                },
              ],
            },
          ]}
        >
          <Text
            accessibilityLabel={`Thay đổi ${delta > 0 ? '+' : ''}${delta.toLocaleString('vi-VN')} ${unit === 'đ' ? 'đồng' : unit}`}
            style={[styles.deltaText, { color: deltaColor }]}
          >
            {delta > 0 ? '+' : ''}
            {delta.toLocaleString('vi-VN')}
            {' '}
            {unit}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  counter: {
    minWidth: 34,
    minHeight: 18,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balance: {
    zIndex: 1,
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 1,
    backgroundColor: colors.skySoft,
    color: colors.earth,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  positive: { color: colors.success, backgroundColor: colors.successSoft },
  negative: { color: colors.danger, backgroundColor: colors.dangerSoft },
  deltaFloat: {
    position: 'absolute',
    zIndex: 2,
    top: 0,
    alignSelf: 'center',
    minWidth: 34,
    alignItems: 'center',
  },
  deltaText: {
    overflow: 'hidden',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.surface,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
});
