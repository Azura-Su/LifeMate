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
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { AppTextInput } from '../../components/AppTextInput';
import { Button } from '../../components/Button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme';
import type { LoanAdvance, LoanRecord, LoanRepayment } from '../../types/loan';
import {
  canSetLoanTotalAmount,
  getLoanOutstandingAmount,
  getLoanPendingAmount,
  getLoanRepaidAmount,
  getLoanStatus,
  getLoanTotalAmount,
} from '../../types/loan';
import {
  formatFinanceAmount,
  formatFinanceDate,
  parseFinanceAmount,
} from '../../utils/finance';
import { loanStyles as styles } from './LoanLedgerModal.styles';
import {
  getPendingAdvanceAttempt,
  getPendingNewLoanAttempt,
  LoanDataConflictError,
  reserveNewLoanAttempt,
} from '../../services/finance/loanStorage';
import {
  LoanBorrowerPicker,
  loanBorrowerKey,
  type LoanEntryMode,
} from './LoanBorrowerPicker';

type Props = {
  visible: boolean;
  addRequestId: number;
  initialLoanId?: string | null;
  uid: string | null;
  loans: LoanRecord[];
  loading: boolean;
  financeLoading: boolean;
  syncStatus: 'synced' | 'local' | null;
  error: string | null;
  onRefresh: () => Promise<boolean>;
  onSave: (
    loan: LoanRecord,
    requestReminderPermission?: boolean,
  ) => Promise<void>;
  onDeleteLoan: (loanId: string) => Promise<void>;
  onCorrectPrincipal: (
    loanId: string,
    amount: number,
    note: string,
    lentAt: number,
  ) => Promise<void>;
  onRecordRepayment: (loanId: string, amount: number) => Promise<void>;
  onDeleteRepayment: (
    loanId: string,
    repayment: LoanRepayment,
  ) => Promise<void>;
  onUpdateRepayment: (
    loanId: string,
    repayment: LoanRepayment,
    amount: number,
    receivedAt: number,
  ) => Promise<void>;
  onRecordAdvance: (
    loanId: string,
    amount: number,
    note: string,
    lentAt: number,
  ) => Promise<void>;
  onUpdateAdvance: (
    loanId: string,
    expectedAdvance: LoanAdvance,
    amount: number,
    note: string,
    lentAt: number,
  ) => Promise<void>;
  onDeleteAdvance: (loanId: string, advance: LoanAdvance) => Promise<void>;
  onDeleteInitialEntry: (
    loanId: string,
    expectedUpdatedAt: number,
  ) => Promise<void>;
};

type LoanTab = 'open' | 'settled' | 'cancelled';
type HistoryActions = {
  title: string;
  description: string;
  canEdit: boolean;
  onEdit: () => void;
  canDelete: boolean;
  onDelete: () => void;
};
type LoanAction =
  | 'repay'
  | 'delete'
  | 'amount'
  | 'advance'
  | 'editAdvance'
  | 'deleteAdvance'
  | 'deleteInitial'
  | 'editRepayment'
  | 'deleteRepayment';

