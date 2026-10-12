import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTextInput } from '../../components/AppTextInput';
import { Button } from '../../components/Button';
import { colors } from '../../theme';
import type { LoanRecord, LoanRepayment } from '../../types/loan';
import {
  getLoanOutstandingAmount,
  getLoanPendingAmount,
  getLoanRepaidAmount,
  getLoanStatus,
} from '../../types/loan';
import {
  formatFinanceAmount,
  formatFinanceDate,
  parseFinanceAmount,
} from '../../utils/finance';
import { loanStyles as styles } from './LoanLedgerModal.styles';

type Props = {
  visible: boolean;
  uid: string | null;
  loans: LoanRecord[];
  loading: boolean;
  financeLoading: boolean;
  syncStatus: 'synced' | 'local' | null;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onSave: (
    loan: LoanRecord,
    requestReminderPermission?: boolean,
  ) => Promise<void>;
  onDeleteLoan: (loanId: string) => Promise<void>;
  onCorrectPrincipal: (loanId: string, amount: number) => Promise<void>;
  onRecordRepayment: (loanId: string, amount: number) => Promise<void>;
};

type LoanTab = 'open' | 'settled' | 'cancelled';
type LoanAction = 'repay' | 'delete' | 'note' | 'amount';

const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export function LoanLedgerModal({
  visible,
  uid,
  loans,
  loading,
  financeLoading,
  syncStatus,
  error,
  onClose,
  onRefresh,
  onSave,
  onDeleteLoan,
  onCorrectPrincipal,
  onRecordRepayment,
}: Props) {
  const insets = useSafeAreaInsets();
  const [formVisible, setFormVisible] = useState(false);
  const [repayTarget, setRepayTarget] = useState<LoanRecord | null>(null);
  const [noteTarget, setNoteTarget] = useState<LoanRecord | null>(null);
  const [principalTarget, setPrincipalTarget] = useState<LoanRecord | null>(
    null,
  );
  const [selectedLoanTab, setSelectedLoanTab] = useState<LoanTab>('open');
  const [busyAction, setBusyAction] = useState<{
    loanId: string;
    action: LoanAction;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) return;
    setFormVisible(false);
    setRepayTarget(null);
    setNoteTarget(null);
    setPrincipalTarget(null);
  }, [visible]);
  const unfinishedLoans = useMemo(
    () =>
      [...loans]
        .filter((loan) => getLoanStatus(loan) === 'open')
        .sort((a, b) => {
          const aDue = a.dueAt ?? Number.MAX_SAFE_INTEGER;
          const bDue = b.dueAt ?? Number.MAX_SAFE_INTEGER;
          return aDue - bDue || b.lentAt - a.lentAt;
        }),
    [loans],
  );
  const completedLoans = useMemo(
    () =>
      loans
        .filter((loan) => getLoanStatus(loan) === 'settled')
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [loans],
  );
  const cancelledLoans = useMemo(
    () =>
      loans
        .filter((loan) => getLoanStatus(loan) === 'cancelled')
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [loans],
  );
  const loansByTab: Record<LoanTab, LoanRecord[]> = {
    open: unfinishedLoans,
    settled: completedLoans,
    cancelled: cancelledLoans,
  };
  const loanTabOptions: { value: LoanTab; label: string }[] = [
    { value: 'open', label: 'Chưa hoàn thành' },
    { value: 'settled', label: 'Đã hoàn thành' },
    { value: 'cancelled', label: 'Đã hủy' },
  ];
  const visibleLoans = loansByTab[selectedLoanTab];
  const receivable = unfinishedLoans.reduce(
    (total, loan) => total + getLoanOutstandingAmount(loan),
    0,
  );

  function isActionBusy(loanId: string, action: LoanAction) {
    return busyAction?.loanId === loanId && busyAction.action === action;
  }

  async function record(loanId: string, amount: number) {
    setBusyAction({ loanId, action: 'repay' });
    setActionError(null);
    try {
      await onRecordRepayment(loanId, amount);
      setRepayTarget(null);
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : 'Chưa ghi được khoản nhận lại. Hãy thử lại.',
      );
      setRepayTarget(null);
    } finally {
      setBusyAction(null);
    }
  }

  async function updateNote(loan: LoanRecord, note: string) {
    setBusyAction({ loanId: loan.id, action: 'note' });
    try {
      await onSave({
        ...loan,
        note: note.trim(),
        updatedAt: Math.max(Date.now(), loan.updatedAt + 1),
      });
      setNoteTarget(null);
    } finally {
      setBusyAction(null);
    }
  }

  async function updatePrincipal(loan: LoanRecord, amount: number) {
    setBusyAction({ loanId: loan.id, action: 'amount' });
    try {
      await onCorrectPrincipal(loan.id, amount);
      setPrincipalTarget(null);
    } finally {
      setBusyAction(null);
    }
  }

  function confirmDelete(loan: LoanRecord) {
    Alert.alert(
      'Xóa khoản cho mượn?',
      loan.repayments.length === 0
        ? `Xóa khoản của ${loan.borrowerName} và khoản chi cho mượn liên kết trong Tài chính?`
        : `Hồ sơ của ${loan.borrowerName} sẽ bị xóa khỏi sổ. Các giao dịch chi và thu đã ghi trong Tài chính vẫn được giữ lại.`,
      [
        { text: 'Để sau', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            setBusyAction({ loanId: loan.id, action: 'delete' });
            setActionError(null);
            void onDeleteLoan(loan.id)
              .catch((cause) =>
                setActionError(
                  cause instanceof Error
                    ? cause.message
                    : 'Chưa xóa được khoản này.',
                ),
              )
              .finally(() => setBusyAction(null));
          },
        },
      ],
    );
  }

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onClose}
      >
        <View
          style={[
            styles.page,
            { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.headerTitle}>
              Sổ cho mượn
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng sổ cho mượn"
              hitSlop={8}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Feather name="x" size={22} color={colors.earth} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.summary}>
              <Text style={styles.summaryLabel}>Tổng còn phải thu</Text>
              <Text style={styles.summaryValue}>
                {formatFinanceAmount(receivable)}
              </Text>
              <Text style={styles.summaryHint}>
                Tiền gốc còn lại của {unfinishedLoans.length} khoản đang mở
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tạo khoản cho mượn"
              onPress={() => {
                setActionError(null);
                setFormVisible(true);
              }}
              style={({ pressed }) => [
                styles.addLoan,
                pressed && styles.addLoanPressed,
              ]}
            >
              <Feather name="plus" size={18} color={colors.earth} />
              <Text style={styles.addLoanText}>Thêm khoản cho mượn</Text>
            </Pressable>
            <View style={styles.sync}>
              <Feather
                name={syncStatus === 'local' ? 'cloud-off' : 'cloud'}
                size={15}
                color={
                  syncStatus === 'local' ? colors.sunlight : colors.success
                }
              />
              <Text
                style={[
                  styles.syncText,
                  syncStatus === 'local' && styles.syncLocal,
                ]}
              >
                {syncStatus === 'local'
                  ? 'Đang lưu trên thiết bị · chưa đồng bộ'
                  : 'Lưu riêng theo tài khoản'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đồng bộ sổ cho mượn"
                disabled={loading}
                onPress={onRefresh}
                hitSlop={8}
              >
                {loading ? (
                  <Text style={styles.syncText}>Đang tải…</Text>
                ) : (
                  <Feather name="refresh-cw" size={17} color={colors.earth} />
                )}
              </Pressable>
            </View>
            {(error || actionError) && (
              <Text accessibilityRole="alert" style={styles.error}>
                {actionError ?? error}
              </Text>
            )}
            <View style={styles.loanTabs} accessibilityRole="tablist">
              {loanTabOptions.map((tab) => {
                const selected = selectedLoanTab === tab.value;
                return (
                  <Pressable
                    key={tab.value}
                    accessibilityRole="tab"
                    accessibilityLabel={`${tab.label}, ${loansByTab[tab.value].length} khoản`}
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedLoanTab(tab.value)}
                    style={[styles.loanTab, selected && styles.loanTabSelected]}
                  >
                    <Text
                      numberOfLines={2}
                      style={[
                        styles.loanTabLabel,
                        selected && styles.loanTabLabelSelected,
                      ]}
                    >
                      {tab.label}
                    </Text>
                    <Text
                      style={[
                        styles.loanTabCount,
                        selected && styles.loanTabLabelSelected,
                      ]}
                    >
                      {loansByTab[tab.value].length}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {loading && loans.length === 0 ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.earth} />
                <Text style={styles.meta}>Đang tải sổ cho mượn…</Text>
              </View>
            ) : visibleLoans.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="book-open" size={24} color={colors.sky} />
                <Text style={styles.emptyTitle}>Chưa có khoản nào</Text>
                <Text style={styles.emptyText}>
                  {selectedLoanTab === 'open'
                    ? 'Thêm khoản cho mượn để theo dõi số tiền cần nhận lại.'
                    : selectedLoanTab === 'settled'
                      ? 'Khoản đã nhận đủ tiền sẽ xuất hiện ở đây.'
                      : 'Khoản đã hủy sẽ được lưu lại ở đây.'}
                </Text>
              </View>
            ) : (
              visibleLoans.map((loan) => {
                const status = getLoanStatus(loan);
                const repaid = getLoanRepaidAmount(loan);
                const outstanding = getLoanOutstandingAmount(loan);
                const pending = loan.repayments.find(
                  (item) => item.status === 'pending',
                );
                const primaryAmount =
                  status === 'open'
                    ? outstanding
                    : status === 'settled'
                      ? repaid
                      : loan.principalAmount;
                const primaryAmountLabel =
                  status === 'open'
                    ? 'Còn phải thu'
                    : status === 'settled'
                      ? 'Đã nhận lại'
                      : 'Số tiền đã cho mượn';
                return (
                  <View key={loan.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <Feather name="user" size={17} color={colors.earth} />
                      <Text numberOfLines={1} style={styles.borrower}>
                        {loan.borrowerName}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Xóa khoản cho mượn của ${loan.borrowerName}`}
                        disabled={busyAction !== null}
                        hitSlop={8}
                        onPress={() => confirmDelete(loan)}
                        style={styles.deleteAction}
                      >
                        {isActionBusy(loan.id, 'delete') ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.danger}
                          />
                        ) : (
                          <Feather
                            name="trash-2"
                            size={16}
                            color={colors.danger}
                          />
                        )}
                      </Pressable>
                    </View>
                    <View
                      style={[
                        styles.loanSummary,
                        status === 'settled' && styles.loanSummarySettled,
                      ]}
                    >
                      <View style={styles.loanBalance}>
                        <Text
                          style={[
                            styles.loanBalanceLabel,
                            status === 'settled' &&
                              styles.loanBalanceLabelSettled,
                          ]}
                        >
                          {primaryAmountLabel}
                        </Text>
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.75}
                          style={[
                            styles.loanBalanceAmount,
                            status === 'settled' &&
                              styles.loanBalanceAmountSettled,
                          ]}
                        >
                          {formatFinanceAmount(primaryAmount)}
                        </Text>
                      </View>
                      {loan.dueAt !== null && (
                        <View style={styles.loanDueDateBlock}>
                          <View style={styles.loanDueDateHeading}>
                            <Feather
                              name="calendar"
                              size={13}
                              color={colors.earth}
                            />
                            <Text style={styles.loanDueDateLabel}>Hẹn trả</Text>
                          </View>
                          <Text
                            numberOfLines={1}
                            style={styles.loanDueDateValue}
                          >
                            {formatFinanceDate(new Date(loan.dueAt))}
                          </Text>
                        </View>
                      )}
                    </View>
                    {status !== 'cancelled' && (
                      <View style={styles.loanRepaymentDetails}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Sửa số tiền đã cho ${loan.borrowerName} mượn`}
                          disabled={busyAction !== null}
                          onPress={() => setPrincipalTarget(loan)}
                          style={styles.loanRepaidRow}
                        >
                          <Text style={styles.amountLabel}>Đã cho mượn</Text>
                          <View style={styles.loanPrincipalEdit}>
                            <Text style={styles.loanSecondaryAmount}>
                              {formatFinanceAmount(loan.principalAmount)}
                            </Text>
                            {isActionBusy(loan.id, 'amount') ? (
                              <ActivityIndicator
                                size="small"
                                color={colors.earth}
                              />
                            ) : (
                              <Feather
                                name="edit-2"
                                size={13}
                                color={colors.earth}
                              />
                            )}
                          </View>
                        </Pressable>
                        {status === 'open' && repaid > 0 && (
                          <View style={styles.loanRepaidRow}>
                            <Text style={styles.amountLabel}>Đã nhận lại</Text>
                            <Text style={styles.loanRepaidAmount}>
                              {formatFinanceAmount(repaid)}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Sửa ghi chú của ${loan.borrowerName}`}
                      accessibilityState={{ disabled: busyAction !== null }}
                      disabled={busyAction !== null}
                      onPress={() => setNoteTarget(loan)}
                      style={styles.noteRow}
                    >
                      <Feather
                        name="file-text"
                        size={15}
                        color={colors.muted}
                      />
                      <Text
                        numberOfLines={2}
                        style={[
                          styles.note,
                          !loan.note && styles.notePlaceholder,
                        ]}
                      >
                        {loan.note || 'Thêm ghi chú'}
                      </Text>
                      {isActionBusy(loan.id, 'note') ? (
                        <ActivityIndicator size="small" color={colors.earth} />
                      ) : (
                        <Feather name="edit-2" size={15} color={colors.earth} />
                      )}
                    </Pressable>
                    {loan.repayments.length > 0 && (
                      <View style={styles.repaymentList}>
                        {loan.repayments.map((repayment) => (
                          <RepaymentRow
                            key={repayment.id}
                            repayment={repayment}
                          />
                        ))}
                      </View>
                    )}
                    {status === 'open' && (
                      <View style={styles.actionRow}>
                        {pending ? (
                          <Button
                            compact
                            title="Thử ghi vào Tài chính"
                            loading={isActionBusy(loan.id, 'repay')}
                            disabled={financeLoading || busyAction !== null}
                            onPress={() => void record(loan.id, pending.amount)}
                          />
                        ) : (
                          <Button
                            compact
                            title="Xác nhận nhận lại tiền"
                            disabled={financeLoading || busyAction !== null}
                            onPress={() => {
                              setActionError(null);
                              setRepayTarget(loan);
                            }}
                          />
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
          <LoanFormDialog
            visible={formVisible}
            uid={uid}
            onClose={() => setFormVisible(false)}
            onSave={async (loan) => {
              await onSave(loan, loan.remindOnDueDate);
              setFormVisible(false);
            }}
          />
          <RepaymentDialog
            loan={repayTarget}
            busy={!!repayTarget && isActionBusy(repayTarget.id, 'repay')}
            financeLoading={financeLoading}
            onClose={() => setRepayTarget(null)}
            onSave={(amount) => {
              if (repayTarget) void record(repayTarget.id, amount);
            }}
          />
          <LoanNoteDialog
            loan={noteTarget}
            busy={!!noteTarget && isActionBusy(noteTarget.id, 'note')}
            onClose={() => setNoteTarget(null)}
            onSave={(note) => {
              if (noteTarget) return updateNote(noteTarget, note);
              return Promise.resolve();
            }}
          />
          <PrincipalCorrectionDialog
            loan={principalTarget}
            busy={
              !!principalTarget && isActionBusy(principalTarget.id, 'amount')
            }
            onClose={() => setPrincipalTarget(null)}
            onSave={(amount) =>
              principalTarget
                ? updatePrincipal(principalTarget, amount)
                : Promise.resolve()
            }
          />
        </View>
      </Modal>
    </>
  );
}

function RepaymentRow({ repayment }: { repayment: LoanRepayment }) {
  return (
    <View style={styles.repaymentRow}>
      <Feather
        name={repayment.status === 'posted' ? 'check-circle' : 'clock'}
        size={14}
        color={repayment.status === 'posted' ? colors.success : colors.sunlight}
      />
      <Text
        style={[
          styles.repaymentText,
          repayment.status === 'pending' && styles.pendingText,
        ]}
      >
        {repayment.status === 'posted'
          ? `${formatFinanceDate(new Date(repayment.receivedAt))} · ${formatFinanceAmount(repayment.amount)}`
          : `Chờ ghi Tài chính · ${formatFinanceAmount(repayment.amount)}`}
      </Text>
    </View>
  );
}

function LoanFormDialog({
  visible,
  uid,
  onClose,
  onSave,
}: {
  visible: boolean;
  uid: string | null;
  onClose: () => void;
  onSave: (
    loan: LoanRecord,
    requestReminderPermission?: boolean,
  ) => Promise<void>;
}) {
  const [borrowerName, setBorrowerName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [remind, setRemind] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingLoanAttempt = useRef<{
    signature: string;
    loan: LoanRecord;
  } | null>(null);
  const calendarDays = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const leadingDays = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: 42 }, (_, index) => {
      const day = index - leadingDays + 1;
      return day > 0 && day <= daysInMonth ? new Date(year, month, day) : null;
    });
  }, [visibleMonth]);

  useEffect(() => {
    if (!visible) return;
    setBorrowerName('');
    setAmountText('');
    setNote('');
    setDueDate(null);
    setDatePickerVisible(false);
    setRemind(false);
    setError(null);
    pendingLoanAttempt.current = null;
  }, [visible]);

  function reset() {
    setBorrowerName('');
    setAmountText('');
    setNote('');
    setDueDate(null);
    setDatePickerVisible(false);
    setRemind(false);
    setError(null);
    pendingLoanAttempt.current = null;
  }

  async function submit() {
    if (saving) return;
    const borrower = borrowerName.trim();
    const amount = parseFinanceAmount(amountText);
    if (!borrower) return setError('Nhập tên người mượn.');
    if (borrower.length > 100)
      return setError('Tên người mượn tối đa 100 ký tự.');
    if (amount === null)
      return setError('Nhập số tiền là số nguyên lớn hơn 0.');
    if (note.trim().length > 500) return setError('Ghi chú tối đa 500 ký tự.');
    if (remind && !dueDate)
      return setError('Chọn ngày hẹn trả trước khi bật nhắc.');
    if (!uid) return setError('Bạn cần đăng nhập để lưu khoản cho mượn.');
    const dueAt = dueDate
      ? new Date(
          dueDate.getFullYear(),
          dueDate.getMonth(),
          dueDate.getDate(),
          12,
        ).getTime()
      : null;
    const trimmedNote = note.trim();
    const signature = JSON.stringify([
      uid,
      borrower,
      amount,
      dueAt,
      remind,
      trimmedNote,
    ]);
    let loan =
      pendingLoanAttempt.current?.signature === signature
        ? pendingLoanAttempt.current.loan
        : null;
    if (!loan) {
      const lentAt = Date.now();
      loan = {
        id: newId(),
        ownerId: uid,
        borrowerName: borrower,
        principalAmount: amount,
        lentAt,
        dueAt,
        remindOnDueDate: remind,
        note: trimmedNote,
        repayments: [],
        cancelledAt: null,
        updatedAt: lentAt,
      };
      pendingLoanAttempt.current = { signature, loan };
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(loan);
      reset();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Chưa lưu được khoản cho mượn.',
      );
    } finally {
      setSaving(false);
    }
  }

  const today = new Date();
  const amountPreview = parseFinanceAmount(amountText);

  return (
    <>
      {visible && !datePickerVisible && (
        <LoanDialogOverlay
          dialogStyle={styles.loanFormDialog}
          onRequestClose={saving ? undefined : onClose}
        >
          <ScrollView
            style={styles.dialogScroll}
            contentContainerStyle={styles.dialogForm}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.dialogHeader}>
              <Text accessibilityRole="header" style={styles.dialogTitle}>
                Khoản cho mượn mới
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng form khoản cho mượn"
                disabled={saving}
                onPress={onClose}
                hitSlop={8}
                style={styles.dialogClose}
              >
                <Feather name="x" size={20} color={colors.earth} />
              </Pressable>
            </View>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Người mượn</Text>
              <AppTextInput
                accessibilityLabel="Tên người mượn"
                placeholder="Nhập tên người mượn"
                placeholderTextColor={colors.muted}
                value={borrowerName}
                onChangeText={setBorrowerName}
                maxLength={100}
                style={styles.input}
              />
            </View>
            <View style={styles.formRow}>
              <View style={[styles.formField, styles.formColumn]}>
                <Text style={styles.fieldLabel}>Số tiền đã cho mượn</Text>
                <AppTextInput
                  accessibilityLabel="Số tiền đã cho mượn"
                  placeholder="Ví dụ: 500000"
                  placeholderTextColor={colors.muted}
                  value={amountText}
                  onChangeText={(value) =>
                    setAmountText(value.replace(/\D/g, ''))
                  }
                  keyboardType="number-pad"
                  maxLength={16}
                  style={styles.input}
                />
                {amountPreview !== null && (
                  <Text style={styles.amountPreview}>
                    {formatFinanceAmount(amountPreview)}
                  </Text>
                )}
              </View>
              <View style={[styles.formField, styles.formColumn]}>
                <View style={styles.fieldHeading}>
                  <Text style={styles.fieldLabel}>Ngày hẹn trả</Text>
                  <Text style={styles.optionalLabel}>Tùy chọn</Text>
                </View>
                <View style={styles.compactDateField}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      dueDate
                        ? `Ngày hẹn trả ${formatFinanceDate(dueDate)}`
                        : 'Chọn ngày hẹn trả'
                    }
                    onPress={() => {
                      const date = dueDate ?? new Date();
                      setVisibleMonth(
                        new Date(date.getFullYear(), date.getMonth(), 1),
                      );
                      setDatePickerVisible(true);
                    }}
                    style={styles.compactDateButton}
                  >
                    {!dueDate && (
                      <Feather name="calendar" size={16} color={colors.sky} />
                    )}
                    <Text numberOfLines={1} style={styles.compactDateValue}>
                      {dueDate ? formatFinanceDate(dueDate) : 'Chọn ngày'}
                    </Text>
                  </Pressable>
                  {dueDate && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Bỏ ngày hẹn trả"
                      hitSlop={8}
                      onPress={() => {
                        setDueDate(null);
                        setRemind(false);
                      }}
                      style={styles.compactDateClear}
                    >
                      <Feather name="x" size={16} color={colors.muted} />
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Nhắc vào ngày hẹn trả"
              accessibilityState={{
                checked: remind,
                disabled: dueDate === null,
              }}
              disabled={dueDate === null}
              onPress={() => setRemind((value) => !value)}
              style={styles.reminderToggle}
            >
              <Feather
                name={remind ? 'check-square' : 'square'}
                size={19}
                color={
                  dueDate === null
                    ? colors.line
                    : remind
                      ? colors.earth
                      : colors.muted
                }
              />
              <Text
                style={[
                  styles.reminderText,
                  dueDate === null && styles.reminderDisabled,
                ]}
              >
                Nhắc lúc 09:00 ngày hẹn · trên thiết bị này
              </Text>
            </Pressable>
            <View style={styles.formField}>
              <View style={styles.fieldHeading}>
                <Text style={styles.fieldLabel}>Ghi chú</Text>
                <Text style={styles.optionalLabel}>Tùy chọn</Text>
              </View>
              <AppTextInput
                accessibilityLabel="Ghi chú khoản cho mượn"
                placeholder="Thêm ghi chú"
                placeholderTextColor={colors.muted}
                value={note}
                onChangeText={setNote}
                maxLength={500}
                multiline
                textAlignVertical="top"
                style={styles.noteInput}
              />
            </View>
            {error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            <Text style={styles.meta}>
              Tiền cho mượn sẽ được ghi thành khoản chi trong Tài chính.
            </Text>
            <Button
              title="Lưu khoản cho mượn"
              loading={saving}
              onPress={() => void submit()}
              compact
            />
          </ScrollView>
        </LoanDialogOverlay>
      )}
      {visible && datePickerVisible && (
        <LoanDialogOverlay
          elevated
          dialogStyle={styles.dateDialog}
          overlayStyle={styles.dateOverlay}
          onRequestClose={() => setDatePickerVisible(false)}
        >
          <View style={styles.dialogHeader}>
            <Text accessibilityRole="header" style={styles.dialogTitle}>
              Chọn ngày hẹn trả
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng chọn ngày hẹn trả"
              onPress={() => setDatePickerVisible(false)}
              hitSlop={8}
            >
              <Feather name="x" size={20} color={colors.earth} />
            </Pressable>
          </View>
          <View style={styles.calendarMonthRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tháng trước"
              onPress={() =>
                setVisibleMonth(
                  (month) =>
                    new Date(month.getFullYear(), month.getMonth() - 1, 1),
                )
              }
              style={styles.calendarMonthButton}
            >
              <Feather name="chevron-left" size={19} color={colors.earth} />
            </Pressable>
            <Text style={styles.calendarMonthTitle}>
              Tháng {visibleMonth.getMonth() + 1} năm{' '}
              {visibleMonth.getFullYear()}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tháng sau"
              onPress={() =>
                setVisibleMonth(
                  (month) =>
                    new Date(month.getFullYear(), month.getMonth() + 1, 1),
                )
              }
              style={styles.calendarMonthButton}
            >
              <Feather name="chevron-right" size={19} color={colors.earth} />
            </Pressable>
          </View>
          <View style={styles.calendarWeekdays}>
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((weekday) => (
              <Text key={weekday} style={styles.calendarWeekday}>
                {weekday}
              </Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {calendarDays.map((date, index) => {
              if (!date)
                return (
                  <View key={`empty-${index}`} style={styles.calendarDay} />
                );
              const selected =
                dueDate?.getFullYear() === date.getFullYear() &&
                dueDate.getMonth() === date.getMonth() &&
                dueDate.getDate() === date.getDate();
              const isToday =
                today.getFullYear() === date.getFullYear() &&
                today.getMonth() === date.getMonth() &&
                today.getDate() === date.getDate();
              return (
                <Pressable
                  key={date.toISOString()}
                  accessibilityRole="button"
                  accessibilityLabel={`Chọn ngày ${formatFinanceDate(date)}`}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setDueDate(date);
                    setDatePickerVisible(false);
                  }}
                  style={[
                    styles.calendarDay,
                    isToday && styles.calendarDayToday,
                    selected && styles.calendarDaySelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.calendarDayText,
                      selected && styles.calendarDayTextSelected,
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </LoanDialogOverlay>
      )}
    </>
  );
}

function LoanNoteDialog({
  loan,
  busy,
  onClose,
  onSave,
}: {
  loan: LoanRecord | null;
  busy: boolean;
  onClose: () => void;
  onSave: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const visible = loan !== null;

  useEffect(() => {
    setNote(loan?.note ?? '');
    setError(null);
  }, [loan?.id, loan?.note]);

  async function submit() {
    if (!loan || busy) return;
    setError(null);
    try {
      await onSave(note);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Chưa lưu được ghi chú.',
      );
    }
  }

  return (
    visible && (
      <LoanDialogOverlay onRequestClose={busy ? undefined : onClose}>
        <View style={styles.dialogHeader}>
          <Text accessibilityRole="header" style={styles.dialogTitle}>
            Sửa ghi chú
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng sửa ghi chú"
            disabled={busy}
            onPress={onClose}
            hitSlop={8}
          >
            <Feather name="x" size={20} color={colors.earth} />
          </Pressable>
        </View>
        <Text style={styles.noteDialogSubtitle}>{loan.borrowerName}</Text>
        <AppTextInput
          accessibilityLabel="Ghi chú khoản cho mượn"
          placeholder="Nhập ghi chú (không bắt buộc)"
          placeholderTextColor={colors.muted}
          value={note}
          onChangeText={(value) => {
            setNote(value);
            setError(null);
          }}
          maxLength={500}
          multiline
          textAlignVertical="top"
          style={[styles.input, styles.noteEditor]}
        />
        <Text style={styles.noteDialogHint}>{note.length}/500 ký tự</Text>
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <Button
          title="Lưu ghi chú"
          loading={busy}
          onPress={() => void submit()}
        />
      </LoanDialogOverlay>
    )
  );
}

function LoanDialogOverlay({
  children,
  onRequestClose,
  elevated = false,
  dialogStyle,
  overlayStyle,
}: {
  children: ReactNode;
  onRequestClose?: () => void;
  elevated?: boolean;
  dialogStyle?: StyleProp<ViewStyle>;
  overlayStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <KeyboardAvoidingView
      style={[styles.overlay, elevated && styles.overlayElevated, overlayStyle]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Đóng hộp thoại"
        disabled={!onRequestClose}
        onPress={onRequestClose}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.dialog, dialogStyle]} accessibilityViewIsModal>
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}

function RepaymentDialog({
  loan,
  busy,
  financeLoading,
  onClose,
  onSave,
}: {
  loan: LoanRecord | null;
  busy: boolean;
  financeLoading: boolean;
  onClose: () => void;
  onSave: (amount: number) => void;
}) {
  const [amountText, setAmountText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const visible = loan !== null;
  useEffect(() => {
    setAmountText('');
    setError(null);
  }, [loan?.id]);
  const outstanding = loan ? getLoanOutstandingAmount(loan) : 0;
  const available = loan
    ? Math.max(0, outstanding - getLoanPendingAmount(loan))
    : 0;

  function submit() {
    const amount = parseFinanceAmount(amountText);
    if (amount === null) return setError('Nhập số tiền lớn hơn 0.');
    if (amount > available)
      return setError('Số tiền nhận lại không được vượt số còn phải thu.');
    setError(null);
    onSave(amount);
  }

  return visible ? (
    <LoanDialogOverlay onRequestClose={busy ? undefined : onClose}>
      <View style={styles.dialogForm}>
        <View style={styles.dialogHeader}>
          <Text accessibilityRole="header" style={styles.dialogTitle}>
            Xác nhận nhận lại tiền
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng xác nhận nhận lại tiền"
            disabled={busy}
            onPress={onClose}
            hitSlop={8}
          >
            <Feather name="x" size={20} color={colors.earth} />
          </Pressable>
        </View>
        {loan && (
          <View style={styles.repaymentSummary}>
            <View style={styles.repaymentBorrowerRow}>
              <Feather name="user" size={16} color={colors.earth} />
              <Text numberOfLines={1} style={styles.repaymentBorrower}>
                {loan.borrowerName}
              </Text>
            </View>
            <View style={styles.repaymentBalance}>
              <Text style={styles.repaymentBalanceLabel}>Còn phải thu</Text>
              <Text style={styles.repaymentBalanceValue}>
                {formatFinanceAmount(outstanding)}
              </Text>
            </View>
          </View>
        )}
        <View style={styles.repaymentFieldHeader}>
          <Text style={styles.fieldLabel}>Số tiền nhận lại lần này</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Nhập số tiền tối đa ${formatFinanceAmount(available)}`}
            accessibilityState={{ disabled: !available || busy }}
            disabled={!available || busy}
            onPress={() => {
              setAmountText(String(available));
              setError(null);
            }}
            style={({ pressed }) => [
              styles.maxButton,
              (!available || busy) && styles.maxButtonDisabled,
              pressed && available > 0 && !busy && styles.maxButtonPressed,
            ]}
          >
            <Text style={styles.maxButtonText}>Tối đa</Text>
          </Pressable>
        </View>
        <AppTextInput
          accessibilityLabel="Số tiền nhận lại"
          placeholder="Nhập số tiền"
          placeholderTextColor={colors.muted}
          value={amountText}
          onChangeText={(value) => {
            setAmountText(value.replace(/\D/g, ''));
            setError(null);
          }}
          keyboardType="number-pad"
          maxLength={16}
          editable={!busy && available > 0}
          style={styles.input}
        />
        <Text style={styles.meta}>
          Khoản nhận lại sẽ được ghi riêng trong Tài chính.
        </Text>
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <Button
          title="Ghi nhận khoản đã nhận"
          loading={busy}
          disabled={!available || financeLoading}
          onPress={submit}
        />
      </View>
    </LoanDialogOverlay>
  ) : null;
}

function PrincipalCorrectionDialog({
  loan,
  busy,
  onClose,
  onSave,
}: {
  loan: LoanRecord | null;
  busy: boolean;
  onClose: () => void;
  onSave: (amount: number) => Promise<void>;
}) {
  const [amountText, setAmountText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const principalAmount = loan?.principalAmount;
  const loanId = loan?.id;
  useEffect(() => {
    setAmountText(principalAmount === undefined ? '' : String(principalAmount));
    setError(null);
  }, [loanId, principalAmount]);
  if (!loan) return null;
  const received = loan.repayments.reduce((sum, row) => sum + row.amount, 0);

  async function submit() {
    const amount = parseFinanceAmount(amountText);
    if (amount === null) return setError('Nhập số tiền lớn hơn 0.');
    if (amount < received)
      return setError('Số tiền mới không được thấp hơn số đã nhận lại.');
    if (amount === loan?.principalAmount) return onClose();
    setError(null);
    try {
      await onSave(amount);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Chưa sửa được số tiền.',
      );
    }
  }

  return (
    <LoanDialogOverlay onRequestClose={busy ? undefined : onClose}>
      <View style={styles.dialogForm}>
        <View style={styles.dialogHeader}>
          <Text accessibilityRole="header" style={styles.dialogTitle}>
            Sửa số tiền cho mượn
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng sửa số tiền cho mượn"
            disabled={busy}
            onPress={onClose}
            hitSlop={8}
          >
            <Feather name="x" size={20} color={colors.earth} />
          </Pressable>
        </View>
        <Text style={styles.noteDialogSubtitle}>{loan.borrowerName}</Text>
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Số tiền đã cho mượn</Text>
          <AppTextInput
            accessibilityLabel="Sửa số tiền đã cho mượn"
            value={amountText}
            onChangeText={(value) => {
              setAmountText(value.replace(/\D/g, ''));
              setError(null);
            }}
            keyboardType="number-pad"
            maxLength={16}
            editable={!busy}
            style={styles.input}
          />
        </View>
        <Text style={styles.meta}>
          Giao dịch chi liên kết trong Tài chính sẽ cập nhật cùng lúc.
        </Text>
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <Button
          title="Lưu số tiền"
          loading={busy}
          onPress={() => void submit()}
        />
      </View>
    </LoanDialogOverlay>
  );
}
