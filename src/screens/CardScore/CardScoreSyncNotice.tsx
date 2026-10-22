import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, layout, radius, spacing } from '../../theme';

export function CardScoreSyncNotice({
  scoreError,
  onSync,
}: {
  scoreError?: string | null;
  onSync: () => void;
}) {
  if (!scoreError) return null;
  return (
    <View style={noticeStyles.container}>
      <View style={noticeStyles.row}>
        <Text style={noticeStyles.message}>
          {scoreError} Bảng điểm tạm chỉ xem.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đồng bộ lại bảng điểm"
          onPress={onSync}
          style={noticeStyles.action}
        >
          <Feather name="refresh-cw" size={14} color={colors.earth} />
          <Text style={noticeStyles.actionText}>Đồng bộ lại</Text>
        </Pressable>
      </View>
    </View>
  );
}
const noticeStyles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.skySoft,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  message: {
    flexGrow: 1,
    flexBasis: '60%',
    color: colors.muted,
    fontSize: fontSize.label,
    lineHeight: 18,
  },
  action: {
    minHeight: layout.hitSize,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionText: {
    color: colors.earth,
    fontSize: fontSize.label,
    fontWeight: '600',
  },
});
