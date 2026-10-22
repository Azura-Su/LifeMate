import { StyleSheet } from 'react-native';
import { colors, typography } from '../../theme';

export const styles = StyleSheet.create({
  calendar: { gap: 6 },
  monthHeader: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  monthArrow: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.skySoft,
  },
  monthTitle: {
    ...typography.body,
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
    color: colors.ink,
    textTransform: 'capitalize',
  },
  weekdays: { flexDirection: 'row' },
  weekday: {
    width: '14.2857%',
    height: 28,
    textAlign: 'center',
    textAlignVertical: 'center',
    ...typography.small,
    color: colors.muted,
    fontWeight: '600',
  },
  days: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: '14.2857%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  selectedDayCell: { backgroundColor: colors.earth },
  dayNumber: { ...typography.body, color: colors.ink },
  selectedDayNumber: { color: colors.surface, fontWeight: '700' },
});
