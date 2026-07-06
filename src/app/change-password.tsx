import { useRouter } from 'expo-router';
import { KeyRound, Lock } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, Text } from 'react-native';

import { Button, Card, Input, Screen, ScreenHeader } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { colors, spacing, type } from '@/lib/theme';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { role, session } = useAuth();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (role !== 'owner') {
    return (
      <Screen bottomInset={spacing.xl}>
        <ScreenHeader title="Change password" />
        <Card>
          <Text style={type.body}>Only the owner can change the password here.</Text>
        </Card>
      </Screen>
    );
  }

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!current) errs.current = 'Enter your current password';
    if (next.length < 8) errs.next = 'Use at least 8 characters';
    if (confirm !== next) errs.confirm = 'Passwords do not match';
    if (next && next === current) errs.next = 'New password must be different';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const email = session?.user.email;
    if (!email) return;

    setBusy(true);

    // Confirm the current password before allowing the change.
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (authErr) {
      setBusy(false);
      setErrors({
        current: /invalid login credentials/i.test(authErr.message)
          ? 'Current password is wrong'
          : authErr.message,
      });
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (error) {
      setErrors({ confirm: error.message });
      return;
    }

    if (Platform.OS === 'web') {
      router.back();
      return;
    }
    Alert.alert('Password changed', 'Use your new password the next time you sign in.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader title="Change password" subtitle={session?.user.email ?? undefined} />

      <Card style={styles.form}>
        <Input
          label="Current password"
          placeholder="Your current password"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          value={current}
          onChangeText={setCurrent}
          prefix={<Lock color={colors.textMuted} size={20} />}
          error={errors.current}
        />
        <Input
          label="New password"
          placeholder="At least 8 characters"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          value={next}
          onChangeText={setNext}
          prefix={<KeyRound color={colors.textMuted} size={20} />}
          error={errors.next}
        />
        <Input
          label="Confirm new password"
          placeholder="Type it again"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          value={confirm}
          onChangeText={setConfirm}
          onSubmitEditing={save}
          prefix={<KeyRound color={colors.textMuted} size={20} />}
          error={errors.confirm}
        />
        <Button title="Change password" fullWidth loading={busy} onPress={save} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
});
