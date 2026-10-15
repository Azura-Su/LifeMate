import Feather from '@expo/vector-icons/Feather';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useAgendaAccount } from '../../hooks/useAgendaAccount';
import { addAgendaItemToCalendar } from '../../services/agenda/calendarService';
import { colors, typography } from '../../theme';
import type { AgendaItem } from '../../types/agenda';
import { formatAgendaDate, getAgendaForDate } from '../../utils/agenda';
import { isSameDay } from '../../utils/vietnameseCalendar';
import { AgendaTaskFormDialog } from '../Agenda/AgendaTaskFormDialog';
import { AgendaTaskRow } from '../Agenda/AgendaTaskRow';
import { styles } from './HomeAgendaCard.styles';

type AgendaAction = 'complete' | 'delete' | 'calendar';

export function HomeAgendaCard({
  date,
  onOpenAgenda,
}: {
  date: Date;
  onOpenAgenda: () => void;
}) {
  const model = useAgendaAccount();
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<AgendaItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const [pendingActions, setPendingActions] = useState<
    Record<string, AgendaAction>
  >({});
  const actionPending = useRef(new Set<string>());
  const todaysItems = getAgendaForDate(model.items, date);
  const isToday = isSameDay(date, new Date());

  async function runItemAction(
    item: AgendaItem,
    action: AgendaAction,
    operation: () => Promise<unknown>,
    fallback: string,
  ) {
    if (actionPending.current.has(item.id)) return;
    actionPending.current.add(item.id);
    setPendingActions((current) => ({ ...current, [item.id]: action }));
    setFeedback(null);
    setFeedbackIsError(false);
    try {
      await operation();
    } catch (cause) {
      setFeedback((cause as Error).message || fallback);
      setFeedbackIsError(true);
    } finally {
      actionPending.current.delete(item.id);
      setPendingActions((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    }
  }

  async function save(item: AgendaItem) {
    if (!model.uid) return;
    setFeedback(null);
    setFeedbackIsError(false);
    setSaving(true);
    try {
      const reminderStatus = await model.save(model.uid, {
        ...item,
        ownerId: model.uid,
      });
      if (reminderStatus === 'denied')
        setFeedback('Việc đã lưu. Bật thông báo để nhận lời nhắc.');
      else if (reminderStatus === 'past')
        setFeedback('Việc đã lưu nhưng giờ nhắc đã qua.');
    } finally {
      setSaving(false);
    }
  }

  function deleteItem(item: AgendaItem) {
    Alert.alert('Xóa công việc?', `“${item.title}” sẽ bị xóa.`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          if (!model.uid) return;
          void runItemAction(
            item,
            'delete',
            () => model.remove(model.uid!, item.id),
            'Chưa xóa được công việc. Hãy thử lại.',
          );
        },
      },
    ]);
  }

  return (
    <>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.icon}>
            <Feather name="check-square" size={19} color={colors.earth} />
          </View>
          <View style={styles.heading}>
            <Text style={styles.title}>
              {isToday ? 'Hôm nay' : 'Việc trong ngày'}
            </Text>
            <Text style={typography.small}>
              {isToday
                ? todaysItems.length
                  ? `${todaysItems.length} việc cần làm`
                  : 'Một ngày nhẹ nhàng'
                : formatAgendaDate(date)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xem tất cả công việc"
            onPress={onOpenAgenda}
            style={styles.smallAction}
          >
            <Feather name="arrow-up-right" size={20} color={colors.sky} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thêm việc hôm nay"
            onPress={() => {
              setEditing(null);
              setFormVisible(true);
            }}
            style={styles.add}
          >
            <Feather name="plus" size={21} color={colors.earth} />
          </Pressable>
        </View>
        {model.loading ? (
          <ActivityIndicator color={colors.earth} />
        ) : todaysItems.length === 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setEditing(null);
              setFormVisible(true);
            }}
            style={styles.empty}
          >
            <Text style={typography.small}>
              Chưa có việc nào cho hôm nay. Thêm việc cần nhớ.
            </Text>
          </Pressable>
        ) : (
          todaysItems.slice(0, 4).map((item) => (
            <AgendaTaskRow
              key={item.id}
              item={item}
              pendingAction={pendingActions[item.id]}
              onComplete={() =>
                model.uid &&
                void runItemAction(
                  item,
                  'complete',
                  () => model.complete(model.uid!, item.id, !item.completed),
                  'Chưa cập nhật được công việc. Hãy thử lại.',
                )
              }
              onEdit={() => {
                setEditing(item);
                setFormVisible(true);
              }}
              onDelete={() => deleteItem(item)}
              onAddToCalendar={() =>
                void runItemAction(
                  item,
                  'calendar',
                  () => addAgendaItemToCalendar(item),
                  'Chưa mở được lịch trên thiết bị này.',
                )
              }
            />
          ))
        )}
        {todaysItems.length > 4 && (
          <Pressable accessibilityRole="button" onPress={onOpenAgenda}>
            <Text style={styles.more}>
              Xem thêm {todaysItems.length - 4} việc
            </Text>
          </Pressable>
        )}
        {!!model.error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {model.error}
          </Text>
        )}
        {!model.synced && !model.loading && (
          <Text style={styles.error}>
            Chưa đồng bộ công việc. Kéo xuống để thử lại.
          </Text>
        )}
        {!!feedback && (
          <Text
            accessibilityRole={feedbackIsError ? 'alert' : undefined}
            accessibilityLiveRegion="polite"
            style={feedbackIsError ? styles.error : styles.sync}
          >
            {feedback}
          </Text>
        )}
      </View>
      <AgendaTaskFormDialog
        visible={formVisible}
        item={editing}
        existingItems={model.items}
        initialDate={date}
        busy={saving}
        onClose={() => {
          setFormVisible(false);
          setEditing(null);
        }}
        onSave={save}
      />
    </>
  );
}
