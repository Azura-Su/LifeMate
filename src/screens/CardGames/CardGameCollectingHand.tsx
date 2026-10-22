import { Animated, StyleSheet, View } from 'react-native';
import { PlayingCard } from './PlayingCard';
import { colors } from '../../theme';

export function CardGameCollectingHand({
  cards,
  progress,
  compact,
  overlap,
}: {
  cards: number[];
  progress: Animated.Value;
  compact: boolean;
  overlap: number;
}) {
  const cardWidth = compact ? 44 : 56;
  return (
    <View
      testID="collecting-hand"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.layer}
    >
      {cards.map((card, index) => (
        <Animated.View
          key={card}
          style={{
            zIndex: index + 1,
            marginRight: index === cards.length - 1 ? 0 : -overlap,
            opacity: progress.interpolate({
              inputRange: [0, 0.7, 1],
              outputRange: [1, 0.8, 0],
            }),
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [
                    0,
                    ((cards.length - 1) / 2 - index) * (cardWidth - overlap),
                  ],
                }),
              },
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -68],
                }),
              },
              {
                scale: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0.6],
                }),
              },
              {
                rotateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '180deg'],
                }),
              },
            ],
          }}
        >
          <View style={styles.face}>
            <PlayingCard card={card} stacked compact={compact} />
          </View>
          <View
            style={[
              styles.back,
              { width: cardWidth, height: compact ? 58 : 78 },
            ]}
          />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 2,
    right: 2,
    bottom: 6,
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 4,
  },
  face: { backfaceVisibility: 'hidden' },
  back: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.earth,
    backgroundColor: colors.primary,
    backfaceVisibility: 'hidden',
    transform: [{ rotateY: '180deg' }],
  },
});
