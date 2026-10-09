import { StyleSheet } from 'react-native';
import { colors, typography } from '../../theme';

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  wordmark: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -1,
    color: colors.ink,
  },
  intro: { gap: 12, marginTop: 16, marginBottom: 8 },
  title: {
    ...typography.title,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -1,
  },
  form: { gap: 12 },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink, marginTop: 8 },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  password: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  passwordInput: {
    flex: 1,
    minHeight: 56,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.ink,
  },
  eye: {
    width: 52,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submit: { marginTop: 16 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21 },
  footer: { marginTop: 'auto', gap: 20, paddingTop: 24, paddingBottom: 12 },
  line: { width: 40, height: 3, backgroundColor: colors.primary },
});
