import { LinearGradient } from 'expo-linear-gradient';
import { Lock, Mail } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Input } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, font, gradients, radius, shadow, spacing, type } from '@/lib/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await signIn(email, password);
    if (err) setError(err);
    setBusy(false);
    // On success the auth gate in _layout redirects automatically.
  };

  return (
    <LinearGradient colors={gradients.hero} style={styles.bg}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Image
                source={require('@/assets/play_store/icon_main_512x512.png')}
                style={styles.logoImg}
              />
            </View>
            <Text style={styles.title}>Safeco Taxi Service</Text>
            <Text style={styles.subtitle}>Fleet management · Port Moresby</Text>
          </View>

          <Card raised style={styles.card}>
            <Text style={type.sectionTitle}>Sign in</Text>

            {!isSupabaseConfigured && (
              <View style={styles.configWarning}>
                <Text style={styles.configWarningText}>
                  Backend not connected yet. Follow supabase/README.md, then add your
                  project keys to .env and restart.
                </Text>
              </View>
            )}

            <Input
              label="Email"
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              prefix={<Mail color={colors.textMuted} size={20} />}
            />
            <Input
              label="Password"
              placeholder="Your password"
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={submit}
              prefix={<Lock color={colors.textMuted} size={20} />}
              error={error ?? undefined}
            />
            <Button title="Sign in" fullWidth onPress={submit} loading={busy} />
          </Card>

          <Text style={styles.footer}>Built by Skyworks Systems · © 2026</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  brand: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  logo: {
    width: 92,
    height: 92,
    borderRadius: radius.xl,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginBottom: spacing.xs,
    ...shadow.raised,
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontFamily: font.extrabold,
    fontSize: 32,
    color: colors.textOnDark,
  },
  subtitle: {
    fontFamily: font.medium,
    fontSize: 14,
    color: colors.textOnDarkMuted,
  },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  configWarning: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  configWarningText: {
    ...type.caption,
    color: colors.warning,
  },
  footer: {
    ...type.caption,
    color: colors.textOnDarkMuted,
    textAlign: 'center',
  },
});
