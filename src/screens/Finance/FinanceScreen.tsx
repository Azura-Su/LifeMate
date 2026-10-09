import Feather from '@expo/vector-icons/Feather';
import {
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { colors, typography } from '../../theme';
import {
  filterFinanceTransactions,
  formatFinanceAmount,
  formatFinanceDate,
} from '../../utils/finance';
import type {
  FinanceTransaction,
  FinanceTransactionType,
} from '../../types/finance';
import { FinanceMonthSection } from './FinanceMonthSection';
import { FinanceTransactionRow } from './FinanceTransactionRow';
import {
  FinanceCategoryReport,
  type FinancePeriodMode,
  type FinanceReportPoint,
} from './FinanceCategoryReport';
import { FinancePeriodSelector } from './FinancePeriodSelector';
import { FinanceTransactionDialog } from './FinanceTransactionDialog';
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

export function FinanceScreen() {
  const model = useFinanceScreen();
  const currentDate = new Date();
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogInitialType, setDialogInitialType] =
    useState<FinanceTransactionType>('expense');
  const [dialogInitialDate, setDialogInitialDate] =
    useState(formatFinanceDate());
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<FinanceTransaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [reportMode, setReportMode] = useState<
    'overview' | 'income' | 'expense'
  >('overview');
  const [reportPeriodMode, setReportPeriodMode] =
    useState<FinancePeriodMode>('year');
  const [reportYear, setReportYear] = useState(currentDate.getFullYear());
  const [reportStart, setReportStart] = useState<FinanceReportPoint>({
    year: currentDate.getFullYear(),
    month: 1,
  });
  const [reportEnd, setReportEnd] = useState<FinanceReportPoint>({
    year: currentDate.getFullYear(),
    month: currentDate.getMonth() + 1,
  });

  function openAddDialog(
    type: FinanceTransactionType,
    period?: FinanceReportPoint,
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
    setEditTarget(transaction);
    setDialogInitialType(transaction.type);
    setDialogInitialDate(formatFinanceDate(new Date(transaction.createdAt)));
    setDialogVisible(true);
  }

  function confirmDelete(transaction: FinanceTransaction) {
    Alert.alert(
      'Xóa giao dịch?',
      'Giao dịch này sẽ được xóa khỏi sổ thu chi của tài khoản.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            void model.removeTransaction(transaction.id).catch(() => undefined);
          },
        },
      ],
    );
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
        <>
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
        </>
      }
      fixedHeaderStyle={styles.header}
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
          {model.syncStatus !== 'synced' && (
            <Button
              compact
              title={
                model.syncStatus === 'recovery' ? 'Tải lại' : 'Đồng bộ lại'
              }
              variant="secondary"
              onPress={model.refresh}
            />
          )}
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
            customCategories={
              model.preferences[
                reportMode === 'income'
                  ? 'incomeCategories'
                  : 'expenseCategories'
              ]
            }
            onAdd={(year, month) => openAddDialog(reportMode, { year, month })}
            periodMode={reportPeriodMode}
            onPeriodModeChange={setReportPeriodMode}
            year={reportYear}
            onYearChange={setReportYear}
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
                  onEdit={editRow}
                  onDelete={deleteRow}
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
        initialTransaction={editTarget}
        initialType={dialogInitialType}
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
    </Screen>
  );
}
