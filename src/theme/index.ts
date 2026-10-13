import { StyleSheet } from 'react-native';

export const colors = {
  // Light earth, cloud-white sky, and a soft sunlight highlight.
  background: '#F6FBFE',
  surface: '#FFFFFF',
  primary: '#F1E7DE',
  primaryBorder: '#E2D4C7',
  primarySoft: '#F8F3EF',
  bottomBar: '#FAF7F3',
  earth: '#7C5C45',
  earthLight: '#F1E7DE',
  sky: '#4D7088',
  skySoft: '#E9F0F3',
  sunlight: '#895F18',
  sunlightSoft: '#FFF9E8',
  sunlightFaint: '#FFFCF5',
  sunlightLine: '#F0E5C5',
  sunlightAction: '#F6ECC9',
  sunlightBorder: '#E3D59F',
  ink: '#352D28',
  muted: '#6A625B',
  line: '#DEE5E9',
  success: '#506F5F',
  successSoft: '#EAF2EC',
  danger: '#A84646',
  dangerSoft: '#F8ECEB',
  onPrimary: '#352D28',
  scrim: 'rgba(53, 45, 40, 0.48)',
  shadow: '#352D2826',
  cloudShadow: '#536774',
  onAccentDivider: '#E2D4C7',
  record: '#342D29',
  recordGroove: '#8D796A',
};

export const layout = {
  screenGutter: 20,
  contentMaxWidth: 620,
} as const;

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
