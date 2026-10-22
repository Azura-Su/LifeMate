import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, layout, radius, spacing } from '../../theme';
import type { CardScoreMatch } from '../../types/cardScore';
import type { GameRoomStatus } from '../../types/cardGame';

export function CardScoreRoomActions({
  match,
  status,
  busy,
  allowRejoin = true,
  compact = false,
  onRejoin,
  onReopen,
  onDelete,
}: {
  match: CardScoreMatch;
  status: GameRoomStatus | null;
  busy: boolean;
  allowRejoin?: boolean;
  /** Icon-only buttons for the open table header. */
  compact?: boolean;
  onRejoin: (code: string) => void;
  onReopen?: () => void;
  onDelete?: () => void;
}) {
  if (!match.onlineRoomId) return null;
  const code =
    match.onlineRoomCode ??
    match.title.match(/· ([ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8})$/)?.[1];
  const actions: {
    key: string;
    title: string;
    label: string;
    icon: 'log-in' | 'refresh-cw' | 'trash-2';
    run: () => void;
  }[] = [];
  if (
    allowRejoin &&
    !match.deletedAt &&
    match.status === 'active' &&
    code &&
    (!status || status.canRejoin)
  )
    actions.push({
      key: 'rejoin',
      title: 'Vào lại phòng',
      label: `Vào lại phòng ${code}`,
      icon: 'log-in',
      run: () => onRejoin(code),
    });
  if (status?.canReopen && onReopen)
    actions.push({
      key: 'reopen',
      title: 'Tạo lại phòng',
      label: 'Tạo lại phòng',
      icon: 'refresh-cw',
      run: onReopen,
    });
  if (status?.canDelete && onDelete)
    actions.push({
      key: 'delete',
      title: 'Xóa phòng',
      label: 'Xóa phòng đã kết thúc',
      icon: 'trash-2',
      run: onDelete,
    });
  if (!actions.length) return null;
  if (compact)
    return (
      <>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            testID={`online-room-${action.key}`}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={action.run}
            style={({ pressed }) => [
              roomStyles.iconAction,
              (busy || pressed) && roomStyles.dim,
            ]}
          >
            <Feather
              name={action.icon}
              size={16}
              color={action.key === 'delete' ? colors.danger : colors.earth}
            />
          </Pressable>
        ))}
      </>
    );
  return (
    <View style={roomStyles.actions}>
      {actions.map((action) => (
        <Pressable
          key={action.key}
          testID={`online-room-${action.key}${allowRejoin ? '' : `-${match.id}`}`}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={action.run}
          style={({ pressed }) => [
            roomStyles.action,
            (busy || pressed) && roomStyles.dim,
          ]}
        >
          <Feather name={action.icon} size={14} color={colors.earth} />
          <Text style={roomStyles.label}>{action.title}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const roomStyles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: {
    minHeight: layout.hitSize,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  label: { color: colors.earth, fontSize: fontSize.label, fontWeight: '600' },
  iconAction: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.skySoft,
  },
  dim: { opacity: 0.5 },
});
