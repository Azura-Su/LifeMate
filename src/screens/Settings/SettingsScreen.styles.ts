import { StyleSheet } from 'react-native';
import { colors, typography } from '../../theme';

export const styles = StyleSheet.create({
  section: { gap: 16 },
  profile: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    paddingVertical: 16,
  },
  profileText: { flex: 1, gap: 6 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  divider: { height: 1, backgroundColor: colors.line },
  error: { ...typography.small, color: colors.danger },
  footer: {
    ...typography.small,
    textAlign: 'center',
    marginTop: 'auto',
    paddingTop: 24,
  },
});
