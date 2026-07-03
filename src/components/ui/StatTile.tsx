import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Card } from '@/components/ui/Card';
import { colors, radius, spacing, type } from '@/lib/theme';

type Props = {
  label: string;
  value: string;
  /** Small line under the value, e.g. "4 of 5 vehicles". */
  sub?: string;
  subColor?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
};

/** Dashboard summary tile: label, big number, optional icon + subline. */
export function StatTile({ label, value, sub, subColor, icon, onPress, style }: Props) {
  return (
    <Card onPress={onPress} style={StyleSheet.flatten([styles.tile, style])}>
      <View style={styles.top}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
      </View>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? (
        <Text style={[styles.sub, subColor ? { color: subColor } : null]} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    gap: spacing.xxs,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  label: {
    ...type.label,
    flex: 1,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    ...type.stat,
  },
  sub: {
    ...type.caption,
  },
});
