import { StyleSheet } from 'react-native';
import { colors } from '../../theme';

export const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  greeting: { flex: 1 },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    padding: 24,
    gap: 24,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  tag: {
    color: colors.ink,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
    flexShrink: 1,
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 39,
    letterSpacing: -0.7,
    fontWeight: '600',
    color: colors.ink,
  },
  heroBody: { fontSize: 15, lineHeight: 24, color: colors.ink },
  section: { gap: 8, marginTop: 8 },
  music: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  musicIcon: {
    width: 56,
    height: 64,
    backgroundColor: '#E4EDDF',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 4 },
  note: { marginTop: 'auto', gap: 16, paddingTop: 16 },
  noteLine: { width: 32, height: 2, backgroundColor: colors.green },
});
