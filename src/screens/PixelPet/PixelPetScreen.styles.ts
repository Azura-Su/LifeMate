import { StyleSheet } from 'react-native';
import { colors, fontSize, layout, radius, spacing } from '../../theme';

export const styles = StyleSheet.create({
  fixedHeader: {
    paddingHorizontal: layout.screenGutter,
    paddingVertical: spacing.sm,
  },
  content: { gap: spacing.lg, paddingBottom: spacing.xxxl },
  stage: {
    alignItems: 'center',
    borderRadius: radius.xl,
    backgroundColor: colors.skySoft,
    paddingVertical: spacing.xl,
  },
  card: {
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  name: { fontSize: fontSize.heading, fontWeight: '700', color: colors.ink },
  meta: { fontSize: fontSize.small, color: colors.muted },
  body: { fontSize: fontSize.body, lineHeight: 21, color: colors.ink },
  notice: {
    fontSize: fontSize.small,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  barTrack: {
    height: spacing.sm,
    borderRadius: spacing.sm / 2,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: colors.success },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    borderRadius: radius.pill,
    backgroundColor: colors.sunlightSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipText: { fontSize: fontSize.label, color: colors.sunlight, fontWeight: '600' },
  actions: { gap: spacing.sm },
});
