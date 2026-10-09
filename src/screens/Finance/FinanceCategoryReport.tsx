import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { colors } from '../../theme';
import type {
  FinanceTransaction,
  FinanceTransactionType,
} from '../../types/finance';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../types/finance';
import {
  formatFinanceAmount,
  getExpenseReport,
  getIncomeReport,
} from '../../utils/finance';
import { FinanceTransactionRow } from './FinanceTransactionRow';
import { categoryReportStyles as styles } from './FinanceCategoryReport.styles';

export type FinanceReportPoint = { year: number; month: number };
export type FinancePeriodMode = 'year' | 'range';
type PickerEdge = 'start' | 'end';

type Props = {
  kind: Extract<FinanceTransactionType, 'income' | 'expense'>;
  transactions: FinanceTransaction[];
  onDelete: (transaction: FinanceTransaction) => void;
  onEdit: (transaction: FinanceTransaction) => void;
  customCategories?: string[];
  onAdd: (year: number, month: number) => void;
  periodMode: FinancePeriodMode;
  onPeriodModeChange: (mode: FinancePeriodMode) => void;
  year: number;
  onYearChange: (year: number) => void;
  start: FinanceReportPoint;
  onStartChange: (point: FinanceReportPoint) => void;
  end: FinanceReportPoint;
  onEndChange: (point: FinanceReportPoint) => void;
};

const monthName = (month: number) =>
  new Intl.DateTimeFormat('vi-VN', { month: 'long' }).format(
    new Date(2024, month - 1, 1),
  );

const pointValue = ({ year, month }: FinanceReportPoint) => year * 12 + month;

function formatPeriodPoint({ year, month }: FinanceReportPoint) {
  return `${String(month).padStart(2, '0')}/${year}`;
}