const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export function LoanLedgerModal({
  visible,
  addRequestId,
  initialLoanId = null,
  uid,
  loans,
  loading,
  financeLoading,
  syncStatus,
  error,
  onRefresh,
  onSave,
  onDeleteLoan,
  onCorrectPrincipal,
  onRecordRepayment,
  onDeleteRepayment,
  onUpdateRepayment,
  onRecordAdvance,
  onUpdateAdvance,
  onDeleteAdvance,
  onDeleteInitialEntry,
}: Props) {
  const loanListRef = useRef<ScrollView>(null);
  const refreshRequest = useRef<object | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const handledAddRequestId = useRef(addRequestId);
  const [repayTarget, setRepayTarget] = useState<LoanRecord | null>(null);
  const [advanceTarget, setAdvanceTarget] = useState<LoanRecord | null>(null);
  const [advanceEditTarget, setAdvanceEditTarget] = useState<{
    loan: LoanRecord;
    advance: LoanAdvance;
  } | null>(null);
  const [repaymentEditTarget, setRepaymentEditTarget] = useState<{
    loan: LoanRecord;
    repayment: LoanRepayment;
  } | null>(null);
  const [principalTarget, setPrincipalTarget] = useState<LoanRecord | null>(
    null,
  );
  const [selectedLoanTab, setSelectedLoanTab] = useState<LoanTab>('open');
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const focusedLoan = useRef<{ id: string; status: LoanTab } | null>(null);
  const [busyAction, setBusyAction] = useState<{
    loanId: string;
    action: LoanAction;
    repaymentId?: string;
    advanceId?: string;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [historyActions, setHistoryActions] = useState<HistoryActions | null>(
    null,
  );
  useEffect(() => {
    if (!visible || handledAddRequestId.current === addRequestId) return;
    handledAddRequestId.current = addRequestId;
    setActionError(null);
    setFormVisible(true);
  }, [addRequestId, visible]);
  useEffect(() => {
    if (visible) return;
    refreshRequest.current = null;
    setRefreshing(false);
    setRefreshError(null);
    setFormVisible(false);
    setRepayTarget(null);
    setAdvanceTarget(null);
    setAdvanceEditTarget(null);
    setRepaymentEditTarget(null);
    setPrincipalTarget(null);
    setHistoryActions(null);
    setExpandedLoanId(null);
  }, [visible]);
  useEffect(() => {
    if (!visible || !initialLoanId) {
      focusedLoan.current = null;
      return;
    }
    const targetLoan = loans.find(({ id }) => id === initialLoanId);
    if (!targetLoan) return;
    const targetStatus = getLoanStatus(targetLoan);
    const previouslyFocused = focusedLoan.current;
    if (previouslyFocused?.id !== initialLoanId) {
      focusedLoan.current = { id: initialLoanId, status: targetStatus };
      setSelectedLoanTab(targetStatus);
      setExpandedLoanId(initialLoanId);
      loanListRef.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    if (previouslyFocused.status === targetStatus) return;
    focusedLoan.current = { id: initialLoanId, status: targetStatus };
    if (selectedLoanTab === previouslyFocused.status)
      setSelectedLoanTab(targetStatus);
  }, [initialLoanId, loans, selectedLoanTab, visible]);
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
  const visibleLoans = initialLoanId
    ? [...loansByTab[selectedLoanTab]].sort(
        (a, b) =>
          Number(b.id === initialLoanId) - Number(a.id === initialLoanId),
      )
    : loansByTab[selectedLoanTab];
  const receivable = unfinishedLoans.reduce(
    (total, loan) => total + getLoanOutstandingAmount(loan),
    0,
  );

  async function refreshLedger() {
    if (!visible || !uid || loading || refreshRequest.current) return;
    const request = {};
    refreshRequest.current = request;
    setRefreshing(true);
    setRefreshError(null);
    try {
      if (!(await onRefresh())) throw new Error('Sync failed');
    } catch {
      if (refreshRequest.current === request)
        setRefreshError('Chưa đồng bộ được. Kéo xuống để thử lại.');
    } finally {
      if (refreshRequest.current === request) {
        refreshRequest.current = null;
        setRefreshing(false);
      }
    }
  }

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

  async function updatePrincipal(
    loan: LoanRecord,
    amount: number,
    note: string,
    lentAt: number,
  ) {
    setBusyAction({ loanId: loan.id, action: 'amount' });
    try {
      await onCorrectPrincipal(loan.id, amount, note, lentAt);
      setPrincipalTarget(null);
    } finally {
      setBusyAction(null);
    }
  }

  async function addAdvance(
    loanId: string,
    amount: number,
    note: string,
    lentAt: number,
  ) {
    setBusyAction({ loanId, action: 'advance' });
    setActionError(null);
    try {
      await onRecordAdvance(loanId, amount, note, lentAt);
      setAdvanceTarget(null);
    } finally {
      setBusyAction(null);
    }
  }

  async function updateAdvance(
    loan: LoanRecord,
    advance: LoanAdvance,
    amount: number,
    note: string,
    lentAt: number,
  ) {
    setBusyAction({ loanId: loan.id, action: 'editAdvance' });
    try {
      await onUpdateAdvance(loan.id, advance, amount, note, lentAt);
      setAdvanceEditTarget(null);
    } finally {
      setBusyAction(null);
    }
  }

  async function updateRepayment(
    loan: LoanRecord,
    repayment: LoanRepayment,
    amount: number,
    receivedAt: number,
  ) {
    setBusyAction({
      loanId: loan.id,
      action: 'editRepayment',
      repaymentId: repayment.id,
    });
    try {
      await onUpdateRepayment(loan.id, repayment, amount, receivedAt);
      setRepaymentEditTarget(null);
      const adjusted: LoanRecord = {
        ...loan,
        repayments: loan.repayments.map((item) =>
          item.id === repayment.id ? { ...item, amount, receivedAt } : item,
        ),
        ...(loan.recordedRepaymentAmount !== undefined
          ? {
              recordedRepaymentAmount:
                loan.recordedRepaymentAmount - repayment.amount + amount,
            }
          : {}),
      };
      setSelectedLoanTab(getLoanStatus(adjusted));
    } finally {
      setBusyAction(null);
    }
  }

  function confirmDelete(loan: LoanRecord) {
    Alert.alert(
      'Xóa khoản cho vay?',
      loan.repayments.length === 0
        ? `Xóa khoản của ${loan.borrowerName} và tất cả khoản chi cho vay liên kết trong Tài chính?`
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

  function confirmDeleteRepayment(loan: LoanRecord, repayment: LoanRepayment) {
    if (repayment.status !== 'posted' || busyAction !== null) return;
    const amount = formatFinanceAmount(repayment.amount);
    const date = formatFinanceDate(new Date(repayment.receivedAt));
    Alert.alert(
      'Xóa lần đã nhận?',
      `Xóa ${amount} đã nhận ngày ${date} từ ${loan.borrowerName}? Giao dịch Tài chính liên kết cũng sẽ bị xóa và dư nợ tăng lại ${amount}.`,
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Xóa lần nhận',
          style: 'destructive',
          onPress: () => {
            setBusyAction({
              loanId: loan.id,
              action: 'deleteRepayment',
              repaymentId: repayment.id,
            });
            setActionError(null);
            void onDeleteRepayment(loan.id, repayment)
              .then(() => {
                if (getLoanStatus(loan) === 'settled')
                  setSelectedLoanTab('open');
              })
              .catch((cause) =>
                setActionError(
                  cause instanceof Error
                    ? cause.message
                    : 'Chưa xác nhận được lần xóa. Hãy tải lại sổ.',
                ),
              )
              .finally(() => setBusyAction(null));
          },
        },
      ],
    );
  }

  function confirmDeleteAdvance(loan: LoanRecord, advance: LoanAdvance) {
    if (busyAction !== null) return;
    Alert.alert(
      'Xóa khoản vay thêm?',
      `Xóa ${formatFinanceAmount(advance.amount)} cho vay ngày ${formatFinanceDate(new Date(advance.lentAt))}? Khoản chi liên kết trong Tài chính cũng sẽ bị xóa.`,
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Xóa khoản này',
          style: 'destructive',
          onPress: () => {
            setBusyAction({
              loanId: loan.id,
              action: 'deleteAdvance',
              advanceId: advance.id,
            });
            setActionError(null);
            void onDeleteAdvance(loan.id, advance)
              .then(() => {
                const adjusted: LoanRecord = {
                  ...loan,
                  advances: loan.advances?.filter(
                    ({ id }) => id !== advance.id,
                  ),
                  additionalAmount:
                    (loan.additionalAmount ?? 0) - advance.amount,
                };
                setSelectedLoanTab(getLoanStatus(adjusted));
              })
              .catch((cause) =>
                setActionError(
                  cause instanceof Error
                    ? cause.message
                    : 'Chưa xóa được khoản vay thêm.',
                ),
              )
              .finally(() => setBusyAction(null));
          },
        },
      ],
    );
  }

  function confirmDeleteInitial(loan: LoanRecord) {
    if (busyAction !== null) return;
    if (!loan.advances?.length) {
      if (loan.repayments.length > 0) {
        Alert.alert(
          'Chưa thể xóa khoản ban đầu',
          'Khoản này vẫn có lịch sử nhận lại. Hãy sửa số tiền ban đầu hoặc xóa các lần đã nhận trước.',
        );
        return;
      }
      confirmDelete(loan);
      return;
    }
    const nextPrincipal = loan.advances[0];
    Alert.alert(
      'Xóa khoản vay ban đầu?',
      `Xóa ${formatFinanceAmount(loan.principalAmount)} đã cho vay ban đầu? Khoản vay thêm ${formatFinanceAmount(nextPrincipal.amount)} sẽ thành khoản gốc mới. Giao dịch Tài chính liên kết sẽ được cập nhật cùng lúc.`,
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Xóa khoản ban đầu',
          style: 'destructive',
          onPress: () => {
            setBusyAction({ loanId: loan.id, action: 'deleteInitial' });
            setActionError(null);
            void onDeleteInitialEntry(loan.id, loan.updatedAt)
              .then(() => {
                const adjusted: LoanRecord = {
                  ...loan,
                  principalAmount: nextPrincipal.amount,
                  advances: loan.advances?.slice(1),
                  additionalAmount:
                    (loan.additionalAmount ?? 0) - nextPrincipal.amount,
                };
                setSelectedLoanTab(getLoanStatus(adjusted));
              })
              .catch((cause) =>
                setActionError(
                  cause instanceof Error
                    ? cause.message
                    : 'Chưa xóa được khoản vay ban đầu.',
                ),
              )
              .finally(() => setBusyAction(null));
          },
        },
      ],
    );
  }

  if (!visible) return null;

  return (
    <View style={styles.page}>
      <View style={styles.fixedContent}>
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Tổng còn phải thu</Text>
          <Text style={styles.summaryValue}>
            {formatFinanceAmount(receivable)}
          </Text>
          <Text style={styles.summaryHint}>
            Tiền gốc còn lại của {unfinishedLoans.length} khoản đang mở
          </Text>
        </View>
        {(refreshError || error || actionError) && (
          <Text accessibilityRole="alert" style={styles.error}>
            {actionError ?? refreshError ?? error}
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
                onPress={() => {
                  setSelectedLoanTab(tab.value);
                  loanListRef.current?.scrollTo({ y: 0, animated: false });
                }}
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
      </View>
      <ScrollView
        ref={loanListRef}
        style={styles.loanListScroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refreshLedger()}
            enabled={!!uid}
            tintColor={colors.earth}
            colors={[colors.earth]}
            progressBackgroundColor={colors.surface}
            accessibilityLabel="Kéo xuống để đồng bộ sổ cho vay"
          />
        }
      >
        {loading && loans.length === 0 ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.earth} />
            <Text style={styles.meta}>Đang tải sổ cho vay…</Text>
          </View>
        ) : visibleLoans.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="book-open" size={24} color={colors.sky} />
            <Text style={styles.emptyTitle}>Chưa có khoản nào</Text>
            <Text style={styles.emptyText}>
              {selectedLoanTab === 'open'
                ? 'Thêm khoản cho vay để theo dõi số tiền cần nhận lại.'
                : selectedLoanTab === 'settled'
                  ? 'Khoản đã nhận đủ tiền sẽ xuất hiện ở đây.'
                  : 'Khoản đã hủy sẽ được lưu lại ở đây.'}
            </Text>
          </View>
        ) : (
          visibleLoans.map((loan) => {
            const expanded = expandedLoanId === loan.id;
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
                  : getLoanTotalAmount(loan);
            const primaryAmountLabel =
              status === 'open'
                ? 'Còn phải thu'
                : status === 'settled'
                  ? 'Đã nhận lại'
                  : 'Số tiền đã cho vay';
            return (
              <View key={loan.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${expanded ? 'Thu gọn' : 'Xem'} lịch sử khoản vay của ${loan.borrowerName}`}
                    accessibilityState={{ expanded }}
                    onPress={() => setExpandedLoanId(expanded ? null : loan.id)}
                    style={styles.borrowerToggle}
                  >
                    <Feather name="user" size={17} color={colors.earth} />
                    <Text numberOfLines={1} style={styles.borrower}>
                      {loan.borrowerName}
                    </Text>
                    <Feather
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={17}
                      color={colors.earth}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Xóa khoản cho vay của ${loan.borrowerName}`}
                    disabled={busyAction !== null}
                    hitSlop={8}
                    onPress={() => confirmDelete(loan)}
                    style={styles.deleteAction}
                  >
                    {isActionBusy(loan.id, 'delete') ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <Feather name="trash-2" size={16} color={colors.danger} />
                    )}
                  </Pressable>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${primaryAmountLabel} ${formatFinanceAmount(primaryAmount)}. ${expanded ? 'Thu gọn' : 'Xem'} lịch sử khoản vay của ${loan.borrowerName}`}
                  accessibilityState={{ expanded }}
                  onPress={() => setExpandedLoanId(expanded ? null : loan.id)}
                  style={[
                    styles.loanSummary,
                    status === 'settled' && styles.loanSummarySettled,
                  ]}
                >
                  <View style={styles.loanBalance}>
                    <Text
                      style={[
                        styles.loanBalanceLabel,
                        status === 'settled' && styles.loanBalanceLabelSettled,
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
                        status === 'settled' && styles.loanBalanceAmountSettled,
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
                      <Text numberOfLines={1} style={styles.loanDueDateValue}>
                        {formatFinanceDate(new Date(loan.dueAt))}
                      </Text>
                    </View>
                  )}
                </Pressable>
                {status !== 'cancelled' && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${expanded ? 'Thu gọn' : 'Xem'} lịch sử khoản vay của ${loan.borrowerName}`}
                    accessibilityState={{ expanded }}
                    onPress={() => setExpandedLoanId(expanded ? null : loan.id)}
                    style={styles.loanRepaymentDetails}
                  >
                    <View style={styles.loanRepaidRow}>
                      <Text style={styles.amountLabel}>Tổng đã cho vay</Text>
                      <View style={styles.loanPrincipalEdit}>
                        <Text style={styles.loanSecondaryAmount}>
                          {formatFinanceAmount(getLoanTotalAmount(loan))}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.loanRepaidRow}>
                      <Text style={styles.amountLabel}>Đã nhận lại</Text>
                      <Text style={styles.loanRepaidAmount}>
                        {formatFinanceAmount(repaid)}
                      </Text>
                    </View>
                  </Pressable>
                )}
                {expanded && (
                  <LoanHistory
                    loan={loan}
                    canEdit={status !== 'cancelled' && busyAction === null}
                    showDeleteLending={status !== 'cancelled'}
                    canDeleteLending={
                      !financeLoading &&
                      !loading &&
                      !pending &&
                      syncStatus === 'synced' &&
                      busyAction === null
                    }
                    deletingInitial={isActionBusy(loan.id, 'deleteInitial')}
                    deletingAdvanceId={
                      isActionBusy(loan.id, 'deleteAdvance')
                        ? (busyAction?.advanceId ?? null)
                        : null
                    }
                    canDeleteRepayment={
                      !financeLoading &&
                      !loading &&
                      !pending &&
                      syncStatus === 'synced' &&
                      busyAction === null
                    }
                    deletingRepaymentId={
                      isActionBusy(loan.id, 'deleteRepayment')
                        ? (busyAction?.repaymentId ?? null)
                        : null
                    }
                    onDeleteRepayment={(repayment) =>
                      confirmDeleteRepayment(loan, repayment)
                    }
                    onEditRepayment={(repayment) =>
                      setRepaymentEditTarget({ loan, repayment })
                    }
                    canAddAdvance={status === 'open'}
                    advanceDisabled={
                      financeLoading ||
                      busyAction !== null ||
                      !!pending ||
                      loading
                    }
                    advanceLoading={isActionBusy(loan.id, 'advance')}
                    onAddAdvance={() => setAdvanceTarget(loan)}
                    canAddRepayment={status === 'open'}
                    repaymentDisabled={
                      financeLoading ||
                      busyAction !== null ||
                      !!pending ||
                      loading
                    }
                    repaymentLoading={isActionBusy(loan.id, 'repay')}
                    onAddRepayment={() => {
                      setActionError(null);
                      setRepayTarget(loan);
                    }}
                    onEditPrincipal={() => setPrincipalTarget(loan)}
                    onDeletePrincipal={() => confirmDeleteInitial(loan)}
                    onEditAdvance={(advance) =>
                      setAdvanceEditTarget({ loan, advance })
                    }
                    onDeleteAdvance={(advance) =>
                      confirmDeleteAdvance(loan, advance)
                    }
                    onOpenActions={setHistoryActions}
                  />
                )}
                {status === 'open' &&
                  (pending || (!expanded && loan.repayments.length === 0)) && (
                    <View style={styles.actionRow}>
                      {pending ? (
                        <View style={styles.actionButton}>
                          <Button
                            compact
                            title="Thử ghi nhận"
                            loading={isActionBusy(loan.id, 'repay')}
                            disabled={financeLoading || busyAction !== null}
                            onPress={() => void record(loan.id, pending.amount)}
                          />
                        </View>
                      ) : (
                        <View style={styles.actionButton}>
                          <Button
                            compact
                            title="Nhận lại tiền"
                            disabled={financeLoading || busyAction !== null}
                            onPress={() => {
                              setActionError(null);
                              setRepayTarget(loan);
                            }}
                          />
                        </View>
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
        loans={loans.filter((loan) => loan.ownerId === uid)}
        loading={loading || financeLoading}
        onClose={() => setFormVisible(false)}
        onSave={async (loan) => {
          await onSave(loan, loan.remindOnDueDate);
          setSelectedLoanTab('open');
          setFormVisible(false);
        }}
        onRecordAdvance={async (loanId, amount, note, lentAt) => {
          await addAdvance(loanId, amount, note, lentAt);
          setSelectedLoanTab('open');
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
      <LoanPrincipalEditDialog
        loan={
          principalTarget
            ? (loans.find(({ id }) => id === principalTarget.id) ??
              principalTarget)
            : null
        }
        busy={!!principalTarget && isActionBusy(principalTarget.id, 'amount')}
        onClose={() => setPrincipalTarget(null)}
        onSave={(amount, note, lentAt) =>
          principalTarget
            ? updatePrincipal(principalTarget, amount, note, lentAt)
            : Promise.resolve()
        }
      />
      <LoanAdvanceDialog
        uid={uid}
        loan={
          advanceTarget
            ? (loans.find(({ id }) => id === advanceTarget.id) ?? advanceTarget)
            : null
        }
        busy={!!advanceTarget && isActionBusy(advanceTarget.id, 'advance')}
        onClose={() => setAdvanceTarget(null)}
        onSave={(amount, note, lentAt) =>
          advanceTarget
            ? addAdvance(advanceTarget.id, amount, note, lentAt)
            : Promise.resolve()
        }
      />
      <LoanAdvanceEditDialog
        loan={
          advanceEditTarget
            ? (loans.find(({ id }) => id === advanceEditTarget.loan.id) ??
              advanceEditTarget.loan)
            : null
        }
        advance={
          advanceEditTarget
            ? (loans
                .find(({ id }) => id === advanceEditTarget.loan.id)
                ?.advances?.find(
                  ({ id }) => id === advanceEditTarget.advance.id,
                ) ?? advanceEditTarget.advance)
            : null
        }
        busy={
          !!advanceEditTarget &&
          isActionBusy(advanceEditTarget.loan.id, 'editAdvance')
        }
        onClose={() => setAdvanceEditTarget(null)}
        onSave={(amount, note, lentAt) =>
          advanceEditTarget
            ? updateAdvance(
                advanceEditTarget.loan,
                advanceEditTarget.advance,
                amount,
                note,
                lentAt,
              )
            : Promise.resolve()
        }
      />
      <LoanRepaymentEditDialog
        loan={
          repaymentEditTarget
            ? (loans.find(({ id }) => id === repaymentEditTarget.loan.id) ??
              repaymentEditTarget.loan)
            : null
        }
        repayment={
          repaymentEditTarget
            ? (loans
                .find(({ id }) => id === repaymentEditTarget.loan.id)
                ?.repayments.find(
                  ({ id }) => id === repaymentEditTarget.repayment.id,
                ) ?? repaymentEditTarget.repayment)
            : null
        }
        busy={
          !!repaymentEditTarget &&
          isActionBusy(repaymentEditTarget.loan.id, 'editRepayment')
        }
        onClose={() => setRepaymentEditTarget(null)}
        onSave={(amount, receivedAt) =>
          repaymentEditTarget
            ? updateRepayment(
                repaymentEditTarget.loan,
                repaymentEditTarget.repayment,
                amount,
                receivedAt,
              )
            : Promise.resolve()
        }
      />
      {historyActions && (
        <HistoryActionsOverlay
          actions={historyActions}
          bottomInset={0}
          onClose={() => setHistoryActions(null)}
        />
      )}
    </View>
  );
}

function LoanAdvanceDialog({
  uid,
  loan,
  busy,
  onClose,
  onSave,
}: {
  uid: string | null;
  loan: LoanRecord | null;
  busy: boolean;
  onClose: () => void;
  onSave: (amount: number, note: string, lentAt: number) => Promise<void>;
}) {
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [lentDate, setLentDate] = useState(() => new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    let active = true;
    setAmountText('');
    setNote('');
    setLentDate(new Date());
    setDatePickerVisible(false);
    setError(null);
    setRetrying(false);
    setRestoring(!!loan && !!uid);
    if (!loan || !uid) {
      setRestoring(false);
      return () => {
        active = false;
      };
    }
    void getPendingAdvanceAttempt(uid, loan.id, loan.advances)
      .then((attempt) => {
        if (!active || !attempt) return;
        setAmountText(String(attempt.amount));
        setNote(attempt.note ?? '');
        setLentDate(new Date(attempt.lentAt));
        setRetrying(true);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [loan, uid]);
  if (!loan) return null;
  const amount = parseFinanceAmount(amountText);
  const outstanding = getLoanOutstandingAmount(loan);
  const validAmount =
    amount !== null && Number.isSafeInteger(getLoanTotalAmount(loan) + amount);
  const canSave =
    validAmount &&
    getLoanStatus(loan) === 'open' &&
    getLoanPendingAmount(loan) === 0;
  async function submit() {
    if (busy || submitting.current || !canSave || amount === null) return;
    const description = note.trim();
    if (!description) return setError('Nhập nội dung khoản cho vay thêm.');
    const selectedLentAt = new Date(
      lentDate.getFullYear(),
      lentDate.getMonth(),
      lentDate.getDate(),
      12,
    ).getTime();
    submitting.current = true;
    setError(null);
    try {
      await onSave(amount, description, selectedLentAt);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Chưa ghi được lần cho vay thêm.',
      );
    } finally {
      submitting.current = false;
    }
  }
  return (
    <>
      <LoanDialogOverlay
        onRequestClose={busy ? undefined : onClose}
        datePicker={
          datePickerVisible
            ? {
                title: 'Chọn ngày cho vay',
                selectedDate: lentDate,
                onClose: () => setDatePickerVisible(false),
                onSelect: (date) => {
                  setLentDate(date);
                  setDatePickerVisible(false);
                },
              }
            : undefined
        }
      >
        <ScrollView
          style={styles.dialogScroll}
          contentContainerStyle={styles.dialogForm}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.dialogHeader}>
            <Text accessibilityRole="header" style={styles.dialogTitle}>
              Cho vay thêm
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng cho vay thêm"
              disabled={busy}
              onPress={onClose}
              hitSlop={8}
              style={styles.dialogClose}
            >
              <Feather name="x" size={20} color={colors.earth} />
            </Pressable>
          </View>
          <View style={styles.repaymentSummary}>
            <View style={styles.repaymentBorrowerRow}>
              <Feather name="user" size={16} color={colors.earth} />
              <Text style={styles.repaymentBorrower}>{loan.borrowerName}</Text>
            </View>
            <View style={styles.repaymentBalance}>
              <Text style={styles.repaymentBalanceLabel}>Đang còn nợ</Text>
              <Text style={styles.repaymentBalanceValue}>
                {formatFinanceAmount(outstanding)}
              </Text>
            </View>
          </View>
          <View style={styles.formRow}>
            <View style={[styles.formField, styles.formColumn]}>
              <Text style={styles.fieldLabel}>Số tiền cho vay thêm</Text>
              <AppTextInput
                accessibilityLabel="Số tiền cho vay thêm"
                placeholder="Ví dụ: 500000"
                placeholderTextColor={colors.muted}
                value={amountText}
                onChangeText={(value) => {
                  setAmountText(value.replace(/\D/g, ''));
                  setError(null);
                }}
                keyboardType="number-pad"
                maxLength={16}
                editable={!busy && !restoring && !retrying}
                style={styles.input}
              />
              {amount !== null && (
                <Text style={styles.amountPreview}>
                  {formatFinanceAmount(amount)}
                </Text>
              )}
            </View>
            <View style={[styles.formField, styles.formColumn]}>
              <Text style={styles.fieldLabel}>Ngày cho vay</Text>
              <View style={styles.compactDateField}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ngày cho vay ${formatFinanceDate(lentDate)}`}
                  disabled={busy || restoring || retrying}
                  onPress={() => setDatePickerVisible(true)}
                  style={styles.compactDateButton}
                >
                  <Feather name="calendar" size={16} color={colors.sky} />
                  <Text numberOfLines={1} style={styles.compactDateValue}>
                    {formatFinanceDate(lentDate)}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
          <LoanNoteInputField
            label="Nội dung"
            accessibilityLabel="Nội dung khoản cho vay thêm"
            placeholder="Ví dụ: Mượn mua đồ gia dụng"
            value={note}
            maxLength={120}
            editable={!busy && !restoring && !retrying}
            onChangeText={(value) => {
              setNote(value);
              setError(null);
            }}
          />
          {validAmount && (
            <View style={styles.loanRepaidRow}>
              <Text style={styles.amountLabel}>Còn phải thu sau khi thêm</Text>
              <Text style={styles.loanSecondaryAmount}>
                {formatFinanceAmount(outstanding + amount!)}
              </Text>
            </View>
          )}
          {amount !== null && !validAmount && (
            <Text accessibilityRole="alert" style={styles.error}>
              Tổng tiền vượt giới hạn cho phép.
            </Text>
          )}
          {loan.dueAt !== null && (
            <Text style={styles.meta}>
              Hẹn trả: {formatFinanceDate(new Date(loan.dueAt))}
            </Text>
          )}
          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          {restoring && (
            <Text accessibilityLiveRegion="polite" style={styles.meta}>
              Đang kiểm tra lần cho vay chưa đồng bộ…
            </Text>
          )}
          {retrying && (
            <Text style={styles.meta}>
              Đã khôi phục thông tin lần lưu đang chờ để thử lại an toàn.
            </Text>
          )}
          <Button
            title={retrying ? 'Thử lại lần cho vay' : 'Lưu khoản vay thêm'}
            loading={busy}
            disabled={!canSave || busy || restoring || !note.trim()}
            onPress={() => void submit()}
          />
        </ScrollView>
      </LoanDialogOverlay>
    </>
  );
}

function LoanAdvanceEditDialog({
  loan,
  advance,
  busy,
  onClose,
  onSave,
}: {
  loan: LoanRecord | null;
  advance: LoanAdvance | null;
  busy: boolean;
  onClose: () => void;
  onSave: (amount: number, note: string, lentAt: number) => Promise<void>;
}) {
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [lentDate, setLentDate] = useState(() => new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const visible = loan !== null && advance !== null;

  useEffect(() => {
    if (!loan || !advance) {
      setDatePickerVisible(false);
      return;
    }
    setAmountText(String(advance.amount));
    setNote(advance.note ?? '');
    setLentDate(new Date(advance.lentAt));
    setDatePickerVisible(false);
    setError(null);
  }, [advance, loan]);

  if (!loan || !advance) return null;
  const amount = parseFinanceAmount(amountText);
  const newTotal =
    amount === null ? null : getLoanTotalAmount(loan) - advance.amount + amount;
  const validAmount =
    amount !== null &&
    newTotal !== null &&
    canSetLoanTotalAmount(loan, newTotal);
  const legacyReductionBlocked =
    newTotal !== null &&
    loan.recordedRepaymentAmount === undefined &&
    loan.repayments.length > 0 &&
    newTotal < getLoanTotalAmount(loan);

  async function submit() {
    if (busy || submitting.current || !validAmount || amount === null) return;
    const description = note.trim();
    if (!description) return setError('Nhập nội dung khoản cho vay thêm.');
    const selectedLentAt = new Date(
      lentDate.getFullYear(),
      lentDate.getMonth(),
      lentDate.getDate(),
      12,
    ).getTime();
    submitting.current = true;
    setError(null);
    try {
      await onSave(amount, description, selectedLentAt);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Chưa sửa được lần cho vay thêm.',
      );
    } finally {
      submitting.current = false;
    }
  }

  return (
    <>
      {visible && (
        <LoanDialogOverlay
          onRequestClose={busy ? undefined : onClose}
          datePicker={
            datePickerVisible
              ? {
                  title: 'Chọn ngày cho vay',
                  selectedDate: lentDate,
                  onClose: () => setDatePickerVisible(false),
                  onSelect: (date) => {
                    setLentDate(date);
                    setDatePickerVisible(false);
                  },
                }
              : undefined
          }
        >
          <ScrollView
            style={styles.dialogScroll}
            contentContainerStyle={styles.dialogForm}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.dialogHeader}>
              <Text accessibilityRole="header" style={styles.dialogTitle}>
                Sửa lần cho vay thêm
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng sửa lần cho vay thêm"
                disabled={busy}
                onPress={onClose}
                hitSlop={8}
                style={styles.dialogClose}
              >
                <Feather name="x" size={20} color={colors.earth} />
              </Pressable>
            </View>
            <View style={styles.repaymentSummary}>
              <View style={styles.repaymentBorrowerRow}>
                <Feather name="user" size={16} color={colors.earth} />
                <Text style={styles.repaymentBorrower}>
                  {loan.borrowerName}
                </Text>
              </View>
              <View style={styles.repaymentBalance}>
                <Text style={styles.repaymentBalanceLabel}>Lần cho thêm</Text>
                <Text style={styles.repaymentBalanceValue}>
                  {formatFinanceAmount(advance.amount)}
                </Text>
              </View>
            </View>
            <View style={styles.formRow}>
              <View style={[styles.formField, styles.formColumn]}>
                <Text style={styles.fieldLabel}>Số tiền</Text>
                <AppTextInput
                  accessibilityLabel="Số tiền cho vay thêm"
                  placeholder="Ví dụ: 500000"
                  placeholderTextColor={colors.muted}
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
                {amount !== null && (
                  <Text style={styles.amountPreview}>
                    {formatFinanceAmount(amount)}
                  </Text>
                )}
              </View>
              <View style={[styles.formField, styles.formColumn]}>
                <Text style={styles.fieldLabel}>Ngày cho vay</Text>
                <View style={styles.compactDateField}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Ngày cho vay ${formatFinanceDate(lentDate)}`}
                    disabled={busy}
                    onPress={() => setDatePickerVisible(true)}
                    style={styles.compactDateButton}
                  >
                    <Feather name="calendar" size={16} color={colors.sky} />
                    <Text numberOfLines={1} style={styles.compactDateValue}>
                      {formatFinanceDate(lentDate)}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
            <LoanNoteInputField
              label="Nội dung"
              accessibilityLabel="Nội dung khoản cho vay thêm"
              placeholder="Ví dụ: Mượn mua đồ gia dụng"
              value={note}
              maxLength={120}
              editable={!busy}
              onChangeText={(value) => {
                setNote(value);
                setError(null);
              }}
            />
            {amount !== null && !validAmount && (
              <Text accessibilityRole="alert" style={styles.error}>
                {legacyReductionBlocked
                  ? 'Khoản cũ đã nhận tiền chưa thể giảm tổng cho vay. Bạn vẫn có thể sửa ngày hoặc nội dung.'
                  : 'Số tiền mới không được thấp hơn số đã nhận lại.'}
              </Text>
            )}
            {error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            <Button
              title="Lưu thay đổi"
              loading={busy}
              disabled={!validAmount || !note.trim() || busy}
              onPress={() => void submit()}
            />
          </ScrollView>
        </LoanDialogOverlay>
      )}
    </>
  );
}

function LoanHistory({
  loan,
  canEdit,
  showDeleteLending,
  canDeleteLending,
  deletingInitial,
  deletingAdvanceId,
  canDeleteRepayment,
  deletingRepaymentId,
  onDeleteRepayment,
  onEditRepayment,
  canAddAdvance,
  advanceDisabled,
  advanceLoading,
  onAddAdvance,
  canAddRepayment,
  repaymentDisabled,
  repaymentLoading,
  onAddRepayment,
  onEditPrincipal,
  onDeletePrincipal,
  onEditAdvance,
  onDeleteAdvance,
  onOpenActions,
}: {
  loan: LoanRecord;
  canEdit: boolean;
  showDeleteLending: boolean;
  canDeleteLending: boolean;
  deletingInitial: boolean;
  deletingAdvanceId: string | null;
  canDeleteRepayment: boolean;
  deletingRepaymentId: string | null;
  onDeleteRepayment: (repayment: LoanRepayment) => void;
  onEditRepayment: (repayment: LoanRepayment) => void;
  canAddAdvance: boolean;
  advanceDisabled: boolean;
  advanceLoading: boolean;
  onAddAdvance: () => void;
  canAddRepayment: boolean;
  repaymentDisabled: boolean;
  repaymentLoading: boolean;
  onAddRepayment: () => void;
  onEditPrincipal: () => void;
  onDeletePrincipal: () => void;
  onEditAdvance: (advance: LoanAdvance) => void;
  onDeleteAdvance: (advance: LoanAdvance) => void;
  onOpenActions: (actions: HistoryActions) => void;
}) {
  const lendingEvents = [
    {
      kind: 'initial' as const,
      id: 'initial',
      at: loan.lentAt,
      amount: loan.principalAmount,
    },
    ...(loan.advances ?? []).map((advance) => ({
      kind: 'advance' as const,
      id: advance.id,
      at: advance.lentAt,
      value: advance,
    })),
  ].sort((a, b) => a.at - b.at);
  const repayments = [...loan.repayments].sort(
    (a, b) => a.receivedAt - b.receivedAt,
  );
  return (
    <View style={styles.repaymentList}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyHeading}>Lịch sử khoản vay</Text>
        {canAddAdvance && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Cho vay thêm cho ${loan.borrowerName}`}
            disabled={advanceDisabled}
            onPress={onAddAdvance}
            hitSlop={6}
            style={({ pressed }) => [
              styles.historyAddButton,
              pressed && !advanceDisabled && styles.historyAddButtonPressed,
            ]}
          >
            {advanceLoading ? (
              <ActivityIndicator size="small" color={colors.earth} />
            ) : (
              <Feather name="plus" size={18} color={colors.earth} />
            )}
          </Pressable>
        )}
      </View>
      {lendingEvents.map((event) =>
        event.kind === 'initial' ? (
          <LoanLendingHistoryRow
            key="initial-loan"
            title="Khoản vay ban đầu"
            at={event.at}
            amount={event.amount}
            note={loan.note}
            showEmptyNote
            canEdit={canEdit}
            onEdit={onEditPrincipal}
            showDelete={showDeleteLending}
            canDelete={canDeleteLending}
            deleting={deletingInitial}
            onDelete={onDeletePrincipal}
            onOpenActions={onOpenActions}
          />
        ) : (
          <LoanLendingHistoryRow
            key={`advance-${event.value.id}`}
            title="Khoản vay thêm"
            at={event.at}
            amount={event.value.amount}
            note={event.value.note}
            isAdditional
            canEdit={canEdit}
            onEdit={() => onEditAdvance(event.value)}
            showDelete={showDeleteLending}
            canDelete={canDeleteLending}
            deleting={deletingAdvanceId === event.value.id}
            onDelete={() => onDeleteAdvance(event.value)}
            onOpenActions={onOpenActions}
          />
        ),
      )}
      <View style={styles.repaymentHistorySection}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyHeading}>Lịch sử nhận lại</Text>
          {canAddRepayment && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ghi nhận thêm tiền từ ${loan.borrowerName}`}
              accessibilityState={{ disabled: repaymentDisabled }}
              disabled={repaymentDisabled}
              onPress={onAddRepayment}
              hitSlop={6}
              style={({ pressed }) => [
                styles.historyAddButton,
                pressed && !repaymentDisabled && styles.historyAddButtonPressed,
              ]}
            >
              {repaymentLoading ? (
                <ActivityIndicator size="small" color={colors.earth} />
              ) : (
                <Feather name="plus" size={18} color={colors.earth} />
              )}
            </Pressable>
          )}
        </View>
        {repayments.length === 0 && (
          <Text style={styles.historyEmpty}>Chưa có lần nhận lại.</Text>
        )}
        {repayments.map((repayment) => (
          <RepaymentRow
            key={`repay-${repayment.id}`}
            repayment={repayment}
            canEdit={canDeleteRepayment}
            onEdit={() => onEditRepayment(repayment)}
            canDelete={canDeleteRepayment}
            deleting={deletingRepaymentId === repayment.id}
            onDelete={() => onDeleteRepayment(repayment)}
            onOpenActions={onOpenActions}
          />
        ))}
      </View>
    </View>
  );
}

