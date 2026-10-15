import Feather from '@expo/vector-icons/Feather';
import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { DialogCloseButton } from '../../components/DialogCloseButton';
import { DialogModal } from '../../components/DialogModal';
import { colors } from '../../theme';
import type {
  FinanceIncomeSourceFilter,
  FinancePeriodMode,
  FinanceReportPoint,
} from './FinanceCategoryReport';
import { categoryReportStyles as styles } from './FinanceCategoryReport.styles';

type PickerEdge = 'start' | 'end' | 'month';
type Props = {
  kind: 'income' | 'expense';
  incomeSource: FinanceIncomeSourceFilter;
  onIncomeSourceChange: (source: FinanceIncomeSourceFilter) => void;
  periodMode: FinancePeriodMode;
  onPeriodModeChange: (mode: FinancePeriodMode) => void;
  year: number;
  onYearChange: (year: number) => void;
  month: FinanceReportPoint;
  onMonthChange: (point: FinanceReportPoint) => void;
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

export function FinanceCategoryReportControls({
  kind,
  incomeSource,
  onIncomeSourceChange,
  periodMode,
  onPeriodModeChange,
  year,
  onYearChange,
  month,
  onMonthChange,
  start,
  onStartChange,
  end,
  onEndChange,
}: Props) {
  const isIncome = kind === 'income';
  const [picker, setPicker] = useState<{
    edge: PickerEdge;
    point: FinanceReportPoint;
  } | null>(null);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const sourcePickerRef = useRef<View>(null);
  const [sourceMenuAnchor, setSourceMenuAnchor] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const sourceMenuWidth = Math.min(
    windowWidth - 24,
    Math.max(172, sourceMenuAnchor.width),
  );
  const sourceMenuHeight = 132;
  const sourceMenuLeft = Math.max(
    12,
    Math.min(
      sourceMenuAnchor.x + sourceMenuAnchor.width - sourceMenuWidth,
      windowWidth - sourceMenuWidth - 12,
    ),
  );
  const sourceMenuTop =
    sourceMenuAnchor.y + sourceMenuAnchor.height + sourceMenuHeight + 12 <=
    windowHeight
      ? sourceMenuAnchor.y + sourceMenuAnchor.height + 4
      : Math.max(12, sourceMenuAnchor.y - sourceMenuHeight - 4);
  const selectedPoint = picker?.point ?? start;
  const sourceLabel =
    incomeSource === 'company'
      ? 'Công ty'
      : incomeSource === 'other'
        ? 'Ngoài công ty'
        : 'Tất cả';

  function changePoint(month: number) {
    if (!picker) return;
    const chosen = { ...selectedPoint, month };
    if (picker.edge === 'month') {
      onMonthChange(chosen);
      setPicker(null);
      return;
    }
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

  function moveReportMonth(delta: number) {
    const monthIndex = Math.min(
      9999 * 12 + 11,
      Math.max(1900 * 12, month.year * 12 + month.month - 1 + delta),
    );
    onMonthChange({
      year: Math.floor(monthIndex / 12),
      month: (monthIndex % 12) + 1,
    });
  }

  function toggleSourceMenu() {
    if (sourcePickerOpen) {
      setSourcePickerOpen(false);
      return;
    }
    if (!sourcePickerRef.current?.measureInWindow) {
      setSourcePickerOpen(true);
      return;
    }
    sourcePickerRef.current.measureInWindow((x, y, width, height) => {
      setSourceMenuAnchor({ x, y, width, height });
      setSourcePickerOpen(true);
    });
  }

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
              numberOfLines={1}
              adjustsFontSizeToFit
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
            accessibilityState={{ selected: periodMode === 'month' }}
            onPress={() => onPeriodModeChange('month')}
            style={[
              styles.modeButton,
              periodMode === 'month' && styles.modeSelected,
            ]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.modeText,
                periodMode === 'month' && styles.modeTextSelected,
              ]}
            >
              Tháng
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
              numberOfLines={1}
              adjustsFontSizeToFit
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
        ) : periodMode === 'month' ? (
          <View style={styles.yearPicker}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tháng báo cáo trước"
              disabled={month.year === 1900 && month.month === 1}
              hitSlop={8}
              onPress={() => moveReportMonth(-1)}
              style={styles.yearArrow}
            >
              <Feather name="chevron-left" size={20} color={colors.earth} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Chọn tháng ${month.month} năm ${month.year}`}
              onPress={() => setPicker({ edge: 'month', point: { ...month } })}
              style={styles.selectedMonthButton}
            >
              <Text style={styles.selectedMonthText}>
                Tháng {month.month} năm {month.year}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tháng báo cáo sau"
              disabled={month.year === 9999 && month.month === 12}
              hitSlop={8}
              onPress={() => moveReportMonth(1)}
              style={styles.yearArrow}
            >
              <Feather name="chevron-right" size={20} color={colors.earth} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.rangeRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Chọn tháng bắt đầu: ${formatPeriodPoint(start)}`}
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
              accessibilityLabel={`Chọn tháng kết thúc: ${formatPeriodPoint(end)}`}
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
        {isIncome && (
          <View style={styles.sourceRow}>
            <Text style={styles.sourceLabel}>Nguồn thu</Text>
            <Pressable
              ref={sourcePickerRef}
              accessibilityRole="button"
              accessibilityLabel={`Nguồn thu: ${sourceLabel}`}
              accessibilityState={{ expanded: sourcePickerOpen }}
              onPress={toggleSourceMenu}
              style={styles.sourcePickerButton}
            >
              <Text style={styles.sourcePickerText}>{sourceLabel}</Text>
              <Feather
                name={sourcePickerOpen ? 'chevron-up' : 'chevron-down'}
                size={15}
                color={colors.earth}
              />
            </Pressable>
          </View>
        )}
      </View>

      <Modal
        transparent
        statusBarTranslucent
        visible={sourcePickerOpen}
        onRequestClose={() => setSourcePickerOpen(false)}
        animationType="none"
      >
        <View style={styles.sourceMenuOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng danh sách nguồn thu"
            onPress={() => setSourcePickerOpen(false)}
            style={styles.sourceMenuDismissLayer}
          />
          <View
            accessibilityViewIsModal
            style={[
              styles.sourceMenu,
              {
                top: sourceMenuTop,
                left: sourceMenuLeft,
                width: sourceMenuWidth,
              },
            ]}
          >
            {(
              [
                ['all', 'Tất cả'],
                ['company', 'Công ty'],
                ['other', 'Ngoài công ty'],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`Chọn nguồn thu báo cáo: ${label}`}
                accessibilityState={{ selected: incomeSource === value }}
                onPress={() => {
                  onIncomeSourceChange(value);
                  setSourcePickerOpen(false);
                }}
                style={styles.sourceChoice}
              >
                <Text
                  style={[
                    styles.sourceChoiceText,
                    incomeSource === value && styles.sourceChoiceTextSelected,
                  ]}
                >
                  {label}
                </Text>
                {incomeSource === value && (
                  <Feather name="check" size={16} color={colors.earth} />
                )}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      <DialogModal
        visible={picker !== null}
        onRequestClose={() => setPicker(null)}
        style={styles.dialog}
      >
        <View style={styles.dialogHeader}>
          <Text accessibilityRole="header" style={styles.dialogTitle}>
            {picker?.edge === 'start'
              ? 'Chọn tháng bắt đầu'
              : picker?.edge === 'end'
                ? 'Chọn tháng kết thúc'
                : 'Chọn tháng báo cáo'}
          </Text>
          <DialogCloseButton
            accessibilityLabel="Đóng bộ chọn tháng báo cáo"
            onPress={() => setPicker(null)}
          />
        </View>
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
      </DialogModal>
    </View>
  );
}
