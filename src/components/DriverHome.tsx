import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { FileText, UserX } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Card, EmptyState, Screen, SkeletonCard } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { daysUntil, expiryLabel, toneForDays } from '@/lib/alerts';
import { formatDate, formatDateShort, formatPGK, todayISO } from '@/lib/format';
import { dayOfPeriod, periodForDate, type Period } from '@/lib/payroll';
import { signedUrl } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { colors, font, gradients, radius, shadow, spacing, type } from '@/lib/theme';
import type { AppSettings, DailyTakings, Driver, PayPeriod } from '@/types/db';

/** Home screen for the driver role: own takings, pay estimate, payslips. */
export function DriverHome() {
  const { session, profile } = useAuth();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [takings, setTakings] = useState<DailyTakings[]>([]);
  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([]);
  const [period, setPeriod] = useState<Period | null>(null);
  const [estimate, setEstimate] = useState(0);
  const [rate, setRate] = useState(0.29);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const { data: d } = await supabase
      .from('drivers')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();
    const drv = d as Driver | null;
    setDriver(drv);
    if (!drv) {
      setLoading(false);
      return;
    }

    const { data: s } = await supabase.from('app_settings').select('*').eq('id', 1).single();
    const settings = s as AppSettings | null;
    const per = periodForDate(todayISO(), settings?.pay_period_anchor ?? '2026-01-05');
    setPeriod(per);
    setRate(settings?.commission_rate ?? 0.29);

    const [t, pp, cur] = await Promise.all([
      supabase
        .from('daily_takings')
        .select('*')
        .eq('driver_id', drv.id)
        .order('date', { ascending: false })
        .limit(14),
      supabase
        .from('pay_periods')
        .select('*')
        .eq('driver_id', drv.id)
        .order('period_start', { ascending: false })
        .limit(6),
      supabase
        .from('daily_takings')
        .select('amount_received')
        .eq('driver_id', drv.id)
        .gte('date', per.start)
        .lte('date', per.end),
    ]);
    setTakings((t.data ?? []) as DailyTakings[]);
    setPayPeriods((pp.data ?? []) as PayPeriod[]);
    const gross = ((cur.data ?? []) as { amount_received: number }[]).reduce(
      (sum, r) => sum + Number(r.amount_received),
      0,
    );
    setEstimate(gross * (settings?.commission_rate ?? 0.29));
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openPayslip = async (p: PayPeriod) => {
    if (!p.payslip_url) return;
    const url = await signedUrl('payslips', p.payslip_url);
    if (url) await WebBrowser.openBrowserAsync(url);
  };

  if (loading) {
    return (
      <Screen>
        <SkeletonCard />
        <SkeletonCard />
      </Screen>
    );
  }

  if (!driver) {
    return (
      <Screen>
        <Card padded={false}>
          <EmptyState
            icon={<UserX color={colors.textMuted} size={30} />}
            title="Account not linked yet"
            message="Ask the owner to link your login to your driver profile, then reopen the app."
          />
        </Card>
      </Screen>
    );
  }

  const firstName = driver.full_name.split(' ')[0] || profile?.full_name || 'Driver';

  return (
    <Screen>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, shadow.raised]}
      >
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroGreeting}>Hi {firstName} 👋</Text>
            <Text style={styles.heroDate}>
              {period ? `Fortnight day ${dayOfPeriod(todayISO(), period)} of 14` : ''}
            </Text>
          </View>
          <Image
            source={require('@/assets/play_store/icon_main_512x512.png')}
            style={styles.heroLogo}
          />
        </View>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Pay so far ({(rate * 100).toFixed(0)}%)</Text>
            <Text style={styles.heroStatValue}>{formatPGK(estimate)}</Text>
          </View>
        </View>
        <Text style={styles.heroNote}>
          Estimate before deductions — the final payslip is what counts.
        </Text>
      </LinearGradient>

      {driver.license_expiry && daysUntil(driver.license_expiry) <= 30 && (
        <Card style={styles.licenseCard}>
          <Text style={type.bodyMedium}>Your license needs renewing</Text>
          <Badge
            label={expiryLabel(driver.license_expiry)}
            tone={toneForDays(daysUntil(driver.license_expiry))}
          />
        </Card>
      )}

      <Text style={type.sectionTitle}>My recent takings</Text>
      {takings.length === 0 ? (
        <Card>
          <Text style={type.body}>No takings recorded yet.</Text>
        </Card>
      ) : (
        <Card padded={false}>
          {takings.map((t, idx) => (
            <View key={t.id} style={[styles.row, idx < takings.length - 1 && styles.divider]}>
              <Text style={[type.bodyMedium, styles.date]}>{formatDateShort(t.date)}</Text>
              <View style={styles.info}>
                <Text style={type.bodyMedium}>{formatPGK(t.amount_received)}</Text>
                {t.is_relief_driver && <Text style={type.caption}>relief day</Text>}
              </View>
              {t.target_amount === null ? (
                <Badge label="No target" tone="neutral" />
              ) : t.shortfall_amount > 0 ? (
                <Badge label={`Short ${formatPGK(t.shortfall_amount, { decimals: 0 })}`} tone="danger" />
              ) : (
                <Badge label="Target met" tone="success" dot />
              )}
            </View>
          ))}
        </Card>
      )}

      <Text style={type.sectionTitle}>My payslips</Text>
      {payPeriods.length === 0 ? (
        <Card>
          <Text style={type.body}>Payslips appear here after each fortnight is finalised.</Text>
        </Card>
      ) : (
        <Card padded={false}>
          {payPeriods.map((p, idx) => (
            <Pressable
              key={p.id}
              onPress={() => openPayslip(p)}
              disabled={!p.payslip_url}
              style={({ pressed }) => [
                styles.row,
                idx < payPeriods.length - 1 && styles.divider,
                pressed && p.payslip_url && { backgroundColor: colors.surfaceMuted },
              ]}
            >
              <View style={styles.payslipIcon}>
                <FileText color={p.payslip_url ? colors.info : colors.textMuted} size={18} />
              </View>
              <View style={styles.info}>
                <Text style={type.bodyMedium}>{formatPGK(Number(p.net_pay))}</Text>
                <Text style={type.caption}>
                  {formatDate(p.period_start)} – {formatDate(p.period_end)}
                  {p.payslip_url ? ' · tap for PDF' : ''}
                </Text>
              </View>
              <Badge
                label={p.status === 'paid' ? 'Paid' : 'Finalised'}
                tone={p.status === 'paid' ? 'success' : 'info'}
                dot
              />
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroGreeting: {
    fontFamily: font.extrabold,
    fontSize: 24,
    color: colors.textOnDark,
  },
  heroDate: {
    fontFamily: font.medium,
    fontSize: 13,
    color: colors.textOnDarkMuted,
    marginTop: 2,
  },
  heroLogo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF',
  },
  heroStats: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  heroStat: {
    gap: 2,
  },
  heroStatLabel: {
    fontFamily: font.medium,
    fontSize: 12,
    color: colors.textOnDarkMuted,
  },
  heroStatValue: {
    fontFamily: font.extrabold,
    fontSize: 28,
    color: colors.textOnDark,
  },
  heroNote: {
    fontFamily: font.medium,
    fontSize: 11,
    color: colors.textOnDarkMuted,
  },
  licenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  date: {
    width: 56,
  },
  info: {
    flex: 1,
    gap: 1,
  },
  payslipIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
