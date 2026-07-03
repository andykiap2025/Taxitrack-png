import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors, radius, spacing, type } from '@/lib/theme';

type Props = {
  /** Lucide icon, rendered inside a soft circle. */
  icon: React.ReactNode;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
};

/** Never show a blank screen: icon + message + primary action. */
export function EmptyState({ icon, title, message, actionLabel, onAction, style }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.iconCircle}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} size="md" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    ...type.cardTitle,
    textAlign: 'center',
  },
  message: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  action: {
    marginTop: spacing.md,
  },
});
