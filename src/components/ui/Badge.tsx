import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, font, radius, spacing } from '@/lib/theme';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

type Props = {
  label: string;
  tone?: BadgeTone;
  /** Show a small status dot before the label. */
  dot?: boolean;
  style?: ViewStyle;
};

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  info: { bg: colors.infoSoft, fg: colors.info },
  neutral: { bg: colors.surfaceMuted, fg: colors.textSecondary },
};

/** Status pill — target met / due soon / overdue / off-road etc. */
export function Badge({ label, tone = 'neutral', dot = false, style }: Props) {
  const t = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: t.fg }]} /> : null}
      <Text style={[styles.label, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontFamily: font.semibold,
    fontSize: 12,
  },
});
