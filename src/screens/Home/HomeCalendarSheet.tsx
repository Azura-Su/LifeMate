import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LifeNote } from '../../types/note';
import type { PrepChecklist } from '../../types/prepChecklist';
import { formatLunarDate, solarToLunar } from '../../utils/vietnameseCalendar';
import { colors, typography } from '../../theme';
import { HomeAgendaCard } from './HomeAgendaCard';
import { HomeCalendar } from './HomeCalendar';
import { HomeDayDetailsCard } from './HomeDayDetailsCard';
import { styles } from './HomeCalendarSheet.styles';

type SheetTab = 'calendar' | 'tasks';

type Props = {
  visible: boolean;
  onClose: () => void;
  initialTab: SheetTab;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  noteDateKeys: string[];
  checklistDateKeys?: string[];
  checklists?: PrepChecklist[];
  checklistsLoading?: boolean;
  noteUid: string | null;
  notes: LifeNote[];
  notesSynced: boolean;
  onSaveNote: (uid: string, note: LifeNote) => Promise<void>;
  onDeleteNote: (uid: string, noteId: string) => Promise<void>;
  onOpenAgenda: () => void;
  onOpenChecklist?: (checklistId: string) => void;
};

export function HomeCalendarSheet({
  visible,
  onClose,
  initialTab,
  selectedDate,
  onSelectDate,
  noteDateKeys,
  checklistDateKeys = [],
  checklists = [],
  checklistsLoading = false,
  noteUid,
  notes,
  notesSynced,
  onSaveNote,
  onDeleteNote,
  onOpenAgenda,
  onOpenChecklist = () => undefined,
}: Props) {
  const insets = useSafeAreaInsets();
  const [savedToastVisible, setSavedToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showCalendar = initialTab === 'calendar';
  const lunar = solarToLunar(
    selectedDate.getDate(),
    selectedDate.getMonth() + 1,
    selectedDate.getFullYear(),
  );
  const dateLabel = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(selectedDate);

  useEffect(() => {
    if (!visible) setSavedToastVisible(false);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [visible]);

  function showSavedToast() {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setSavedToastVisible(true);
    toastTimer.current = setTimeout(() => {
      setSavedToastVisible(false);
      toastTimer.current = null;
    }, 2400);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng bảng lịch và việc"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          testID="home-calendar-sheet"
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View style={styles.headingCopy}>
              <Text accessibilityRole="header" style={styles.title}>
                {showCalendar ? 'Lịch' : 'Việc cần làm'}
              </Text>
              <Text
                numberOfLines={1}
                style={showCalendar ? styles.calendarDate : typography.small}
              >
                {dateLabel} · Âm lịch {formatLunarDate(lunar)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng lịch và việc"
              hitSlop={8}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Feather name="x" size={21} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView
            key={initialTab}
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {showCalendar ? (
              <>
                <HomeCalendar
                  selectedDate={selectedDate}
                  noteDateKeys={noteDateKeys}
                  notes={notes}
                  checklistDateKeys={checklistDateKeys}
                  onSelect={onSelectDate}
                />
                <HomeDayDetailsCard
                  key={`day-details-${noteUid ?? 'signed-out'}`}
                  date={selectedDate}
                  uid={noteUid}
                  notes={notes}
                  synced={notesSynced}
                  onSave={onSaveNote}
                  onDelete={onDeleteNote}
                  onSaved={showSavedToast}
                  checklists={checklists}
                  checklistsLoading={checklistsLoading}
                  onOpenChecklist={onOpenChecklist}
                />
              </>
            ) : (
              <HomeAgendaCard date={selectedDate} onOpenAgenda={onOpenAgenda} />
            )}
          </ScrollView>
          {savedToastVisible && (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              pointerEvents="none"
              style={styles.savedToast}
            >
              <Feather name="check-circle" size={18} color={colors.success} />
              <Text style={styles.savedToastText}>
                Đã lưu ghi chú thành công
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
