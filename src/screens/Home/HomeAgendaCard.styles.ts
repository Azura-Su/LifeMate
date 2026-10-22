import { StyleSheet } from 'react-native';
import { colors } from '../../theme';
import { actionIconStyles } from '../../theme/actionIcons';

export const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  icon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
  },
  heading: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '700', color: colors.ink },
  smallAction: {
    width: 38,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    ...actionIconStyles.add,
  },
  empty: { padding: 12, borderRadius: 12, backgroundColor: colors.skySoft },
  more: {
    padding: 8,
    textAlign: 'center',
    color: colors.sky,
    fontWeight: '600',
  },
  error: { fontSize: 12, color: colors.danger },
  sync: { fontSize: 12, color: colors.success },
});