function LoanLendingHistoryRow({
  title,
  at,
  amount,
  note,
  isAdditional = false,
  showEmptyNote = false,
  canEdit,
  onEdit,
  showDelete,
  canDelete,
  deleting,
  onDelete,
  onOpenActions,
}: {
  title: string;
  at: number;
  amount: number;
  note?: string;
  isAdditional?: boolean;
  showEmptyNote?: boolean;
  canEdit: boolean;
  onEdit: () => void;
  showDelete: boolean;
  canDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
  onOpenActions: (actions: HistoryActions) => void;
}) {
  return (
    <View style={styles.historyAdvance}>
      <View style={styles.historyAdvanceIcon}>
        <Feather
          name={isAdditional ? 'plus' : 'arrow-up-right'}
          size={isAdditional ? 16 : 14}
          color={colors.earth}
        />
      </View>
      <View style={styles.historyAdvanceContent}>
        <Text style={styles.historyAdvanceTitle}>{title}</Text>
        <View style={styles.historyAdvanceDetails}>
          <View style={styles.historyAdvanceDate}>
            <Feather name="calendar" size={12} color={colors.muted} />
            <Text style={styles.historyAdvanceDateText}>
              {formatFinanceDate(new Date(at))}
            </Text>
          </View>
          <Text style={styles.historyAdvanceAmount}>
            {formatFinanceAmount(amount)}
          </Text>
        </View>
        {(!!note || showEmptyNote) && (
          <View style={styles.historyAdvanceNoteRow}>
            <Feather name="file-text" size={12} color={colors.muted} />
            <Text
              numberOfLines={2}
              style={[
                styles.historyAdvanceNote,
                !note && styles.notePlaceholder,
              ]}
            >
              {note || 'Thêm ghi chú ban đầu'}
            </Text>
          </View>
        )}
      </View>
      {(canEdit || showDelete) && (
        <HistoryActionMenu
          title={title}
          description={`${formatFinanceDate(new Date(at))} · ${formatFinanceAmount(amount)}`}
          canEdit={canEdit}
          onEdit={onEdit}
          canDelete={showDelete && canDelete}
          onDelete={onDelete}
          deleting={deleting}
          onOpen={onOpenActions}
        />
      )}
    </View>
  );
}

