import Feather from '@expo/vector-icons/Feather';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../../theme';
import type {
  FinanceTransaction,
  FinanceTransactionType,
  RegularFinanceIncomeSource,
} from '../../types/finance';
import type { LoanRecord } from '../../types/loan';
import {
  filterFinanceTransactions,
  formatFinanceAmount,
  getExpenseReport,
  getFinanceIncomeSource,
  getFinanceReportContribution,
  getIncomeReport,
  matchesFinanceSearch,
} from '../../utils/finance';
import {
  getPendingSharedExpenses,
  type PendingSharedExpense,
} from '../../utils/sharedExpense';
import { FinancePendingSharedExpenses } from './FinancePendingSharedExpenses';
import { FinanceTransactionDayGroups } from './FinanceTransactionDayGroups';
import { FinanceSearchResults } from './FinanceSearchResults';
import { FinanceListSearch } from './FinanceListSearch';
import { categoryReportStyles as styles } from './FinanceCategoryReport.styles';

export type FinanceReportPoint = { year: number; month: number };
export type FinancePeriodMode = 'year' | 'month' | 'range';
export type FinanceIncomeSourceFilter = 'all' | RegularFinanceIncomeSource;

type Props = {
  kind: Extract<FinanceTransactionType, 'income' | 'expense'>;
  transactions: FinanceTransaction[];
  onDelete: (transaction: FinanceTransaction) => void;
  onEdit: (transaction: FinanceTransaction) => void;
  onOpenLoan: (loanId: string) => void;
  loansById: ReadonlyMap<string, LoanRecord>;
  canDeleteLinkedExpense?: (transaction: FinanceTransaction) => boolean;
  deletingIds?: ReadonlySet<string>;
  customCategories?: string[];
  onAdd: (
    year: number,
    month: number,
    incomeSource?: RegularFinanceIncomeSource,
  ) => void;
  periodMode: FinancePeriodMode;
  year: number;
  month: FinanceReportPoint;
  start: FinanceReportPoint;
  end: FinanceReportPoint;
  incomeSource: FinanceIncomeSourceFilter;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  deferredSearchQuery: string;
  getAdditionalSearchText: (transaction: FinanceTransaction) => string;
  loading: boolean;
  revealedTransactionId: string | null;
};

const monthName = (month: number) =>
  new Intl.DateTimeFormat('vi-VN', { month: 'long' }).format(
    new Date(2024, month - 1, 1),
  );

function formatPeriodPoint({ year, month }: FinanceReportPoint) {
  return `${String(month).padStart(2, '0')}/${year}`;
}

