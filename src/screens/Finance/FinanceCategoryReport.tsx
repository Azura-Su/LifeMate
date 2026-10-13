import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../../theme';
import type {
  FinanceTransaction,
  FinanceTransactionType,
  RegularFinanceIncomeSource,
} from '../../types/finance';
import type { LoanRecord } from '../../types/loan';
import {
  formatFinanceAmount,
  getExpenseReport,
  getFinanceIncomeSource,
  getFinanceReportContribution,
  getIncomeReport,
} from '../../utils/finance';
import { FinanceTransactionDayGroups } from './FinanceTransactionDayGroups';
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
}: Props) {
  const isIncome = kind === 'income';
  const reportTransactions = useMemo(
    () =>
      isIncome
        ? transactions.filter(
            (transaction) =>
              transaction.type === 'income' &&
              transaction.incomeSource !== 'loan_repayment' &&
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

  return (
    <View style={styles.container}>
      <View style={styles.summaryCard}>
        <View style={[styles.totalCard, !isIncome && styles.expenseTotalCard]}>
          <Text style={styles.totalLabel}>{totalLabel}</Text>
          <Text
            accessibilityRole="text"
            accessibilityLabel={`${totalLabel}: ${formatFinanceAmount(report.total)}`}
            style={[styles.totalAmount, !isIncome && styles.expenseTotalAmount]}
          >
            {formatFinanceAmount(report.total)}
          </Text>
          <View style={styles.periodBadge}>
            <Feather name="calendar" size={12} color={colors.sky} />
            <Text style={styles.periodBadgeText}>{periodLabel}</Text>
          </View>
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

      <View style={styles.detailsHeading}>
        <Text accessibilityRole="header" style={styles.detailsTitle}>
          {periodMode === 'month' ? 'Giao dịch trong tháng' : 'Theo từng tháng'}
        </Text>
        <Text style={styles.monthCount}>
          {periodMode === 'month'
            ? report.months.length > 0
              ? `${report.months[0].transactions.length} giao dịch`
              : 'Chưa phát sinh'
            : report.months.length > 0
              ? `${report.months.length} tháng có giao dịch`
              : 'Chưa phát sinh'}
        </Text>
      </View>

      {report.months.length === 0 ? (
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
      ) : (
        <View style={styles.monthList}>
          {report.months.map((month) => {
            const key = `${kind}-${month.year}-${month.month}`;
            const expanded = expandedMonths.has(key);
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
                    <Feather name="plus" size={17} color={colors.earth} />
                  </Pressable>
                </View>
                {expanded && (
                  <View style={styles.transactionList}>
                    <FinanceTransactionDayGroups
                      transactions={month.transactions}
                      deletingIds={deletingIds}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      loansById={loansById}
                      onOpenLoan={onOpenLoan}
                      canDeleteLinkedExpense={canDeleteLinkedExpense}
                    />
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
