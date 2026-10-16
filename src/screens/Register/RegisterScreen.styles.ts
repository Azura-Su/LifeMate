import { StyleSheet } from 'react-native';
import { colors, typography } from '../../theme';

export const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 16 },
  backText: { color: colors.earth, fontSize: 15, fontWeight: '600' },
  intro: { gap: 8 },
  title: { ...typography.title, fontSize: 30, lineHeight: 38 },
  hint: { ...typography.small, color: colors.muted },
  actionGroup: { gap: 10, marginTop: 14 },
  status: { gap: 12 },
  statusLine: { ...typography.body, color: colors.ink },
  warning: { ...typography.small, color: colors.danger },
});
