import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useAgendaAccount } from '../../hooks/useAgendaAccount';
import { addAgendaItemToCalendar } from '../../services/agenda/calendarService';
import { colors, typography } from '../../theme';
import type { AgendaItem } from '../../types/agenda';
import { getTodaysAgenda } from '../../utils/agenda';
import { AgendaTaskFormDialog } from '../Agenda/AgendaTaskFormDialog';
import { AgendaTaskRow } from '../Agenda/AgendaTaskRow';
import { styles } from './HomeAgendaCard.styles';

export function HomeAgendaCard({ onOpenAgenda }: { onOpenAgenda: () => void }) {
  const model = useAgendaAccount();
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<AgendaItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const todaysItems = getTodaysAgenda(model.items);

  async function save(item: AgendaItem) {
    if (!model.uid) return;
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
        onPress: () =>
          model.uid &&
          void model
            .remove(model.uid, item.id)
            .catch((cause) => setFeedback((cause as Error).message)),
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
            <Text style={styles.title}>Hôm nay</Text>
            <Text style={typography.small}>
              {todaysItems.length
                ? `${todaysItems.length} việc cần làm`
                : 'Một ngày nhẹ nhàng'}
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
            <Feather name="plus" size={19} color={colors.earth} />
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
              onComplete={() =>
                model.uid &&
                void model
                  .complete(model.uid, item.id, true)
                  .catch((cause) => setFeedback((cause as Error).message))
              }
              onEdit={() => {
                setEditing(item);
                setFormVisible(true);
              }}
              onDelete={() => deleteItem(item)}
              onAddToCalendar={() =>
                addAgendaItemToCalendar(item).catch(() =>
                  setFeedback('Chưa mở được lịch trên thiết bị này.'),
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
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {feedback}
          </Text>
        )}
      </View>
      <AgendaTaskFormDialog
        visible={formVisible}
        item={editing}
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
