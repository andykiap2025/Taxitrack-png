/**
 * TaxiTrack PNG design tokens.
 * Single source of truth for colors, spacing, radii, typography and shadows.
 * Rules: 8px spacing grid · limited palette (navy primary, amber accent,
 * semantic green/amber/red) · soft shadows · Inter typography.
 */
import { Platform, TextStyle, ViewStyle } from 'react-native';

export const colors = {
  // Brand
  primary: '#122349', // deep navy
  primaryDark: '#0B1220',
  primaryLight: '#1E3A6E',
  onPrimary: '#FFFFFF',
  accent: '#F5A524', // taxi amber
  accentDark: '#E08700',
  onAccent: '#231303',

  // Surfaces
  background: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceMuted: '#EDF1F7',
  border: '#E3E8F0',
  borderStrong: '#C9D2E0',

  // Text
  text: '#101828',
  textSecondary: '#5B6779',
  textMuted: '#8B96A8',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: 'rgba(255,255,255,0.68)',

  // Semantic (target met / due soon / overdue)
  success: '#12934F',
  successSoft: '#E3F6EC',
  warning: '#D8850C',
  warningSoft: '#FCF0DA',
  danger: '#D92D20',
  dangerSoft: '#FDE9E7',
  info: '#1570CD',
  infoSoft: '#E4F0FC',

  // Chart marks (validated against the light surface — see dataviz notes).
  // Brand navy is an ink color, not a mark color; this is its chart-legible step.
  chart: '#2F5DB3',
  chartEmphasis: '#1E4489',
} as const;

/** Gradient pairs — use sparingly: hero headers and primary buttons only. */
export const gradients = {
  hero: ['#16294F', '#0B1220'] as const,
  accent: ['#FFB938', '#F09000'] as const,
  card: ['#FFFFFF', '#F7F9FC'] as const,
};

/** 8px grid. Never use raw numbers for margins/padding. */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  full: 999,
} as const;

/** Inter font family names as registered by @expo-google-fonts/inter. */
export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

/** Typography scale per the design rules. */
export const type = {
  pageTitle: { fontFamily: font.extrabold, fontSize: 30, lineHeight: 36, color: colors.text } as TextStyle,
  sectionTitle: { fontFamily: font.bold, fontSize: 21, lineHeight: 27, color: colors.text } as TextStyle,
  cardTitle: { fontFamily: font.semibold, fontSize: 17, lineHeight: 23, color: colors.text } as TextStyle,
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: colors.text } as TextStyle,
  bodyMedium: { fontFamily: font.medium, fontSize: 15, lineHeight: 22, color: colors.text } as TextStyle,
  label: { fontFamily: font.medium, fontSize: 13, lineHeight: 18, color: colors.textSecondary } as TextStyle,
  caption: { fontFamily: font.medium, fontSize: 12, lineHeight: 16, color: colors.textMuted } as TextStyle,
  stat: { fontFamily: font.extrabold, fontSize: 26, lineHeight: 32, color: colors.text } as TextStyle,
};

/** Soft layered shadows. `elevation` covers Android, shadow* covers iOS/web. */
export const shadow = {
  card: Platform.select<ViewStyle>({
    default: {
      shadowColor: '#101828',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 14,
      elevation: 3,
    },
    web: { boxShadow: '0 4px 14px rgba(16, 24, 40, 0.07)' } as ViewStyle,
  })!,
  raised: Platform.select<ViewStyle>({
    default: {
      shadowColor: '#101828',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 22,
      elevation: 7,
    },
    web: { boxShadow: '0 8px 22px rgba(16, 24, 40, 0.12)' } as ViewStyle,
  })!,
  accentGlow: Platform.select<ViewStyle>({
    default: {
      shadowColor: colors.accentDark,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 14,
      elevation: 5,
    },
    web: { boxShadow: '0 6px 14px rgba(224, 135, 0, 0.3)' } as ViewStyle,
  })!,
};

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };
