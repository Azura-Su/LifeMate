import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { DialogCloseButton } from '../../components/DialogCloseButton';
import { FinanceAmountInput } from '../../components/FinanceAmountInput';
import { FinanceAmountWords } from '../../components/FinanceAmountWords';
import { ModalHeader } from '../../components/ModalHeader';
import { AppTextInput as TextInput } from '../../components/AppTextInput';
import type {
  FinanceTransaction,
  SharedExpenseReceipt,
} from '../../types/finance';
import { colors } from '../../theme';
import {
  formatFinanceAmount,
  formatFinanceDate,
  parseFinanceAmount,
  parseFinanceDate,
} from '../../utils/finance';
import {
  getSharedExpensePersonTotals,
  getSharedExpenseTotals,
} from '../../utils/sharedExpense';
import { FinanceDatePicker } from './FinanceDatePicker';
import { styles } from './SharedExpenseModal.styles';

type ReceiptDraft = {
  requestId: string;
  participantId: string;
  amount: string;
  date: string;
  note: string;
};

function makeReceiptId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

type Props = {
  visible: boolean;
  transaction: FinanceTransaction | null;
  onClose: () => void;
  onEditExpense: (transaction: FinanceTransaction) => void;
  onSaveReceipt: (
    expenseId: string,
    draft: ReceiptDraft,
    receiptId?: string,
  ) => Promise<void>;
  onRemoveReceipt: (expenseId: string, receiptId: string) => Promise<void>;
};