export function FinanceCategoryReport({
  kind,
  transactions,
  onDelete,
  onEdit,
  customCategories,
  onAdd,
  periodMode,
  onPeriodModeChange,
  year,
  onYearChange,
  start,
  onStartChange,
  end,
  onEndChange,
}: Props) {
  const isIncome = kind === 'income';
  const categories = useMemo(
    () => [
      ...new Set([
        ...(customCategories ??
          (isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)),
        ...transactions
          .filter((transaction) => transaction.type === kind)
          .map((transaction) => transaction.category.trim())
          .filter(Boolean),
      ]),
    ],
    [customCategories, isIncome, kind, transactions],
  );
  const categoryLabel = isIncome ? 'khoản thu' : 'khoản chi';
  const totalLabel = isIncome ? 'Tổng thu nhập' : 'Tổng chi tiêu';
  const report = useMemo(() => {
    const getReport = isIncome ? getIncomeReport : getExpenseReport;
    return periodMode === 'year'
      ? getReport(transactions, year, 1, year, 12, customCategories)
      : getReport(
          transactions,
          start.year,
          start.month,
          end.year,
          end.month,
          customCategories,
        );
  }, [transactions, isIncome, periodMode, year, start, end, customCategories]);
  const [picker, setPicker] = useState<{
    edge: PickerEdge;
    point: FinanceReportPoint;
  } | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    () => new Set(),
  );
  const selectedPoint = picker?.point ?? start;

  function toggleMonth(key: string) {
    setExpandedMonths((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function changePoint(month: number) {
    if (!picker) return;
    const chosen = { ...selectedPoint, month };
    if (picker.edge === 'start') {
      onStartChange(chosen);
      if (pointValue(chosen) > pointValue(end)) onEndChange(chosen);
    } else {
      onEndChange(chosen);
      if (pointValue(chosen) < pointValue(start)) onStartChange(chosen);
    }
    setPicker(null);
  }

  function changePickerYear(delta: number) {
    if (!picker) return;
    const nextYear = Math.min(9999, Math.max(1900, selectedPoint.year + delta));
    setPicker({ ...picker, point: { ...selectedPoint, year: nextYear } });
  }

  const periodLabel =
    periodMode === 'year'
      ? `Cả năm ${year}`
      : `${formatPeriodPoint(start)} – ${formatPeriodPoint(end)}`;

  return (
    <View style={styles.container}>
      <View style={styles.periodCard}>
        <View style={styles.modeSwitch}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: periodMode === 'year' }}
            onPress={() => onPeriodModeChange('year')}
            style={[
              styles.modeButton,
              periodMode === 'year' && styles.modeSelected,
            ]}
          >
            <Text
              style={[
                styles.modeText,
                periodMode === 'year' && styles.modeTextSelected,
              ]}
            >
              Cả năm
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: periodMode === 'range' }}
            onPress={() => onPeriodModeChange('range')}
            style={[
              styles.modeButton,
              periodMode === 'range' && styles.modeSelected,
            ]}
          >
            <Text
              style={[
                styles.modeText,
                periodMode === 'range' && styles.modeTextSelected,
              ]}
            >
              Tùy chọn tháng
            </Text>
          </Pressable>
        </View>

        {periodMode === 'year' ? (
          <View style={styles.yearPicker}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Năm báo cáo trước"
              disabled={year <= 1900}
              hitSlop={8}
              onPress={() => onYearChange(Math.max(1900, year - 1))}
              style={styles.yearArrow}
            >
              <Feather name="chevron-left" size={20} color={colors.earth} />
            </Pressable>
            <Text accessibilityRole="header" style={styles.yearText}>
              {year}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Năm báo cáo sau"
              disabled={year >= 9999}
              hitSlop={8}
              onPress={() => onYearChange(Math.min(9999, year + 1))}
              style={styles.yearArrow}
            >
              <Feather name="chevron-right" size={20} color={colors.earth} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.rangeRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chọn tháng bắt đầu"
              onPress={() => setPicker({ edge: 'start', point: { ...start } })}
              style={styles.rangeButton}
            >
              <Text style={styles.rangeLabel}>Từ tháng</Text>
              <View style={styles.rangeValueRow}>
                <Text style={styles.rangeValue}>
                  {formatPeriodPoint(start)}
                </Text>
                <Feather name="chevron-down" size={15} color={colors.muted} />
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chọn tháng kết thúc"
              onPress={() => setPicker({ edge: 'end', point: { ...end } })}
              style={styles.rangeButton}
            >
              <Text style={styles.rangeLabel}>Đến tháng</Text>
              <View style={styles.rangeValueRow}>
                <Text style={styles.rangeValue}>{formatPeriodPoint(end)}</Text>
                <Feather name="chevron-down" size={15} color={colors.muted} />
              </View>
            </Pressable>
          </View>
        )}
        <Text style={styles.periodHint}>
          {isIncome
            ? 'Chỉ tính lương, thưởng và thu thêm'
            : 'Chỉ tính các khoản chi tiêu'}
        </Text>
      </View>

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
        {report.total > 0 && (
          <View style={styles.categoryTotals}>
            {categories
              .filter(
                (category) =>
                  (report.categories as Record<string, number>)[category] > 0,
              )
              .map((category) => (
                <View key={category} style={styles.categoryTotalRow}>
                  <View style={styles.categoryNameRow}>
                    <View
                      style={[
                        styles.categoryDot,
                        !isIncome && styles.expenseCategoryDot,
                      ]}
                    />
                    <Text style={styles.categoryName}>{category}</Text>
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
          Theo từng tháng
        </Text>
        <Text style={styles.monthCount}>
          {report.months.length} tháng có {isIncome ? 'thu' : 'chi'}
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
                    onPress={() => onAdd(month.year, month.month)}
                    style={styles.monthAddButton}
                  >
                    <Feather name="plus" size={17} color={colors.earth} />
                  </Pressable>
                </View>
                {expanded && (
                  <View style={styles.transactionList}>
                    {month.transactions.map((transaction) => (
                      <FinanceTransactionRow
                        key={transaction.id}
                        transaction={transaction}
                        onDelete={onDelete}
                        onEdit={onEdit}
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <DialogModal
        visible={picker !== null}
        onRequestClose={() => setPicker(null)}
        style={styles.dialog}
      >
        <Text accessibilityRole="header" style={styles.dialogTitle}>
          {picker?.edge === 'start'
            ? 'Chọn tháng bắt đầu'
            : 'Chọn tháng kết thúc'}
        </Text>
        <View style={styles.dialogYearRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Năm trước"
            disabled={selectedPoint.year <= 1900}
            onPress={() => changePickerYear(-1)}
            style={styles.dialogYearArrow}
          >
            <Feather name="chevron-left" size={20} color={colors.earth} />
          </Pressable>
          <Text style={styles.dialogYear}>{selectedPoint.year}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Năm sau"
            disabled={selectedPoint.year >= 9999}
            onPress={() => changePickerYear(1)}
            style={styles.dialogYearArrow}
          >
            <Feather name="chevron-right" size={20} color={colors.earth} />
          </Pressable>
        </View>
        <View style={styles.monthGrid}>
          {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
            const selected = month === selectedPoint.month;
            return (
              <Pressable
                key={month}
                accessibilityRole="button"
                accessibilityLabel={`${monthName(month)} ${selectedPoint.year}`}
                accessibilityState={{ selected }}
                onPress={() => changePoint(month)}
                style={[styles.monthChoice, selected && styles.monthSelected]}
              >
                <Text
                  style={[
                    styles.monthChoiceText,
                    selected && styles.monthChoiceTextSelected,
                  ]}
                >
                  {monthName(month)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Button
          title="Đóng"
          variant="secondary"
          onPress={() => setPicker(null)}
        />
      </DialogModal>
    </View>
  );
}
