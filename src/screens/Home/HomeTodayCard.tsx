import { animateNextLayout } from '../../utils/motion';
import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { colors } from '../../theme';
import type { AgendaItem } from '../../types/agenda';
import type { LifeNote } from '../../types/note';
import type { PrepChecklist } from '../../types/prepChecklist';
import { isCalendarNoteForDate } from '../../utils/calendarNotes';
import {
  formatAgendaDate,
  formatAgendaTime,
  getTodaysAgenda,
} from '../../utils/agenda';
import {
  getVietnamCalendarEvents,
  toDateKey,
} from '../../utils/vietnameseCalendar';
import { styles } from './HomeScreen.styles';

type IconName = ComponentProps<typeof Feather>['name'];
type CalendarEntry = {
  id: string;
  kind: 'holiday' | 'festival' | 'note' | 'checklist';
  label: string;
  title: string;
  detail?: string;
};
type CalendarEntryGroup = {
  kind: CalendarEntry['kind'];
  label: string;
  entries: CalendarEntry[];
};

type Props = {
  date: Date;
  checklists: PrepChecklist[];
  checklistsLoading: boolean;
  notes: LifeNote[];
  notesLoading: boolean;
  agendaItems: AgendaItem[];
  agendaLoading: boolean;
  onOpenCalendar: () => void;
  onOpenTasks: () => void;
  /** Marks a task done straight from Home. */
  onCompleteTask?: (id: string) => Promise<void>;
};