function RepaymentRow({
  repayment,
  canEdit,
  onEdit,
  canDelete,
  deleting,
  onDelete,
  onOpenActions,
}: {
  repayment: LoanRepayment;
  canEdit: boolean;
  onEdit: () => void;
  canDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
  onOpenActions: (actions: HistoryActions) => void;
}) {
  const isPosted = repayment.status === 'posted';
  return (
    <View
      style={[
        styles.historyAdvance,
        styles.repaymentCard,
        !isPosted && styles.repaymentPendingCard,
      ]}
    >
      <View style={styles.historyAdvanceIcon}>
        <Feather
          name={isPosted ? 'check' : 'clock'}
          size={16}
          color={isPosted ? colors.success : colors.sunlight}
        />
      </View>
      <View style={styles.historyAdvanceContent}>
        <Text numberOfLines={1} style={styles.repaymentDate}>
          {formatFinanceDate(new Date(repayment.receivedAt))}
        </Text>
        {!isPosted && (
          <Text style={[styles.historyAdvanceDateText, styles.pendingText]}>
            Chờ ghi Tài chính
          </Text>
        )}
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[styles.repaymentAmount, !isPosted && styles.pendingText]}
      >
        {formatFinanceAmount(repayment.amount)}
      </Text>
      {isPosted && (
        <HistoryActionMenu
          title="Lần đã nhận"
          description={`${formatFinanceDate(new Date(repayment.receivedAt))} · ${formatFinanceAmount(repayment.amount)}`}
          canEdit={canEdit}
          onEdit={onEdit}
          canDelete={canDelete}
          onDelete={onDelete}
          deleting={deleting}
          onOpen={onOpenActions}
        />
      )}
    </View>
  );
}

