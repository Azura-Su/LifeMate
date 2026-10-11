import Feather from '@expo/vector-icons/Feather';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { LifeNote } from '../../types/note';
import { colors } from '../../theme';
import { isCalendarNoteForDate } from '../../utils/calendarNotes';
import {
  formatLunarDate,
  getMonthGrid,
  getVietnamCalendarEvents,
  isSolarDateSupported,
  isSameDay,
  MAX_SOLAR_YEAR,
  MIN_SOLAR_YEAR,
  solarToLunar,
  toDateKey,
} from '../../utils/vietnameseCalendar';
import { styles } from './HomeCalendar.styles';

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function moveMonth(date: Date, offset: number) {
  const targetMonth = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  const day = Math.min(
    date.getDate(),
    new Date(
      targetMonth.getFullYear(),
      targetMonth.getMonth() + 1,
      0,
    ).getDate(),
  );
  return new Date(targetMonth.getFullYear(), targetMonth.getMonth(), day);
}

export function HomeCalendar({
  selectedDate,
  monthDate = selectedDate,
  noteDateKeys,
  notes = [],
  checklistDateKeys,
  onSelect,
  onMonthChange,
}: {
  selectedDate: Date;
  monthDate?: Date;
  noteDateKeys?: string[];
  notes?: LifeNote[];
  checklistDateKeys?: string[];
  onSelect: (date: Date) => void;
  onMonthChange?: (date: Date) => void;
}) {
  const year = monthDate.getFullYear();
  const monthIndex = monthDate.getMonth();
  const previousMonthDisabled = year <= MIN_SOLAR_YEAR && monthIndex === 0;
  const nextMonthDisabled = year >= MAX_SOLAR_YEAR && monthIndex === 11;
  const today = new Date();
  // Lunar dates and holidays depend only on the visible month; compute them
  // once per month instead of on every selection or parent re-render.
  const cells = useMemo(
    () =>
      getMonthGrid(year, monthIndex).map((date) => {
        const supported = isSolarDateSupported(date);
        return {
          date,
          dateKey: toDateKey(date),
          supported,
          lunar: supported
            ? solarToLunar(
                date.getDate(),
                date.getMonth() + 1,
                date.getFullYear(),
              )
            : null,
          events: supported ? getVietnamCalendarEvents(date) : [],
        };
      }),
    [year, monthIndex],
  );
  const datesWithNotes = useMemo(() => new Set(noteDateKeys), [noteDateKeys]);
  const recurringNoteDates = useMemo(
    () =>
      new Set(
        cells
          .filter(({ dateKey }) =>
            notes.some((note) => isCalendarNoteForDate(note, dateKey)),
          )
          .map(({ dateKey }) => dateKey),
      ),
    [cells, notes],
  );
  const datesWithChecklists = useMemo(
    () => new Set(checklistDateKeys),
    [checklistDateKeys],
  );
  const monthLabel = new Intl.DateTimeFormat('vi-VN', {
    month: 'long',
    year: 'numeric',
  }).format(monthDate);
  const changeMonth = onMonthChange ?? onSelect;
  const showingCurrentMonth =
    year === today.getFullYear() && monthIndex === today.getMonth();

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.monthActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tháng trước"
            accessibilityState={{ disabled: previousMonthDisabled }}
            disabled={previousMonthDisabled}
            onPress={() => changeMonth(moveMonth(monthDate, -1))}
            style={[
              styles.arrow,
              previousMonthDisabled && styles.disabledArrow,
            ]}
          >
            <Feather name="chevron-left" size={20} color={colors.earth} />
          </Pressable>
          <Text accessibilityRole="header" style={styles.monthTitle}>
            {monthLabel}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tháng sau"
            accessibilityState={{ disabled: nextMonthDisabled }}
            disabled={nextMonthDisabled}
            onPress={() => changeMonth(moveMonth(monthDate, 1))}
            style={[styles.arrow, nextMonthDisabled && styles.disabledArrow]}
          >
            <Feather name="chevron-right" size={20} color={colors.earth} />
          </Pressable>
        </View>
        {(!isSameDay(selectedDate, today) || !showingCurrentMonth) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Về hôm nay"
            onPress={() => {
              onSelect(today);
              onMonthChange?.(today);
            }}
            style={styles.todayButton}
          >
            <Text style={styles.todayText}>Hôm nay</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendText}>Dương lịch</Text>
        <Text style={styles.legendDot}>·</Text>
        <Text style={styles.legendText}>Âm lịch</Text>
        <View style={styles.legendSpacer} />
        <View style={styles.holidayLegend} />
        <Text style={styles.legendText}>Lễ</Text>
        <View style={styles.noteLegend} />
        <Text style={styles.legendText}>Ghi chú</Text>
        <View style={styles.checklistLegend} />
        <Text style={styles.legendText}>Chuẩn bị</Text>
      </View>
      <View style={styles.grid}>
        {WEEKDAYS.map((weekday) => (
          <Text key={weekday} style={styles.weekday}>
            {weekday}
          </Text>
        ))}
        {cells.map(({ date, dateKey, lunar, events, supported }) => {
          const selected = isSameDay(date, selectedDate);
          const isToday = isSameDay(date, today);
          const inMonth = date.getMonth() === monthIndex;
          const lunarLabel =
            lunar === null
              ? ''
              : lunar.day === 1
                ? `${lunar.day}/${lunar.month}`
                : String(lunar.day);
          const hasNote =
            datesWithNotes.has(dateKey) || recurringNoteDates.has(dateKey);
          const hasChecklist = datesWithChecklists.has(dateKey);
          const dayLabel = `${date.getDate()} tháng ${date.getMonth() + 1}${lunar ? `, ngày âm ${formatLunarDate(lunar)}` : ''}${events.length ? `, ${events.map((event) => event.title).join(', ')}` : ''}${hasNote ? ', có ghi chú' : ''}${hasChecklist ? ', có danh sách chuẩn bị' : ''}`;
          const eventKind = events.some((event) => event.kind === 'holiday')
            ? 'holiday'
            : events.length
              ? 'festival'
              : null;
          return (
            <Pressable
              key={dateKey}
              testID={`calendar-day-${dateKey}`}
              accessibilityRole="button"
              accessibilityLabel={`Chọn ngày ${dayLabel}`}
              accessibilityState={{ selected, disabled: !supported }}
              disabled={!supported}
              onPress={() => onSelect(date)}
              style={[
                styles.day,
                !inMonth && styles.outsideMonth,
                !supported && styles.unsupportedDay,
                isToday && !selected && styles.todayCell,
                selected && styles.selectedCell,
              ]}
            >
              <Text
                style={[
                  styles.solarDay,
                  isToday && !selected && styles.todayTextColor,
                  selected && styles.selectedText,
                ]}
              >
                {date.getDate()}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.lunarDay, selected && styles.selectedLunarText]}
              >
                {lunarLabel}
              </Text>
              {(eventKind || hasNote || hasChecklist) && (
                <View style={styles.dotsRow}>
                  {eventKind && (
                    <View
                      style={[
                        styles.eventDot,
                        eventKind === 'holiday'
                          ? styles.holidayDot
                          : styles.festivalDot,
                        selected && styles.selectedEventDot,
                      ]}
                    />
                  )}
                  {hasNote && (
                    <View
                      testID={`calendar-note-dot-${dateKey}`}
                      style={[
                        styles.eventDot,
                        styles.noteDot,
                        selected && styles.selectedEventDot,
                      ]}
                    />
                  )}
                  {hasChecklist && (
                    <View
                      testID={`calendar-checklist-dot-${dateKey}`}
                      style={[
                        styles.eventDot,
                        styles.checklistDot,
                        selected && styles.selectedEventDot,
                      ]}
                    />
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
