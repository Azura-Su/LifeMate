import { StyleSheet } from 'react-native';

export const colors = {
  // Light earth, cloud-white sky, and a soft sunlight highlight.
  background: '#F7FAFC',
  surface: '#FFFFFF',
  primary: '#E8D9C9',
  primaryBorder: '#D2B9A4',
  primarySoft: '#F3EAE0',
  earth: '#7C5C45',
  earthLight: '#E8D9C9',
  sky: '#4D7088',
  skySoft: '#E9F0F3',
  sunlight: '#9C701D',
  sunlightSoft: '#FBF4DD',
  sunlightAction: '#EAD89D',
  sunlightBorder: '#D2B875',
  ink: '#352D28',
  muted: '#6A625B',
  line: '#DEE5E9',
  success: '#506F5F',
  danger: '#A84646',
  dangerSoft: '#F8ECEB',
  onPrimary: '#352D28',
  scrim: 'rgba(53, 45, 40, 0.48)',
  shadow: '#352D2826',
  onAccentDivider: '#D2B9A4',
  record: '#342D29',
  recordGroove: '#8D796A',
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
