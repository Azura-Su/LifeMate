import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../../theme';
import { styles } from './CardGamesScreen.styles';

export function PhomGameEntry({
  expanded,
  onToggle,
  onRules,
}: {
  expanded: boolean;
  onToggle: () => void;
  onRules: () => void;
}) {
  return (
    <View style={[styles.gameCard, expanded && styles.gameCardSelected]}>
      <View style={styles.gameCardHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn Phỏm"
          accessibilityState={{ selected: expanded }}
          onPress={onToggle}
          style={styles.gameOption}
        >
          <View style={styles.gameOptionIcon}>
            <Feather name="grid" size={18} color={colors.earth} />
          </View>
          <View style={styles.grow}>
            <Text style={styles.name}>Phỏm</Text>
            <Text style={styles.gameMeta}>
              2–4 người · Ăn, bốc, hạ và gửi bài
            </Text>
          </View>
          {expanded && (
            <Feather name="check-circle" size={18} color={colors.earth} />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xem luật Phỏm"
          onPress={onRules}
          style={styles.gameExpansionRules}
        >
          <Feather name="book-open" size={16} color={colors.earth} />
        </Pressable>
      </View>
    </View>
  );
}
