import { StyleSheet } from 'react-native';
import { colors, typography } from '../../theme';

export const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  compactCard: { gap: 8, padding: 12, borderRadius: 0, borderWidth: 0 },
  notificationRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  compactNotificationRow: { gap: 8, minHeight: 40 },
  notificationText: { flex: 1, gap: 2 },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.ink,
  },
  compactCardTitle: { fontSize: 14, lineHeight: 19 },
  compactDescription: { fontSize: 12, lineHeight: 17 },
  iconBadge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  securityIcon: { backgroundColor: colors.primarySoft },
  compactIconBadge: { width: 32, height: 32, borderRadius: 12 },
  error: { ...typography.small, color: colors.danger },
});
