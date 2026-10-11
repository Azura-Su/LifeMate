import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
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

export function HomeFinanceCard({
  today,
  transactions,
  loading,
  error,
  canViewFinance,
  onOpenFinance,
}: {
  today: Date;
  transactions: FinanceTransaction[];
  loading: boolean;
  error: string | null;
  canViewFinance: boolean;
  onOpenFinance: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState(() => today);
  const [monthDate, setMonthDate] = useState(() => today);
  const [pickerVisible, setPickerVisible] = useState(false);
  const selectedDateKey = toDateKey(selectedDate);
  const year = monthDate.getFullYear();
  const monthIndex = monthDate.getMonth();
  const previousMonthDisabled = year <= 1900 && monthIndex === 0;
  const nextMonthDisabled = year >= 9999 && monthIndex === 11;
  const todayIsSelected = isSameDay(selectedDate, today);
  const monthLabel = new Intl.DateTimeFormat('vi-VN', {
    month: 'long',
    year: 'numeric',
  }).format(monthDate);
  const weekDates = useMemo(() => {
    const firstDate = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate() - selectedDate.getDay(),
    );
    return Array.from(
      { length: 7 },
      (_, index) =>
        new Date(
          firstDate.getFullYear(),
          firstDate.getMonth(),
          firstDate.getDate() + index,
        ),
    );
  }, [selectedDate]);
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
    setSelectedDate(date);
    setMonthDate(date);
  }

  function openPicker() {
    setMonthDate(selectedDate);
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
          <Text accessibilityRole="header" style={styles.title}>
            {todayIsSelected ? 'Tài chính hôm nay' : 'Tài chính theo ngày'}
          </Text>
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
            <Text style={styles.selectedDate}>
              {todayIsSelected ? 'Hôm nay' : formatDay(selectedDate)}
            </Text>
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

          <View style={styles.datePickerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Chọn ngày trong ${monthLabel}`}
              onPress={openPicker}
              style={styles.openPickerButton}
            >
              <Feather name="calendar" size={16} color={colors.earth} />
              <View style={styles.openPickerCopy}>
                <Text style={styles.openPickerHint}>Chọn ngày</Text>
                <Text numberOfLines={1} style={styles.openPickerMonth}>
                  {monthLabel}
                </Text>
              </View>
              <Feather name="chevron-down" size={16} color={colors.earth} />
            </Pressable>
            {!todayIsSelected && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Về hôm nay"
                onPress={() => {
                  setSelectedDate(today);
                  setMonthDate(today);
                }}
                style={styles.todayButton}
              >
                <Text style={styles.todayText}>Hôm nay</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.weekStrip}>
            {weekDates.map((date) => {
              const dateKey = toDateKey(date);
              const totals = transactionsByDate.get(dateKey);
              const selected = isSameDay(date, selectedDate);
              const isToday = isSameDay(date, today);
              const weekday = WEEKDAYS[date.getDay()];
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
                  testID={`home-finance-day-${dateKey}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Chọn ${weekday}, ngày ${dayLabel}${activityLabel}`}
                  accessibilityState={{ selected }}
                  onPress={() => selectDate(date)}
                  style={[
                    styles.weekDay,
                    isToday && !selected && styles.todayWeekDay,
                    selected && styles.selectedWeekDay,
                  ]}
                >
                  <Text style={styles.weekdayLabel}>{weekday}</Text>
                  <Text style={styles.weekDayNumber}>{date.getDate()}</Text>
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
                    const selected = isSameDay(date, selectedDate);
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
