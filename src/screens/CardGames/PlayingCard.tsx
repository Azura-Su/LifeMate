import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  onPress,
  disabled = false,
}: {
  card: number;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const content = (
    <View style={[styles.face, selected && styles.selected]}>
      <Text style={[styles.rank, card % 4 >= 2 && styles.red]}>
        {ranks[Math.floor(card / 4)]}
      </Text>
      <Text style={[styles.suit, card % 4 >= 2 && styles.red]}>
        {suits[card % 4]}
      </Text>
    </View>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cardLabel(card)}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.target}
    >
      {content}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={cardLabel(card)}>
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
    justifyContent: 'space-between',
  },
  selected: {
    borderColor: colors.earth,
    borderWidth: 2,
    backgroundColor: colors.sunlightSoft,
    transform: [{ translateY: -4 }],
  },
  rank: { fontSize: 18, lineHeight: 22, fontWeight: '700', color: colors.ink },
  suit: {
    fontSize: 22,
    lineHeight: 25,
    color: colors.ink,
    alignSelf: 'flex-end',
  },
  red: { color: colors.danger },
});
