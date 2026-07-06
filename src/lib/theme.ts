/**
 * TaxiTrack PNG design tokens.
 * Single source of truth for colors, spacing, radii, typography and shadows.
 * Rules: 8px spacing grid · limited palette (navy primary, amber accent,
 * semantic green/amber/red) · soft shadows · Inter typography.
 */
import { Platform, TextStyle, ViewStyle } from 'react-native';

export const colors = {
  // Brand — single navy
  primary: '#1E2A4A',
  primaryDark: '#131C33',
  primaryLight: '#2C3D6B',
  onPrimary: '#FFFFFF',
  accent: '#F0A800', // web orange (Bright Blue palette)
  accentDark: '#C98D00',
  onAccent: '#231303',

  // Surfaces
  background: '#F5F6F8',
  surface: '#FFFFFF',
  /** Card faces: a whisper of blue so cards read as tinted panels. */
  card: '#FAFBFF',
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

/**
 * Six-color identity palette: avatars and person/vehicle accents pick a
 * stable color from these pairs (soft background + strong foreground).
 */
// "Bright Blue" palette (colormagic): web orange, burnt sienna, scampi,
// dodger blue, persian green — soft tint for fills, strong for text/icons.
export const identityPalette = [
  { soft: '#E1F0FF', strong: '#0F6FD6' }, // dodger blue
  { soft: '#DCF6F0', strong: '#00846A' }, // persian green
  { soft: '#FDF2D7', strong: '#A87500' }, // web orange
  { soft: '#ECE8F7', strong: '#5A4B99' }, // scampi
  { soft: '#FBE7E0', strong: '#C24E31' }, // burnt sienna
] as const;

/** Deterministic color per id/name — the same driver always gets the same color. */
export function identityColor(key: string): (typeof identityPalette)[number] {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return identityPalette[h % identityPalette.length];
}

/** Gradient pairs — use sparingly: hero headers and primary buttons only. */
export const gradients = {
  hero: ['#16294F', '#0B1220'] as const,
  accent: ['#FFBE33', '#E9A200'] as const,
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
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 18,
      elevation: 8,
    },
    web: { boxShadow: '0 8px 20px rgba(16, 24, 40, 0.13)' } as ViewStyle,
  })!,
  raised: Platform.select<ViewStyle>({
    default: {
      shadowColor: '#101828',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.22,
      shadowRadius: 28,
      elevation: 14,
    },
    web: { boxShadow: '0 12px 28px rgba(16, 24, 40, 0.18)' } as ViewStyle,
  })!,
  /** Deep soft shadow for a single floating panel (e.g. the auth card). */
  floating: Platform.select<ViewStyle>({
    default: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.15,
      shadowRadius: 40,
      elevation: 18,
    },
    web: { boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)' } as ViewStyle,
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
