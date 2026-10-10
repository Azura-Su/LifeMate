import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
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
import { getCalendarNoteDateKey } from '../../utils/calendarNotes';
import { getTodaysAgenda } from '../../utils/agenda';
import {
  getVietnamCalendarEvents,
  toDateKey,
} from '../../utils/vietnameseCalendar';
import { styles } from './HomeScreen.styles';

type IconName = ComponentProps<typeof Feather>['name'];
type CloudShape = 'calendar' | 'tasks';

type Props = {
  date: Date;
  notes: LifeNote[];
  notesLoading: boolean;
  agendaItems: AgendaItem[];
  agendaLoading: boolean;
  onOpenCalendar: () => void;
  onOpenTasks: () => void;
};

export function HomeTodayCard({
  date,
  notes,
  notesLoading,
  agendaItems,
  agendaLoading,
  onOpenCalendar,
  onOpenTasks,
}: Props) {
  const dateKey = toDateKey(date);
  const dayNotes = notes.filter(
    (note) => getCalendarNoteDateKey(note.id) === dateKey,
  );
  const calendarCount = getVietnamCalendarEvents(date).length + dayNotes.length;
  const todayTasks = getTodaysAgenda(agendaItems, date);

  return (
    <View style={styles.todayCards}>
      <TodaySection
        cloudShape="calendar"
        icon="calendar"
        iconColor={colors.earth}
        iconBackground={colors.primarySoft}
        title="Lịch"
        count={calendarCount}
        countUnit="mục hôm nay"
        loading={notesLoading}
        onPress={onOpenCalendar}
        accessibilityLabel="Mở lịch hôm nay"
        cloudStyle={styles.todayCalendarCloud}
        headerOffsetX={-11}
        countOffsetX={-14}
      />

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
        cloudStyle={styles.todayTasksCloud}
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
        pressed && styles.todayCloudPressed,
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
