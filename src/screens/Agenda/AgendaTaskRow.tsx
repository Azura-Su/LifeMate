import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { colors, typography } from '../../theme';
import type { AgendaItem } from '../../types/agenda';
import { formatAgendaDate, formatAgendaTime } from '../../utils/agenda';
import { styles } from './AgendaScreen.styles';

type Props = {
  item: AgendaItem;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddToCalendar: () => void;
  pendingAction?: 'complete' | 'delete' | 'calendar';
};
export function AgendaTaskRow({
  item,
  onComplete,
  onEdit,
  onDelete,
  onAddToCalendar,
  pendingAction,
}: Props) {
  const due = new Date(item.dueAt);
  const busy = !!pendingAction;
  return (
    <View style={styles.taskRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={
          item.completed
            ? `Đánh dấu chưa xong ${item.title}`
            : `Hoàn thành ${item.title}`
        }
        accessibilityState={{
          checked: item.completed,
          disabled: busy,
          busy: pendingAction === 'complete',
        }}
        disabled={busy}
        onPress={onComplete}
        style={styles.check}
      >
        {pendingAction === 'complete' ? (
          <ActivityIndicator size="small" color={colors.earth} />
        ) : (
          <Feather
            name={item.completed ? 'check-circle' : 'circle'}
            size={21}
            color={item.completed ? colors.success : colors.muted}
          />
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={onEdit}
        style={styles.taskText}
      >
        <Text
          numberOfLines={2}
          style={[styles.taskTitle, item.completed && styles.completed]}
        >
          {item.title}
        </Text>
        <Text style={typography.small}>
          {formatAgendaDate(due)} · {formatAgendaTime(due)}
          {item.reminderAt !== null ? ' · Có nhắc' : ''}
        </Text>
        {!!item.details && (
          <Text numberOfLines={2} style={styles.taskDetails}>
            {item.details}
          </Text>
        )}
      </Pressable>
      <View style={styles.taskActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Thêm ${item.title} vào lịch điện thoại`}
          accessibilityState={{
            disabled: busy,
            busy: pendingAction === 'calendar',
          }}
          disabled={busy}
          onPress={onAddToCalendar}
          style={styles.action}
        >
          {pendingAction === 'calendar' ? (
            <ActivityIndicator size="small" color={colors.sky} />
          ) : (
            <Feather name="calendar" size={17} color={colors.sky} />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Xóa ${item.title}`}
          accessibilityState={{
            disabled: busy,
            busy: pendingAction === 'delete',
          }}
          disabled={busy}
          onPress={onDelete}
          style={styles.action}
        >
          {pendingAction === 'delete' ? (
            <ActivityIndicator size="small" color={colors.earth} />
          ) : (
            <Feather name="trash-2" size={17} color={colors.muted} />
          )}
        </Pressable>
      </View>
    </View>
  );
}
