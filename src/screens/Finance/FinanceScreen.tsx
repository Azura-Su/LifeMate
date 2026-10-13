import Feather from '@expo/vector-icons/Feather';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { AppTextInput as TextInput } from '../../components/AppTextInput';
import { Screen } from '../../components/Screen';
import { colors, typography } from '../../theme';
import {
  filterFinanceTransactions,
  formatFinanceAmount,
  formatFinanceDate,
  getFinanceTransactionCategoryLabel,
} from '../../utils/finance';
import type {
  RegularFinanceIncomeSource,
  FinanceTransaction,
  FinanceTransactionType,
} from '../../types/finance';
import { isLoanLedgerTransaction } from '../../types/finance';
import { useLoanLedger } from '../../hooks/useLoanLedger';
import { useHeldMoneyLedger } from '../../hooks/useHeldMoneyLedger';
import { useFinanceStore } from '../../store/financeStore';
import { FinanceMonthSection } from './FinanceMonthSection';
import { FinanceTransactionRow } from './FinanceTransactionRow';
import {
  FinanceCategoryReport,
  type FinanceIncomeSourceFilter,
  type FinancePeriodMode,
  type FinanceReportPoint,
} from './FinanceCategoryReport';
import { FinanceCategoryReportControls } from './FinanceCategoryReportControls';
import { FinancePeriodSelector } from './FinancePeriodSelector';
import { FinanceTransactionDialog } from './FinanceTransactionDialog';
import { LoanLedgerModal } from './LoanLedgerModal';
import { HeldMoneyLedger } from './HeldMoneyLedger';
import { styles } from './FinanceScreen.styles';
import { useFinanceScreen } from './useFinanceScreen';

const reportTabs = [
  {
    value: 'overview',
    label: 'Thu chi',
    accessibilityLabel: 'Tổng quan thu chi',
  },
  {
    value: 'income',
    label: 'Thu nhập',
    accessibilityLabel: 'Báo cáo thu nhập',
  },
  {
    value: 'expense',
    label: 'Chi tiêu',
    accessibilityLabel: 'Báo cáo chi tiêu',
  },
  {
    value: 'loans',
    label: 'Sổ cho vay',
    accessibilityLabel: 'Sổ cho vay',
  },
  {
    value: 'held',
    label: 'Đóng hộ',
    accessibilityLabel: 'Sổ đóng hộ',
  },
] as const;