export function SharedExpenseModal({
  visible,
  transaction,
  onClose,
  onEditExpense,
  onSaveReceipt,
  onRemoveReceipt,
}: Props) {
  const [form, setForm] = useState<ReceiptDraft | null>(null);
  const [editingReceiptId, setEditingReceiptId] = useState<string>();
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const shared = transaction?.sharedExpense;
  const totals = shared ? getSharedExpenseTotals(shared) : null;
  const selectedPerson = shared?.participants.find(
    ({ id }) => id === form?.participantId,
  );
  const selectedReceipt = shared?.receipts.find(
    ({ id }) => id === editingReceiptId,
  );
  const available =
    shared && form
      ? getSharedExpensePersonTotals(shared, form.participantId).remaining +
        (selectedReceipt?.amount ?? 0)
      : 0;
  const enteredAmount = form ? parseFinanceAmount(form.amount) : null;
  const canSave =
    !!form &&
    enteredAmount !== null &&
    enteredAmount <= available &&
    parseFinanceDate(form.date) !== null &&
    !busy;

  useEffect(() => {
    if (!visible) {
      setForm(null);
      setEditingReceiptId(undefined);
      setDatePickerVisible(false);
      setError(null);
    }
  }, [visible]);

  if (!transaction || !shared || !totals) return null;

  function openForm(participantId: string, receipt?: SharedExpenseReceipt) {
    if (busy) return;
    const remaining = getSharedExpensePersonTotals(
      shared!,
      participantId,
    ).remaining;
    setForm({
      requestId: receipt?.id ?? makeReceiptId(),
      participantId,
      amount: String(receipt?.amount ?? remaining),
      date: receipt
        ? formatFinanceDate(new Date(receipt.receivedAt))
        : formatFinanceDate(),
      note: receipt?.note ?? '',
    });
    setEditingReceiptId(receipt?.id);
    setError(null);
  }

  function openDatePicker() {
    if (!form || busy) return;
    const current = parseFinanceDate(form.date);
    const value = current === null ? new Date() : new Date(current);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        display: 'calendar',
        onChange: (event, date) => {
          if (event.type === 'set' && date)
            setForm(
              (previous) =>
                previous && { ...previous, date: formatFinanceDate(date) },
            );
        },
      });
    } else setDatePickerVisible(true);
  }

  async function submit() {
    if (!form || !canSave || busy || savingRef.current) return;
    savingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await onSaveReceipt(transaction!.id, form, editingReceiptId);
      setForm(null);
      setEditingReceiptId(undefined);
    } catch (cause) {
      setError((cause as Error).message || 'Chưa lưu được lần nhận lại.');
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  }

  function confirmRemove(receipt: SharedExpenseReceipt) {
    if (busy) return;
    Alert.alert(
      'Xóa lần nhận lại?',
      'Chi tiêu của kỳ nhận tiền sẽ tăng lại tương ứng.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            void onRemoveReceipt(transaction!.id, receipt.id)
              .catch((cause) =>
                setError((cause as Error).message || 'Chưa xóa được.'),
              )
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  }

  return (
    <DialogModal
      visible={visible}
      onRequestClose={
        busy
          ? undefined
          : datePickerVisible
            ? () => setDatePickerVisible(false)
            : form
              ? () => setForm(null)
              : onClose
      }
      style={styles.dialog}
    >
      {datePickerVisible && form ? (
        <View style={styles.content}>
          <View style={styles.rowBetween}>
            <Text style={styles.title}>Chọn ngày nhận</Text>
            <DialogCloseButton
              accessibilityLabel="Đóng chọn ngày nhận"
              onPress={() => setDatePickerVisible(false)}
            />
          </View>
          <FinanceDatePicker
            value={new Date(parseFinanceDate(form.date) ?? Date.now())}
            onChange={(date) =>
              setForm(
                (previous) =>
                  previous && {
                    ...previous,
                    date: formatFinanceDate(date),
                  },
              )
            }
          />
          <Button
            title="Chọn ngày"
            onPress={() => setDatePickerVisible(false)}
          />
        </View>
      ) : form ? (
        <>
          <View style={styles.header}>
            <ModalHeader
              title={
                editingReceiptId ? 'Sửa lần nhận lại' : 'Nhận lại tiền chi'
              }
              accessibilityLabel="Đóng nhận lại tiền chi"
              onClose={() => setForm(null)}
              disabled={busy}
            />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <Text style={styles.helper}>
              {selectedPerson?.name} còn cần trả{' '}
              {formatFinanceAmount(available)}
            </Text>
            <View style={styles.amountDateRow}>
              <View style={styles.field}>
                <Text style={styles.label}>Số tiền nhận</Text>
                <FinanceAmountInput
                  accessibilityLabel="Số tiền nhận lại"
                  value={form.amount}
                  onChangeText={(amount) => setForm({ ...form, amount })}
                  editable={!busy}
                  compact
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Ngày nhận</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Chọn ngày nhận lại"
                  onPress={openDatePicker}
                  style={styles.dateButton}
                >
                  <Text style={styles.dateText}>{form.date}</Text>
                  <Feather name="calendar" size={15} color={colors.earth} />
                </Pressable>
              </View>
            </View>
            <FinanceAmountWords value={form.amount} />
            <Text style={styles.label}>Ghi chú · không bắt buộc</Text>
            <TextInput
              accessibilityLabel="Ghi chú lần nhận lại"
              value={form.note}
              onChangeText={(note) => setForm({ ...form, note })}
              maxLength={120}
              editable={!busy}
              placeholder="Ví dụ: Chuyển khoản"
              placeholderTextColor={colors.muted}
              style={styles.noteInput}
            />
            {enteredAmount !== null && enteredAmount > available && (
              <Text style={styles.error}>Số tiền vượt phần còn cần trả.</Text>
            )}
            {!!error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            <Button
              title={editingReceiptId ? 'Lưu thay đổi' : 'Lưu lần nhận lại'}
              onPress={() => void submit()}
              disabled={!canSave}
              loading={busy}
            />
          </ScrollView>
        </>
      ) : (
        <>
          <View style={styles.header}>
            <ModalHeader
              title="Khoản chi có người trả lại"
              accessibilityLabel="Đóng chi tiết khoản chi"
              onClose={onClose}
              disabled={busy}
            />
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.rowBetween}>
              <View style={styles.headingText}>
                <Text style={styles.title}>
                  {transaction.note || transaction.category}
                </Text>
                <Text style={styles.helper}>
                  {transaction.category} ·{' '}
                  {formatFinanceDate(new Date(transaction.createdAt))}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sửa khoản chi"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={() => onEditExpense(transaction)}
                style={styles.iconButton}
              >
                <Feather name="edit-2" size={16} color={colors.earth} />
              </Pressable>
            </View>
            <View style={styles.summary}>
              <View style={styles.rowBetween}>
                <Text style={styles.helper}>Đã thanh toán</Text>
                <Text style={styles.value}>
                  {formatFinanceAmount(transaction.amount)}
                </Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.helper}>Phần của tôi dự kiến</Text>
                <Text style={styles.value}>
                  {formatFinanceAmount(transaction.amount - totals.owed)}
                </Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.helper}>Đã nhận lại</Text>
                <Text style={styles.value}>
                  {formatFinanceAmount(totals.received)}
                </Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.label}>Còn chờ</Text>
                <Text style={styles.highlight}>
                  {formatFinanceAmount(totals.remaining)}
                </Text>
              </View>
            </View>
            {shared.participants.map((person) => {
              const personTotals = getSharedExpensePersonTotals(
                shared,
                person.id,
              );
              const receipts = shared.receipts
                .filter(({ participantId }) => participantId === person.id)
                .sort((a, b) => b.receivedAt - a.receivedAt);
              return (
                <View key={person.id} style={styles.personSection}>
                  <View style={styles.rowBetween}>
                    <View style={styles.headingText}>
                      <Text style={styles.personName}>{person.name}</Text>
                      <Text style={styles.helper}>
                        Cần trả {formatFinanceAmount(person.owedAmount)} · Còn{' '}
                        {formatFinanceAmount(personTotals.remaining)}
                      </Text>
                    </View>
                    {personTotals.remaining > 0 && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Nhận lại tiền từ ${person.name}`}
                        accessibilityState={{ disabled: busy }}
                        disabled={busy}
                        onPress={() => openForm(person.id)}
                        style={styles.iconButton}
                      >
                        <Feather name="plus" size={18} color={colors.earth} />
                      </Pressable>
                    )}
                  </View>
                  {receipts.length === 0 ? (
                    <Text style={styles.helper}>Chưa nhận lại lần nào.</Text>
                  ) : (
                    receipts.map((receipt) => (
                      <View key={receipt.id} style={styles.receiptRow}>
                        <View style={styles.headingText}>
                          <Text style={styles.value}>
                            +{formatFinanceAmount(receipt.amount)}
                          </Text>
                          <Text style={styles.helper}>
                            {formatFinanceDate(new Date(receipt.receivedAt))}
                            {receipt.note ? ` · ${receipt.note}` : ''}
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Sửa lần nhận từ ${person.name}`}
                          accessibilityState={{ disabled: busy }}
                          disabled={busy}
                          onPress={() => openForm(person.id, receipt)}
                          style={styles.iconButton}
                        >
                          <Feather
                            name="edit-2"
                            size={15}
                            color={colors.muted}
                          />
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Xóa lần nhận từ ${person.name}`}
                          accessibilityState={{ disabled: busy }}
                          disabled={busy}
                          onPress={() => confirmRemove(receipt)}
                          style={styles.iconButton}
                        >
                          <Feather
                            name="trash-2"
                            size={15}
                            color={colors.danger}
                          />
                        </Pressable>
                      </View>
                    ))
                  )}
                </View>
              );
            })}
            {!!error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            <Text style={styles.helper}>
              Tiền nhận lại giảm chi {transaction.category}, không cộng vào Thu
              nhập.
            </Text>
          </ScrollView>
        </>
      )}
    </DialogModal>
  );
}
