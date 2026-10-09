import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
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
};
export function AgendaTaskRow({
  item,
  onComplete,
  onEdit,
  onDelete,
  onAddToCalendar,
}: Props) {
  const due = new Date(item.dueAt);
  return (
    <View style={styles.taskRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={
          item.completed
            ? `Đánh dấu chưa xong ${item.title}`
            : `Hoàn thành ${item.title}`
        }
        accessibilityState={{ checked: item.completed }}
        onPress={onComplete}
        style={styles.check}
      >
        <Feather
          name={item.completed ? 'check-circle' : 'circle'}
          size={21}
          color={item.completed ? colors.success : colors.muted}
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
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
          onPress={onAddToCalendar}
          style={styles.action}
        >
          <Feather name="calendar" size={17} color={colors.sky} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Xóa ${item.title}`}
          onPress={onDelete}
          style={styles.action}
        >
          <Feather name="trash-2" size={17} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}
