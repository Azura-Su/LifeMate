import { useAgendaStore } from '../../store/agendaStore';
import { animateNextLayout } from '../../utils/motion';
import { HeaderIconButton, ScreenHeader } from '../../components/ScreenHeader';
import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { useAgendaAccount } from '../../hooks/useAgendaAccount';
import type { MainTabParams } from '../../navigation/types';
import { addAgendaItemToCalendar } from '../../services/agenda/calendarService';
import { colors, typography } from '../../theme';
import type { AgendaItem } from '../../types/agenda';
import { AgendaTaskFormDialog } from './AgendaTaskFormDialog';
import { AgendaTaskRow } from './AgendaTaskRow';
import { groupAgendaItems } from '../../utils/agenda';
import { styles } from './AgendaScreen.styles';

type AgendaAction = 'complete' | 'delete' | 'calendar';

export function AgendaScreen({
  navigation,
}: BottomTabScreenProps<MainTabParams, 'Agenda'>) {
  const model = useAgendaAccount();
  // Animate rows moving between groups / disappearing whenever the list
  // itself changes (complete, delete, add), not on the first load.
  useEffect(
    () =>
      useAgendaStore.subscribe((state, previous) => {
        if (
          state.items !== previous.items &&
          previous.items.length > 0 &&
          state.uid === previous.uid
        )
          animateNextLayout();
      }),
    [],
  );
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

  async function save(item: AgendaItem, expected: AgendaItem | null) {
    if (!model.uid) return;
    setFeedback(null);
    setFeedbackIsError(false);
    setSaving(true);
    try {
      const reminderStatus = await model.save(
        model.uid,
        {
          ...item,
          ownerId: model.uid,
        },
        expected,
      );
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
          <ScreenHeader
            title="Lịch và việc"
            onBack={() => navigation.navigate('Home')}
            right={
              <HeaderIconButton
                icon="plus"
                label="Thêm việc cần làm"
                onPress={() => {
                  setEditing(null);
                  setFormVisible(true);
                }}
              />
            }
          />
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
          groupAgendaItems(model.items).map((group) => (
            <View key={group.key} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text
                  accessibilityRole="header"
                  style={[
                    styles.groupTitle,
                    group.key === 'overdue' && styles.groupTitleOverdue,
                  ]}
                >
                  {group.title}
                </Text>
                <Text style={styles.groupCount}>{group.items.length}</Text>
              </View>
              <View style={styles.groupCard}>
                {group.items.map((item, index) => (
                  <AgendaTaskRow
                    key={item.id}
                    divider={index > 0}
                    item={item}
                    pendingAction={pendingActions[item.id]}
                    onComplete={() =>
                      model.uid &&
                      void runItemAction(
                        item,
                        'complete',
                        () =>
                          model.complete(model.uid!, item.id, !item.completed),
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
                ))}
              </View>
            </View>
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