function HistoryActionMenu({
  title,
  description,
  canEdit,
  onEdit,
  canDelete,
  onDelete,
  deleting,
  onOpen,
}: {
  title: string;
  description: string;
  canEdit: boolean;
  onEdit: () => void;
  canDelete: boolean;
  onDelete: () => void;
  deleting: boolean;
  onOpen: (actions: HistoryActions) => void;
}) {
  const disabled = deleting || (!canEdit && !canDelete);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Tùy chọn ${title.toLocaleLowerCase('vi')}, ${description}`}
      accessibilityHint={
        canEdit && canDelete
          ? 'Mở lựa chọn sửa hoặc xóa'
          : canEdit
            ? 'Mở lựa chọn sửa'
            : 'Mở lựa chọn xóa'
      }
      accessibilityState={{ disabled, busy: deleting }}
      disabled={disabled}
      hitSlop={10}
      onPress={() =>
        onOpen({ title, description, canEdit, onEdit, canDelete, onDelete })
      }
      style={({ pressed }) => [
        styles.historyActionButton,
        disabled && styles.historyActionButtonDisabled,
        pressed && !disabled && styles.historyActionButtonPressed,
      ]}
    >
      {deleting ? (
        <ActivityIndicator size="small" color={colors.earth} />
      ) : (
        <Feather name="more-vertical" size={17} color={colors.muted} />
      )}
    </Pressable>
  );
}

function HistoryActionsOverlay({
  actions,
  bottomInset,
  onClose,
}: {
  actions: HistoryActions;
  bottomInset: number;
  onClose: () => void;
}) {
  const { bottom } = useSafeAreaInsets();
  function select(action: () => void) {
    onClose();
    requestAnimationFrame(action);
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View accessibilityViewIsModal style={styles.historyActionOverlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng lựa chọn thao tác"
          onPress={onClose}
          style={StyleSheet.absoluteFillObject}
        />
        <View
          style={[
            styles.historyActionSheet,
            { paddingBottom: Math.max(bottomInset, bottom, 16) },
          ]}
        >
          <View style={styles.historyActionSheetHeader}>
            <View style={styles.historyActionSheetHeading}>
              <Text
                accessibilityRole="header"
                style={styles.historyActionTitle}
              >
                {actions.title}
              </Text>
              <Text style={styles.historyActionDescription}>
                {actions.description}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng lựa chọn thao tác"
              hitSlop={8}
              onPress={onClose}
              style={styles.historyActionClose}
            >
              <Feather name="x" size={18} color={colors.muted} />
            </Pressable>
          </View>
          <View style={styles.historyActionDivider} />
          <View style={styles.historyActionOptions}>
            {actions.canEdit && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Sửa ${actions.title.toLocaleLowerCase('vi')}`}
                onPress={() => select(actions.onEdit)}
                style={({ pressed }) => [
                  styles.historyActionOption,
                  styles.historyActionEditOption,
                  pressed && styles.historyActionOptionPressed,
                ]}
              >
                <Feather name="edit-2" size={17} color={colors.earth} />
                <Text style={styles.historyActionOptionText}>Sửa</Text>
              </Pressable>
            )}
            {actions.canDelete && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Xóa ${actions.title.toLocaleLowerCase('vi')}`}
                onPress={() => select(actions.onDelete)}
                style={({ pressed }) => [
                  styles.historyActionOption,
                  styles.historyActionDeleteOption,
                  pressed && styles.historyActionOptionPressed,
                ]}
              >
                <Feather name="trash-2" size={17} color={colors.danger} />
                <Text
                  style={[
                    styles.historyActionOptionText,
                    styles.historyActionDeleteText,
                  ]}
                >
                  Xóa
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function LoanRepaymentEditDialog({
  loan,
  repayment,
  busy,
  onClose,
  onSave,
}: {
  loan: LoanRecord | null;
  repayment: LoanRepayment | null;
  busy: boolean;
  onClose: () => void;
  onSave: (amount: number, receivedAt: number) => Promise<void>;
}) {
  const [amountText, setAmountText] = useState('');
  const [receivedDate, setReceivedDate] = useState(() => new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    setAmountText(repayment ? String(repayment.amount) : '');
    setReceivedDate(repayment ? new Date(repayment.receivedAt) : new Date());
    setDatePickerVisible(false);
    setError(null);
  }, [repayment]);

  if (!loan || !repayment) return null;
  const editingRepayment = repayment;
  const amount = parseFinanceAmount(amountText);
  const otherReceived = loan.repayments
    .filter(({ id }) => id !== repayment.id)
    .reduce((total, item) => total + item.amount, 0);
  const maxAmount = getLoanTotalAmount(loan) - otherReceived;
  const validAmount =
    amount !== null &&
    amount <= maxAmount &&
    (loan.recordedRepaymentAmount !== undefined || amount <= repayment.amount);

  async function submit() {
    if (busy || submitting.current || !validAmount || amount === null) return;
    setError(null);
    submitting.current = true;
    try {
      const original = new Date(editingRepayment.receivedAt);
      const receivedAt =
        receivedDate.getFullYear() === original.getFullYear() &&
        receivedDate.getMonth() === original.getMonth() &&
        receivedDate.getDate() === original.getDate()
          ? editingRepayment.receivedAt
          : new Date(
              receivedDate.getFullYear(),
              receivedDate.getMonth(),
              receivedDate.getDate(),
              12,
            ).getTime();
      await onSave(amount, receivedAt);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Chưa sửa được lần nhận lại.',
      );
    } finally {
      submitting.current = false;
    }
  }

  return (
    <>
      <LoanDialogOverlay
        onRequestClose={busy ? undefined : onClose}
        datePicker={
          datePickerVisible
            ? {
                title: 'Chọn ngày nhận',
                selectedDate: receivedDate,
                onClose: () => setDatePickerVisible(false),
                onSelect: (date) => {
                  setReceivedDate(date);
                  setDatePickerVisible(false);
                },
              }
            : undefined
        }
      >
        <ScrollView
          style={styles.dialogScroll}
          contentContainerStyle={styles.dialogForm}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.dialogHeader}>
            <Text accessibilityRole="header" style={styles.dialogTitle}>
              Sửa lần nhận lại
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng sửa lần nhận lại"
              disabled={busy}
              onPress={onClose}
              hitSlop={8}
              style={styles.dialogClose}
            >
              <Feather name="x" size={20} color={colors.earth} />
            </Pressable>
          </View>
          <View style={styles.formRow}>
            <View style={[styles.formField, styles.formColumn]}>
              <Text style={styles.fieldLabel}>Số tiền đã nhận</Text>
              <AppTextInput
                accessibilityLabel="Số tiền đã nhận"
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
              {amount !== null && (
                <Text style={styles.amountPreview}>
                  {formatFinanceAmount(amount)}
                </Text>
              )}
            </View>
            <View style={[styles.formField, styles.formColumn]}>
              <Text style={styles.fieldLabel}>Ngày nhận</Text>
              <View style={styles.compactDateField}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ngày nhận ${formatFinanceDate(receivedDate)}`}
                  disabled={busy}
                  onPress={() => setDatePickerVisible(true)}
                  style={styles.compactDateButton}
                >
                  <Feather name="calendar" size={16} color={colors.sky} />
                  <Text numberOfLines={1} style={styles.compactDateValue}>
                    {formatFinanceDate(receivedDate)}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
          {amount !== null && !validAmount && (
            <Text accessibilityRole="alert" style={styles.error}>
              {amount > maxAmount
                ? 'Tổng đã nhận không được vượt quá tổng đã cho vay.'
                : 'Khoản cũ chỉ có thể giữ nguyên hoặc giảm số tiền đã nhận.'}
            </Text>
          )}
          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          <Button
            title="Lưu lần nhận lại"
            loading={busy}
            disabled={!validAmount || busy}
            onPress={() => void submit()}
          />
        </ScrollView>
      </LoanDialogOverlay>
    </>
  );
}

