import { FadeInView } from '../../components/FadeInView';
import Feather from '@expo/vector-icons/Feather';
import { styles } from './HomeScreen.styles';

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { UserAvatar } from '../../components/UserAvatar';
import { AppDrawer } from '../../components/AppDrawer';
import { Screen } from '../../components/Screen';
import type { MainTabParams } from '../../navigation/types';
import { colors, typography } from '../../theme';
import { useHomeScreen } from './useHomeScreen';
import { HomeCalendarSheet } from './HomeCalendarSheet';
import { HomeFinanceCard } from './HomeFinanceCard';
import { HomeTodayCard } from './HomeTodayCard';
import { HomePetRoamer } from './HomePetRoamer';
import { getCalendarNoteDateKey } from '../../utils/calendarNotes';
import { useAuthStore } from '../../store/authStore';
import { syncPixelPetInBackground } from '../../services/pixelPet/pixelPetApi';
import { readPrepChecklists } from '../../services/checklists/checklistStorage';
import type { PrepChecklist } from '../../types/prepChecklist';
import { useScreenActive } from '../../hooks/useScreenActive';
import { usePixelPetRefresh } from '../../hooks/usePixelPetRefresh';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 14) return 'Chào buổi trưa';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export function HomeScreen({
  navigation,
}: BottomTabScreenProps<MainTabParams, 'Home'>) {
  const model = useHomeScreen();
  const uid = useAuthStore((state) => state.user?.uid);
  const active = useScreenActive();
  usePixelPetRefresh(uid, active);
  const [checklists, setChecklists] = useState<PrepChecklist[]>([]);
  const [checklistsLoading, setChecklistsLoading] = useState(true);
  const [checklistsError, setChecklistsError] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarSheetTab, setCalendarSheetTab] = useState<
    'calendar' | 'tasks'
  >('calendar');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [financeDateResetKey, setFinanceDateResetKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshInFlight = useRef(false);
  const [focused, setFocused] = useState(true);
  useEffect(() => {
    const offFocus = navigation.addListener?.('focus', () => setFocused(true));
    const offBlur = navigation.addListener?.('blur', () => setFocused(false));
    return () => {
      offFocus?.();
      offBlur?.();
    };
  }, [navigation]);
  const checklistLoadGeneration = useRef(0);

  useEffect(() => {
    if (!uid) return;
    syncPixelPetInBackground(uid);
    return navigation.addListener('focus', () => syncPixelPetInBackground(uid));
  }, [navigation, uid]);

  const refreshChecklists = useCallback(async () => {
    const generation = ++checklistLoadGeneration.current;
    if (!uid) {
      setChecklists([]);
      setChecklistsLoading(false);
      setChecklistsError(null);
      return;
    }
    setChecklists([]);
    setChecklistsLoading(true);
    setChecklistsError(null);
    try {
      const saved = await readPrepChecklists(uid);
      if (
        generation === checklistLoadGeneration.current &&
        uid === useAuthStore.getState().user?.uid
      )
        setChecklists(saved);
    } catch (cause) {
      if (
        generation === checklistLoadGeneration.current &&
        uid === useAuthStore.getState().user?.uid
      )
        setChecklistsError(
          (cause as Error).message || 'Chưa đọc được danh sách chuẩn bị.',
        );
    } finally {
      if (
        generation === checklistLoadGeneration.current &&
        uid === useAuthStore.getState().user?.uid
      )
        setChecklistsLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void refreshChecklists();
    const unsubscribe = navigation.addListener?.('focus', () => {
      void refreshChecklists();
      setFinanceDateResetKey((key) => key + 1);
    });
    return () => {
      checklistLoadGeneration.current += 1;
      unsubscribe?.();
    };
  }, [navigation, refreshChecklists]);

  const checklistDateKeys = checklists.flatMap((checklist) =>
    checklist.scheduledDateKey ? [checklist.scheduledDateKey] : [],
  );
  async function refresh() {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      await Promise.all([model.refresh(), refreshChecklists()]);
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }
  return (
    <View style={styles.root}>
      <Screen
        backgroundColor={colors.background}
        safeAreaBackgroundColor={colors.sunlightFaint}
        fixedHeader={
          <View style={styles.header}>
            <View style={styles.greeting}>
              <View style={styles.headerGreetingRow}>
                <Text style={typography.small}>{greeting()},</Text>
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
              <UserAvatar size={32} />
              <View style={styles.menuBadge}>
                <Feather name="menu" size={10} color={colors.surface} />
              </View>
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
        <FadeInView>
          <HomeFinanceCard
            today={model.today}
            transactions={model.finance.transactions}
            loading={model.finance.loading}
            error={model.finance.error}
            dateResetKey={financeDateResetKey}
            onOpenFinance={() => navigation.navigate('Finance')}
          />
        </FadeInView>
        <FadeInView delay={70}>
          <HomeTodayCard
            date={model.today}
            checklists={checklists}
            checklistsLoading={checklistsLoading}
            notes={model.notes.notes}
            notesLoading={model.notes.loading}
            agendaItems={model.agenda.items}
            agendaLoading={model.agenda.loading}
            onOpenCalendar={() => {
              setCalendarSheetTab('calendar');
              setSelectedDate(model.today);
              setCalendarVisible(true);
            }}
            onOpenTasks={() => {
              setCalendarSheetTab('tasks');
              setSelectedDate(model.today);
              setCalendarVisible(true);
            }}
            onCompleteTask={
              model.agenda.uid
                ? (id) => model.agenda.complete(model.agenda.uid!, id, true)
                : undefined
            }
          />
        </FadeInView>
        <FadeInView delay={140} style={styles.shortcutSection}>
          <Text accessibilityRole="header" style={styles.sectionLabel}>
            Lối tắt
          </Text>
          <View style={styles.shortcuts}>
            {(
              [
                ['edit-3', 'Sổ tay', colors.skySoft, colors.sky, 'Notes'],
                [
                  'calendar',
                  'Lịch & việc',
                  colors.primarySoft,
                  colors.earth,
                  'Agenda',
                ],
                [
                  'check-square',
                  'Chuẩn bị',
                  colors.successSoft,
                  colors.success,
                  'Checklists',
                ],
                [
                  'award',
                  'Trò chơi',
                  colors.sunlightSoft,
                  colors.sunlight,
                  'CardScore',
                ],
                [
                  'feather',
                  'Linh thú',
                  colors.dangerSoft,
                  colors.danger,
                  'PixelPet',
                ],
              ] as const
            ).map(([icon, label, background, tint, route]) => (
              <Pressable
                key={route}
                accessibilityRole="button"
                accessibilityLabel={`Mở ${label}`}
                onPress={() => navigation.navigate(route)}
                style={({ pressed }) => [
                  styles.shortcut,
                  pressed && styles.shortcutPressed,
                ]}
              >
                <View
                  style={[styles.shortcutIcon, { backgroundColor: background }]}
                >
                  <Feather name={icon} size={17} color={tint} />
                </View>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  style={styles.shortcutLabel}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </FadeInView>
        {model.warning && (
          <Text accessibilityLiveRegion="polite" style={typography.small}>
            {model.warning} Kéo xuống để thử lại.
          </Text>
        )}
        {checklistsError && (
          <Text accessibilityRole="alert" style={typography.small}>
            {checklistsError}
          </Text>
        )}
        <AppDrawer
          visible={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          onOpenNotes={() => navigation.navigate('Notes')}
          onOpenCardScore={() => navigation.navigate('CardScore')}
          onOpenChecklists={() => navigation.navigate('Checklists')}
          onOpenAgenda={() => navigation.navigate('Agenda')}
          onOpenUserManagement={() => navigation.navigate('UserManagement')}
          onOpenPetManagement={() => navigation.navigate('PetManagement')}
          onOpenProfile={() => navigation.navigate('Profile')}
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
          checklistDateKeys={checklistDateKeys}
          checklists={checklists}
          checklistsLoading={checklistsLoading}
          noteUid={model.notes.uid}
          notes={model.notes.notes}
          notesSynced={model.notes.synced}
          onSaveNote={model.notes.save}
          onDeleteNote={model.notes.remove}
          onOpenAgenda={() => {
            setCalendarVisible(false);
            navigation.navigate('Agenda');
          }}
          onOpenChecklist={(checklistId) => {
            setCalendarVisible(false);
            navigation.navigate('Checklists', { checklistId });
          }}
        />
      </Screen>
      <HomePetRoamer
        uid={uid ?? null}
        active={focused && !calendarVisible}
        onPress={() => navigation.navigate('PixelPet')}
      />
    </View>
  );
}
