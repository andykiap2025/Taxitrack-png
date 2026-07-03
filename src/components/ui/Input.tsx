import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

import { colors, font, radius, spacing, type } from '@/lib/theme';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
  /** Fixed element before the value, e.g. a "K" currency prefix. */
  prefix?: React.ReactNode;
  /** Element after the value, e.g. a unit or an icon button. */
  suffix?: React.ReactNode;
  containerStyle?: ViewStyle;
};

/**
 * Labelled input: 56px touch target, 16px radius, visible focus ring,
 * inline error message.
 */
export function Input({
  label,
  error,
  hint,
  prefix,
  suffix,
  containerStyle,
  onFocus,
  onBlur,
  editable = true,
  ...rest
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={containerStyle}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.frame,
          focused && styles.focused,
          !!error && styles.errored,
          !editable && styles.readonly,
        ]}
      >
        {prefix ? <View style={styles.affix}>{prefix}</View> : null}
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.textMuted}
          editable={editable}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {suffix ? <View style={styles.affix}>{suffix}</View> : null}
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...type.label,
    marginBottom: spacing.xxs,
  },
  frame: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  focused: {
    borderColor: colors.primary,
  },
  errored: {
    borderColor: colors.danger,
  },
  readonly: {
    backgroundColor: colors.surfaceMuted,
  },
  affix: {
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontFamily: font.medium,
    fontSize: 16,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  error: {
    ...type.caption,
    color: colors.danger,
    marginTop: spacing.xxs,
  },
  hint: {
    ...type.caption,
    marginTop: spacing.xxs,
  },
});
