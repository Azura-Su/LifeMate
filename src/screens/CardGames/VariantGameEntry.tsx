import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../../theme';
import { styles } from './CardGamesScreen.styles';

export const variantGameInfo = {
  north: {
    name: 'Tiến lên miền Bắc',
    meta: '2–4 người · 13 lá · So cùng chất',
    note: 'Đôi cùng màu, sảnh cùng chất. Không có đôi thông.',
    pointLabel: 'Điểm mỗi lá còn lại',
    pointTitle: 'Mỗi lá còn lại',
    pointHint: 'Người về nhất nhận',
    icon: 'layers' as const,
  },
  sam: {
    name: 'Sâm',
    meta: '2–4 người · 10 lá · Có báo Sâm',
    note: 'Báo Sâm trước lượt đầu; báo một chỉ để thông tin.',
    pointLabel: 'Điểm mỗi lá còn lại khi báo thất bại hoặc không báo',
    pointTitle: 'Mỗi lá còn lại',
    pointHint: 'Khi báo thất bại hoặc không báo',
    icon: 'zap' as const,
  },
  tan: {
    name: 'Tấn',
    meta: '2–4 người · 8 lá · Chất chủ, tấn và đỡ',
    note: 'Đỡ từng lá hoặc nhận bài; rút nọc theo thứ tự lượt.',
    pointLabel: 'Điểm mỗi lá người thua còn',
    pointTitle: 'Mỗi lá còn lại',
    pointHint: 'Người thua trả',
    icon: 'shield' as const,
  },
};

export function VariantGameEntry({
  game,
  expanded,
  onToggle,
  onRules,
}: {
  game: keyof typeof variantGameInfo;
  expanded: boolean;
  onToggle: () => void;
  onRules: () => void;
}) {
  const info = variantGameInfo[game];
  return (
    <View style={[styles.gameCard, expanded && styles.gameCardSelected]}>
      <View style={styles.gameCardHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Chọn ${info.name}`}
          accessibilityState={{ selected: expanded }}
          onPress={onToggle}
          style={styles.gameOption}
        >
          <View style={styles.gameOptionIcon}>
            <Feather name={info.icon} size={18} color={colors.earth} />
          </View>
          <View style={styles.grow}>
            <Text style={styles.name}>{info.name}</Text>
            <Text style={styles.gameMeta}>{info.meta}</Text>
          </View>
          {expanded && (
            <Feather name="check-circle" size={18} color={colors.earth} />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Xem luật ${info.name}`}
          onPress={onRules}
          style={styles.gameExpansionRules}
        >
          <Feather name="book-open" size={16} color={colors.earth} />
        </Pressable>
      </View>
    </View>
  );
}
