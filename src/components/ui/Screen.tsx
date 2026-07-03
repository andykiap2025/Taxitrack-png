import React from 'react';
import { ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, type } from '@/lib/theme';

type Props = {
  /** Large page title rendered at the top (omit for custom headers). */
  title?: string;
  /** Right-aligned element beside the title, e.g. an action button. */
  titleAccessory?: React.ReactNode;
  children: React.ReactNode;
  /** Scrollable by default; disable for screens that manage their own lists. */
  scroll?: boolean;
  /** Extra bottom padding so content clears the floating tab bar. */
  bottomInset?: number;
  style?: ViewStyle;
};

/** Clears the floating tab bar (default) — detail screens may pass less. */
const TAB_BAR_CLEARANCE = 112;

/** Standard screen container: background, safe area, 16px gutters. */
export function Screen({
  title,
  titleAccessory,
  children,
  scroll = true,
  bottomInset = TAB_BAR_CLEARANCE,
  style,
}: Props) {
  const insets = useSafeAreaInsets();

  const header = title ? (
    <View style={styles.header}>
      <Text style={type.pageTitle}>{title}</Text>
      {titleAccessory}
    </View>
  ) : null;

  if (!scroll) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + spacing.md }, style]}>
        {header}
        {children}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + bottomInset },
          style,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {header}
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
  },
  content: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
});
