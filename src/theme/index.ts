import { StyleSheet } from 'react-native';

export const colors = {
  background: '#FAF7EE',
  surface: '#FFFFFF',
  cream: '#F7F1DF',
  primary: '#EDB324',
  primarySoft: '#FFF0C2',
  ink: '#28291F',
  muted: '#696A5D',
  line: '#E4E1D6',
  green: '#315743',
  danger: '#AC3030',
};

export const typography = StyleSheet.create({
  eyebrow: {
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '700',
    color: colors.muted,
  },
  title: { fontSize: 32, lineHeight: 40, fontWeight: '700', color: colors.ink },
  heading: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '600',
    color: colors.ink,
  },
  body: { fontSize: 16, lineHeight: 25, color: colors.muted },
  small: { fontSize: 13, lineHeight: 20, color: colors.muted },
});
