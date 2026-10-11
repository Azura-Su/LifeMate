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
const MIN_PICKER_YEAR = 1900;
const MAX_PICKER_YEAR = 9999;
const YEAR_PAGE_SIZE = 12;

type DayTotals = { income: number; expense: number };

function getYearPageStart(year: number) {
  return (
    MIN_PICKER_YEAR +
    Math.floor((year - MIN_PICKER_YEAR) / YEAR_PAGE_SIZE) * YEAR_PAGE_SIZE
  );
}

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
    year: 'numeric',
  }).format(date);
}

function formatCompactDay(date: Date, currentYear: number) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dateLabel = `${day}/${month}`;
  return date.getFullYear() === currentYear
    ? dateLabel
    : `${dateLabel}/${date.getFullYear()}`;
}

export function HomeFinanceCard({
  today,
  transactions,
  loading,
  error,
  onOpenFinance,
  dateResetKey = 0,
}: {
  today: Date;
  transactions: FinanceTransaction[];
  loading: boolean;
  error: string | null;
  onOpenFinance: () => void;
  dateResetKey?: number;
}) {
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [monthDate, setMonthDate] = useState(() => today);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);
  useEffect(() => setSelectedDate(null), [dateResetKey]);
  const dateBeingViewed = selectedDate ?? today;
  const selectedDateKey = toDateKey(dateBeingViewed);
  const year = monthDate.getFullYear();
  const monthIndex = monthDate.getMonth();
  const previousMonthDisabled = year <= 1900 && monthIndex === 0;
  const nextMonthDisabled = year >= 9999 && monthIndex === 11;
  const yearPageStart = getYearPageStart(year);
  const yearPageEnd = Math.min(
    MAX_PICKER_YEAR,
    yearPageStart + YEAR_PAGE_SIZE - 1,
  );
  const previousPickerDisabled = yearPickerVisible
    ? yearPageStart === MIN_PICKER_YEAR
    : previousMonthDisabled;
  const nextPickerDisabled = yearPickerVisible
    ? yearPageEnd === MAX_PICKER_YEAR
    : nextMonthDisabled;
  const todayIsSelected = selectedDate === null;
  const monthLabel = new Intl.DateTimeFormat('vi-VN', {
    month: 'long',
  }).format(monthDate);
  const transactionsByDate = useMemo(() => {
    const totals = new Map<string, DayTotals>();
    for (const transaction of transactions) {
      const dateKey = toDateKey(new Date(transaction.createdAt));
      const day = totals.get(dateKey) ?? { income: 0, expense: 0 };
      day[transaction.type] += transaction.amount;
      totals.set(dateKey, day);
    }
    return totals;
  }, [transactions]);
  const selectedTotals = transactionsByDate.get(selectedDateKey) ?? {
    income: 0,
    expense: 0,
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
    setYearPickerVisible(false);
    setPickerVisible(true);
  }

  function selectPickerDate(date: Date) {
    selectDate(date);
    setPickerVisible(false);
  }

  function changePickerMonth(offset: number) {
    setMonthDate((current) => moveMonth(current, offset));
  }

  function changeYearPage(offset: number) {
    setMonthDate((current) => {
      const nextYear = Math.max(
        MIN_PICKER_YEAR,
        Math.min(
          MAX_PICKER_YEAR - YEAR_PAGE_SIZE + 1,
          getYearPageStart(current.getFullYear()) + offset * YEAR_PAGE_SIZE,
        ),
      );
      return new Date(nextYear, current.getMonth(), 1);
    });
  }

  function selectYear(selectedYear: number) {
    setMonthDate(new Date(selectedYear, monthIndex, 1));
    setYearPickerVisible(false);
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
            {!loading && (
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
                    : formatCompactDay(dateBeingViewed, today.getFullYear())}
                </Text>
                <Feather name="chevron-down" size={13} color={colors.earth} />
              </Pressable>
            )}
          </View>
          {!loading && !todayIsSelected && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Về hôm nay"
              onPress={() => {
                setSelectedDate(null);
                setMonthDate(today);
              }}
              style={styles.headerTodayButton}
            >
              <Feather name="rotate-ccw" size={13} color={colors.earth} />
              <Text style={styles.todayText}>Về hôm nay</Text>
            </Pressable>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mở sổ Tài chính"
          onPress={onOpenFinance}
          style={styles.detailButton}
        >
          <Feather name="arrow-up-right" size={16} color={colors.earth} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.status}>
          <ActivityIndicator color={colors.earth} />
          <Text style={typography.small}>Đang tải sổ thu chi…</Text>
        </View>
      ) : (
        <>
          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              Chưa tải được sổ thu chi. Kéo xuống để thử lại.
            </Text>
          )}

          <View style={styles.summary}>
            <View style={styles.totals}>
              <View style={[styles.total, styles.incomeTotal]}>
                <Text style={styles.incomeLabel}>Thu</Text>
                <Text numberOfLines={1} style={styles.incomeAmount}>
                  {formatFinanceAmount(selectedTotals.income)}
                </Text>
              </View>
              <View style={[styles.total, styles.expenseTotal]}>
                <Text style={styles.expenseLabel}>Chi</Text>
                <Text numberOfLines={1} style={styles.expenseAmount}>
                  {formatFinanceAmount(selectedTotals.expense)}
                </Text>
              </View>
            </View>
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
                    accessibilityLabel={
                      yearPickerVisible ? '12 năm trước' : 'Tháng trước'
                    }
                    accessibilityState={{ disabled: previousPickerDisabled }}
                    disabled={previousPickerDisabled}
                    onPress={() =>
                      yearPickerVisible
                        ? changeYearPage(-1)
                        : changePickerMonth(-1)
                    }
                    style={[
                      styles.monthArrow,
                      previousPickerDisabled && styles.disabledArrow,
                    ]}
                  >
                    <Feather
                      name="chevron-left"
                      size={19}
                      color={colors.earth}
                    />
                  </Pressable>
                  {yearPickerVisible ? (
                    <Text
                      testID="home-finance-month-label"
                      accessibilityRole="header"
                      style={styles.yearRangeTitle}
                    >
                      {yearPageStart} – {yearPageEnd}
                    </Text>
                  ) : (
                    <View style={styles.monthPickerControl}>
                      <Text
                        testID="home-finance-month-label"
                        accessibilityRole="header"
                        style={styles.monthTitle}
                      >
                        {monthLabel}
                      </Text>
                      <Text style={styles.monthTitle}>Năm</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Chọn năm ${year}`}
                        onPress={() => setYearPickerVisible(true)}
                        style={styles.yearButton}
                      >
                        <Text style={styles.yearButtonText}>{year}</Text>
                      </Pressable>
                    </View>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      yearPickerVisible ? '12 năm sau' : 'Tháng sau'
                    }
                    accessibilityState={{ disabled: nextPickerDisabled }}
                    disabled={nextPickerDisabled}
                    onPress={() =>
                      yearPickerVisible
                        ? changeYearPage(1)
                        : changePickerMonth(1)
                    }
                    style={[
                      styles.monthArrow,
                      nextPickerDisabled && styles.disabledArrow,
                    ]}
                  >
                    <Feather
                      name="chevron-right"
                      size={19}
                      color={colors.earth}
                    />
                  </Pressable>
                </View>
                {yearPickerVisible ? (
                  <View style={styles.yearGrid}>
                    {Array.from(
                      { length: yearPageEnd - yearPageStart + 1 },
                      (_, index) => yearPageStart + index,
                    ).map((candidateYear) => (
                      <Pressable
                        key={candidateYear}
                        testID={`home-finance-picker-year-${candidateYear}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Chọn năm ${candidateYear}`}
                        accessibilityState={{ selected: candidateYear === year }}
                        onPress={() => selectYear(candidateYear)}
                        style={[
                          styles.yearOption,
                          candidateYear === year && styles.selectedYearOption,
                        ]}
                      >
                        <Text style={styles.yearOptionText}>
                          {candidateYear}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
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
                )}
              </View>
            </View>
          </Modal>
        </>
      )}
    </View>
  );
}
