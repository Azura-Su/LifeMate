import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { useInteractionGuard } from '../../hooks/useInteractionGuard';
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
  onDismiss?: () => void;
  onEditExpense: (transaction: FinanceTransaction) => void;
  onSaveReceipt: (
    expected: FinanceTransaction,
    draft: ReceiptDraft,
    receiptId?: string,
  ) => Promise<void>;
  onRemoveReceipt: (
    expected: FinanceTransaction,
    receiptId: string,
  ) => Promise<void>;
};

export function SharedExpenseModal({
  visible,
  transaction,
  onClose,
  onDismiss,
  onEditExpense,
  onSaveReceipt,
  onRemoveReceipt,
}: Props) {
  const canInteract = useInteractionGuard(
    visible,
    transaction ? `${transaction.ownerId}:${transaction.id}` : null,
  );
  const [form, setForm] = useState<ReceiptDraft | null>(null);
  const [expected, setExpected] = useState<FinanceTransaction | null>(null);
  const [editingReceiptId, setEditingReceiptId] = useState<string>();
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transitioningToEdit, setTransitioningToEdit] = useState(false);
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
      setExpected(null);
      setEditingReceiptId(undefined);
      setDatePickerVisible(false);
      setError(null);
    }
  }, [visible]);

  if (!transaction || !shared || !totals) return null;

  function openForm(participantId: string, receipt?: SharedExpenseReceipt) {
    if (busy) return;
    setExpected(transaction);
    setForm({
      requestId: receipt?.id ?? makeReceiptId(),
      participantId,
      amount: receipt ? String(receipt.amount) : '',
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
          if (!canInteract()) return;
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
    if (!form || !expected || !canSave || busy || savingRef.current) return;
    savingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await onSaveReceipt(expected, form, editingReceiptId);
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
    if (!canInteract() || busy || savingRef.current) return;
    const expected = transaction!;
    Alert.alert(
      'Xóa lần nhận lại?',
      'Chi tiêu của kỳ nhận tiền sẽ tăng lại tương ứng.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            if (!canInteract() || savingRef.current) return;
            savingRef.current = true;
            setBusy(true);
            void onRemoveReceipt(expected, receipt.id)
              .catch((cause) =>
                setError((cause as Error).message || 'Chưa xóa được.'),
              )
              .finally(() => {
                savingRef.current = false;
                setBusy(false);
              });
          },
        },
      ],
    );
  }

  function startEditingExpense() {
    if (busy || transitioningToEdit) return;
    if (Platform.OS === 'ios') setTransitioningToEdit(true);
    onEditExpense(transaction!);
  }

  return (
    <DialogModal
      visible={visible}
      onDismiss={() => {
        setTransitioningToEdit(false);
        onDismiss?.();
      }}
      onRequestClose={
        busy || transitioningToEdit
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
                <View style={styles.amountFieldHeading}>
                  <Text style={styles.label}>Số tiền nhận</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Nhập tối đa ${formatFinanceAmount(available)}`}
                    accessibilityState={{ disabled: busy || available <= 0 }}
                    disabled={busy || available <= 0}
                    hitSlop={7}
                    onPress={() => {
                      setForm((previous) =>
                        previous
                          ? { ...previous, amount: String(available) }
                          : previous,
                      );
                      setError(null);
                    }}
                    style={styles.maxButton}
                  >
                    <Text style={styles.maxButtonText}>MAX</Text>
                  </Pressable>
                </View>
                <FinanceAmountInput
                  accessibilityLabel="Số tiền nhận lại"
                  value={form.amount}
                  onChangeText={(amount) => setForm({ ...form, amount })}
                  placeholder="Nhập tiền"
                  editable={!busy}
                  compact
                />
              </View>
              <View style={styles.field}>
                <View style={styles.amountFieldHeading}>
                  <Text style={styles.label}>Ngày nhận</Text>
                </View>
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
              title="Chi chung"
              accessibilityLabel="Đóng chi tiết khoản chi"
              onClose={onClose}
              disabled={busy || transitioningToEdit}
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
                accessibilityState={{ disabled: busy || transitioningToEdit }}
                disabled={busy || transitioningToEdit}
                hitSlop={4}
                onPress={startEditingExpense}
                style={styles.iconButton}
              >
                <Feather name="edit-2" size={18} color={colors.earth} />
              </Pressable>
            </View>
            <View style={styles.summary}>
              <Text style={styles.summaryLabel}>Còn chờ nhận</Text>
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={styles.summaryAmount}
              >
                {formatFinanceAmount(totals.remaining)}
              </Text>
              <View style={styles.summaryDetails}>
                <View style={styles.rowBetween}>
                  <Text style={styles.helper}>Đã chi</Text>
                  <Text
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={styles.value}
                  >
                    {formatFinanceAmount(transaction.amount)}
                  </Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.helper}>Đã nhận lại</Text>
                  <Text
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={styles.value}
                  >
                    {formatFinanceAmount(totals.received)}
                  </Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.helper}>Phần của tôi</Text>
                  <Text
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={styles.value}
                  >
                    {formatFinanceAmount(transaction.amount - totals.owed)}
                  </Text>
                </View>
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
              const receivedPercent =
                person.owedAmount > 0
                  ? Math.min(
                      100,
                      (personTotals.received / person.owedAmount) * 100,
                    )
                  : 0;
              return (
                <View key={person.id} style={styles.personSection}>
                  <View style={styles.personTop}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.personName}>{person.name}</Text>
                      {personTotals.remaining > 0 && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Nhận lại tiền từ ${person.name}`}
                          accessibilityState={{ disabled: busy }}
                          disabled={busy}
                          hitSlop={4}
                          onPress={() => openForm(person.id)}
                          style={styles.addReceiptButton}
                        >
                          <Feather name="plus" size={22} color={colors.earth} />
                        </Pressable>
                      )}
                    </View>
                    <View style={styles.personBalanceRow}>
                      <Text style={styles.personBalanceLabel}>
                        {personTotals.remaining > 0
                          ? 'Còn cần trả'
                          : 'Tình trạng'}
                      </Text>
                      <Text
                        adjustsFontSizeToFit
                        numberOfLines={1}
                        style={[
                          styles.personBalanceAmount,
                          personTotals.remaining <= 0 && styles.personPaid,
                        ]}
                      >
                        {personTotals.remaining > 0
                          ? formatFinanceAmount(personTotals.remaining)
                          : 'Đã trả đủ'}
                      </Text>
                    </View>
                    {personTotals.received > 0 && (
                      <>
                        <View
                          accessibilityRole="progressbar"
                          accessibilityLabel={`Đã nhận từ ${person.name}`}
                          accessibilityValue={{
                            min: 0,
                            max: person.owedAmount,
                            now: personTotals.received,
                          }}
                          style={styles.personProgressTrack}
                        >
                          <View
                            style={[
                              styles.personProgressFill,
                              { width: `${receivedPercent}%` },
                            ]}
                          />
                        </View>
                        <Text style={styles.personProgressText}>
                          Đã nhận {formatFinanceAmount(personTotals.received)} /{' '}
                          {formatFinanceAmount(person.owedAmount)}
                        </Text>
                      </>
                    )}
                  </View>
                  <View style={styles.personHistory}>
                    <Text style={styles.historyTitle}>Lịch sử nhận lại</Text>
                    {receipts.length === 0 ? (
                      <Text style={styles.emptyHistory}>
                        Chưa có lần nhận lại
                      </Text>
                    ) : (
                      receipts.map((receipt) => (
                        <View key={receipt.id} style={styles.receiptRow}>
                          <View style={styles.receiptIcon}>
                            <Feather
                              name="arrow-down-left"
                              size={15}
                              color={colors.success}
                            />
                          </View>
                          <View style={styles.receiptMain}>
                            <Text style={styles.receiptAmount}>
                              +{formatFinanceAmount(receipt.amount)}
                            </Text>
                            <Text style={styles.receiptDate}>
                              {formatFinanceDate(new Date(receipt.receivedAt))}
                              {receipt.note ? ` · ${receipt.note}` : ''}
                            </Text>
                          </View>
                          <View style={styles.receiptActions}>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Sửa lần nhận từ ${person.name}`}
                              accessibilityState={{ disabled: busy }}
                              disabled={busy}
                              hitSlop={4}
                              onPress={() => openForm(person.id, receipt)}
                              style={styles.receiptAction}
                            >
                              <Feather
                                name="edit-2"
                                size={16}
                                color={colors.earth}
                              />
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Xóa lần nhận từ ${person.name}`}
                              accessibilityState={{ disabled: busy }}
                              disabled={busy}
                              hitSlop={4}
                              onPress={() => confirmRemove(receipt)}
                              style={styles.receiptAction}
                            >
                              <Feather
                                name="trash-2"
                                size={16}
                                color={colors.danger}
                              />
                            </Pressable>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              );
            })}
            {!!error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
          </ScrollView>
          {transitioningToEdit && (
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Đang mở màn sửa giao dịch"
              style={styles.transitionOverlay}
            >
              <ActivityIndicator color={colors.earth} />
              <Text style={styles.transitionText}>Đang mở màn sửa…</Text>
            </View>
          )}
        </>
      )}
    </DialogModal>
  );
}