export function FinanceScreen({ suspended = false }: { suspended?: boolean }) {
  const model = useFinanceScreen();
  const loanLedger = useLoanLedger(model.uid);
  const loansById = useMemo(
    () => new Map(loanLedger.loans.map((loan) => [loan.id, loan])),
    [loanLedger.loans],
  );
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const refreshRequest = useRef<object | null>(null);
  const feedbackError = refreshError ?? model.error;

  useEffect(() => {
    refreshRequest.current = null;
    setRefreshing(false);
    setRefreshError(null);
    return () => {
      refreshRequest.current = null;
    };
  }, [model.uid, suspended]);

  async function refreshFinance() {
    if (
      refreshRequest.current ||
      !model.uid ||
      suspended ||
      (reportMode !== 'held' && model.loading)
    )
      return;
    const request = {};
    refreshRequest.current = request;
    setRefreshing(true);
    setRefreshError(null);
    try {
      if (reportMode === 'held') {
        await heldLedger.load();
        return;
      }
      const [financeResult, loanResult] = await Promise.allSettled([
        model.refresh(),
        loanLedger.load(),
      ]);
      const finance = useFinanceStore.getState();
      if (
        financeResult.status === 'rejected' ||
        loanResult.status === 'rejected' ||
        !loanResult.value ||
        finance.uid !== model.uid ||
        finance.syncStatus !== 'synced' ||
        finance.error
      )
        throw new Error('Refresh failed');
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

  function openFinanceConflict() {
    const conflict = model.conflicts[0];
    if (!conflict || !model.uid) return;
    const uid = model.uid;
    const describe = (item: FinanceTransaction) =>
      `${item.category} · ${formatFinanceAmount(item.amount)} · ${formatFinanceDate(new Date(item.createdAt))}${item.note ? `\n${item.note}` : ''}`;
    Alert.alert(
      'Giao dịch thay đổi ở hai nơi',
      `Trên thiết bị:\n${describe(conflict.local)}\n\nTrên tài khoản:\n${conflict.remote ? describe(conflict.remote) : 'Đã xóa'}\n\nChọn bản muốn giữ.`,
      [
        { text: 'Để sau', style: 'cancel' },
        {
          text: 'Giữ bản tài khoản',
          onPress: () =>
            void model
              .resolveConflict(uid, conflict, 'server')
              .catch(() => undefined),
        },
        {
          text: 'Giữ bản thiết bị',
          onPress: () =>
            void model
              .resolveConflict(uid, conflict, 'local')
              .catch(() => undefined),
        },
      ],
    );
  }
  const correctableDeletedLoanIds = useMemo(
    () => new Set(loanLedger.correctableDeletedLoanIds),
    [loanLedger.correctableDeletedLoanIds],
  );
  const canDeleteLinkedExpense = useCallback(
    (transaction: FinanceTransaction) =>
      !loanLedger.loading &&
      transaction.expenseSource === 'loan_lending' &&
      !!transaction.loanId &&
      correctableDeletedLoanIds.has(transaction.loanId),
    [correctableDeletedLoanIds, loanLedger.loading],
  );
  const currentDate = new Date();
  const [reportMode, setReportMode] = useState<
    'overview' | 'income' | 'expense' | 'loans' | 'held'
  >('overview');
  const heldLedger = useHeldMoneyLedger(
    model.uid,
    reportMode === 'held' && !suspended,
  );
  const [addHeldRequestId, setAddHeldRequestId] = useState(0);
  const [loanLedgerTargetId, setLoanLedgerTargetId] = useState<string | null>(
    null,
  );
  const [addLoanRequestId, setAddLoanRequestId] = useState(0);
  const openLoanLedger = useCallback((loanId: string | null = null) => {
    setLoanLedgerTargetId(loanId);
    setReportMode('loans');
  }, []);
  const openLinkedLoan = useCallback(
    (loanId: string) => openLoanLedger(loanId),
    [openLoanLedger],
  );
  const getLoanSearchText = useCallback(
    (transaction: FinanceTransaction) => {
      if (!transaction.loanId) return '';
      const loan = loansById.get(transaction.loanId);
      if (transaction.expenseSource === 'loan_lending') {
        const content = transaction.advanceId
          ? loan?.advances?.find(({ id }) => id === transaction.advanceId)?.note
          : loan?.note;
        return [
          loan ? `Cho ${loan.borrowerName} vay` : 'Cho vay',
          getFinanceTransactionCategoryLabel(transaction),
          content ?? '',
        ].join(' ');
      }
      if (transaction.incomeSource === 'loan_repayment')
        return [
          loan ? `Nhận lại tiền từ ${loan.borrowerName}` : '',
          getFinanceTransactionCategoryLabel(transaction),
          'Giảm chi Cho vay',
        ].join(' ');
      return '';
    },
    [loansById],
  );
  const reloadLoanLedger = loanLedger.load;
  useEffect(() => {
    if (reportMode === 'loans' && !suspended) void reloadLoanLedger(true);
  }, [reportMode, reloadLoanLedger, suspended]);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogInitialType, setDialogInitialType] =
    useState<FinanceTransactionType>('expense');
  const [dialogInitialIncomeSource, setDialogInitialIncomeSource] =
    useState<RegularFinanceIncomeSource>('company');
  const [dialogInitialDate, setDialogInitialDate] =
    useState(formatFinanceDate());
  const [saving, setSaving] = useState(false);
  const [deletingIds, setDeletingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const deletingIdsRef = useRef(new Set<string>());
  const [editTarget, setEditTarget] = useState<FinanceTransaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [reportIncomeSource, setReportIncomeSource] =
    useState<FinanceIncomeSourceFilter>('company');
  const [reportPeriodMode, setReportPeriodMode] =
    useState<FinancePeriodMode>('year');
  const [reportYear, setReportYear] = useState(currentDate.getFullYear());
  const [reportMonth, setReportMonth] = useState<FinanceReportPoint>({
    year: currentDate.getFullYear(),
    month: currentDate.getMonth() + 1,
  });
  const [reportStart, setReportStart] = useState<FinanceReportPoint>({
    year: currentDate.getFullYear(),
    month: 1,
  });
  const [reportEnd, setReportEnd] = useState<FinanceReportPoint>({
    year: currentDate.getFullYear(),
    month: currentDate.getMonth() + 1,
  });

  useEffect(() => {
    if (reportMode === 'overview') setReportIncomeSource('company');
  }, [reportMode]);

  function openAddDialog(
    type: FinanceTransactionType,
    period?: FinanceReportPoint,
    incomeSource: RegularFinanceIncomeSource = 'company',
  ) {
    setEditTarget(null);
    const today = new Date();
    const isCurrentMonth =
      period?.year === today.getFullYear() &&
      period.month === today.getMonth() + 1;
    const initialDate = period
      ? new Date(
          period.year,
          period.month - 1,
          isCurrentMonth ? today.getDate() : 1,
        )
      : today;
    setDialogInitialType(type);
    setDialogInitialIncomeSource(incomeSource);
    setDialogInitialDate(formatFinanceDate(initialDate));
    setDialogVisible(true);
  }

  const deferredQuery = useDeferredValue(searchQuery.trim());
  const searchResults = useMemo(
    () =>
      deferredQuery
        ? filterFinanceTransactions(
            model.transactions,
            deferredQuery,
            getLoanSearchText,
          )
        : [],
    [deferredQuery, getLoanSearchText, model.transactions],
  );
  // Stable row callbacks that always call the latest handlers.
  const handlers = useRef({ openEditDialog, confirmDelete });
  handlers.current = { openEditDialog, confirmDelete };
  const editRow = useCallback(
    (transaction: FinanceTransaction) =>
      handlers.current.openEditDialog(transaction),
    [],
  );
  const deleteRow = useCallback(
    (transaction: FinanceTransaction) =>
      handlers.current.confirmDelete(transaction),
    [],
  );

  function openEditDialog(transaction: FinanceTransaction) {
    if (isLoanLedgerTransaction(transaction)) return;
    setEditTarget(transaction);
    setDialogInitialType(transaction.type);
    setDialogInitialIncomeSource(
      transaction.incomeSource === 'other' ? 'other' : 'company',
    );
    setDialogInitialDate(formatFinanceDate(new Date(transaction.createdAt)));
    setDialogVisible(true);
  }

  function confirmDelete(transaction: FinanceTransaction) {
    if (deletingIdsRef.current.has(transaction.id)) return;
    Alert.alert(
      'Xóa giao dịch?',
      canDeleteLinkedExpense(transaction)
        ? 'Hồ sơ cho vay đã xóa. Xóa luôn khoản chi liên kết còn sót trong Tài chính?'
        : 'Giao dịch này sẽ được xóa khỏi sổ thu chi của tài khoản.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => void deleteTransaction(transaction),
        },
      ],
    );
  }

  async function deleteTransaction(transaction: FinanceTransaction) {
    if (deletingIdsRef.current.has(transaction.id)) return;
    deletingIdsRef.current.add(transaction.id);
    setDeletingIds((current) => new Set(current).add(transaction.id));
    try {
      await model.removeTransaction(transaction.id);
    } catch (cause) {
      Alert.alert(
        'Chưa xóa được giao dịch',
        (cause as Error).message || 'Vui lòng thử lại.',
      );
    } finally {
      deletingIdsRef.current.delete(transaction.id);
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(transaction.id);
        return next;
      });
    }
  }

  async function save(
    draft: Parameters<typeof model.addTransaction>[0],
    id?: string,
  ) {
    setSaving(true);
    try {
      if (id) await model.updateTransaction(id, draft);
      else await model.addTransaction(draft);
    } finally {
      setSaving(false);
    }
  }

  const addLabel =
    reportMode === 'overview'
      ? 'Thêm giao dịch'
      : reportMode === 'income'
        ? 'Thêm khoản thu'
        : reportMode === 'expense'
          ? 'Thêm khoản chi'
          : reportMode === 'loans'
            ? 'Thêm khoản cho vay'
            : 'Thêm khoản đóng hộ';
  const loanSyncStatus =
    model.syncStatus === 'recovery'
      ? 'recovery'
      : model.syncStatus === 'local' || loanLedger.syncStatus === 'local'
        ? 'local'
        : model.syncStatus === 'synced' && loanLedger.syncStatus === 'synced'
          ? 'synced'
          : null;
  const displaySyncStatus =
    reportMode === 'loans'
      ? loanSyncStatus
      : reportMode === 'held'
        ? heldLedger.synced === true
          ? 'synced'
          : heldLedger.synced === false
            ? 'local'
            : null
        : model.syncStatus;
  const syncBusy =
    refreshing ||
    (reportMode === 'loans' && loanLedger.loading) ||
    (reportMode === 'held' && (heldLedger.loading || heldLedger.busy));
  const addBusy =
    saving ||
    (reportMode === 'held'
      ? heldLedger.loading || heldLedger.busy
      : model.loading || (reportMode === 'loans' && loanLedger.loading));
  const syncActionBusy =
    reportMode === 'held'
      ? heldLedger.loading
      : model.loading || loanLedger.loading;

  function addInViewedPeriod() {
    if (reportMode === 'held') {
      setAddHeldRequestId((current) => current + 1);
      return;
    }
    if (reportMode === 'loans') {
      setAddLoanRequestId((current) => current + 1);
      return;
    }
    if (reportMode === 'overview') {
      openAddDialog('expense', { year: model.year, month: model.month });
      return;
    }
    const period =
      reportPeriodMode === 'range'
        ? reportEnd
        : reportPeriodMode === 'month'
          ? reportMonth
          : {
              year: reportYear,
              month:
                reportYear === currentDate.getFullYear()
                  ? currentDate.getMonth() + 1
                  : 1,
            };
    openAddDialog(reportMode, period);
  }

  function renderReportTab(
    tab: (typeof reportTabs)[number],
    ledgerTab = false,
  ) {
    const selected = reportMode === tab.value;
    return (
      <Pressable
        key={tab.value}
        accessibilityRole="tab"
        accessibilityLabel={tab.accessibilityLabel}
        accessibilityState={{ selected }}
        hitSlop={{ top: 3, bottom: 3 }}
        onPress={() => {
          setReportMode(tab.value);
          setLoanLedgerTargetId(null);
        }}
        style={[
          styles.reportModeButton,
          ledgerTab && styles.ledgerModeButton,
          selected &&
            (ledgerTab ? styles.ledgerModeSelected : styles.reportModeSelected),
        ]}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          style={[
            styles.reportModeText,
            selected && styles.reportModeTextSelected,
          ]}
        >
          {tab.label}
        </Text>
      </Pressable>
    );
  }

  return (
    <Screen
      fixedHeader={
        <View style={styles.headerRow}>
          <Text
            accessibilityRole="header"
            style={[typography.title, styles.headerTitle]}
          >
            Tài chính
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={addLabel}
            accessibilityState={{
              disabled: addBusy,
            }}
            disabled={addBusy}
            onPress={addInViewedPeriod}
            style={styles.addButton}
          >
            <Feather name="plus" size={22} color={colors.earth} />
          </Pressable>
        </View>
      }
      fixedHeaderStyle={styles.header}
      fixedContent={
        <View style={styles.fixedActions}>
          {model.conflicts.length > 0 && (
            <View style={styles.syncStatus} accessibilityRole="alert">
              <Feather name="alert-circle" size={15} color={colors.sunlight} />
              <Text style={styles.syncText}>
                {model.conflicts.length} giao dịch cần chọn bản lưu
              </Text>
              <Button
                compact
                title="Xử lý"
                variant="secondary"
                onPress={openFinanceConflict}
              />
            </View>
          )}
          {(!!displaySyncStatus ||
            syncBusy ||
            reportMode === 'loans' ||
            reportMode === 'held') && (
            <View
              accessibilityRole="summary"
              accessibilityState={{ busy: syncBusy }}
              accessibilityLiveRegion="polite"
              style={[
                styles.syncStatus,
                !syncBusy &&
                  displaySyncStatus === 'local' &&
                  styles.syncPending,
                (syncBusy ||
                  displaySyncStatus === 'recovery' ||
                  !displaySyncStatus) &&
                  styles.syncRecovery,
              ]}
            >
              <Feather
                name={
                  !syncBusy && displaySyncStatus === 'local'
                    ? 'cloud-off'
                    : 'cloud'
                }
                size={15}
                color={
                  syncBusy
                    ? colors.sky
                    : displaySyncStatus === 'local'
                      ? colors.sunlight
                      : displaySyncStatus === 'recovery' || !displaySyncStatus
                        ? colors.sky
                        : colors.success
                }
              />
              <Text
                style={[
                  styles.syncText,
                  !syncBusy &&
                    displaySyncStatus === 'local' &&
                    styles.syncPendingText,
                  (syncBusy ||
                    displaySyncStatus === 'recovery' ||
                    !displaySyncStatus) &&
                    styles.syncRecoveryText,
                ]}
              >
                {syncBusy
                  ? 'Đang đồng bộ…'
                  : displaySyncStatus === 'synced'
                    ? 'Đã lưu trên tài khoản'
                    : displaySyncStatus === 'recovery'
                      ? 'Đã tải từ cloud · cache trên máy chưa đọc được'
                      : displaySyncStatus === 'local'
                        ? reportMode === 'held'
                          ? heldLedger.error
                            ? 'Sổ chưa đầy đủ · tải lại để kiểm tra'
                            : 'Bản sổ trên thiết bị · tải lại khi có mạng'
                          : 'Chưa sao lưu · chỉ có trên thiết bị'
                        : 'Chưa xác nhận đồng bộ'}
              </Text>
              {!syncBusy &&
                displaySyncStatus !== 'synced' &&
                (displaySyncStatus === 'recovery' ||
                displaySyncStatus === null ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Tải lại"
                    accessibilityHint="Tải lại dữ liệu từ tài khoản."
                    accessibilityState={{
                      disabled: syncActionBusy,
                      busy: syncActionBusy,
                    }}
                    hitSlop={4}
                    disabled={syncActionBusy}
                    onPress={() => void refreshFinance()}
                    style={({ pressed }) => [
                      styles.syncAction,
                      pressed && styles.syncActionPressed,
                    ]}
                  >
                    {syncActionBusy ? (
                      <ActivityIndicator size="small" color={colors.earth} />
                    ) : (
                      <Feather
                        name="refresh-cw"
                        size={17}
                        color={colors.earth}
                      />
                    )}
                  </Pressable>
                ) : (
                  <Button
                    compact
                    title="Đồng bộ lại"
                    variant="secondary"
                    loading={syncActionBusy || refreshing}
                    onPress={refreshFinance}
                  />
                ))}
            </View>
          )}
          <View style={styles.reportMode} accessibilityRole="tablist">
            <View style={styles.reportModeRow}>
              {reportTabs.slice(0, 3).map((tab) => renderReportTab(tab))}
            </View>
            <View style={styles.ledgerModeRow}>
              {reportTabs.slice(3).map((tab) => renderReportTab(tab, true))}
            </View>
          </View>
          {reportMode === 'overview' ? (
            <FinancePeriodSelector
              year={model.year}
              month={model.month}
              onPeriodChange={model.setPeriod}
            />
          ) : reportMode !== 'loans' && reportMode !== 'held' ? (
            <FinanceCategoryReportControls
              kind={reportMode}
              incomeSource={reportIncomeSource}
              onIncomeSourceChange={setReportIncomeSource}
              periodMode={reportPeriodMode}
              onPeriodModeChange={setReportPeriodMode}
              year={reportYear}
              onYearChange={setReportYear}
              month={reportMonth}
              onMonthChange={setReportMonth}
              start={reportStart}
              onStartChange={setReportStart}
              end={reportEnd}
              onEndChange={setReportEnd}
            />
          ) : null}
        </View>
      }
      fixedContentStyle={styles.reportModeSection}
      scrollable={reportMode !== 'loans'}
      contentStyle={reportMode === 'loans' ? undefined : styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refreshFinance()}
          enabled={!!model.uid && !suspended}
          tintColor={colors.earth}
          colors={[colors.earth]}
          progressBackgroundColor={colors.surface}
          accessibilityLabel="Kéo xuống để đồng bộ tài chính"
        />
      }
    >
      {reportMode !== 'overview' &&
        reportMode !== 'loans' &&
        reportMode !== 'held' &&
        !!feedbackError && (
          <View>
            <Text accessibilityRole="alert" style={styles.feedback}>
              {feedbackError}
            </Text>
            <Button
              compact
              title="Thử tải lại"
              variant="secondary"
              loading={model.loading || refreshing}
              onPress={refreshFinance}
            />
          </View>
        )}

      {reportMode === 'income' || reportMode === 'expense' ? (
        <>
          <FinanceCategoryReport
            kind={reportMode}
            transactions={model.transactions}
            onDelete={deleteRow}
            onEdit={editRow}
            onOpenLoan={openLinkedLoan}
            loansById={loansById}
            canDeleteLinkedExpense={canDeleteLinkedExpense}
            deletingIds={deletingIds}
            customCategories={
              model.preferences[
                reportMode === 'income'
                  ? 'incomeCategories'
                  : 'expenseCategories'
              ]
            }
            onAdd={(year, month, incomeSource) =>
              openAddDialog(reportMode, { year, month }, incomeSource)
            }
            periodMode={reportPeriodMode}
            year={reportYear}
            month={reportMonth}
            start={reportStart}
            end={reportEnd}
            incomeSource={reportIncomeSource}
          />
          {model.loading && !refreshing && (
            <ActivityIndicator color={colors.earth} />
          )}
        </>
      ) : reportMode === 'held' ? (
        <HeldMoneyLedger
          uid={model.uid}
          ledger={heldLedger}
          addRequestId={addHeldRequestId}
        />
      ) : reportMode === 'overview' ? (
        <>
          <TextInput
            accessibilityLabel="Tìm giao dịch"
            placeholder="Tìm theo ghi chú, danh mục hoặc số tiền"
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            style={styles.searchInput}
          />
          {!searchQuery.trim() && (
            <View style={styles.summary}>
              <View style={styles.balance}>
                <Text style={styles.balanceLabel}>Còn lại trong kỳ</Text>
                <Text style={styles.balanceAmount}>
                  {formatFinanceAmount(model.report.balance)}
                </Text>
              </View>
              <View style={styles.totals}>
                <View style={styles.total}>
                  <Text style={styles.totalLabel}>Tổng thu</Text>
                  <Text style={[styles.totalAmount, styles.income]}>
                    {formatFinanceAmount(model.report.income)}
                  </Text>
                </View>
                <View style={styles.total}>
                  <Text style={styles.totalLabel}>Tổng chi</Text>
                  <Text style={[styles.totalAmount, styles.expense]}>
                    {formatFinanceAmount(model.report.expense)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {searchQuery.trim()
                ? 'Kết quả tìm kiếm'
                : 'Giao dịch trong tháng'}
            </Text>
            {model.loading && !refreshing && (
              <ActivityIndicator color={colors.earth} />
            )}
          </View>

          {!!feedbackError && (
            <View>
              <Text accessibilityRole="alert" style={styles.feedback}>
                {feedbackError}
              </Text>
              <Button
                compact
                title="Thử tải lại"
                variant="secondary"
                loading={model.loading || refreshing}
                onPress={refreshFinance}
              />
            </View>
          )}

          {searchQuery.trim() ? (
            <View style={styles.searchResults}>
              {searchResults.map((transaction) => (
                <FinanceTransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  deleting={deletingIds.has(transaction.id)}
                  onEdit={editRow}
                  onDelete={deleteRow}
                  loan={
                    transaction.loanId
                      ? loansById.get(transaction.loanId)
                      : undefined
                  }
                  onOpenLoan={openLinkedLoan}
                  canDeleteLinkedExpense={canDeleteLinkedExpense(transaction)}
                />
              ))}
              {!model.loading &&
                !!deferredQuery &&
                searchResults.length === 0 && (
                  <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>
                      Không tìm thấy giao dịch
                    </Text>
                    <Text style={typography.small}>
                      Thử từ khóa khác hoặc xóa nội dung tìm kiếm.
                    </Text>
                  </View>
                )}
            </View>
          ) : null}

          {!searchQuery.trim() &&
            !model.loading &&
            model.report.months.length === 0 &&
            !model.error && (
              <View style={styles.empty}>
                <Feather name="pie-chart" size={24} color={colors.sky} />
                <Text style={styles.emptyTitle}>
                  {model.transactions.length === 0
                    ? 'Chưa có giao dịch nào'
                    : 'Chưa có giao dịch trong tháng này'}
                </Text>
                <Text style={typography.small}>
                  {model.transactions.length === 0
                    ? 'Thêm khoản lương hoặc chi tiêu đầu tiên của bạn.'
                    : 'Chọn tháng khác để xem các khoản đã ghi.'}
                </Text>
              </View>
            )}

          {!searchQuery.trim() && (
            <View style={styles.monthList}>
              {model.report.months.map((month) => (
                <FinanceMonthSection
                  key={month.month}
                  year={model.year}
                  month={month.month}
                  transactions={month.transactions}
                  income={month.income}
                  expense={month.expense}
                  balance={month.balance}
                  onDelete={deleteRow}
                  onEdit={editRow}
                  canDeleteLinkedExpense={canDeleteLinkedExpense}
                  deletingIds={deletingIds}
                  loansById={loansById}
                  onOpenLoan={openLinkedLoan}
                  onAdd={() =>
                    openAddDialog('income', {
                      year: model.year,
                      month: month.month,
                    })
                  }
                />
              ))}
            </View>
          )}
        </>
      ) : null}

      <FinanceTransactionDialog
        visible={dialogVisible}
        suspended={suspended}
        initialTransaction={editTarget}
        initialType={dialogInitialType}
        initialIncomeSource={dialogInitialIncomeSource}
        initialDate={dialogInitialDate}
        incomeCategories={model.preferences.incomeCategories}
        expenseCategories={model.preferences.expenseCategories}
        templates={model.preferences.templates}
        onSaveTemplate={model.addTemplate}
        onRemoveTemplate={model.removeTemplate}
        onAddCategory={model.addCategory}
        onRemoveCategory={model.removeCategory}
        busy={saving}
        onClose={() => {
          setDialogVisible(false);
          setEditTarget(null);
        }}
        onSave={save}
      />
      <LoanLedgerModal
        key={model.uid ?? 'signed-out'}
        visible={reportMode === 'loans' && !suspended}
        addRequestId={addLoanRequestId}
        initialLoanId={loanLedgerTargetId}
        uid={model.uid}
        loans={loanLedger.loans}
        loading={loanLedger.loading}
        financeLoading={model.loading}
        syncStatus={loanLedger.syncStatus}
        error={loanLedger.error}
        onRefresh={() => loanLedger.load(true)}
        onSave={loanLedger.save}
        onDeleteLoan={loanLedger.remove}
        onCorrectPrincipal={loanLedger.correctPrincipal}
        onRecordRepayment={loanLedger.recordRepayment}
        onDeleteRepayment={loanLedger.removeRepayment}
        onUpdateRepayment={loanLedger.updateRepayment}
        onRecordAdvance={loanLedger.recordAdvance}
        onUpdateAdvance={loanLedger.updateAdvance}
        onDeleteAdvance={loanLedger.removeAdvance}
        onDeleteInitialEntry={loanLedger.removeInitialEntry}
      />
    </Screen>
  );
}
