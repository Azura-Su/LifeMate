import { StyleSheet } from 'react-native';
import { colors } from '../../theme';

export const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 14,
    borderRadius: 18,
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
  title: { fontSize: 17, fontWeight: '700', color: colors.ink },
  smallAction: {
    width: 38,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.sunlightSoft,
  },
  empty: { padding: 12, borderRadius: 12, backgroundColor: colors.skySoft },
  more: {
    padding: 8,
    textAlign: 'center',
    color: colors.sky,
    fontWeight: '600',
  },
  error: { fontSize: 12, color: colors.danger },
});
