import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { colors, typography } from '../../theme';
import type { AgendaItem } from '../../types/agenda';
import {
  formatAgendaDate,
  formatAgendaTime,
  parseAgendaDateTime,
} from '../../utils/agenda';
import { styles } from './AgendaScreen.styles';

type Props = {
  visible: boolean;
  item?: AgendaItem | null;
  busy?: boolean;
  onClose: () => void;
  onSave: (item: AgendaItem) => Promise<void>;
};
const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function AgendaTaskFormDialog({
  visible,
  item,
  busy = false,
  onClose,
  onSave,
}: Props) {
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [remind, setRemind] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!visible) return;
    const due = item
      ? new Date(item.dueAt)
      : new Date(Date.now() + 60 * 60 * 1000);
    setTitle(item?.title ?? '');
    setDetails(item?.details ?? '');
    setDateText(formatAgendaDate(due));
    setTimeText(formatAgendaTime(due));
    setRemind(item?.reminderAt !== null && item?.reminderAt !== undefined);
    setError(null);
  }, [item, visible]);

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
    try {
      await onSave({
        id: item?.id ?? newId(),
        ownerId: item?.ownerId ?? '',
        title: title.trim(),
        details: details.trim(),
        dueAt,
        completed: item?.completed ?? false,
        reminderAt: remind ? dueAt - 10 * 60_000 : null,
        updatedAt: Date.now(),
      });
      onClose();
    } catch (cause) {
      setError((cause as Error).message || 'Chưa lưu được công việc.');
    }
  }

  return (
    <DialogModal
      visible={visible}
      onRequestClose={busy ? undefined : onClose}
      style={styles.dialog}
    >
      <Text accessibilityRole="header" style={styles.dialogTitle}>
        {item ? 'Sửa việc cần làm' : 'Việc mới'}
      </Text>
      <TextInput
        accessibilityLabel="Tên công việc"
        placeholder="Bạn cần làm gì?"
        placeholderTextColor={colors.muted}
        value={title}
        onChangeText={setTitle}
        maxLength={120}
        style={styles.input}
      />
      <TextInput
        accessibilityLabel="Chi tiết công việc"
        placeholder="Ghi chú thêm (không bắt buộc)"
        placeholderTextColor={colors.muted}
        value={details}
        onChangeText={setDetails}
        maxLength={2000}
        multiline
        textAlignVertical="top"
        style={[styles.input, styles.details]}
      />
      <Text style={styles.fieldLabel}>Ngày và giờ</Text>
      <View style={styles.dateRow}>
        <TextInput
          accessibilityLabel="Ngày công việc"
          placeholder="DD/MM/YYYY"
          placeholderTextColor={colors.muted}
          value={dateText}
          onChangeText={setDateText}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          style={[styles.input, styles.dateInput]}
        />
        <TextInput
          accessibilityLabel="Giờ công việc"
          placeholder="HH:MM"
          placeholderTextColor={colors.muted}
          value={timeText}
          onChangeText={setTimeText}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          style={[styles.input, styles.timeInput]}
        />
      </View>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Nhắc trước 10 phút"
        accessibilityState={{ checked: remind }}
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
      <Button
        title="Hủy"
        variant="secondary"
        disabled={busy}
        onPress={onClose}
      />
    </DialogModal>
  );
}
