import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, shadow, spacing } from '@/lib/theme';

type Props = {
  title: string;
  subtitle?: string;
  /** Right-aligned element, e.g. an edit button. */
  accessory?: React.ReactNode;
};

/** Detail-screen header: back chevron, title, optional right action. */
export function ScreenHeader({ title, subtitle, accessory }: Props) {
  const router = useRouter();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <ChevronLeft color={colors.text} size={22} />
      </Pressable>
      <View style={styles.titles}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {accessory}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  backPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  titles: {
    flex: 1,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 20,
    color: colors.text,
  },
  subtitle: {
    fontFamily: font.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
});
