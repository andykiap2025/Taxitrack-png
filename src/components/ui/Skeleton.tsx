import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, Easing, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/lib/theme';

type Props = {
  width?: DimensionValue;
  height?: number;
  round?: number;
  style?: ViewStyle;
};

/** Pulsing placeholder block used while data loads. */
export function Skeleton({ width = '100%', height = 16, round = radius.sm, style }: Props) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: round, backgroundColor: colors.surfaceMuted, opacity: pulse },
        style,
      ]}
    />
  );
}

/** Standard three-row card skeleton for list screens. */
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <Skeleton width="55%" height={18} />
      <Skeleton width="80%" height={13} />
      <Skeleton width="35%" height={13} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
});
