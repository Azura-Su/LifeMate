import Feather from '@expo/vector-icons/Feather';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { AppTextInput as TextInput } from '../../components/AppTextInput';
import { Screen } from '../../components/Screen';
import { colors, typography } from '../../theme';
import {
  filterFinanceTransactions,
  formatFinanceAmount,
  formatFinanceDate,
} from '../../utils/finance';
import type {
  FinanceIncomeSource,
  RegularFinanceIncomeSource,
  FinanceTransaction,
  FinanceTransactionType,
} from '../../types/finance';
import { isLoanLedgerTransaction } from '../../types/finance';
import { getLoanStatus } from '../../types/loan';
import { useLoanLedger } from '../../hooks/useLoanLedger';
import { FinanceMonthSection } from './FinanceMonthSection';
import { FinanceTransactionRow } from './FinanceTransactionRow';
import {
  FinanceCategoryReport,
  type FinancePeriodMode,
  type FinanceReportPoint,
} from './FinanceCategoryReport';
import { FinancePeriodSelector } from './FinancePeriodSelector';
import { FinanceTransactionDialog } from './FinanceTransactionDialog';
import { LoanLedgerModal } from './LoanLedgerModal';
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
] as const;

export function FinanceScreen({ suspended = false }: { suspended?: boolean }) {
  const model = useFinanceScreen();
  const loanLedger = useLoanLedger(model.uid);
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
  const [loanLedgerVisible, setLoanLedgerVisible] = useState(false);
  const reloadLoanLedger = loanLedger.load;
  useEffect(() => {
    if (loanLedgerVisible && !suspended) void reloadLoanLedger(true);
  }, [loanLedgerVisible, reloadLoanLedger, suspended]);
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
  const [reportMode, setReportMode] = useState<
    'overview' | 'income' | 'expense'
  >('overview');
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
    if (suspended) setLoanLedgerVisible(false);
  }, [suspended]);

  function openAddDialog(
    type: FinanceTransactionType,
    period?: FinanceReportPoint,
    incomeSource: FinanceIncomeSource = 'company',
  ) {
    if (incomeSource === 'loan_repayment') {
      setLoanLedgerVisible(true);
      return;
    }
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
        ? filterFinanceTransactions(model.transactions, deferredQuery)
        : [],
    [deferredQuery, model.transactions],
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
        ? 'Hồ sơ cho mượn đã xóa. Xóa luôn khoản chi liên kết còn sót trong Tài chính?'
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
        : 'Thêm khoản chi';

  function addInViewedPeriod() {
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
            accessibilityState={{ disabled: model.loading || saving }}
            disabled={model.loading || saving}
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
          <View style={styles.reportMode} accessibilityRole="tablist">
            {reportTabs.map((tab) => (
              <Pressable
                key={tab.value}
                accessibilityRole="tab"
                accessibilityLabel={tab.accessibilityLabel}
                accessibilityState={{ selected: reportMode === tab.value }}
                onPress={() => setReportMode(tab.value)}
                style={[
                  styles.reportModeButton,
                  reportMode === tab.value && styles.reportModeSelected,
                ]}
              >
                <Text
                  style={[
                    styles.reportModeText,
                    reportMode === tab.value && styles.reportModeTextSelected,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {reportMode === 'overview' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mở sổ cho mượn"
              onPress={() => setLoanLedgerVisible(true)}
              style={styles.loanLedgerLink}
            >
              <View style={styles.loanLedgerIcon}>
                <Feather name="book-open" size={16} color={colors.sky} />
              </View>
              <Text style={styles.loanLedgerText}>Sổ cho mượn</Text>
              <Text style={styles.loanLedgerMeta}>
                {
                  loanLedger.loans.filter(
                    (loan) => getLoanStatus(loan) === 'open',
                  ).length
                }{' '}
                khoản đang mở
              </Text>
              <Feather name="chevron-right" size={17} color={colors.muted} />
            </Pressable>
          )}
        </View>
      }
      fixedContentStyle={styles.reportModeSection}
      contentStyle={styles.content}
    >
      {reportMode === 'overview' && (
        <FinancePeriodSelector
          year={model.year}
          month={model.month}
          onPeriodChange={model.setPeriod}
        />
      )}

      {!!model.syncStatus && (
        <View
          accessibilityRole="summary"
          style={[
            styles.syncStatus,
            model.syncStatus === 'local' && styles.syncPending,
            model.syncStatus === 'recovery' && styles.syncRecovery,
          ]}
        >
          <Feather
            name={model.syncStatus === 'local' ? 'cloud-off' : 'cloud'}
            size={15}
            color={
              model.syncStatus === 'local'
                ? colors.sunlight
                : model.syncStatus === 'recovery'
                  ? colors.sky
                  : colors.success
            }
          />
          <Text
            style={[
              styles.syncText,
              model.syncStatus === 'local' && styles.syncPendingText,
              model.syncStatus === 'recovery' && styles.syncRecoveryText,
            ]}
          >
            {model.syncStatus === 'synced'
              ? 'Đã lưu trên tài khoản'
              : model.syncStatus === 'recovery'
                ? 'Đã tải từ cloud · cache trên máy chưa đọc được'
                : 'Chưa sao lưu · chỉ có trên thiết bị'}
          </Text>
          {model.syncStatus !== 'synced' &&
            (model.syncStatus === 'recovery' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tải lại"
                accessibilityHint="Tải lại dữ liệu từ tài khoản."
                accessibilityState={{
                  disabled: model.loading,
                  busy: model.loading,
                }}
                hitSlop={4}
                disabled={model.loading}
                onPress={() => void model.refresh()}
                style={({ pressed }) => [
                  styles.syncAction,
                  pressed && styles.syncActionPressed,
                ]}
              >
                {model.loading ? (
                  <ActivityIndicator size="small" color={colors.earth} />
                ) : (
                  <Feather name="refresh-cw" size={17} color={colors.earth} />
                )}
              </Pressable>
            ) : (
              <Button
                compact
                title="Đồng bộ lại"
                variant="secondary"
                loading={model.loading}
                onPress={model.refresh}
              />
            ))}
        </View>
      )}

      {reportMode !== 'overview' && !!model.error && (
        <View>
          <Text accessibilityRole="alert" style={styles.feedback}>
            {model.error}
          </Text>
          <Button
            compact
            title="Thử tải lại"
            variant="secondary"
            loading={model.loading}
            onPress={model.refresh}
          />
        </View>
      )}

      {reportMode !== 'overview' ? (
        <>
          <FinanceCategoryReport
            kind={reportMode}
            transactions={model.transactions}
            onDelete={deleteRow}
            onEdit={editRow}
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
          {model.loading && <ActivityIndicator color={colors.earth} />}
        </>
      ) : (
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
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={styles.balanceAmount}
                >
                  {formatFinanceAmount(model.report.balance)}
                </Text>
              </View>
              <View style={styles.totals}>
                <View style={styles.total}>
                  <Text style={styles.totalLabel}>Tổng thu</Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[styles.totalAmount, styles.income]}
                  >
                    {formatFinanceAmount(model.report.income)}
                  </Text>
                </View>
                <View style={styles.total}>
                  <Text style={styles.totalLabel}>Tổng chi</Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[styles.totalAmount, styles.expense]}
                  >
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
            {model.loading && <ActivityIndicator color={colors.earth} />}
          </View>

          {!!model.error && (
            <View>
              <Text accessibilityRole="alert" style={styles.feedback}>
                {model.error}
              </Text>
              <Button
                compact
                title="Thử tải lại"
                variant="secondary"
                loading={model.loading}
                onPress={model.refresh}
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
      )}

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
        visible={loanLedgerVisible && !suspended}
        uid={model.uid}
        loans={loanLedger.loans}
        loading={loanLedger.loading}
        financeLoading={model.loading}
        syncStatus={loanLedger.syncStatus}
        error={loanLedger.error}
        onClose={() => setLoanLedgerVisible(false)}
        onRefresh={() => void loanLedger.load(true)}
        onSave={loanLedger.save}
        onDeleteLoan={loanLedger.remove}
        onCorrectPrincipal={loanLedger.correctPrincipal}
        onRecordRepayment={loanLedger.recordRepayment}
      />
    </Screen>
  );
}
