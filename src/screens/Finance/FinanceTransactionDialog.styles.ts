import { StyleSheet } from 'react-native';
import { colors, typography } from '../../theme';

export const styles = StyleSheet.create({
  dialog: { maxHeight: '92%', padding: 0, gap: 0 },
  content: { padding: 22, gap: 12 },
  typeRow: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    backgroundColor: colors.skySoft,
  },
  typeButton: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  typeSelected: { backgroundColor: colors.surface },
  typeText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  typeTextSelected: { color: colors.earth },
  label: { ...typography.small, color: colors.ink, fontWeight: '600' },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  categoryList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  categorySelected: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
  },
  categoryText: { fontSize: 13, color: colors.muted },
  categoryTextSelected: { fontWeight: '600', color: colors.earth },
  error: { ...typography.small, color: colors.danger },
});
