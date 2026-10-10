import { styles } from './HomeScreen.styles';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { useRef, useState } from 'react';
import { BrandAvatar } from '../../components/BrandAvatar';
import { AppDrawer } from '../../components/AppDrawer';
import { Screen } from '../../components/Screen';
import type { MainTabParams } from '../../navigation/types';
import { colors, typography } from '../../theme';
import { useHomeScreen } from './useHomeScreen';
import { HomeCalendarSheet } from './HomeCalendarSheet';
import { HomeTodayCard } from './HomeTodayCard';
import { getCalendarNoteDateKey } from '../../utils/calendarNotes';

export function HomeScreen({
  navigation,
}: BottomTabScreenProps<MainTabParams, 'Home'>) {
  const model = useHomeScreen();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarSheetTab, setCalendarSheetTab] = useState<
    'calendar' | 'tasks'
  >('calendar');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const refreshInFlight = useRef(false);
  async function refresh() {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      await model.refresh();
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }
  return (
    <Screen
      backgroundColor={colors.background}
      safeAreaBackgroundColor={colors.sunlightFaint}
      fixedHeader={
        <View style={styles.header}>
          <View style={styles.greeting}>
            <View style={styles.headerGreetingRow}>
              <Text style={typography.small}>Chào bạn,</Text>
              <Text
                accessibilityRole="header"
                numberOfLines={1}
                style={[typography.title, styles.headerName]}
              >
                {model.name}
              </Text>
            </View>
            <Text style={typography.small}>{model.date}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở menu"
            onPress={() => setDrawerVisible(true)}
            style={styles.menuButton}
          >
            <BrandAvatar size={32} />
          </Pressable>
        </View>
      }
      fixedHeaderStyle={styles.fixedHeader}
      contentStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          tintColor={colors.earth}
        />
      }
    >
      <HomeTodayCard
        date={new Date()}
        notes={model.notes.notes}
        notesLoading={model.notes.loading}
        agendaItems={model.agenda.items}
        agendaLoading={model.agenda.loading}
        onOpenCalendar={() => {
          setCalendarSheetTab('calendar');
          setSelectedDate(new Date());
          setCalendarVisible(true);
        }}
        onOpenTasks={() => {
          setCalendarSheetTab('tasks');
          setSelectedDate(new Date());
          setCalendarVisible(true);
        }}
      />
      {model.warning && (
        <Text accessibilityLiveRegion="polite" style={typography.small}>
          {model.warning} Kéo xuống để thử lại.
        </Text>
      )}
      <AppDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        onOpenNotes={() => navigation.navigate('Notes')}
        onOpenCardScore={() => navigation.navigate('CardScore')}
        privacy={model.privacy}
      />
      <HomeCalendarSheet
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        initialTab={calendarSheetTab}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        noteDateKeys={model.notes.notes.flatMap((note) => {
          const dateKey = getCalendarNoteDateKey(note.id);
          return dateKey ? [dateKey] : [];
        })}
        noteUid={model.notes.uid}
        notes={model.notes.notes}
        notesSynced={model.notes.synced}
        onSaveNote={model.notes.save}
        onDeleteNote={model.notes.remove}
        onOpenAgenda={() => {
          setCalendarVisible(false);
          navigation.navigate('Agenda');
        }}
      />
    </Screen>
  );
}
