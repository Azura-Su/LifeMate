import Feather from '@expo/vector-icons/Feather';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FinanceTransaction } from '../../types/finance';
import { colors, typography } from '../../theme';
import { formatFinanceAmount } from '../../utils/finance';
import {
  getMonthGrid,
  isSameDay,
  toDateKey,
} from '../../utils/vietnameseCalendar';
import { styles } from './HomeFinanceCard.styles';

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

type DayTotals = { income: number; expense: number; count: number };

function moveMonth(date: Date, offset: number) {
  const month = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  const day = Math.min(
    date.getDate(),
    new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(),
  );
  return new Date(month.getFullYear(), month.getMonth(), day);
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function formatCompactDay(date: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function HomeFinanceCard({
  today,
  transactions,
  loading,
  error,
  canViewFinance,
  onOpenFinance,
  dateResetKey = 0,
}: {
  today: Date;
  transactions: FinanceTransaction[];
  loading: boolean;
  error: string | null;
  canViewFinance: boolean;
  onOpenFinance: () => void;
  dateResetKey?: number;
}) {
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [monthDate, setMonthDate] = useState(() => today);
  const [pickerVisible, setPickerVisible] = useState(false);
  useEffect(() => setSelectedDate(null), [dateResetKey]);
  const dateBeingViewed = selectedDate ?? today;
  const selectedDateKey = toDateKey(dateBeingViewed);
  const year = monthDate.getFullYear();
  const monthIndex = monthDate.getMonth();
  const previousMonthDisabled = year <= 1900 && monthIndex === 0;
  const nextMonthDisabled = year >= 9999 && monthIndex === 11;
  const todayIsSelected = selectedDate === null;
  const monthLabel = new Intl.DateTimeFormat('vi-VN', {
    month: 'long',
    year: 'numeric',
  }).format(monthDate);
  const transactionsByDate = useMemo(() => {
    const totals = new Map<string, DayTotals>();
    for (const transaction of transactions) {
      const dateKey = toDateKey(new Date(transaction.createdAt));
      const day = totals.get(dateKey) ?? { income: 0, expense: 0, count: 0 };
      day[transaction.type] += transaction.amount;
      day.count += 1;
      totals.set(dateKey, day);
    }
    return totals;
  }, [transactions]);
  const selectedTotals = transactionsByDate.get(selectedDateKey) ?? {
    income: 0,
    expense: 0,
    count: 0,
  };
  const cells = useMemo(
    () => getMonthGrid(year, monthIndex),
    [year, monthIndex],
  );

  function selectDate(date: Date) {
    setSelectedDate(isSameDay(date, today) ? null : date);
    setMonthDate(date);
  }

  function openPicker() {
    setMonthDate(dateBeingViewed);
    setPickerVisible(true);
  }

  function selectPickerDate(date: Date) {
    selectDate(date);
    setPickerVisible(false);
  }

  function changePickerMonth(offset: number) {
    setMonthDate((current) => moveMonth(current, offset));
  }

  return (
    <View testID="home-finance-card" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Feather name="pie-chart" size={18} color={colors.earth} />
        </View>
        <View style={styles.headingCopy}>
          <View style={styles.headingTitleRow}>
            <Text accessibilityRole="header" style={styles.title}>
              Tài chính
            </Text>
            {canViewFinance && !loading && (
              <Pressable
                testID="home-finance-heading-date"
                accessibilityRole="button"
                accessibilityLabel={`Chọn ngày, ${todayIsSelected ? 'hôm nay' : formatDay(dateBeingViewed)}`}
                onPress={openPicker}
                style={styles.headerDateButton}
              >
                <Text numberOfLines={1} style={styles.headerDateText}>
                  {todayIsSelected
                    ? 'Hôm nay'
                    : formatCompactDay(dateBeingViewed)}
                </Text>
                <Feather name="chevron-down" size={13} color={colors.earth} />
              </Pressable>
            )}
          </View>
          <Text style={typography.small}>Thu chi theo ngày</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mở sổ Tài chính"
          onPress={onOpenFinance}
          style={styles.detailButton}
        >
          <Text style={styles.detailText}>Chi tiết</Text>
          <Feather name="arrow-up-right" size={16} color={colors.earth} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.status}>
          <ActivityIndicator color={colors.earth} />
          <Text style={typography.small}>Đang tải sổ thu chi…</Text>
        </View>
      ) : !canViewFinance ? (
        <View style={styles.locked}>
          <Feather name="lock" size={18} color={colors.earth} />
          <View style={styles.lockedCopy}>
            <Text style={styles.lockedTitle}>Sổ thu chi đang khóa</Text>
            <Text style={typography.small}>
              Mở Tài chính để xác thực và xem theo ngày.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở Tài chính để xác thực"
            onPress={onOpenFinance}
            style={styles.unlockButton}
          >
            <Feather name="arrow-right" size={18} color={colors.earth} />
          </Pressable>
        </View>
      ) : (
        <>
          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              Chưa tải được sổ thu chi. Kéo xuống để thử lại.
            </Text>
          )}

          <View style={styles.summary}>
            {!todayIsSelected && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Về hôm nay"
                onPress={() => {
                  setSelectedDate(null);
                  setMonthDate(today);
                }}
                style={styles.todayButton}
              >
                <Text style={styles.todayText}>Về hôm nay</Text>
              </Pressable>
            )}
            <View style={styles.totals}>
              <View style={[styles.total, styles.incomeTotal]}>
                <Text style={styles.incomeLabel}>Thu vào</Text>
                <Text numberOfLines={1} style={styles.incomeAmount}>
                  {formatFinanceAmount(selectedTotals.income)}
                </Text>
              </View>
              <View style={[styles.total, styles.expenseTotal]}>
                <Text style={styles.expenseLabel}>Chi ra</Text>
                <Text numberOfLines={1} style={styles.expenseAmount}>
                  {formatFinanceAmount(selectedTotals.expense)}
                </Text>
              </View>
            </View>
            {!selectedTotals.count && !error && (
              <Text style={styles.empty}>
                Chưa có giao dịch trong ngày này.
              </Text>
            )}
          </View>

          <Modal
            visible={pickerVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setPickerVisible(false)}
            statusBarTranslucent
          >
            <View style={styles.pickerOverlay}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng bộ chọn ngày"
                onPress={() => setPickerVisible(false)}
                style={styles.pickerBackdrop}
              />
              <View
                testID="home-finance-picker"
                accessibilityViewIsModal
                style={[
                  styles.pickerSheet,
                  { paddingBottom: Math.max(insets.bottom, 16) },
                ]}
              >
                <View style={styles.pickerGrabber} />
                <View style={styles.pickerHeading}>
                  <Text accessibilityRole="header" style={styles.pickerTitle}>
                    Chọn ngày
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Đóng bộ chọn ngày"
                    onPress={() => setPickerVisible(false)}
                    style={styles.pickerCloseButton}
                  >
                    <Feather name="x" size={20} color={colors.ink} />
                  </Pressable>
                </View>
                <View style={styles.monthHeader}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Tháng trước"
                    accessibilityState={{ disabled: previousMonthDisabled }}
                    disabled={previousMonthDisabled}
                    onPress={() => changePickerMonth(-1)}
                    style={[
                      styles.monthArrow,
                      previousMonthDisabled && styles.disabledArrow,
                    ]}
                  >
                    <Feather
                      name="chevron-left"
                      size={19}
                      color={colors.earth}
                    />
                  </Pressable>
                  <Text
                    testID="home-finance-month-label"
                    accessibilityRole="header"
                    style={styles.monthTitle}
                  >
                    {monthLabel}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Tháng sau"
                    accessibilityState={{ disabled: nextMonthDisabled }}
                    disabled={nextMonthDisabled}
                    onPress={() => changePickerMonth(1)}
                    style={[
                      styles.monthArrow,
                      nextMonthDisabled && styles.disabledArrow,
                    ]}
                  >
                    <Feather
                      name="chevron-right"
                      size={19}
                      color={colors.earth}
                    />
                  </Pressable>
                </View>
                <View style={styles.grid}>
                  {WEEKDAYS.map((weekday) => (
                    <Text key={weekday} style={styles.weekday}>
                      {weekday}
                    </Text>
                  ))}
                  {cells.map((date) => {
                    const dateKey = toDateKey(date);
                    const totals = transactionsByDate.get(dateKey);
                    const selected = isSameDay(date, dateBeingViewed);
                    const isToday = isSameDay(date, today);
                    const inMonth = date.getMonth() === monthIndex;
                    const dayLabel = new Intl.DateTimeFormat('vi-VN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }).format(date);
                    const activityLabel = totals
                      ? `, thu ${formatFinanceAmount(totals.income)}, chi ${formatFinanceAmount(totals.expense)}`
                      : ', chưa có giao dịch';
                    return (
                      <Pressable
                        key={dateKey}
                        testID={`home-finance-picker-day-${dateKey}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Chọn ngày ${dayLabel}${activityLabel}`}
                        accessibilityState={{ selected }}
                        onPress={() => selectPickerDate(date)}
                        style={[
                          styles.day,
                          !inMonth && styles.outsideMonth,
                          isToday && !selected && styles.todayCell,
                          selected && styles.selectedCell,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNumber,
                            isToday && !selected && styles.todayNumber,
                            selected && styles.selectedNumber,
                          ]}
                        >
                          {date.getDate()}
                        </Text>
                        {totals && (
                          <View style={styles.dots}>
                            {totals.income > 0 && (
                              <View style={[styles.dot, styles.incomeDot]} />
                            )}
                            {totals.expense > 0 && (
                              <View style={[styles.dot, styles.expenseDot]} />
                            )}
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </Modal>
        </>
      )}
    </View>
  );
}
