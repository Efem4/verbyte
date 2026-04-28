/**
 * Verbyte — Design Tokens
 * React Native / StyleSheet.create() ready
 *
 * dark (gece) + light (gündüz) tema desteği.
 * Geist font: expo-font ile yüklenmeli (App.js useFonts).
 */

import { StyleSheet, Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────
// COLORS — semantic tokens, theme-keyed
// ─────────────────────────────────────────────────────────────
export const colors = {
  dark: {
    // surfaces
    bg:           '#0A091B',
    panel:        'rgba(255,255,255,0.025)',
    panelBorder:  'rgba(255,255,255,0.06)',
    panelStrong:  'rgba(255,255,255,0.04)',
    hairline:     'rgba(255,255,255,0.06)',
    navBg:        'rgba(10,9,27,0.85)',
    navBorder:    'rgba(255,255,255,0.06)',

    // text
    text:         '#E8E6F5',
    textMuted:    '#9D9BB8',
    textDim:      '#7A7898',
    textFaint:    '#5C5A78',

    // brand / accent
    accent:       '#818CF8',  // indigo-400
    accentSoft:   '#A5B4FC',  // indigo-300
    accentTint:   'rgba(129,140,248,0.10)',
    accentBorder: 'rgba(129,140,248,0.25)',

    // semantic
    success:        '#34D399',
    successTint:    'rgba(52,211,153,0.10)',
    successBorder:  'rgba(52,211,153,0.25)',
    danger:         '#F87171',
    dangerTint:     'rgba(248,113,113,0.08)',
    dangerBorder:   'rgba(248,113,113,0.22)',
    warn:           '#FBBF24',
    warnTint:       'rgba(251,191,36,0.08)',
    warnBorder:     'rgba(251,191,36,0.20)',

    // primary action button (inverted contrast)
    primaryBtnBg:   '#E8E6F5',
    primaryBtnText: '#0A091B',

    // bars / tracks
    barTrack:       'rgba(255,255,255,0.06)',
    barTrackThin:   'rgba(255,255,255,0.05)',

    // chips
    chipBg:         'rgba(255,255,255,0.06)',
    chipBorder:     'rgba(255,255,255,0.10)',
  },

  light: {
    bg:           '#F5F1F8',
    panel:        '#FFFFFF',
    panelBorder:  'rgba(124,92,211,0.12)',
    panelStrong:  '#FFFFFF',
    hairline:     'rgba(124,92,211,0.08)',
    navBg:        'rgba(245,241,248,0.92)',
    navBorder:    'rgba(124,92,211,0.10)',

    text:         '#2A1E47',
    textMuted:    '#6B5B8A',
    textDim:      '#9F8FB8',
    textFaint:    '#C9BCDD',

    accent:       '#7C5CD3',
    accentSoft:   '#A78BFA',
    accentTint:   'rgba(124,92,211,0.10)',
    accentBorder: 'rgba(124,92,211,0.22)',

    success:        '#10B981',
    successTint:    'rgba(16,185,129,0.10)',
    successBorder:  'rgba(16,185,129,0.25)',
    danger:         '#EC4899',
    dangerTint:     'rgba(236,72,153,0.08)',
    dangerBorder:   'rgba(236,72,153,0.22)',
    warn:           '#F59E0B',
    warnTint:       'rgba(245,158,11,0.10)',
    warnBorder:     'rgba(245,158,11,0.25)',

    primaryBtnBg:   '#2A1E47',
    primaryBtnText: '#FFFFFF',

    barTrack:       'rgba(124,92,211,0.10)',
    barTrackThin:   'rgba(124,92,211,0.08)',

    chipBg:         'rgba(124,92,211,0.06)',
    chipBorder:     'rgba(124,92,211,0.14)',
  },
};

// ─────────────────────────────────────────────────────────────
// TYPOGRAPHY — Geist fontları yüklendikten sonra çalışır
// ─────────────────────────────────────────────────────────────
export const fonts = {
  sans: Platform.select({
    ios:     'Geist',
    android: 'Geist-Regular',
    default: 'Geist',
  }),
  mono: Platform.select({
    ios:     'GeistMono-Regular',
    android: 'GeistMono-Regular',
    default: 'GeistMono-Regular',
  }),
};

export const fontWeights = {
  regular:   '400',
  medium:    '500',
  semibold:  '600',
  bold:      '700',
  extrabold: '800',
};

export const type = StyleSheet.create({
  display: {
    fontFamily: fonts.sans,
    fontSize: 42,
    lineHeight: 42,
    letterSpacing: -1.26,
    fontWeight: '700',
  },
  h1: {
    fontFamily: fonts.sans,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.65,
    fontWeight: '700',
  },
  h2: {
    fontFamily: fonts.sans,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.48,
    fontWeight: '700',
  },
  h3: {
    fontFamily: fonts.sans,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.36,
    fontWeight: '700',
  },
  word: {
    fontFamily: fonts.sans,
    fontSize: 46,
    lineHeight: 46,
    letterSpacing: -1.61,
    fontWeight: '700',
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  bodyMd: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.075,
    fontWeight: '500',
  },
  row: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  caption: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  small: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '400',
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
  monoLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.0,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  monoMeta: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 0.95,
    fontWeight: '700',
  },
  button: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.14,
    fontWeight: '600',
  },
  tab: {
    fontFamily: fonts.mono,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.4,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});

