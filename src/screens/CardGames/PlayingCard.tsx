import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../../theme';

const ranks = [
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
  '2',
];
const suits = ['♠', '♣', '♦', '♥'];
const suitNames = ['bích', 'chuồn', 'rô', 'cơ'];
export const cardLabel = (card: number) =>
  `${ranks[Math.floor(card / 4)]} ${suitNames[card % 4]}`;

export function PlayingCard({
  card,
  selected = false,
  hinted = false,
  accessibilityHint,
  onPress,
  disabled = false,
  stacked = false,
  compact = false,
  stackIndex = 0,
  stackOverlap = 0,
  stackLast = false,
  dealAnimationKey,
  dealIndex = 0,
  dealDelayMs = 650,
}: {
  card: number;
  selected?: boolean;
  hinted?: boolean;
  accessibilityHint?: string;
  onPress?: () => void;
  disabled?: boolean;
  stacked?: boolean;
  compact?: boolean;
  stackIndex?: number;
  stackOverlap?: number;
  stackLast?: boolean;
  dealAnimationKey?: string;
  dealIndex?: number;
  dealDelayMs?: number;
}) {
  const selection = useRef(
    new Animated.Value(selected || hinted ? 1 : 0),
  ).current;
  useEffect(() => {
    const animation = Animated.timing(selection, {
      toValue: selected || hinted ? 1 : 0,
      duration: 150,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [selected, hinted, selection]);

  const lift = stacked ? 14 : 4;
  const dealtKey = useRef<string | null>(null);
  const dealParams = useRef({ dealIndex, dealDelayMs });
  dealParams.current = { dealIndex, dealDelayMs };
  const dealProgress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!dealAnimationKey) {
      dealProgress.setValue(1);
      return;
    }
    if (dealtKey.current === dealAnimationKey) return;
    dealtKey.current = dealAnimationKey;
    dealProgress.setValue(0);
    const animation = Animated.sequence([
      Animated.delay(
        dealParams.current.dealDelayMs + dealParams.current.dealIndex * 35,
      ),
      Animated.timing(dealProgress, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [dealAnimationKey, dealProgress]);
  const content = (
    <View
      style={[
        styles.face,
        stacked && styles.stackedFace,
        stacked && compact && styles.compactStackedFace,
        hinted && styles.hinted,
        selected && styles.selected,
      ]}
    >
      <Text
        style={[
          styles.rank,
          stacked && styles.stackedRank,
          stacked && compact && styles.compactStackedRank,
          card % 4 >= 2 && styles.red,
        ]}
      >
        {ranks[Math.floor(card / 4)]}
      </Text>
      <Text
        style={[
          styles.suit,
          stacked && styles.stackedSuit,
          stacked && compact && styles.compactStackedSuit,
          card % 4 >= 2 && styles.red,
        ]}
      >
        {suits[card % 4]}
      </Text>
    </View>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cardLabel(card)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.target,
        stacked && styles.stackedTarget,
        stacked && compact && styles.compactStackedTarget,
        stacked && {
          // Keep the hand's left-to-right stacking order while a card lifts.
          // Promoting selected cards above later cards hides their readable corners.
          zIndex: stackIndex + 1,
          marginRight: stackLast ? 0 : -stackOverlap,
        },
      ]}
    >
      <Animated.View
        style={{
          opacity: dealProgress,
          transform: [
            {
              translateY: dealProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [-34, 0],
              }),
            },
          ],
        }}
      >
        <Animated.View
          testID={`playing-card-motion-${card}`}
          style={{
            transform: [
              {
                translateY: selection.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -lift],
                }),
              },
            ],
          }}
        >
          {content}
        </Animated.View>
      </Animated.View>
    </Pressable>
  ) : (
    <View
      accessible
      accessibilityLabel={cardLabel(card)}
      accessibilityHint={accessibilityHint}
    >
      {content}
    </View>
  );
}
const styles = StyleSheet.create({
  target: { minWidth: 44, minHeight: 72 },
  face: {
    width: 44,
    height: 68,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 5,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  selected: {
    borderColor: colors.earth,
    borderWidth: 2,
    backgroundColor: colors.sunlightSoft,
  },
  hinted: {
    borderColor: colors.success,
    borderWidth: 2,
    backgroundColor: colors.successSoft,
  },
  stackedTarget: { minWidth: 56, minHeight: 84 },
  compactStackedTarget: { minWidth: 44, minHeight: 62 },
  stackedFace: {
    width: 56,
    height: 78,
    borderRadius: 8,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  compactStackedFace: {
    width: 44,
    height: 58,
    borderRadius: 7,
    padding: 3,
  },
  stackedRank: { fontSize: 16, lineHeight: 19 },
  compactStackedRank: { fontSize: 14, lineHeight: 16 },
  stackedSuit: { fontSize: 18, lineHeight: 20 },
  compactStackedSuit: { fontSize: 16, lineHeight: 17 },
  rank: { fontSize: 18, lineHeight: 21, fontWeight: '700', color: colors.ink },
  suit: {
    fontSize: 20,
    lineHeight: 22,
    color: colors.ink,
    alignSelf: 'flex-start',
    marginTop: -1,
  },
  red: { color: colors.danger },
});
