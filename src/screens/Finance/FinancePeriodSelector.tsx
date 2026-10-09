import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { colors } from '../../theme';
import { styles } from './FinancePeriodSelector.styles';

type Props = {
  year: number;
  month: number;
  onPeriodChange: (year: number, month: number) => void;
};

export function FinancePeriodSelector({ year, month, onPeriodChange }: Props) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const isCurrentMonth = year === currentYear && month === currentMonth;

  function moveMonth(delta: number) {
    const current = year * 12 + month - 1;
    const next = Math.min(9999 * 12 + 11, Math.max(1900 * 12, current + delta));
    onPeriodChange(Math.floor(next / 12), (next % 12) + 1);
  }

  return (
    <>
      <View style={styles.card}>
        <View style={styles.monthNavigation}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tháng trước"
            accessibilityState={{ disabled: year === 1900 && month === 1 }}
            disabled={year === 1900 && month === 1}
            hitSlop={8}
            onPress={() => moveMonth(-1)}
            style={styles.navigationButton}
          >
            <Feather name="chevron-left" size={20} color={colors.earth} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chọn tháng xem giao dịch"
            onPress={() => {
              setPickerYear(year);
              setPickerVisible(true);
            }}
            style={styles.selectedMonthButton}
          >
            <Feather name="calendar" size={16} color={colors.earth} />
            <Text style={styles.selectedMonthText}>
              Tháng {month} · {year}
            </Text>
            <Feather name="chevron-down" size={15} color={colors.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tháng sau"
            accessibilityState={{ disabled: year === 9999 && month === 12 }}
            disabled={year === 9999 && month === 12}
            hitSlop={8}
            onPress={() => moveMonth(1)}
            style={styles.navigationButton}
          >
            <Feather name="chevron-right" size={20} color={colors.earth} />
          </Pressable>
        </View>
        {!isCurrentMonth && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Về tháng hiện tại"
            onPress={() => onPeriodChange(currentYear, currentMonth)}
            style={styles.currentMonthButton}
          >
            <Feather name="rotate-ccw" size={13} color={colors.sky} />
            <Text style={styles.currentMonthText}>Tháng hiện tại</Text>
          </Pressable>
        )}
      </View>

      <DialogModal
        visible={pickerVisible}
        onRequestClose={() => setPickerVisible(false)}
        style={styles.dialog}
      >
        <Text accessibilityRole="header" style={styles.dialogTitle}>
          Chọn tháng xem giao dịch
        </Text>
        <View style={styles.yearRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Năm trước"
            disabled={pickerYear <= 1900}
            onPress={() => setPickerYear(Math.max(1900, pickerYear - 1))}
            style={styles.yearButton}
          >
            <Feather name="chevron-left" size={20} color={colors.earth} />
          </Pressable>
          <Text accessibilityRole="header" style={styles.year}>
            {pickerYear}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Năm sau"
            disabled={pickerYear >= 9999}
            onPress={() => setPickerYear(Math.min(9999, pickerYear + 1))}
            style={styles.yearButton}
          >
            <Feather name="chevron-right" size={20} color={colors.earth} />
          </Pressable>
        </View>
        <View style={styles.monthGrid}>
          {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => {
            const selected = value === month && pickerYear === year;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`Tháng ${value}`}
                accessibilityState={{ selected }}
                onPress={() => {
                  onPeriodChange(pickerYear, value);
                  setPickerVisible(false);
                }}
                style={[styles.monthChoice, selected && styles.monthSelected]}
              >
                <Text
                  style={[
                    styles.monthChoiceText,
                    selected && styles.monthChoiceTextSelected,
                  ]}
                >
                  Tháng {value}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {!isCurrentMonth && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onPeriodChange(currentYear, currentMonth);
              setPickerVisible(false);
            }}
            style={styles.currentMonthButton}
          >
            <Feather name="rotate-ccw" size={14} color={colors.sky} />
            <Text style={styles.currentMonthText}>Về tháng hiện tại</Text>
          </Pressable>
        )}
        <Button
          title="Đóng"
          variant="secondary"
          onPress={() => setPickerVisible(false)}
        />
      </DialogModal>
    </>
  );
}
