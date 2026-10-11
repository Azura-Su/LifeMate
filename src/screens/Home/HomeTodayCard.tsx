import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import {
  Image,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../../theme';
import type { AgendaItem } from '../../types/agenda';
import type { LifeNote } from '../../types/note';
import type { PrepChecklist } from '../../types/prepChecklist';
import { isCalendarNoteForDate } from '../../utils/calendarNotes';
import { formatAgendaTime, getTodaysAgenda } from '../../utils/agenda';
import {
  getVietnamCalendarEvents,
  toDateKey,
} from '../../utils/vietnameseCalendar';
import { styles } from './HomeScreen.styles';

type IconName = ComponentProps<typeof Feather>['name'];
type CloudShape = 'calendar' | 'tasks';
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
}: Props) {
  const [calendarSummaryHeight, setCalendarSummaryHeight] = useState(0);
  const [tasksSummaryHeight, setTasksSummaryHeight] = useState(0);
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
  const tasksTop =
    calendarEntries.length > 0
      ? Math.max(146, calendarSummaryHeight + 12)
      : 146;
  const tasksSummaryTop = tasksTop + 32;
  const todayTasks = getTodaysAgenda(agendaItems, date);
  const cardsMinHeight = Math.max(
    322,
    tasksTop + 176,
    tasksSummaryTop + tasksSummaryHeight,
  );

  return (
    <View
      testID="home-today-card"
      style={[styles.todayCards, { minHeight: cardsMinHeight }]}
    >
      <TodaySection
        cloudShape="calendar"
        icon="calendar"
        iconColor={colors.earth}
        iconBackground={colors.primarySoft}
        title="Lịch"
        count={calendarCount}
        countUnit="mục hôm nay"
        loading={notesLoading || checklistsLoading}
        onPress={onOpenCalendar}
        accessibilityLabel="Mở lịch hôm nay"
        cloudStyle={styles.todayCalendarCloud}
        headerOffsetX={-11}
        countOffsetX={-14}
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
          onLayout={({ nativeEvent }) =>
            setCalendarSummaryHeight((current) =>
              current === nativeEvent.layout.height
                ? current
                : nativeEvent.layout.height,
            )
          }
          onPress={onOpenCalendar}
          style={styles.todayCalendarSummary}
        >
          <View style={styles.todayCalendarSummaryHeader}>
            <Feather name="calendar" size={12} color={colors.earth} />
            <Text style={styles.todayCalendarSummaryTitle}>Hôm nay</Text>
          </View>
          {calendarGroups.map((group) => (
            <View key={group.kind} style={styles.todayCalendarSummaryGroup}>
              <Text
                style={[
                  styles.todayCalendarSummaryKind,
                  group.kind === 'holiday' && styles.todayHolidayKind,
                  group.kind === 'festival' && styles.todayFestivalKind,
                  group.kind === 'note' && styles.todayNoteKind,
                  group.kind === 'checklist' && styles.todayChecklistKind,
                ]}
              >
                {group.label}
              </Text>
              {group.entries.map((entry) => (
                <View key={entry.id} style={styles.todayCalendarSummaryEntry}>
                  <View style={styles.todayCalendarBullet} />
                  <View style={styles.todayCalendarSummaryCopy}>
                    <Text style={styles.todayCalendarEntryTitle}>
                      {entry.title}
                    </Text>
                    {!!entry.detail && (
                      <Text
                        numberOfLines={
                          entry.kind === 'note' && dayNotes.length >= 3 ? 1 : 2
                        }
                        ellipsizeMode="tail"
                        style={styles.todayCalendarEntryDetail}
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

      {todayTasks.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Việc cần làm hôm nay có ${todayTasks.length} việc: ${todayTasks
            .map(
              (task) =>
                `${task.title}, ${formatAgendaTime(new Date(task.dueAt))}${task.details.trim() ? `, ${task.details.trim()}` : ''}`,
            )
            .join('; ')}`}
          onLayout={({ nativeEvent }) =>
            setTasksSummaryHeight((current) =>
              current === nativeEvent.layout.height
                ? current
                : nativeEvent.layout.height,
            )
          }
          onPress={onOpenTasks}
          style={[styles.todayTasksSummary, { top: tasksSummaryTop }]}
        >
          <View style={styles.todayCalendarSummaryHeader}>
            <Feather name="check-square" size={12} color={colors.sky} />
            <Text style={styles.todayCalendarSummaryTitle}>Hôm nay</Text>
          </View>
          <View style={styles.todayCalendarSummaryGroup}>
            {todayTasks.map((task) => (
              <View key={task.id} style={styles.todayCalendarSummaryEntry}>
                <View
                  style={[styles.todayCalendarBullet, styles.todayAgendaBullet]}
                />
                <View style={styles.todayCalendarSummaryCopy}>
                  <Text style={styles.todayCalendarEntryTitle}>
                    {task.title}
                  </Text>
                  <Text
                    numberOfLines={2}
                    ellipsizeMode="tail"
                    style={styles.todayCalendarEntryDetail}
                  >
                    {[
                      formatAgendaTime(new Date(task.dueAt)),
                      task.details.trim(),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Pressable>
      )}

      <TodaySection
        cloudShape="tasks"
        icon="check-square"
        iconColor={colors.sky}
        iconBackground={colors.skySoft}
        title="Việc cần làm"
        count={todayTasks.length}
        countUnit="việc hôm nay"
        loading={agendaLoading}
        onPress={onOpenTasks}
        accessibilityLabel="Mở việc hôm nay"
        cloudStyle={[styles.todayTasksCloud, { marginTop: tasksTop }]}
        horizontalOffset={16}
        headerOffsetX={-13}
        countOffsetX={-15}
      />
    </View>
  );
}

function TodaySection({
  cloudShape,
  icon,
  iconColor,
  iconBackground,
  title,
  count,
  countUnit,
  loading,
  onPress,
  accessibilityLabel,
  cloudStyle,
  horizontalOffset = 0,
  headerOffsetX,
  countOffsetX,
}: {
  cloudShape: CloudShape;
  icon: IconName;
  iconColor: string;
  iconBackground: string;
  title: string;
  count: number;
  countUnit: string;
  loading: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  cloudStyle: StyleProp<ViewStyle>;
  horizontalOffset?: number;
  headerOffsetX: number;
  countOffsetX: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.todayCloud,
        cloudStyle,
        horizontalOffset !== 0 && {
          transform: [{ translateX: horizontalOffset }],
        },
        pressed && styles.todayCloudPressed,
        pressed &&
          horizontalOffset !== 0 && {
            transform: [{ translateX: horizontalOffset }, { scale: 0.98 }],
          },
      ]}
    >
      <View pointerEvents="none" style={styles.todayCloudArt}>
        <Image
          accessible={false}
          source={
            cloudShape === 'calendar'
              ? require('../../../assets/home-cloud-calendar.png')
              : require('../../../assets/home-cloud-tasks.png')
          }
          resizeMode="stretch"
          style={styles.todayCloudImage}
        />
      </View>
      <View style={styles.todayCloudContent}>
        <View
          style={[
            styles.todaySectionHeader,
            { transform: [{ translateX: headerOffsetX }] },
          ]}
        >
          <View
            style={[
              styles.todaySectionIcon,
              { backgroundColor: iconBackground },
            ]}
          >
            <Feather name={icon} size={15} color={iconColor} />
          </View>
          <Text accessibilityRole="header" style={styles.todaySectionTitle}>
            {title}
          </Text>
        </View>
        <View style={styles.todayCountRule}>
          <Text
            style={[
              styles.todayCount,
              { transform: [{ translateX: countOffsetX }] },
            ]}
          >
            {loading ? '…' : `${count} ${countUnit}`}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