function LoanFormDialog({
  visible,
  uid,
  loans,
  loading,
  onClose,
  onSave,
  onRecordAdvance,
}: {
  visible: boolean;
  uid: string | null;
  loans: LoanRecord[];
  loading: boolean;
  onClose: () => void;
  onSave: (
    loan: LoanRecord,
    requestReminderPermission?: boolean,
  ) => Promise<void>;
  onRecordAdvance: (
    loanId: string,
    amount: number,
    note: string,
    lentAt: number,
  ) => Promise<void>;
}) {
  const [borrowerName, setBorrowerName] = useState('');
  const [entryMode, setEntryMode] = useState<LoanEntryMode>('new');
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [advanceNote, setAdvanceNote] = useState('');
  const [advanceDate, setAdvanceDate] = useState(() => new Date());
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [remind, setRemind] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringAdvance, setRestoringAdvance] = useState(false);
  const [restoringLoan, setRestoringLoan] = useState(false);
  const [retryingLoan, setRetryingLoan] = useState(false);
  const [retryingAdvanceId, setRetryingAdvanceId] = useState<string | null>(
    null,
  );
  const submitting = useRef(false);
  const pendingLoanAttempt = useRef<LoanRecord | null>(null);
  const latestLoans = useRef(loans);
  latestLoans.current = loans;
  const selectedLoan = loans.find(
    (loan) =>
      loan.id === selectedLoanId &&
      loan.ownerId === uid &&
      loanBorrowerKey(loan.borrowerName) === loanBorrowerKey(borrowerName) &&
      getLoanStatus(loan) === 'open',
  );
  useEffect(() => {
    let active = true;
    setRetryingAdvanceId(null);
    if (entryMode !== 'advance' || !uid || !selectedLoanId) {
      setRestoringAdvance(false);
      return () => {
        active = false;
      };
    }
    setRestoringAdvance(true);
    void getPendingAdvanceAttempt(uid, selectedLoanId, selectedLoan?.advances)
      .then((attempt) => {
        if (!active || !attempt) return;
        setAmountText(String(attempt.amount));
        setAdvanceNote(attempt.note ?? '');
        setAdvanceDate(new Date(attempt.lentAt));
        setRetryingAdvanceId(selectedLoanId);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setRestoringAdvance(false);
      });
    return () => {
      active = false;
    };
  }, [uid, entryMode, selectedLoanId, selectedLoan?.advances]);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setBorrowerName('');
    setEntryMode('new');
    setSelectedLoanId(null);
    setAmountText('');
    setNote('');
    setAdvanceNote('');
    setAdvanceDate(new Date());
    setDueDate(null);
    setDatePickerVisible(false);
    setRemind(false);
    setError(null);
    setRetryingLoan(false);
    pendingLoanAttempt.current = null;
    setRestoringLoan(!!uid);
    if (uid) {
      void getPendingNewLoanAttempt(uid, latestLoans.current)
        .then((attempt) => {
          if (!active || !attempt) return;
          setBorrowerName(attempt.borrowerName);
          setAmountText(String(attempt.principalAmount));
          setNote(attempt.note);
          setDueDate(attempt.dueAt === null ? null : new Date(attempt.dueAt));
          setRemind(attempt.remindOnDueDate);
          setRetryingLoan(true);
          pendingLoanAttempt.current = attempt;
        })
        .catch(() => {
          if (active) setError('Chưa kiểm tra được khoản cho vay đang chờ.');
        })
        .finally(() => {
          if (active) setRestoringLoan(false);
        });
    }
    return () => {
      active = false;
    };
  }, [visible, uid]);

  function reset() {
    setBorrowerName('');
    setEntryMode('new');
    setSelectedLoanId(null);
    setAmountText('');
    setNote('');
    setAdvanceNote('');
    setAdvanceDate(new Date());
    setDueDate(null);
    setDatePickerVisible(false);
    setRemind(false);
    setError(null);
    setRetryingLoan(false);
    pendingLoanAttempt.current = null;
  }

  async function submit() {
    if (saving || submitting.current || loading || restoringLoan) return;
    const borrower = borrowerName.trim();
    const amount = parseFinanceAmount(amountText);
    if (!borrower) return setError('Nhập tên người vay.');
    if (borrower.length > 100)
      return setError('Tên người vay tối đa 100 ký tự.');
    if (amount === null)
      return setError('Nhập số tiền là số nguyên lớn hơn 0.');
    if (!uid) return setError('Bạn cần đăng nhập để lưu khoản cho vay.');
    if (entryMode === 'advance') {
      if (!selectedLoan)
        return setError('Chọn khoản còn nợ muốn cộng thêm tiền.');
      if (getLoanPendingAmount(selectedLoan) > 0)
        return setError(
          'Đồng bộ lần nhận tiền đang chờ trước khi cho vay thêm.',
        );
      if (!Number.isSafeInteger(getLoanTotalAmount(selectedLoan) + amount))
        return setError('Tổng tiền cho vay vượt giới hạn cho phép.');
      const description = advanceNote.trim();
      if (!description) return setError('Nhập nội dung khoản cho vay thêm.');
      const lentAt = new Date(
        advanceDate.getFullYear(),
        advanceDate.getMonth(),
        advanceDate.getDate(),
        12,
      ).getTime();
      submitting.current = true;
      setSaving(true);
      setError(null);
      try {
        await onRecordAdvance(selectedLoan.id, amount, description, lentAt);
        reset();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Chưa lưu được lần cho vay thêm.',
        );
      } finally {
        submitting.current = false;
        setSaving(false);
      }
      return;
    }
    if (!note.trim()) return setError('Nhập nội dung khoản cho vay.');
    if (note.trim().length > 500) return setError('Nội dung tối đa 500 ký tự.');
    if (remind && !dueDate)
      return setError('Chọn ngày hẹn trả trước khi bật nhắc.');
    const dueAt = dueDate
      ? new Date(
          dueDate.getFullYear(),
          dueDate.getMonth(),
          dueDate.getDate(),
          12,
        ).getTime()
      : null;
    const trimmedNote = note.trim();
    const lentAt = Date.now();
    const proposed: LoanRecord = pendingLoanAttempt.current ?? {
      id: newId(),
      ownerId: uid,
      borrowerName: borrower,
      principalAmount: amount,
      recordedRepaymentAmount: 0,
      lentAt,
      dueAt,
      remindOnDueDate: remind,
      note: trimmedNote,
      repayments: [],
      cancelledAt: null,
      updatedAt: lentAt,
    };
    submitting.current = true;
    setSaving(true);
    setError(null);
    let reserved = false;
    try {
      const loan = await reserveNewLoanAttempt(uid, proposed);
      reserved = true;
      pendingLoanAttempt.current = loan;
      setRetryingLoan(true);
      await onSave(loan);
      reset();
    } catch (cause) {
      if (reserved && cause instanceof LoanDataConflictError) {
        pendingLoanAttempt.current = null;
        setRetryingLoan(false);
      }
      setError(
        cause instanceof Error ? cause.message : 'Chưa lưu được khoản cho vay.',
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  const amountPreview = parseFinanceAmount(amountText);
  const addingToExisting = entryMode === 'advance';
  const amountLabel = addingToExisting
    ? 'Số tiền cho vay thêm'
    : 'Số tiền đã cho vay';
  const outstandingAfter =
    selectedLoan &&
    amountPreview !== null &&
    Number.isSafeInteger(getLoanTotalAmount(selectedLoan) + amountPreview)
      ? getLoanOutstandingAmount(selectedLoan) + amountPreview
      : null;
  const existingBorrower = loans.some(
    (loan) =>
      loanBorrowerKey(loan.borrowerName) === loanBorrowerKey(borrowerName),
  );
  const formDate = addingToExisting ? advanceDate : dueDate;
  const retryingAdvance =
    selectedLoanId !== null && retryingAdvanceId === selectedLoanId;

  return (
    <>
      {visible && (
        <LoanDialogOverlay
          dialogStyle={styles.loanFormDialog}
          onRequestClose={saving ? undefined : onClose}
          datePicker={
            datePickerVisible
              ? {
                  title: addingToExisting
                    ? 'Chọn ngày cho vay'
                    : 'Chọn ngày hẹn trả',
                  selectedDate: formDate,
                  onClose: () => setDatePickerVisible(false),
                  onSelect: (date) => {
                    if (addingToExisting) setAdvanceDate(date);
                    else setDueDate(date);
                    setDatePickerVisible(false);
                  },
                }
              : undefined
          }
        >
          <ScrollView
            style={styles.dialogScroll}
            contentContainerStyle={styles.dialogForm}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.dialogHeader}>
              <Text accessibilityRole="header" style={styles.dialogTitle}>
                {addingToExisting ? 'Cho vay thêm' : 'Khoản cho vay mới'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng form khoản cho vay"
                disabled={saving}
                onPress={onClose}
                hitSlop={8}
                style={styles.dialogClose}
              >
                <Feather name="x" size={20} color={colors.earth} />
              </Pressable>
            </View>
            <LoanBorrowerPicker
              loans={loans}
              name={borrowerName}
              mode={entryMode}
              selectedLoanId={selectedLoanId}
              disabled={saving || restoringLoan || retryingLoan}
              loading={loading}
              onNameChange={(name) => {
                setBorrowerName(name);
                setEntryMode('new');
                setSelectedLoanId(null);
                setRetryingAdvanceId(null);
                setError(null);
              }}
              onModeChange={(mode) => {
                setEntryMode(mode);
                setError(null);
              }}
              onLoanSelect={(id) => {
                setSelectedLoanId(id);
                setError(null);
              }}
            />
            <View style={styles.formRow}>
              <View style={[styles.formField, styles.formColumn]}>
                <Text style={styles.fieldLabel}>{amountLabel}</Text>
                <AppTextInput
                  accessibilityLabel={amountLabel}
                  placeholder="Ví dụ: 500000"
                  placeholderTextColor={colors.muted}
                  value={amountText}
                  editable={
                    !saving &&
                    !restoringLoan &&
                    !retryingLoan &&
                    !retryingAdvance
                  }
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
                  <Text style={styles.fieldLabel}>
                    {addingToExisting ? 'Ngày cho vay' : 'Ngày hẹn trả'}
                  </Text>
                  {!addingToExisting && (
                    <Text style={styles.optionalLabel}>Tùy chọn</Text>
                  )}
                </View>
                <View style={styles.compactDateField}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={
                      saving ||
                      restoringLoan ||
                      retryingLoan ||
                      (addingToExisting &&
                        (restoringAdvance || retryingAdvance))
                    }
                    accessibilityLabel={
                      formDate
                        ? `${addingToExisting ? 'Ngày cho vay' : 'Ngày hẹn trả'} ${formatFinanceDate(formDate)}`
                        : 'Chọn ngày hẹn trả'
                    }
                    onPress={() => {
                      setDatePickerVisible(true);
                    }}
                    style={styles.compactDateButton}
                  >
                    <Feather name="calendar" size={16} color={colors.sky} />
                    <Text numberOfLines={1} style={styles.compactDateValue}>
                      {formDate ? formatFinanceDate(formDate) : 'Chọn ngày'}
                    </Text>
                  </Pressable>
                  {!addingToExisting && dueDate && (
                    <Pressable
                      accessibilityRole="button"
                      disabled={saving || restoringLoan || retryingLoan}
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
            {!addingToExisting && (
              <>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel="Nhắc vào ngày hẹn trả"
                  accessibilityState={{
                    checked: remind,
                    disabled:
                      saving ||
                      restoringLoan ||
                      retryingLoan ||
                      dueDate === null,
                  }}
                  disabled={
                    saving || restoringLoan || retryingLoan || dueDate === null
                  }
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
                <LoanNoteInputField
                  label="Nội dung"
                  accessibilityLabel="Nội dung khoản cho vay"
                  placeholder="Ví dụ: Mượn tiền đóng học phí"
                  value={note}
                  maxLength={500}
                  editable={!saving && !restoringLoan && !retryingLoan}
                  onChangeText={setNote}
                />
              </>
            )}
            {addingToExisting && (
              <LoanNoteInputField
                label="Nội dung"
                accessibilityLabel="Nội dung khoản cho vay thêm"
                placeholder="Ví dụ: Mượn mua đồ gia dụng"
                value={advanceNote}
                maxLength={120}
                editable={!saving && !retryingAdvance}
                onChangeText={(value) => {
                  setAdvanceNote(value);
                  setError(null);
                }}
              />
            )}
            {addingToExisting && selectedLoan && (
              <View style={styles.formField}>
                {outstandingAfter !== null && (
                  <View style={styles.advancePreview}>
                    <Text style={styles.meta}>Còn phải thu sau khi cộng</Text>
                    <Text style={styles.repaymentBalanceValue}>
                      {formatFinanceAmount(outstandingAfter)}
                    </Text>
                  </View>
                )}
                <Text style={styles.meta}>
                  Giữ hạn trả
                  {selectedLoan.dueAt === null
                    ? ' chưa đặt'
                    : ` ${formatFinanceDate(new Date(selectedLoan.dueAt))}`}
                  , ghi chú và cài đặt nhắc của khoản đã chọn.
                </Text>
              </View>
            )}
            {error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            {restoringAdvance && addingToExisting && (
              <Text accessibilityLiveRegion="polite" style={styles.meta}>
                Đang kiểm tra lần cho vay chưa đồng bộ…
              </Text>
            )}
            {retryingAdvance && (
              <Text style={styles.meta}>
                Đã khôi phục thông tin lần lưu đang chờ để thử lại an toàn.
              </Text>
            )}
            {retryingLoan && !addingToExisting && (
              <Text style={styles.meta}>
                Đã khôi phục lần lưu đang chờ. Thử lại để xác nhận, tránh tạo
                trùng khoản vay.
              </Text>
            )}
            {!addingToExisting && (
              <Text style={styles.meta}>
                Tiền cho vay sẽ được ghi thành khoản chi trong Tài chính.
              </Text>
            )}
            <Button
              title={
                addingToExisting
                  ? retryingAdvance
                    ? 'Thử lại lần cho vay'
                    : 'Lưu vào khoản đã chọn'
                  : retryingLoan
                    ? 'Thử lại khoản cho vay'
                    : existingBorrower
                      ? 'Tạo khoản riêng'
                      : 'Lưu khoản cho vay'
              }
              loading={saving}
              disabled={
                loading ||
                restoringLoan ||
                restoringAdvance ||
                (addingToExisting ? !advanceNote.trim() : !note.trim())
              }
              onPress={() => void submit()}
              compact
            />
          </ScrollView>
        </LoanDialogOverlay>
      )}
    </>
  );
}

function LoanDialogOverlay({
  children,
  onRequestClose,
  dialogStyle,
  overlayStyle,
  datePicker,
}: {
  children: ReactNode;
  onRequestClose?: () => void;
  dialogStyle?: StyleProp<ViewStyle>;
  overlayStyle?: StyleProp<ViewStyle>;
  datePicker?: {
    title: string;
    selectedDate: Date | null;
    onClose: () => void;
    onSelect: (date: Date) => void;
  };
}) {
  const close = datePicker?.onClose ?? onRequestClose;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        style={[styles.overlay, overlayStyle, datePicker && styles.dateOverlay]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng hộp thoại"
          disabled={!close}
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[styles.dialog, dialogStyle, datePicker && styles.dateDialog]}
          accessibilityViewIsModal
        >
          {datePicker ? <LoanDatePickerDialog {...datePicker} /> : children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function LoanNoteInputField({
  label,
  accessibilityLabel,
  placeholder,
  value,
  maxLength,
  editable,
  onChangeText,
}: {
  label: string;
  accessibilityLabel: string;
  placeholder: string;
  value: string;
  maxLength: number;
  editable: boolean;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.formField}>
      <View style={styles.fieldHeading}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.optionalLabel}>Bắt buộc</Text>
      </View>
      <View style={styles.noteInputContainer}>
        <AppTextInput
          accessibilityLabel={accessibilityLabel}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          value={value}
          onChangeText={onChangeText}
          maxLength={maxLength}
          multiline
          textAlignVertical="top"
          editable={editable}
          style={styles.noteTextInput}
        />
        <Text pointerEvents="none" style={styles.noteCharacterCount}>
          {value.length}/{maxLength}
        </Text>
      </View>
    </View>
  );
}

function LoanDatePickerDialog({
  title,
  selectedDate,
  onClose,
  onSelect,
}: {
  title: string;
  selectedDate: Date | null;
  onClose: () => void;
  onSelect: (date: Date) => void;
}) {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = selectedDate ?? new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
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
    const date = selectedDate ?? new Date();
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }, [selectedDate]);
  const today = new Date();
  return (
    <>
      <View style={styles.dialogHeader}>
        <Text accessibilityRole="header" style={styles.dialogTitle}>
          {title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng chọn ngày"
          onPress={onClose}
          hitSlop={8}
          style={styles.dialogClose}
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
              (month) => new Date(month.getFullYear(), month.getMonth() - 1, 1),
            )
          }
          style={styles.calendarMonthButton}
        >
          <Feather name="chevron-left" size={19} color={colors.earth} />
        </Pressable>
        <Text style={styles.calendarMonthTitle}>
          Tháng {visibleMonth.getMonth() + 1} năm {visibleMonth.getFullYear()}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tháng sau"
          onPress={() =>
            setVisibleMonth(
              (month) => new Date(month.getFullYear(), month.getMonth() + 1, 1),
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
            return <View key={`empty-${index}`} style={styles.calendarDay} />;
          const selected =
            selectedDate?.getFullYear() === date.getFullYear() &&
            selectedDate.getMonth() === date.getMonth() &&
            selectedDate.getDate() === date.getDate();
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
              onPress={() => onSelect(date)}
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
    </>
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

function LoanPrincipalEditDialog({
  loan,
  busy,
  onClose,
  onSave,
}: {
  loan: LoanRecord | null;
  busy: boolean;
  onClose: () => void;
  onSave: (amount: number, note: string, lentAt: number) => Promise<void>;
}) {
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [lentDate, setLentDate] = useState(() => new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    setAmountText(loan ? String(loan.principalAmount) : '');
    setNote(loan?.note ?? '');
    setLentDate(loan ? new Date(loan.lentAt) : new Date());
    setDatePickerVisible(false);
    setError(null);
  }, [loan]);

  if (!loan) return null;
  const amount = parseFinanceAmount(amountText);
  const totalAmount =
    amount === null ? null : amount + (loan.additionalAmount ?? 0);
  const validAmount =
    amount !== null &&
    totalAmount !== null &&
    canSetLoanTotalAmount(loan, totalAmount);
  const legacyReductionBlocked =
    totalAmount !== null &&
    loan.recordedRepaymentAmount === undefined &&
    loan.repayments.length > 0 &&
    totalAmount < getLoanTotalAmount(loan);

  async function submit() {
    if (busy || submitting.current || !validAmount || amount === null) return;
    if (!note.trim()) return setError('Nhập nội dung khoản cho vay ban đầu.');
    setError(null);
    submitting.current = true;
    try {
      const selectedLentAt = new Date(
        lentDate.getFullYear(),
        lentDate.getMonth(),
        lentDate.getDate(),
        12,
      ).getTime();
      await onSave(amount, note.trim(), selectedLentAt);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Chưa sửa được khoản cho vay ban đầu.',
      );
    } finally {
      submitting.current = false;
    }
  }

  return (
    <>
      <LoanDialogOverlay
        onRequestClose={busy ? undefined : onClose}
        datePicker={
          datePickerVisible
            ? {
                title: 'Chọn ngày cho vay',
                selectedDate: lentDate,
                onClose: () => setDatePickerVisible(false),
                onSelect: (date) => {
                  setLentDate(date);
                  setDatePickerVisible(false);
                },
              }
            : undefined
        }
      >
        <ScrollView
          style={styles.dialogScroll}
          contentContainerStyle={styles.dialogForm}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.dialogHeader}>
            <Text accessibilityRole="header" style={styles.dialogTitle}>
              Sửa khoản cho vay ban đầu
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng sửa khoản cho vay ban đầu"
              disabled={busy}
              onPress={onClose}
              hitSlop={8}
              style={styles.dialogClose}
            >
              <Feather name="x" size={20} color={colors.earth} />
            </Pressable>
          </View>
          <View style={styles.repaymentSummary}>
            <View style={styles.repaymentBorrowerRow}>
              <Feather name="user" size={16} color={colors.earth} />
              <Text numberOfLines={1} style={styles.repaymentBorrower}>
                {loan.borrowerName}
              </Text>
            </View>
            <View style={styles.repaymentBalance}>
              <Text style={styles.repaymentBalanceLabel}>Ban đầu</Text>
              <Text style={styles.repaymentBalanceValue}>
                {formatFinanceAmount(loan.principalAmount)}
              </Text>
            </View>
          </View>
          <View style={styles.formRow}>
            <View style={[styles.formField, styles.formColumn]}>
              <Text style={styles.fieldLabel}>Số tiền ban đầu</Text>
              <AppTextInput
                accessibilityLabel="Số tiền cho vay ban đầu"
                placeholder="Ví dụ: 500000"
                placeholderTextColor={colors.muted}
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
              {amount !== null && (
                <Text style={styles.amountPreview}>
                  {formatFinanceAmount(amount)}
                </Text>
              )}
            </View>
            <View style={[styles.formField, styles.formColumn]}>
              <Text style={styles.fieldLabel}>Ngày cho vay</Text>
              <View style={styles.compactDateField}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ngày cho vay ${formatFinanceDate(lentDate)}`}
                  disabled={busy}
                  onPress={() => setDatePickerVisible(true)}
                  style={styles.compactDateButton}
                >
                  <Feather name="calendar" size={16} color={colors.sky} />
                  <Text numberOfLines={1} style={styles.compactDateValue}>
                    {formatFinanceDate(lentDate)}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
          <LoanNoteInputField
            label="Nội dung"
            accessibilityLabel="Nội dung khoản cho vay ban đầu"
            placeholder="Ví dụ: Mượn tiền đóng học phí"
            value={note}
            maxLength={500}
            editable={!busy}
            onChangeText={(value) => {
              setNote(value);
              setError(null);
            }}
          />
          {amount !== null && !validAmount && (
            <Text accessibilityRole="alert" style={styles.error}>
              {legacyReductionBlocked
                ? 'Khoản cũ đã nhận tiền chưa thể giảm tổng cho vay. Bạn vẫn có thể sửa ngày hoặc nội dung.'
                : 'Số tiền mới không được thấp hơn số đã nhận lại.'}
            </Text>
          )}
          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          <Button
            title="Lưu thay đổi"
            loading={busy}
            disabled={!validAmount || !note.trim() || busy}
            onPress={() => void submit()}
          />
        </ScrollView>
      </LoanDialogOverlay>
    </>
  );
}