// ─────────────────────────────────────────────────────────────
// SPACING — 4pt grid
// ─────────────────────────────────────────────────────────────
export const spacing = {
  xxs:  2,
  xs:   4,
  sm:   6,
  md:   8,
  lg:   10,
  xl:   12,
  xxl:  14,
  xxxl: 18,
  gutter:     18,
  sectionGap: 14,
  blockGap:   10,
  hitMin:     44,
};

// ─────────────────────────────────────────────────────────────
// BORDER RADIUS
// ─────────────────────────────────────────────────────────────
export const radius = {
  none: 0,
  xs:   5,
  sm:   7,
  md:   8,
  lg:   10,
  xl:   11,
  xxl:  14,
  r3xl: 18,  // '3xl' yerine r3xl — JS obje key uyumu
  pill: 999,
};

// ─────────────────────────────────────────────────────────────
// SHADOWS
// ─────────────────────────────────────────────────────────────
export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 24 },
      shadowOpacity: 0.25,
      shadowRadius: 60,
    },
    android: { elevation: 8 },
  }),
  glow: (color = '#818CF8') => Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.6,
      shadowRadius: 24,
    },
    android: { elevation: 6 },
  }),
};

// ─────────────────────────────────────────────────────────────
// makeStyles — tema-bağlı stylesheet
//   const styles = makeStyles('dark' | 'light')
// ─────────────────────────────────────────────────────────────
export function makeStyles(theme = 'dark') {
  const c = colors[theme] || colors.dark;

  return StyleSheet.create({
    shell: {
      flex: 1,
      backgroundColor: c.bg,
    },
    screenPad: {
      paddingHorizontal: spacing.gutter,
    },
    hairline: {
      height: 1,
      backgroundColor: c.hairline,
    },
    panel: {
      borderRadius: radius.lg,
      backgroundColor: c.panel,
      borderWidth: 1,
      borderColor: c.panelBorder,
      padding: spacing.xl,
    },
    panelLg: {
      borderRadius: radius.xxl,
      backgroundColor: c.panel,
      borderWidth: 1,
      borderColor: c.panelBorder,
      padding: 20,
    },
    promptCard: {
      borderRadius: radius.xxl,
      backgroundColor: c.panel,
      borderWidth: 1,
      borderColor: c.accentBorder,
      padding: 20,
    },
    flashcard: {
      borderRadius: radius.r3xl,
      borderWidth: 1,
      borderColor: c.accentBorder,
      padding: 24,
      ...shadows.card,
    },
    chip: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: radius.xs,
      backgroundColor: c.chipBg,
      borderWidth: 1,
      borderColor: c.chipBorder,
    },
    primaryButton: {
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.xxl,
      borderRadius: radius.lg,
      backgroundColor: c.primaryBtnBg,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing.md,
    },
    primaryButtonText: {
      ...type.button,
      color: c.primaryBtnText,
    },
    successButton: {
      paddingVertical: 13,
      paddingHorizontal: spacing.xxl,
      borderRadius: radius.lg,
      backgroundColor: c.successTint,
      borderWidth: 1,
      borderColor: c.successBorder,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 7,
    },
    dangerButton: {
      paddingVertical: 13,
      paddingHorizontal: spacing.xxl,
      borderRadius: radius.lg,
      backgroundColor: c.dangerTint,
      borderWidth: 1,
      borderColor: c.dangerBorder,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 7,
    },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: c.barTrack,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: c.accent,
    },
    bottomNav: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: c.navBorder,
      backgroundColor: c.navBg,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.md,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      gap: spacing.xs,
    },
    // Text helpers
    text:        { ...type.body,      color: c.text },
    textMuted:   { ...type.body,      color: c.textMuted },
    textDim:     { ...type.caption,   color: c.textDim },
    monoLabel:   { ...type.monoLabel, color: c.textDim },
    monoAccent:  { ...type.monoLabel, color: c.accentSoft },
    h1:          { ...type.h1,        color: c.text },
    h2:          { ...type.h2,        color: c.text },
    h3:          { ...type.h3,        color: c.text },
    word:        { ...type.word,      color: c.text },
    display:     { ...type.display,   color: c.text },
  });
}

export default {
  colors,
  fonts,
  fontWeights,
  type,
  spacing,
  radius,
  shadows,
  makeStyles,
};
