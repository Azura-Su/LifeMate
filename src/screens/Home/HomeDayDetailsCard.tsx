import Feather from '@expo/vector-icons/Feather';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { AppTextInput as TextInput } from '../../components/AppTextInput';
import { colors, typography } from '../../theme';
import type { LifeNote } from '../../types/note';
import type { PrepChecklist } from '../../types/prepChecklist';
import {
  formatLunarDate,
  getVietnamCalendarEvents,
  solarToLunar,
  toDateKey,
} from '../../utils/vietnameseCalendar';
import {
  isCalendarNoteForDate,
  isLunarAnnualCalendarNote,
  makeCalendarNoteId,
} from '../../utils/calendarNotes';
import { styles } from './HomeDayDetailsCard.styles';

const legacyTitle = (dateKey: string) => `Ghi chú ngày ${dateKey}`;

function displayTitle(note: LifeNote, dateKey: string) {
  return note.title === legacyTitle(dateKey)
    ? `Ghi chú ngày ${dateKey.split('-').reverse().join('/')}`
    : note.title;
}

export function HomeDayDetailsCard({
  date,
  uid,
  notes,
  synced,
  onSave,
  onDelete,
  onSaved,
  checklists = [],
  checklistsLoading = false,
  onOpenChecklist = () => undefined,
}: {
  date: Date;
  uid: string | null;
  notes: LifeNote[];
  synced: boolean;
  onSave: (
    uid: string,
    note: LifeNote,
    expected: LifeNote | null,
  ) => Promise<void>;
  onDelete: (uid: string, noteId: string) => Promise<void>;
  onSaved?: () => void;
  checklists?: PrepChecklist[];
  checklistsLoading?: boolean;
  onOpenChecklist?: (checklistId: string) => void;
}) {
  const dateKey = toDateKey(date);
  const dayNotes = notes
    .filter((note) => isCalendarNoteForDate(note, dateKey))
    .sort((first, second) => second.updatedAt - first.updatedAt);
  const dayChecklists = checklists.filter(
    (checklist) => checklist.scheduledDateKey === dateKey,
  );
  const [popupVisible, setPopupVisible] = useState(false);
  const [activeNote, setActiveNote] = useState<LifeNote | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [savedTitle, setSavedTitle] = useState('');
  const [savedBody, setSavedBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingNoteIds, setDeletingNoteIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const deletingNotes = useRef(new Set<string>());
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{
    dateKey: string;
    message: string;
  } | null>(null);
  const hasChanges = title.trim() !== savedTitle || body !== savedBody;

  const lunar = solarToLunar(
    date.getDate(),
    date.getMonth() + 1,
    date.getFullYear(),
  );
  const events = useMemo(() => getVietnamCalendarEvents(date), [date]);
  const dateLabel = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  const lunarDateLabel = `Âm lịch ${formatLunarDate(lunar)} năm ${lunar.year}`;
  function openNote(note: LifeNote) {
    setActiveNote(note);
    const editableTitle = note.title === legacyTitle(dateKey) ? '' : note.title;
    setTitle(editableTitle);
    setSavedTitle(editableTitle);
    setBody(note.body);
    setSavedBody(note.body);
    setError(null);
    setPopupVisible(true);
  }

  function addNote() {
    setActiveNote(null);
    setTitle('');
    setBody('');
    setSavedTitle('');
    setSavedBody('');
    setError(null);
    setPopupVisible(true);
  }

  function closePopup() {
    if (saving) return;
    setPopupVisible(false);
    setActiveNote(null);
  }

  async function save() {
    if (!uid || saving) return;
    const normalizedTitle =
      title.trim() ||
      (activeNote?.title === legacyTitle(dateKey) ? activeNote.title : '');
    if (!normalizedTitle) {
      setError('Nhập tiêu đề ghi chú.');
      return;
    }
    setSaving(true);
    try {
      const savedNote: LifeNote = {
        id: activeNote?.id ?? makeCalendarNoteId(dateKey),
        ownerId: uid,
        title: normalizedTitle,
        body: body.trim(),
        updatedAt: Date.now(),
      };
      await onSave(uid, savedNote, activeNote);
      setError(null);
      setPopupVisible(false);
      setActiveNote(null);
      onSaved?.();
    } catch (cause) {
      setError((cause as Error).message || 'Chưa lưu được ghi chú.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(note: LifeNote) {
    if (!uid || deletingNotes.current.has(note.id)) return;
    Alert.alert('Xóa ghi chú?', `“${displayTitle(note, dateKey)}” sẽ bị xóa.`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          if (deletingNotes.current.has(note.id)) return;
          deletingNotes.current.add(note.id);
          setDeleteError(null);
          setDeletingNoteIds((current) => new Set(current).add(note.id));
          void onDelete(uid, note.id)
            .catch((cause) =>
              setDeleteError({
                dateKey,
                message: (cause as Error).message || 'Chưa xóa được ghi chú.',
              }),
            )
            .finally(() => {
              deletingNotes.current.delete(note.id);
              setDeletingNoteIds((current) => {
                const next = new Set(current);
                next.delete(note.id);
                return next;
              });
            });
        },
      },
    ]);
  }

  return (
    <>
      <View style={styles.card}>
        {events.length > 0 && (
          <View style={styles.eventList}>
            {events.map((event) => (
              <View
                key={event.title}
                style={[
                  styles.eventChip,
                  event.kind === 'holiday'
                    ? styles.holidayChip
                    : styles.festivalChip,
                ]}
              >
                <Feather
                  name={event.kind === 'holiday' ? 'flag' : 'sun'}
                  size={13}
                  color={
                    event.kind === 'holiday' ? colors.danger : colors.sunlight
                  }
                />
                <Text
                  style={[
                    styles.eventText,
                    event.kind === 'holiday'
                      ? styles.holidayText
                      : styles.festivalText,
                  ]}
                >
                  {event.title}
                </Text>
                <Text style={styles.eventType}>
                  {event.kind === 'holiday' ? 'Ngày lễ' : 'Lễ hội'}
                </Text>
              </View>
            ))}
          </View>
        )}
        {dayChecklists.length > 0 && (
          <View style={styles.checklistSection}>
            <View style={styles.checklistSectionHeading}>
              <Text style={styles.checklistSectionTitle}>
                Chuẩn bị · {dayChecklists.length}
              </Text>
              {checklistsLoading && (
                <Text style={styles.checklistLoading}>Đang cập nhật</Text>
              )}
            </View>
            {dayChecklists.map((checklist) => {
              const checkedCount = checklist.items.filter(
                (item) => item.checked,
              ).length;
              const itemCount = checklist.items.length;
              const percent = itemCount
                ? Math.round((checkedCount / itemCount) * 100)
                : 0;
              return (
                <Pressable
                  key={checklist.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Mở danh sách ${checklist.title}, ${checkedCount} trên ${itemCount} mục đã chuẩn bị`}
                  onPress={() => onOpenChecklist(checklist.id)}
                  style={styles.checklistPreview}
                >
                  <View style={styles.checklistPreviewHeader}>
                    <View style={styles.checklistPreviewCopy}>
                      <Text numberOfLines={1} style={styles.checklistTitle}>
                        {checklist.title}
                      </Text>
                      <Text style={styles.checklistProgressText}>
                        {itemCount === 0
                          ? 'Chưa có mục'
                          : `${checkedCount}/${itemCount} mục đã chuẩn bị`}
                      </Text>
                    </View>
                    <Feather
                      name="chevron-right"
                      size={18}
                      color={colors.muted}
                    />
                  </View>
                  <View
                    accessibilityRole="progressbar"
                    accessibilityLabel={`Tiến độ ${checklist.title}`}
                    accessibilityValue={{ min: 0, max: 100, now: percent }}
                    style={styles.checklistProgressTrack}
                  >
                    <View
                      style={[
                        styles.checklistProgressFill,
                        { width: `${percent}%` },
                      ]}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        <View style={styles.noteList}>
          <View style={styles.noteSectionHeading}>
            <View style={styles.noteSectionLabel}>
              <Text style={styles.noteSectionTitle}>Ghi chú</Text>
              {dayNotes.length > 0 && (
                <Text style={styles.noteSectionCount}>{dayNotes.length}</Text>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thêm ghi chú cho ngày này"
              onPress={addNote}
              style={styles.addNoteButton}
              hitSlop={4}
            >
              <Feather name="plus" size={22} color={colors.earth} />
            </Pressable>
          </View>
          {dayNotes.map((note) => (
            <View key={note.id} style={styles.notePreview}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Mở ghi chú: ${displayTitle(note, dateKey)}`}
                onPress={() => openNote(note)}
                style={styles.noteOpen}
              >
                <View style={styles.noteIcon}>
                  <Feather name="file-text" size={17} color={colors.sky} />
                </View>
                <Text numberOfLines={1} style={styles.notePreviewTitle}>
                  {displayTitle(note, dateKey)}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Xóa ghi chú: ${displayTitle(note, dateKey)}`}
                accessibilityState={{
                  disabled: deletingNoteIds.has(note.id),
                  busy: deletingNoteIds.has(note.id),
                }}
                disabled={deletingNoteIds.has(note.id)}
                onPress={() => confirmDelete(note)}
                style={styles.deleteNoteButton}
                hitSlop={4}
              >
                {deletingNoteIds.has(note.id) ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <Feather name="trash-2" size={17} color={colors.danger} />
                )}
              </Pressable>
            </View>
          ))}
        </View>
        {deleteError?.dateKey === dateKey && (
          <Text accessibilityRole="alert" style={styles.error}>
            {deleteError.message}
          </Text>
        )}
      </View>
      <DialogModal
        visible={popupVisible}
        onRequestClose={closePopup}
        style={styles.dialog}
      >
        <View style={styles.dialogHeader}>
          <TextInput
            accessibilityLabel="Tiêu đề ghi chú ngày"
            placeholder="Tiêu đề ghi chú"
            placeholderTextColor={colors.muted}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            style={styles.dialogTitleInput}
          />
          <View style={styles.dialogActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng ghi chú"
              disabled={saving}
              onPress={closePopup}
              style={styles.dialogIconButton}
            >
              <Feather name="x" size={20} color={colors.ink} />
            </Pressable>
          </View>
        </View>
        <View style={styles.dialogDate}>
          <Text style={typography.small}>{dateLabel}</Text>
          <Text style={typography.small}>{lunarDateLabel}</Text>
          {isLunarAnnualCalendarNote(title) && (
            <Text style={typography.small}>
              Lặp hằng năm theo ngày âm lịch của ghi chú.
            </Text>
          )}
        </View>
        <TextInput
          accessibilityLabel="Nội dung ghi chú trong ngày"
          placeholder="Ghi chú này chưa có nội dung."
          placeholderTextColor={colors.muted}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={4000}
          textAlignVertical="top"
          style={styles.editor}
        />
        {!synced && activeNote && (
          <Text style={styles.pending}>
            Ghi chú đang lưu trên thiết bị · sẽ đồng bộ khi có mạng
          </Text>
        )}
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        {hasChanges && (
          <Button
            title="Lưu lại"
            loading={saving}
            onPress={() => void save()}
          />
        )}
      </DialogModal>
    </>
  );
}