export function HomeTodayCard({
  date,
  checklists,
  checklistsLoading,
  notes,
  notesLoading,
  agendaItems,
  agendaLoading,
  onOpenCalendar,
  onOpenTasks,
  onCompleteTask,
}: Props) {
  const [completingIds, setCompletingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [taskError, setTaskError] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<ReadonlySet<string>>(() => new Set());
  const dateKey = toDateKey(date);
  const dayNotes = notes.filter((note) => isCalendarNoteForDate(note, dateKey));
  const calendarEvents = getVietnamCalendarEvents(date);
  const todayChecklists = checklists.filter(
    (checklist) => checklist.scheduledDateKey === dateKey,
  );
  const calendarEntries: CalendarEntry[] = [
    ...calendarEvents.map((event) => ({
      id: `event-${event.title}`,
      kind: event.kind,
      label: event.kind === 'holiday' ? 'Ngày lễ' : 'Lễ hội',
      title: event.title,
    })),
    ...dayNotes.map((note) => ({
      id: note.id,
      kind: 'note' as const,
      label: 'Ghi chú',
      title:
        note.title === `Ghi chú ngày ${dateKey}`
          ? 'Ghi chú trong ngày'
          : note.title.trim() || 'Ghi chú trong ngày',
      detail: note.body.trim() || undefined,
    })),
    ...todayChecklists.map((checklist) => {
      const checkedCount = checklist.items.filter(
        (item) => item.checked,
      ).length;
      const itemCount = checklist.items.length;
      return {
        id: checklist.id,
        kind: 'checklist' as const,
        label: 'Chuẩn bị',
        title: checklist.title,
        detail: itemCount
          ? `${checkedCount}/${itemCount} mục đã xong`
          : 'Chưa có mục',
      };
    }),
  ];
  const calendarCount = calendarEntries.length;
  const calendarGroups = calendarEntries.reduce<CalendarEntryGroup[]>(
    (groups, entry) => {
      const existingGroup = groups.find((group) => group.kind === entry.kind);
      if (existingGroup) {
        existingGroup.entries.push(entry);
      } else {
        groups.push({ kind: entry.kind, label: entry.label, entries: [entry] });
      }
      return groups;
    },
    [],
  );
  const todayTasks = getTodaysAgenda(agendaItems, date);
  const dayStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  const overdueTasks = agendaItems
    .filter((item) => !item.completed && item.dueAt < dayStart)
    .sort((a, b) => a.dueAt - b.dueAt);
  const taskRows = [
    ...overdueTasks.map((task) => ({ task, overdue: true })),
    ...todayTasks.map((task) => ({ task, overdue: false })),
  ].filter(({ task }) => !doneIds.has(task.id));
  const completeTask = async (id: string) => {
    if (!onCompleteTask || completingIds.has(id)) return;
    setTaskError(null);
    setCompletingIds((current) => new Set(current).add(id));
    // Hide only while saving; the persisted agenda owns completion afterward.
    animateNextLayout();
    setDoneIds((current) => new Set(current).add(id));
    try {
      await onCompleteTask(id);
    } catch {
      animateNextLayout();
      setTaskError('Chưa cập nhật được công việc. Hãy thử lại.');
    } finally {
      setDoneIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      setCompletingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <View testID="home-today-card" style={styles.todayCards}>
      <View style={styles.todayCard}>
        <TodaySectionHeader
          icon="calendar"
          iconColor={colors.earth}
          iconBackground={colors.primarySoft}
          title="Lịch"
          count={calendarCount}
          countUnit="mục hôm nay"
          loading={notesLoading || checklistsLoading}
          onPress={onOpenCalendar}
          accessibilityLabel="Mở lịch hôm nay"
        />
        {calendarEntries.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Lịch hôm nay có ${calendarEntries.length} mục: ${calendarGroups
              .map(
                (group) =>
                  `${group.label}: ${group.entries
                    .map(
                      (entry) =>
                        `${entry.title}${entry.detail ? `, ${entry.detail}` : ''}`,
                    )
                    .join('; ')}`,
              )
              .join('. ')}`}
            onPress={onOpenCalendar}
            style={({ pressed }) => [
              styles.todayList,
              pressed && styles.todayPressed,
            ]}
          >
            {calendarGroups.map((group) => (
              <View key={group.kind} style={styles.todayGroup}>
                <Text
                  style={[
                    styles.todayKind,
                    group.kind === 'holiday' && styles.todayHolidayKind,
                    group.kind === 'festival' && styles.todayFestivalKind,
                    group.kind === 'note' && styles.todayNoteKind,
                    group.kind === 'checklist' && styles.todayChecklistKind,
                  ]}
                >
                  {group.label}
                </Text>
                {group.entries.map((entry) => (
                  <View key={entry.id} style={styles.todayEntry}>
                    <View style={styles.todayBullet} />
                    <View style={styles.todayEntryCopy}>
                      <Text numberOfLines={1} style={styles.todayEntryTitle}>
                        {entry.title}
                      </Text>
                      {!!entry.detail && (
                        <Text
                          numberOfLines={
                            entry.kind === 'note' && dayNotes.length >= 3
                              ? 1
                              : 2
                          }
                          ellipsizeMode="tail"
                          style={styles.todayEntryDetail}
                        >
                          {entry.detail}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </Pressable>
        )}
      </View>

      <View style={styles.todayCard}>
        <TodaySectionHeader
          icon="check-square"
          iconColor={colors.sky}
          iconBackground={colors.skySoft}
          title="Việc cần làm"
          count={todayTasks.length}
          countUnit="việc hôm nay"
          loading={agendaLoading}
          onPress={onOpenTasks}
          accessibilityLabel="Mở việc hôm nay"
        />
        {overdueTasks.length > 0 && !agendaLoading && (
          <Text style={styles.todayOverdueBadge}>
            {overdueTasks.length} việc quá hạn
          </Text>
        )}
        {taskRows.length > 0 && (
          <View style={styles.todayList}>
            {taskRows.map(({ task, overdue }) => {
              const completing = completingIds.has(task.id);
              const due = new Date(task.dueAt);
              return (
                <View key={task.id} style={styles.todayTaskRow}>
                  {onCompleteTask && (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel={`Hoàn thành ${task.title}`}
                      accessibilityState={{
                        checked: false,
                        disabled: completing,
                        busy: completing,
                      }}
                      disabled={completing}
                      hitSlop={6}
                      onPress={() => void completeTask(task.id)}
                      style={styles.todayCheck}
                    >
                      {completing ? (
                        <ActivityIndicator size="small" color={colors.earth} />
                      ) : (
                        <Feather
                          name="circle"
                          size={20}
                          color={overdue ? colors.danger : colors.muted}
                        />
                      )}
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${overdue ? 'Quá hạn: ' : ''}${task.title}, ${overdue ? `${formatAgendaDate(due)} ` : ''}${formatAgendaTime(due)}${task.details.trim() ? `, ${task.details.trim()}` : ''}`}
                    onPress={onOpenTasks}
                    style={({ pressed }) => [
                      styles.todayEntry,
                      styles.todayTaskBody,
                      pressed && styles.todayPressedText,
                    ]}
                  >
                    <View style={styles.todayEntryCopy}>
                      <Text numberOfLines={1} style={styles.todayEntryTitle}>
                        {task.title}
                      </Text>
                      {!!task.details.trim() && (
                        <Text
                          numberOfLines={2}
                          ellipsizeMode="tail"
                          style={styles.todayEntryDetail}
                        >
                          {task.details.trim()}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.todayTime,
                        overdue && styles.todayOverdueTime,
                      ]}
                    >
                      {overdue
                        ? formatAgendaDate(due).slice(0, 5)
                        : formatAgendaTime(due)}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
            {!!taskError && (
              <Text accessibilityRole="alert" style={styles.todayError}>
                {taskError}
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function TodaySectionHeader({
  icon,
  iconColor,
  iconBackground,
  title,
  count,
  countUnit,
  loading,
  onPress,
  accessibilityLabel,
}: {
  icon: IconName;
  iconColor: string;
  iconBackground: string;
  title: string;
  count: number;
  countUnit: string;
  loading: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: loading }}
      accessibilityValue={{
        text: loading ? 'Đang tải dữ liệu' : `${count} ${countUnit}`,
      }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.todayHeader,
        pressed && styles.todayPressed,
      ]}
    >
      <View style={[styles.todayIcon, { backgroundColor: iconBackground }]}>
        <Feather name={icon} size={16} color={iconColor} />
      </View>
      <View style={styles.todayHeaderCopy}>
        <Text accessibilityRole="header" style={styles.todayTitle}>
          {title}
        </Text>
        {loading ? (
          <View style={styles.todayCountPlaceholder} />
        ) : (
          <Text style={styles.todayCount}>{`${count} ${countUnit}`}</Text>
        )}
      </View>
      <Feather name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  );
}
