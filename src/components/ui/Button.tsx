import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { colors, font, gradients, radius, shadow, spacing } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'lg' | 'md' | 'sm';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  /** Lucide icon rendered left of the label. */
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
};

const HEIGHTS: Record<Size, number> = { lg: 56, md: 48, sm: 40 };
const FONT_SIZES: Record<Size, number> = { lg: 16, md: 15, sm: 14 };

/**
 * Primary = amber gradient (the one loud element on a screen).
 * Secondary = solid navy. Outline/ghost for lesser actions.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  style,
}: Props) {
  const inactive = disabled || loading;

  const labelStyle: TextStyle = {
    fontFamily: font.bold,
    fontSize: FONT_SIZES[size],
    color:
      variant === 'primary'
        ? colors.onAccent
        : variant === 'secondary'
          ? colors.onPrimary
          : variant === 'danger'
            ? colors.danger
            : colors.primary,
  };

  const content = (
    <View style={styles.row}>
      {loading ? (
        <ActivityIndicator size="small" color={labelStyle.color} />
      ) : (
        icon && <View style={styles.icon}>{icon}</View>
      )}
      <Text style={labelStyle} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );

  const frame: ViewStyle[] = [
    styles.base,
    { height: HEIGHTS[size] },
    fullWidth && styles.fullWidth,
    variant === 'secondary' && styles.secondary,
    variant === 'outline' && styles.outline,
    variant === 'danger' && styles.dangerOutline,
    inactive && styles.disabled,
    style,
  ].filter(Boolean) as ViewStyle[];

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        ...frame,
        variant === 'primary' && !inactive && shadow.accentGlow,
        pressed && styles.pressed,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={gradients.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, { height: HEIGHTS[size] }]}
        >
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  icon: {
    marginRight: 2,
  },
  secondary: {
    backgroundColor: colors.primary,
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  dangerOutline: {
    backgroundColor: colors.dangerSoft,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
});
