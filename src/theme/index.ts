import { StyleSheet } from 'react-native';

export const colors = {
  // Warm paper neutrals with earth, slate-teal (sky) and honey (sunlight)
  // accents. Every text/background pair below keeps WCAG AA (>= 4.5:1).
  background: '#F7F5F1',
  surface: '#FFFFFF',
  primary: '#F0E6DB',
  primaryBorder: '#E0D2C3',
  primarySoft: '#F8F2EC',
  bottomBar: '#FBF9F6',
  earth: '#7A5A43',
  earthLight: '#F0E6DB',
  sky: '#4A6B7C',
  skySoft: '#EDF1F2',
  sunlight: '#87601A',
  sunlightSoft: '#FBF3E0',
  sunlightFaint: '#FDFAF3',
  sunlightLine: '#EFE3C6',
  sunlightAction: '#F4E7C2',
  sunlightBorder: '#E2D19C',
  ink: '#2F2924',
  muted: '#6B635B',
  line: '#E8E2DA',
  success: '#4A6B58',
  successSoft: '#E9F1EB',
  danger: '#A4473F',
  dangerSoft: '#F8EBE8',
  onPrimary: '#2F2924',
  scrim: 'rgba(47, 41, 36, 0.45)',
  shadow: '#2F292426',
  cloudShadow: '#6B5E52',
  onAccentDivider: '#E0D2C3',
  record: '#342D29',
  recordGroove: '#8D796A',
};

export const layout = {
  screenGutter: 20,
  contentMaxWidth: 620,
  /** Minimum touch target for icon buttons. */
  hitSize: 44,
} as const;

/** Spacing scale (4pt grid). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** Corner radius scale. Circles use size / 2 instead. */
export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

/** Type scale. Screens should only use these sizes. */
export const fontSize = {
  micro: 10,
  caption: 11,
  label: 12,
  small: 13,
  body: 14,
  bodyLarge: 16,
  subheading: 18,
  heading: 20,
  display: 24,
  hero: 28,
  title: 32,
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
  /** Title inside a sub-screen header (ScreenHeader). */
  screenTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.ink,
  },
  /** Title of a popup / dialog. */
  dialogTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.ink,
  },
  /** Supporting text under a dialog title. */
  dialogSubtitle: { fontSize: 13, lineHeight: 19, color: colors.muted },
  /** Uppercase section label. */
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.muted,
  },
});
