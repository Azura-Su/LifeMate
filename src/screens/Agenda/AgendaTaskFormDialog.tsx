import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { Button } from '../../components/Button';
import { DialogCloseButton } from '../../components/DialogCloseButton';
import { DialogModal } from '../../components/DialogModal';
import { AppTextInput as TextInput } from '../../components/AppTextInput';
import { colors, typography } from '../../theme';
import type { AgendaItem } from '../../types/agenda';
import {
  formatAgendaDate,
  formatAgendaTime,
  parseAgendaDateTime,
} from '../../utils/agenda';
import { isSameDay } from '../../utils/vietnameseCalendar';
import { styles } from './AgendaScreen.styles';

type Props = {
  visible: boolean;
  item?: AgendaItem | null;
  existingItems?: AgendaItem[];
  initialDate?: Date;
  busy?: boolean;
  onClose: () => void;
  onSave: (item: AgendaItem, expected: AgendaItem | null) => Promise<void>;
};
const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function isSameLocalDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function isSameLocalMinute(firstAt: number, secondAt: number) {
  const first = new Date(firstAt);
  const second = new Date(secondAt);
  return (
    isSameLocalDay(first, second) &&
    first.getHours() === second.getHours() &&
    first.getMinutes() === second.getMinutes()
  );
}

function suggestAvailableDueAt(preferredAt: number, items: AgendaItem[]) {
  const preferred = new Date(preferredAt);
  const usedMinutes = new Set(
    items
      .map((item) => new Date(item.dueAt))
      .filter((due) => isSameLocalDay(due, preferred))
      .map((due) => due.getHours() * 60 + due.getMinutes()),
  );
  const preferredMinute = preferred.getHours() * 60 + preferred.getMinutes();
  const candidates = [
    ...Array.from(
      { length: 24 },
      (_, offset) => (preferredMinute + offset * 60) % 1440,
    ),
    ...Array.from(
      { length: 1439 },
      (_, offset) => (preferredMinute + offset + 1) % 1440,
    ),
  ];
  const availableMinute = candidates.find((minute) => !usedMinutes.has(minute));
  if (availableMinute === undefined) return preferred;

  const suggested = new Date(preferred);
  suggested.setHours(
    Math.floor(availableMinute / 60),
    availableMinute % 60,
    0,
    0,
  );
  return suggested;
}

