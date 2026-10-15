import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../../theme';
import { styles } from './FinanceDatePicker.styles';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function getMonthDays(year: number, monthIndex: number) {
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  const cellCount = Math.ceil((firstWeekday + dayCount) / 7) * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day < 1 || day > dayCount ? null : new Date(year, monthIndex, day);
  });
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatDateLabel(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function FinanceDatePicker({
  value,
  onChange,
}: {
  value: Date;
  onChange: (date: Date) => void;
}) {
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(value.getFullYear(), value.getMonth(), 1),
  );
  const year = visibleMonth.getFullYear();
  const monthIndex = visibleMonth.getMonth();
  const days = getMonthDays(year, monthIndex);
  const monthLabel = formatMonth(visibleMonth);

  function moveMonth(offset: number) {
    setVisibleMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  return (
    <View testID="finance-date-picker" style={styles.calendar}>
      <View style={styles.monthHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tháng trước"
          onPress={() => moveMonth(-1)}
          style={styles.monthArrow}
        >
          <Feather name="chevron-left" size={20} color={colors.earth} />
        </Pressable>
        <Text
          testID="finance-date-picker-month"
          accessibilityRole="header"
          style={styles.monthTitle}
        >
          {monthLabel}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tháng sau"
          onPress={() => moveMonth(1)}
          style={styles.monthArrow}
        >
          <Feather name="chevron-right" size={20} color={colors.earth} />
        </Pressable>
      </View>
      <View style={styles.weekdays}>
        {WEEKDAYS.map((weekday) => (
          <Text key={weekday} style={styles.weekday}>
            {weekday}
          </Text>
        ))}
      </View>
      <View style={styles.days}>
        {days.map((day, index) => {
          if (!day)
            return <View key={`empty-${index}`} style={styles.dayCell} />;
          const selected =
            day.getFullYear() === value.getFullYear() &&
            day.getMonth() === value.getMonth() &&
            day.getDate() === value.getDate();

          return (
            <Pressable
              key={day.getDate()}
              testID={`finance-date-picker-day-${formatDateLabel(day)}`}
              accessibilityRole="button"
              accessibilityLabel={`Chọn ngày ${formatDateLabel(day)}`}
              accessibilityState={{ selected }}
              onPress={() => onChange(day)}
              style={[styles.dayCell, selected && styles.selectedDayCell]}
            >
              <Text
                style={[styles.dayNumber, selected && styles.selectedDayNumber]}
              >
                {day.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
