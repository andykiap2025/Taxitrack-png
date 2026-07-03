import React from 'react';
import { Pressable, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';

import { colors, radius, shadow, spacing } from '@/lib/theme';

type Props = ViewProps & {
  onPress?: () => void;
  /** Removes inner padding for cards that manage their own layout. */
  padded?: boolean;
  /** Stronger elevation for hero/floating cards. */
  raised?: boolean;
  style?: ViewStyle | ViewStyle[];
};

/**
 * Base surface: 20px radius, soft shadow, press feedback when tappable.
 */
export function Card({ onPress, padded = true, raised = false, style, children, ...rest }: Props) {
  const base = [
    styles.card,
    raised ? shadow.raised : shadow.card,
    padded && styles.padded,
    style,
  ];

  if (!onPress) {
    return (
      <View style={base} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [...base, pressed && styles.pressed]}
      android_ripple={{ color: colors.surfaceMuted }}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'visible',
  },
  padded: {
    padding: spacing.md,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.96,
  },
});
