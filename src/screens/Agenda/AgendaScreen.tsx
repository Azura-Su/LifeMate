import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useCallback, useRef, useState } from 'react';
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

type AgendaAction = 'complete' | 'delete' | 'calendar';

export function AgendaScreen({
  navigation,
}: BottomTabScreenProps<MainTabParams, 'Agenda'>) {
  const model = useAgendaAccount();
  const { uid, refresh } = model;
  const [editing, setEditing] = useState<AgendaItem | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const [pendingActions, setPendingActions] = useState<
    Record<string, AgendaAction>
  >({});
  const actionPending = useRef(new Set<string>());
  const hasFocused = useRef(false);
  const focusedUid = useRef(uid);

  useFocusEffect(
    useCallback(() => {
      if (!hasFocused.current || focusedUid.current !== uid) {
        hasFocused.current = true;
        focusedUid.current = uid;
        return;
      }
      if (uid) void refresh();
    }, [refresh, uid]),
  );

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
              <Feather name="plus" size={22} color={colors.earth} />
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
        {model.loading && model.items.length > 0 && (
          <View style={styles.refreshing}>
            <ActivityIndicator size="small" color={colors.earth} />
            <Text style={styles.refreshingText}>Đang cập nhật danh sách…</Text>
          </View>
        )}
        {!!feedback && (
          <Text
            accessibilityRole={feedbackIsError ? 'alert' : undefined}
            accessibilityLiveRegion="polite"
            style={[styles.sync, feedbackIsError && styles.error]}
          >
            {feedback}
          </Text>
        )}
        {!model.synced && !model.loading && (
          <Text style={[styles.sync, styles.syncLocal]}>
            Có thay đổi chỉ lưu trên thiết bị. Đồng bộ lại khi mạng ổn định.
          </Text>
        )}
        {model.loading && model.items.length === 0 ? (
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
              onDelete={() => remove(item)}
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
      </Screen>
      <AgendaTaskFormDialog
        visible={formVisible}
        item={editing}
        existingItems={model.items}
        busy={saving}
        onClose={() => setFormVisible(false)}
        onSave={save}
      />
    </>
  );
}
