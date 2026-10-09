import Feather from '@expo/vector-icons/Feather';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { useAgendaAccount } from '../../hooks/useAgendaAccount';
import type { MainTabParams } from '../../navigation/types';
import { addAgendaItemToCalendar } from '../../services/agenda/calendarService';
import { colors, typography } from '../../theme';
import type { AgendaItem } from '../../types/agenda';
import { AgendaTaskFormDialog } from './AgendaTaskFormDialog';
import { AgendaTaskRow } from './AgendaTaskRow';
import { styles } from './AgendaScreen.styles';

export function AgendaScreen({
  navigation,
}: BottomTabScreenProps<MainTabParams, 'Agenda'>) {
  const model = useAgendaAccount();
  const [editing, setEditing] = useState<AgendaItem | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function save(item: AgendaItem) {
    if (!model.uid) return;
    setSaving(true);
    try {
      const reminderStatus = await model.save(model.uid, {
        ...item,
        ownerId: model.uid,
      });
      if (reminderStatus === 'denied')
        setFeedback(
          'Công việc đã lưu. Cho phép thông báo trong cài đặt để nhận lời nhắc.',
        );
      else if (reminderStatus === 'past')
        setFeedback(
          'Công việc đã lưu. Thời điểm nhắc đã qua nên không đặt được thông báo.',
        );
    } finally {
      setSaving(false);
    }
  }

  function remove(item: AgendaItem) {
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

  async function addToCalendar(item: AgendaItem) {
    try {
      await addAgendaItemToCalendar(item);
    } catch {
      setFeedback('Chưa mở được lịch trên thiết bị này.');
    }
  }

  return (
    <>
      <Screen
        fixedHeaderStyle={styles.fixedHeader}
        fixedHeader={
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay về Home"
              onPress={() => navigation.navigate('Home')}
              style={styles.back}
            >
              <Feather name="arrow-left" size={21} color={colors.earth} />
            </Pressable>
            <Text
              accessibilityRole="header"
              style={[typography.title, styles.headerTitle]}
            >
              Lịch và việc
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thêm việc cần làm"
              onPress={() => {
                setEditing(null);
                setFormVisible(true);
              }}
              style={styles.add}
            >
              <Feather name="plus" size={21} color={colors.earth} />
            </Pressable>
          </View>
        }
        contentStyle={styles.content}
      >
        {!!model.error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {model.error}
          </Text>
        )}
        {!!feedback && (
          <Text accessibilityLiveRegion="polite" style={styles.sync}>
            {feedback}
          </Text>
        )}
        {!model.synced && !model.loading && (
          <Text style={[styles.sync, styles.syncLocal]}>
            Có thay đổi chỉ lưu trên thiết bị. Đồng bộ lại khi mạng ổn định.
          </Text>
        )}
        {model.loading ? (
          <ActivityIndicator color={colors.earth} />
        ) : model.items.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="calendar" size={28} color={colors.sky} />
            <Text style={styles.emptyTitle}>Chưa có việc nào</Text>
            <Text style={typography.small}>
              Thêm việc cần làm hoặc ngày đóng tiền.
            </Text>
          </View>
        ) : (
          model.items.map((item) => (
            <AgendaTaskRow
              key={item.id}
              item={item}
              onComplete={() =>
                model.uid &&
                void model
                  .complete(model.uid, item.id, !item.completed)
                  .catch((cause) => setFeedback((cause as Error).message))
              }
              onEdit={() => {
                setEditing(item);
                setFormVisible(true);
              }}
              onDelete={() => remove(item)}
              onAddToCalendar={() => void addToCalendar(item)}
            />
          ))
        )}
      </Screen>
      <AgendaTaskFormDialog
        visible={formVisible}
        item={editing}
        busy={saving}
        onClose={() => setFormVisible(false)}
        onSave={save}
      />
    </>
  );
}
