import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AppTextInput } from '../../components/AppTextInput';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { colors } from '../../theme';
import type {
  HeldMoneyEntry,
  HeldMoneyEntryKind,
  HeldMoneyRecord,
} from '../../types/heldMoney';
import { formatFinanceDate } from '../../utils/finance';
import { heldStyles as styles } from './HeldMoneyLedger.styles';

export type HeldMoneyRecordDraft = {
  senderName: string;
  purpose: string;
  amount: string;
  date: string;
  note: string;
};

export type HeldMoneyEntryDraft = {
  kind: HeldMoneyEntryKind;
  amount: string;
  date: string;
  note: string;
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  maxLength,
  numeric = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  maxLength: number;
  numeric?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <AppTextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        maxLength={maxLength}
        keyboardType={numeric ? 'numbers-and-punctuation' : 'default'}
        multiline={multiline}
        style={[styles.input, multiline && styles.noteInput]}
      />
    </View>
  );
}

function FormHeading({
  title,
  onClose,
  disabled,
}: {
  title: string;
  onClose: () => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.dialogHeader}>
      <Text accessibilityRole="header" style={styles.dialogTitle}>
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Đóng"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onClose}
        style={styles.menuButton}
      >
        <Feather name="x" size={18} color={colors.earth} />
      </Pressable>
    </View>
  );
}

export function HeldMoneyRecordDialog({
  visible,
  initial,
  busy,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial: HeldMoneyRecord | null;
  busy: boolean;
  onClose: () => void;
  onSave: (draft: HeldMoneyRecordDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<HeldMoneyRecordDraft>({
    senderName: '',
    purpose: '',
    amount: '',
    date: formatFinanceDate(),
    note: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setDraft({
      senderName: initial?.senderName ?? '',
      purpose: initial?.purpose ?? '',
      amount: '',
      date: formatFinanceDate(),
      note: '',
    });
    setError(null);
  }, [initial, visible]);
  const disabled = busy || submitting;
  const change = (key: keyof HeldMoneyRecordDraft) => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  async function save() {
    if (disabled) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSave(draft);
      onClose();
    } catch (cause) {
      setError((cause as Error).message || 'Chưa lưu được khoản đóng hộ.');
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <DialogModal
      visible={visible}
      onRequestClose={disabled ? undefined : onClose}
      style={styles.dialog}
    >
      <FormHeading
        title={initial ? 'Sửa khoản đóng hộ' : 'Khoản đóng hộ mới'}
        onClose={onClose}
        disabled={disabled}
      />
      <ScrollView
        style={styles.dialogScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.form}>
          <Field
            label="Người đưa tiền"
            value={draft.senderName}
            onChangeText={change('senderName')}
            placeholder="Ví dụ: Anh A"
            maxLength={80}
          />
          <Field
            label="Nội dung đóng hộ"
            value={draft.purpose}
            onChangeText={change('purpose')}
            placeholder="Ví dụ: Điện nước tháng 10"
            maxLength={120}
          />
          {!initial && (
            <>
              <View style={styles.twoColumns}>
                <Field
                  label="Số tiền đã nhận"
                  value={draft.amount}
                  onChangeText={change('amount')}
                  placeholder="Ví dụ: 500000"
                  maxLength={16}
                  numeric
                />
                <Field
                  label="Ngày nhận"
                  value={draft.date}
                  onChangeText={change('date')}
                  placeholder="DD/MM/YYYY"
                  maxLength={10}
                  numeric
                />
              </View>
              <Field
                label="Nội dung lần nhận · không bắt buộc"
                value={draft.note}
                onChangeText={change('note')}
                placeholder="Ghi chú nếu cần"
                maxLength={500}
                multiline
              />
            </>
          )}
          <Text style={styles.helper}>
            Tiền giữ hộ được theo dõi riêng, không tính vào thu chi cá nhân.
          </Text>
        </View>
      </ScrollView>
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Button
        title={initial ? 'Lưu thông tin' : 'Tạo khoản đóng hộ'}
        loading={disabled}
        onPress={() => void save()}
      />
    </DialogModal>
  );
}

const kinds: { kind: HeldMoneyEntryKind; label: string }[] = [
  { kind: 'received', label: 'Gửi thêm' },
  { kind: 'paid', label: 'Đóng hộ' },
  { kind: 'returned', label: 'Trả lại' },
];

export function HeldMoneyEntryDialog({
  visible,
  initial,
  initialKind,
  remaining,
  busy,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial: HeldMoneyEntry | null;
  initialKind: HeldMoneyEntryKind;
  remaining: string;
  busy: boolean;
  onClose: () => void;
  onSave: (draft: HeldMoneyEntryDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<HeldMoneyEntryDraft>({
    kind: initialKind,
    amount: '',
    date: formatFinanceDate(),
    note: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setDraft({
      kind: initial?.kind ?? initialKind,
      amount: initial ? String(initial.amount) : '',
      date: initial
        ? formatFinanceDate(new Date(initial.occurredAt))
        : formatFinanceDate(),
      note: initial?.note ?? '',
    });
    setError(null);
  }, [initial, initialKind, visible]);
  const disabled = busy || submitting;
  const availableKinds = initial
    ? kinds
    : kinds.filter(({ kind }) =>
        initialKind === 'received'
          ? kind === 'received'
          : kind === 'paid' || kind === 'returned',
      );
  const actionLabel =
    draft.kind === 'received'
      ? 'gửi thêm'
      : draft.kind === 'paid'
        ? 'đóng hộ'
        : 'trả lại';
  const change = (key: 'amount' | 'date' | 'note') => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  async function save() {
    if (disabled) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSave(draft);
      onClose();
    } catch (cause) {
      setError((cause as Error).message || 'Chưa lưu được mục lịch sử.');
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <DialogModal
      visible={visible}
      onRequestClose={disabled ? undefined : onClose}
      style={styles.dialog}
    >
      <FormHeading
        title={initial ? 'Sửa mục lịch sử' : `Ghi nhận ${actionLabel}`}
        onClose={onClose}
        disabled={disabled}
      />
      <ScrollView
        style={styles.dialogScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.form}>
          {availableKinds.length > 1 && (
            <View style={styles.kindTabs} accessibilityRole="tablist">
              {availableKinds.map(({ kind, label }) => (
                <Pressable
                  key={kind}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: draft.kind === kind }}
                  onPress={() => setDraft((current) => ({ ...current, kind }))}
                  style={[
                    styles.kindButton,
                    draft.kind === kind && styles.kindSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.kindText,
                      draft.kind === kind && styles.kindTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          <View style={styles.twoColumns}>
            <Field
              label="Số tiền"
              value={draft.amount}
              onChangeText={change('amount')}
              placeholder="Ví dụ: 300000"
              maxLength={16}
              numeric
            />
            <Field
              label="Ngày"
              value={draft.date}
              onChangeText={change('date')}
              placeholder="DD/MM/YYYY"
              maxLength={10}
              numeric
            />
          </View>
          <Field
            label="Nội dung · không bắt buộc"
            value={draft.note}
            onChangeText={change('note')}
            placeholder="Ví dụ: Hóa đơn điện"
            maxLength={500}
            multiline
          />
          <Text style={styles.helper}>
            Hiện còn giữ: {remaining}. Tổng đã đóng và trả lại không thể vượt
            tổng đã nhận.
          </Text>
        </View>
      </ScrollView>
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Button
        title={initial ? 'Lưu thay đổi' : `Lưu lần ${actionLabel}`}
        loading={disabled}
        onPress={() => void save()}
      />
    </DialogModal>
  );
}