export function FinanceCategoryReport({
  kind,
  transactions,
  onDelete,
  onEdit,
  onOpenLoan,
  loansById,
  canDeleteLinkedExpense,
  deletingIds,
  customCategories,
  onAdd,
  periodMode,
  year,
  month,
  start,
  end,
  incomeSource,
  searchQuery,
  onSearchQueryChange,
  deferredSearchQuery,
  getAdditionalSearchText,
  loading,
  revealedTransactionId,
}: Props) {
  const isIncome = kind === 'income';
  const reportTransactions = useMemo(
    () =>
      isIncome
        ? transactions.filter(
            (transaction) =>
              getFinanceReportContribution(transaction).kind === 'income' &&
              (incomeSource === 'all' ||
                getFinanceIncomeSource(transaction) === incomeSource),
          )
        : transactions,
    [incomeSource, isIncome, transactions],
  );
  const categoryLabel = isIncome ? 'khoản thu' : 'khoản chi';
  const totalLabel = isIncome
    ? incomeSource === 'company'
      ? 'Thu nhập công ty'
      : incomeSource === 'other'
        ? 'Thu nhập ngoài công ty'
        : 'Tổng thu nhập'
    : 'Tổng chi tiêu';
  const report = useMemo(() => {
    const getReport = isIncome ? getIncomeReport : getExpenseReport;
    if (periodMode === 'year') {
      return getReport(reportTransactions, year, 1, year, 12, customCategories);
    }
    if (periodMode === 'month') {
      return getReport(
        reportTransactions,
        month.year,
        month.month,
        month.year,
        month.month,
        customCategories,
      );
    }
    return getReport(
      reportTransactions,
      start.year,
      start.month,
      end.year,
      end.month,
      customCategories,
    );
  }, [
    reportTransactions,
    isIncome,
    periodMode,
    year,
    month,
    start,
    end,
    customCategories,
  ]);
  const sharedExpenses = useMemo(
    () =>
      isIncome
        ? []
        : transactions.filter(
            (transaction) =>
              transaction.type === 'expense' && !!transaction.sharedExpense,
          ),
    [isIncome, transactions],
  );
  const visibleMonths = useMemo(() => {
    type Month = {
      year: number;
      month: number;
      total: number;
      transactions: FinanceTransaction[];
      pendingSharedExpenses: PendingSharedExpense[];
    };
    const months = new Map<number, Month>();
    for (const entry of report.months) {
      months.set(entry.year * 12 + entry.month - 1, {
        ...entry,
        pendingSharedExpenses: [],
      });
    }
    if (isIncome || sharedExpenses.length === 0) return [...months.values()];

    // Carry unresolved expenses into later months for display, without changing report totals.
    const now = Date.now();
    const current = new Date(now);
    const todayEnd = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate() + 1,
    ).getTime();
    const currentIndex = current.getFullYear() * 12 + current.getMonth();
    const first =
      periodMode === 'year'
        ? year * 12
        : periodMode === 'month'
          ? month.year * 12 + month.month - 1
          : start.year * 12 + start.month - 1;
    const last =
      periodMode === 'year'
        ? year * 12 + 11
        : periodMode === 'month'
          ? first
          : end.year * 12 + end.month - 1;
    const earliest = sharedExpenses.reduce((firstPending, transaction) => {
      const date = new Date(transaction.createdAt);
      return Math.min(firstPending, date.getFullYear() * 12 + date.getMonth());
    }, Infinity);
    for (
      let index = Math.max(first, earliest);
      index <= Math.min(last, currentIndex);
      index += 1
    ) {
      const entryYear = Math.floor(index / 12);
      const entryMonth = (index % 12) + 1;
      const nextMonth = new Date(entryYear, entryMonth, 1).getTime();
      const pending = getPendingSharedExpenses(
        sharedExpenses,
        Math.min(nextMonth, todayEnd),
      );
      if (pending.length === 0) continue;
      const existing = months.get(index);
      months.set(index, {
        year: entryYear,
        month: entryMonth,
        total: existing?.total ?? 0,
        transactions: existing?.transactions ?? [],
        pendingSharedExpenses: pending,
      });
    }
    return [...months.values()].sort(
      (a, b) => a.year - b.year || a.month - b.month,
    );
  }, [
    report.months,
    isIncome,
    sharedExpenses,
    periodMode,
    year,
    month,
    start,
    end,
  ]);
  const activeCategories = useMemo(
    () =>
      new Set(
        report.months.flatMap((entry) =>
          entry.transactions.map((transaction) =>
            getFinanceReportContribution(
              transaction,
            ).category.toLocaleLowerCase('vi-VN'),
          ),
        ),
      ),
    [report],
  );
  const categories = Object.keys(report.categories).filter((category) =>
    activeCategories.has(category.toLocaleLowerCase('vi-VN')),
  );
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    if (!revealedTransactionId) return;
    const savedMonth = report.months.find((entry) =>
      entry.transactions.some(
        (transaction) => transaction.id === revealedTransactionId,
      ),
    );
    if (!savedMonth) return;
    const key = `${kind}-${savedMonth.year}-${savedMonth.month}`;
    setExpandedMonths((current) =>
      current.has(key) ? current : new Set([...current, key]),
    );
  }, [kind, report.months, revealedTransactionId]);

  function toggleMonth(key: string) {
    setExpandedMonths((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const periodLabel =
    periodMode === 'year'
      ? `Cả năm ${year}`
      : periodMode === 'month'
        ? `Tháng ${month.month}/${month.year}`
        : `${formatPeriodPoint(start)} – ${formatPeriodPoint(end)}`;

  const matchingTransactions = useMemo(() => {
    if (!deferredSearchQuery) return [];
    const reportMatches = filterFinanceTransactions(
      report.months.flatMap((entry) => entry.transactions),
      deferredSearchQuery,
      getAdditionalSearchText,
    );
    const pendingMatches = visibleMonths
      .flatMap((entry) => entry.pendingSharedExpenses)
      .filter(({ transaction, remaining, pendingPeople }) =>
        matchesFinanceSearch(
          deferredSearchQuery,
          [
            transaction.note,
            transaction.category,
            pendingPeople.join(' '),
            getAdditionalSearchText(transaction),
          ].join(' '),
          [transaction.amount, remaining],
        ),
      )
      .map(({ transaction }) => transaction);
    return [
      ...new Map(
        [...reportMatches, ...pendingMatches].map((transaction) => [
          transaction.id,
          transaction,
        ]),
      ).values(),
    ];
  }, [deferredSearchQuery, getAdditionalSearchText, report, visibleMonths]);

  const currentMonth = periodMode === 'month' ? visibleMonths[0] : null;
  const currentMonthCarriedPending = currentMonth
    ? currentMonth.pendingSharedExpenses.filter(
        ({ transaction }) =>
          transaction.createdAt <
          new Date(currentMonth.year, currentMonth.month - 1, 1).getTime(),
      )
    : [];
  const carriedCount = currentMonthCarriedPending.length;

  const activeQuery = searchQuery.trim();
  const incomeScope =
    incomeSource === 'company'
      ? 'Công ty'
      : incomeSource === 'other'
        ? 'Ngoài công ty'
        : 'Tất cả nguồn thu';
  const searchBusy = loading || deferredSearchQuery !== activeQuery;

  return (
    <View style={styles.container}>
      {!activeQuery && (
        <View style={styles.summaryCard}>
          <View
            style={[styles.totalCard, !isIncome && styles.expenseTotalCard]}
          >
            <Text style={styles.totalLabel}>{totalLabel}</Text>
            <Text
              accessibilityRole="text"
              accessibilityLabel={`${totalLabel}: ${formatFinanceAmount(report.total)}`}
              style={[
                styles.totalAmount,
                !isIncome && styles.expenseTotalAmount,
              ]}
            >
              {formatFinanceAmount(report.total)}
            </Text>
          </View>
          {categories.length > 0 && (
            <View style={styles.categoryTotals}>
              {categories.map((category) => (
                <View key={category} style={styles.categoryTotalRow}>
                  <View style={styles.categoryNameRow}>
                    <View
                      style={[
                        styles.categoryDot,
                        !isIncome && styles.expenseCategoryDot,
                      ]}
                    />
                    <Text numberOfLines={1} style={styles.categoryName}>
                      {category}
                    </Text>
                  </View>
                  <Text
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={styles.categoryAmount}
                  >
                    {formatFinanceAmount(
                      (report.categories as Record<string, number>)[category],
                    )}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <FinanceListSearch
        key={`${kind}-${revealedTransactionId ?? ''}`}
        title={
          periodMode === 'month' ? 'Giao dịch trong tháng' : 'Theo từng tháng'
        }
        count={
          activeQuery
            ? matchingTransactions.length
            : periodMode === 'month'
              ? (currentMonth?.transactions.length ?? 0) + carriedCount
              : visibleMonths.length
        }
        itemLabel={
          periodMode === 'month' && !isIncome
            ? 'khoản'
            : periodMode === 'month'
              ? 'giao dịch'
              : 'tháng'
        }
        value={searchQuery}
        onChangeText={onSearchQueryChange}
        searchLabel={`giao dịch ${isIncome ? 'thu nhập' : 'chi tiêu'}`}
        placeholder="Ghi chú, danh mục hoặc số tiền"
        searchable={visibleMonths.length > 0 || !!activeQuery}
        scope={isIncome ? `${periodLabel} · ${incomeScope}` : periodLabel}
        busy={!!activeQuery && searchBusy}
      />

      {activeQuery ? (
        <FinanceSearchResults
          transactions={
            deferredSearchQuery === activeQuery ? matchingTransactions : []
          }
          busy={searchBusy}
          onDelete={onDelete}
          onEdit={onEdit}
          onOpenLoan={onOpenLoan}
          loansById={loansById}
          canDeleteLinkedExpense={canDeleteLinkedExpense}
          deletingIds={deletingIds}
        />
      ) : visibleMonths.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="bar-chart-2" size={21} color={colors.sky} />
          </View>
          <Text style={styles.emptyTitle}>
            Chưa có {categoryLabel} trong kỳ này
          </Text>
          <Text style={styles.emptyHint}>
            Nhấn + ở trên để thêm {categoryLabel} vào kỳ đang xem.
          </Text>
        </View>
      ) : periodMode === 'month' ? (
        <View style={styles.monthTransactions}>
          {currentMonthCarriedPending.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Xem khoản còn chờ nhận: ${carriedCount} khoản, ${formatFinanceAmount(
                currentMonthCarriedPending.reduce(
                  (sum, item) => sum + item.remaining,
                  0,
                ),
              )}`}
              onPress={() => {
                const pending = currentMonthCarriedPending[0];
                if (pending) onEdit(pending.transaction);
              }}
              style={styles.monthPendingRow}
            >
              <Text style={styles.monthPendingLabel}>
                Còn chờ nhận · {carriedCount} khoản
              </Text>
              <Text style={styles.monthPendingAmount}>
                {formatFinanceAmount(
                  currentMonthCarriedPending.reduce(
                    (sum, item) => sum + item.remaining,
                    0,
                  ),
                )}
              </Text>
            </Pressable>
          )}
          <FinancePendingSharedExpenses
            items={currentMonthCarriedPending}
            onOpen={onEdit}
          />
          {visibleMonths[0].transactions.length > 0 && (
            <FinanceTransactionDayGroups
              transactions={visibleMonths[0].transactions}
              deletingIds={deletingIds}
              onDelete={onDelete}
              onEdit={onEdit}
              loansById={loansById}
              onOpenLoan={onOpenLoan}
              canDeleteLinkedExpense={canDeleteLinkedExpense}
            />
          )}
        </View>
      ) : (
        <View style={styles.monthList}>
          {visibleMonths.map((month) => {
            const key = `${kind}-${month.year}-${month.month}`;
            const expanded = expandedMonths.has(key);
            const pendingAmount = month.pendingSharedExpenses.reduce(
              (sum, item) => sum + item.remaining,
              0,
            );
            return (
              <View key={key} style={styles.monthCard}>
                <View style={styles.monthHeader}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Xem giao dịch tháng ${month.month} năm ${month.year}`}
                    accessibilityState={{ expanded }}
                    onPress={() => toggleMonth(key)}
                    style={styles.monthSummary}
                  >
                    <View style={styles.monthNameBlock}>
                      <Text style={styles.monthName}>
                        {monthName(month.month)} {month.year}
                      </Text>
                      {month.transactions.length > 0 ? (
                        <View style={styles.monthMeta}>
                          <Text
                            style={[
                              styles.monthTotal,
                              !isIncome && styles.expenseMonthTotal,
                            ]}
                          >
                            {formatFinanceAmount(month.total)}
                          </Text>
                          <Text style={styles.monthBreakdown}>
                            {month.transactions.length} khoản
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.monthBreakdown}>
                          Chưa có giao dịch mới
                        </Text>
                      )}
                      {pendingAmount > 0 && (
                        <Text style={styles.monthPendingLabel}>
                          Còn chờ nhận {formatFinanceAmount(pendingAmount)}
                        </Text>
                      )}
                    </View>
                    <Feather
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.muted}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Thêm khoản ${isIncome ? 'thu' : 'chi'} tháng ${month.month} năm ${month.year}`}
                    onPress={() =>
                      onAdd(
                        month.year,
                        month.month,
                        isIncome && incomeSource !== 'all'
                          ? incomeSource
                          : isIncome
                            ? 'company'
                            : undefined,
                      )
                    }
                    style={styles.monthAddButton}
                  >
                    <Feather name="plus" size={20} color={colors.earth} />
                  </Pressable>
                </View>
                {expanded && (
                  <View style={styles.transactionList}>
                    <FinancePendingSharedExpenses
                      items={month.pendingSharedExpenses.filter(
                        ({ transaction }) =>
                          transaction.createdAt <
                          new Date(month.year, month.month - 1, 1).getTime(),
                      )}
                      onOpen={onEdit}
                    />
                    {month.transactions.length > 0 && (
                      <FinanceTransactionDayGroups
                        transactions={month.transactions}
                        deletingIds={deletingIds}
                        onDelete={onDelete}
                        onEdit={onEdit}
                        loansById={loansById}
                        onOpenLoan={onOpenLoan}
                        canDeleteLinkedExpense={canDeleteLinkedExpense}
                      />
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