export function AgendaTaskFormDialog({
  visible,
  item,
  existingItems = [],
  initialDate,
  busy = false,
  onClose,
  onSave,
}: Props) {
  const existingItemsRef = useRef(existingItems);
  existingItemsRef.current = existingItems;
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [remind, setRemind] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!visible) {
      setPickerMode(null);
      return;
    }
    let due = item
      ? new Date(item.dueAt)
      : new Date(Date.now() + 60 * 60 * 1000);
    if (!item && initialDate) {
      due = new Date(initialDate);
      const now = new Date();
      if (isSameDay(due, now) && now.getHours() >= 23)
        due.setHours(23, 59, 0, 0);
      else if (isSameDay(due, now) && now.getHours() >= 9)
        due.setHours(now.getHours() + 1, 0, 0, 0);
      else due.setHours(9, 0, 0, 0);
    }
    if (!item)
      due = suggestAvailableDueAt(due.getTime(), existingItemsRef.current);
    setTitle(item?.title ?? '');
    setDetails(item?.details ?? '');
    setDateText(formatAgendaDate(due));
    setTimeText(formatAgendaTime(due));
    setRemind(item?.reminderAt !== null && item?.reminderAt !== undefined);
    setError(null);
  }, [initialDate, item, visible]);

  const pickerTimestamp = parseAgendaDateTime(dateText, timeText);
  const pickerValue =
    pickerTimestamp === null ? new Date() : new Date(pickerTimestamp);

  function applyPickerValue(mode: 'date' | 'time', selectedDate: Date) {
    setError(null);
    if (mode === 'date') setDateText(formatAgendaDate(selectedDate));
    else setTimeText(formatAgendaTime(selectedDate));
  }

  function openPicker(mode: 'date' | 'time') {
    if (busy) return;
    Keyboard.dismiss();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: pickerValue,
        mode,
        display: mode === 'date' ? 'calendar' : 'clock',
        is24Hour: true,
        onChange: (event, selectedDate) => {
          if (event.type === 'set' && selectedDate)
            applyPickerValue(mode, selectedDate);
        },
      });
      return;
    }
    setPickerMode(mode);
  }

  async function submit() {
    if (busy) return;
    const dueAt = parseAgendaDateTime(dateText, timeText);
    if (!title.trim()) {
      setError('Nhập tên việc cần làm.');
      return;
    }
    if (dueAt === null) {
      setError('Nhập ngày DD/MM/YYYY và giờ HH:MM hợp lệ.');
      return;
    }
    const conflictingItem = existingItemsRef.current.find(
      (existing) =>
        existing.id !== item?.id && isSameLocalMinute(existing.dueAt, dueAt),
    );
    if (conflictingItem) {
      setError(
        `Giờ này trùng với việc “${conflictingItem.title}”. Hãy chọn giờ khác.`,
      );
      return;
    }
    try {
      await onSave(
        {
          id: item?.id ?? newId(),
          ownerId: item?.ownerId ?? '',
          title: title.trim(),
          details: details.trim(),
          dueAt,
          completed: item?.completed ?? false,
          reminderAt: remind ? dueAt - 10 * 60_000 : null,
          updatedAt: Date.now(),
        },
        item ?? null,
      );
      onClose();
    } catch (cause) {
      setError((cause as Error).message || 'Chưa lưu được công việc.');
    }
  }

  return (
    <DialogModal
      visible={visible}
      onRequestClose={
        busy
          ? undefined
          : Platform.OS === 'ios' && pickerMode
            ? () => setPickerMode(null)
            : onClose
      }
      style={
        Platform.OS === 'ios' && pickerMode
          ? styles.pickerDialog
          : styles.dialog
      }
    >
      {Platform.OS === 'ios' && pickerMode ? (
        <>
          <View style={styles.dialogHeader}>
            <Text style={[styles.dialogTitle, styles.flex]}>
              {pickerMode === 'date' ? 'Chọn ngày' : 'Chọn giờ'}
            </Text>
            <DialogCloseButton
              accessibilityLabel="Đóng bộ chọn"
              onPress={() => setPickerMode(null)}
            />
          </View>
          <DateTimePicker
            value={pickerValue}
            mode={pickerMode}
            display={pickerMode === 'date' ? 'inline' : 'spinner'}
            style={
              pickerMode === 'date' ? styles.datePicker : styles.timePicker
            }
            themeVariant="light"
            textColor={colors.ink}
            accentColor={colors.earth}
            onChange={(event, selectedDate) => {
              if (event.type === 'set' && selectedDate)
                applyPickerValue(pickerMode, selectedDate);
            }}
          />
        </>
      ) : (
        <ScrollView
          style={styles.dialogScroll}
          contentContainerStyle={styles.dialogContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.dialogHeader}>
            <Text
              accessibilityRole="header"
              style={[styles.dialogTitle, styles.flex]}
            >
              {item ? 'Sửa việc cần làm' : 'Việc mới'}
            </Text>
            {!busy && (
              <DialogCloseButton
                accessibilityLabel="Đóng việc cần làm"
                onPress={onClose}
              />
            )}
          </View>
          <TextInput
            accessibilityLabel="Tên công việc"
            placeholder="Bạn cần làm gì?"
            placeholderTextColor={colors.muted}
            value={title}
            onChangeText={setTitle}
            editable={!busy}
            maxLength={120}
            style={styles.input}
          />
          <TextInput
            accessibilityLabel="Chi tiết công việc"
            placeholder="Ghi chú thêm (không bắt buộc)"
            placeholderTextColor={colors.muted}
            value={details}
            onChangeText={setDetails}
            editable={!busy}
            maxLength={2000}
            multiline
            textAlignVertical="top"
            style={[styles.input, styles.details]}
          />
          <Text style={styles.fieldLabel}>Ngày và giờ</Text>
          <View style={styles.dateRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Chọn ngày công việc, ${dateText}`}
              accessibilityHint="Mở lịch để chọn ngày"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => openPicker('date')}
              style={[styles.dateTimeField, styles.dateInput]}
            >
              <Text style={styles.dateTimeValue}>{dateText}</Text>
              <Feather name="calendar" size={16} color={colors.muted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Chọn giờ công việc, ${timeText}`}
              accessibilityHint="Mở đồng hồ để chọn giờ"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => openPicker('time')}
              style={[styles.dateTimeField, styles.timeInput]}
            >
              <Text style={styles.dateTimeValue}>{timeText}</Text>
              <Feather name="clock" size={16} color={colors.muted} />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Nhắc trước 10 phút"
            accessibilityState={{ checked: remind, disabled: busy }}
            disabled={busy}
            onPress={() => setRemind((value) => !value)}
            style={styles.reminderToggle}
          >
            <Feather
              name={remind ? 'check-square' : 'square'}
              size={19}
              color={remind ? colors.earth : colors.muted}
            />
            <View style={styles.flex}>
              <Text style={styles.fieldLabel}>Nhắc trước 10 phút</Text>
              <Text style={typography.small}>
                Thông báo chỉ có trên thiết bị này.
              </Text>
            </View>
          </Pressable>
          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          <Button
            title={item ? 'Lưu thay đổi' : 'Lưu công việc'}
            loading={busy}
            onPress={() => void submit()}
          />
        </ScrollView>
      )}
    </DialogModal>
  );
}
