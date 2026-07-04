import * as Sharing from 'expo-sharing';
import { useLocalSearchParams } from 'expo-router';
import {
  Banknote,
  CheckCircle2,
  FileText,
  Lock,
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Badge, Button, Card, Screen, ScreenHeader, SkeletonCard } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatName, formatPGK, todayISO } from '@/lib/format';
import { DEDUCTION_TYPE_LABELS } from '@/lib/ledger';
import { dayOfPeriod, type Period } from '@/lib/payroll';
import {
  finalisePeriod,
  generateAndUploadPayslip,
  loadDriverPayroll,
  markPaid,
  payslipHTML,
  type DriverPayrollData,
} from '@/lib/payrollActions';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing, type } from '@/lib/theme';
import type { AppSettings } from '@/types/db';

export default function PayslipDetail() {
  const { driverId, start } = useLocalSearchParams<{ driverId: string; start: string }>();
  const { role, session } = useAuth();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [data, setData] = useState<DriverPayrollData | null>(null);
  const [period, setPeriod] = useState<Period | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: s } = await supabase.from('app_settings').select('*').eq('id', 1).single();
    if (!s) {
      setError('Settings not found');
      setLoading(false);
      return;
    }
    const st = s as AppSettings;
    setSettings(st);
    const end = new Date(`${start}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 13);
    const per: Period = { start, end: end.toISOString().slice(0, 10) };
    setPeriod(per);

    const res = await loadDriverPayroll(driverId, per, st);
    setData(res.data);
    setError(res.error);
    setLoading(false);
  }, [driverId, start]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (role !== 'owner') {
    return (
      <Screen bottomInset={spacing.xl}>
        <ScreenHeader title="Payslip" />
        <Card>
          <Text style={type.body}>Payroll is restricted to the owner account.</Text>
        </Card>
      </Screen>
    );
  }

  if (loading || !data || !period || !settings) {
    return (
      <Screen bottomInset={spacing.xl}>
        <ScreenHeader title="Payslip" />
        {error ? (
          <Card>
            <Text style={type.body}>Couldn't load: {error}</Text>
          </Card>
        ) : (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}
      </Screen>
    );
  }

  const comp = data.computation;
  const state = data.existing ? data.existing.status : 'open';
  const today = todayISO();
  const periodRunning = today >= period.start && today <= period.end;

  const doFinalise = () => {
    const proceed = async () => {
      setBusy('finalise');
      const res = await finalisePeriod(data, period, settings, session?.user.id ?? null);
      setBusy(null);
      if (res.error) {
        Alert.alert('Finalise problem', res.error);
      }
      load();
    };
    const message = periodRunning
      ? `This fortnight is still running (day ${dayOfPeriod(today, period)} of 14). Finalising now locks the numbers as they stand.\n\nNet pay: ${formatPGK(comp.netPay)}`
      : `Lock this fortnight and record net pay of ${formatPGK(comp.netPay)} for ${formatName(data.driver.full_name)}?`;
    if (Platform.OS === 'web') {
      proceed();
      return;
    }
    Alert.alert('Finalise pay period', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Finalise', style: 'destructive', onPress: proceed },
    ]);
  };

  const doPayslip = async () => {
    if (!data.existing) return;
    setBusy('pdf');
    const html = payslipHTML({
      driver: data.driver,
      period,
      comp,
      deductions: data.deductions,
      daysWorked: data.takings.length,
      status: data.existing.status,
      paidDate: data.existing.paid_date,
    });
    const res = await generateAndUploadPayslip({
      html,
      driverId: data.driver.id,
      periodStart: period.start,
      payPeriodId: data.existing.id,
    });
    setBusy(null);
    if (res.error) {
      Alert.alert('Payslip', `PDF created but not uploaded:\n${res.error}`);
    }
    if (res.localUri && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(res.localUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Payslip ${formatName(data.driver.full_name)}`,
      });
    }
    load();
  };

  const doMarkPaid = () => {
    const proceed = async () => {
      if (!data.existing) return;
      setBusy('paid');
      const err = await markPaid(data.existing.id);
      setBusy(null);
      if (err) Alert.alert('Could not mark paid', err);
      load();
    };
    if (Platform.OS === 'web') {
      proceed();
      return;
    }
    Alert.alert('Mark as paid', `Confirm ${formatPGK(comp.netPay)} was paid to ${formatName(data.driver.full_name)}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark paid', onPress: proceed },
    ]);
  };

  const Row = ({
    label,
    value,
    strong,
    negative,
  }: {
    label: string;
    value: string;
    strong?: boolean;
    negative?: boolean;
  }) => (
    <View style={styles.mathRow}>
      <Text style={[type.body, strong && styles.strongLabel]}>{label}</Text>
      <Text
        style={[
          styles.mathValue,
          strong && styles.strongValue,
          negative && { color: colors.danger },
        ]}
      >
        {value}
      </Text>
    </View>
  );

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader
        title={formatName(data.driver.full_name)}
        subtitle={`${formatDate(period.start)} – ${formatDate(period.end)}`}
        accessory={
          <Badge
            label={state === 'paid' ? 'Paid' : state === 'finalised' ? 'Finalised' : 'Open'}
            tone={state === 'paid' ? 'success' : state === 'finalised' ? 'info' : 'neutral'}
            dot
          />
        }
      />

      {/* Net pay hero */}
      <Card style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <Banknote color={colors.accent} size={24} />
        </View>
        <Text style={type.label}>Net pay</Text>
        <Text style={styles.netPay}>{formatPGK(comp.netPay)}</Text>
        <Text style={type.caption}>
          {data.takings.length} days worked · gross {formatPGK(comp.grossTakings)}
        </Text>
      </Card>

      {/* Breakdown */}
      <Text style={type.sectionTitle}>Breakdown</Text>
      <Card>
        <Row label="Gross takings" value={formatPGK(comp.grossTakings)} />
        <Row
          label={`Commission @ ${(comp.commissionRate * 100).toFixed(0)}%`}
          value={formatPGK(comp.grossPay)}
          strong
        />
        {comp.surplusBonus > 0 && (
          <Row label="Surplus bonus" value={`+ ${formatPGK(comp.surplusBonus)}`} />
        )}
        <View style={styles.dividerLine} />
        <Row label="Surpluses (days over target)" value={formatPGK(comp.totalSurpluses)} />
        <Row
          label="Shortfalls (days under target)"
          value={`− ${formatPGK(comp.totalShortfalls)}`}
          negative={comp.totalShortfalls > 0}
        />
        <Row
          label="Net balance"
          value={formatPGK(comp.netBalance)}
          negative={comp.netBalance < 0}
        />
        {comp.shortfallDeduction > 0 && (
          <Row
            label="Net shortfall deduction"
            value={`− ${formatPGK(comp.shortfallDeduction)}`}
            negative
          />
        )}
        <View style={styles.dividerLine} />
        {data.deductions.length === 0 ? (
          <Row label="Manual deductions" value="—" />
        ) : (
          data.deductions.map((d) => (
            <Row
              key={d.id}
              label={`${DEDUCTION_TYPE_LABELS[d.type]}${d.description ? ` — ${d.description}` : ''}`}
              value={`− ${formatPGK(Number(d.amount))}`}
              negative
            />
          ))
        )}
        <View style={styles.dividerLine} />
        <Row label="Net pay" value={formatPGK(comp.netPay)} strong />
      </Card>

      {/* Actions */}
      {state === 'open' ? (
        <>
          <Button
            title={periodRunning ? 'Finalise early (period running)' : 'Finalise pay period'}
            fullWidth
            loading={busy === 'finalise'}
            icon={<Lock color={colors.onAccent} size={18} />}
            onPress={doFinalise}
          />
          <Text style={styles.actionHint}>
            Finalising snapshots these numbers, resolves the balance ledger and attaches
            deductions. It can't be re-opened in the app.
          </Text>
        </>
      ) : (
        <View style={styles.actionCol}>
          <Button
            title={Platform.OS === 'web' ? 'Print payslip' : 'Payslip PDF — save & share'}
            fullWidth
            loading={busy === 'pdf'}
            icon={<FileText color={colors.onAccent} size={18} />}
            onPress={doPayslip}
          />
          {state === 'finalised' && (
            <Button
              title="Mark as paid"
              variant="secondary"
              fullWidth
              loading={busy === 'paid'}
              icon={<CheckCircle2 color={colors.onPrimary} size={18} />}
              onPress={doMarkPaid}
            />
          )}
          {state === 'paid' && data.existing?.paid_date && (
            <Text style={styles.actionHint}>Paid on {formatDate(data.existing.paid_date)}</Text>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.lg,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  netPay: {
    fontFamily: font.extrabold,
    fontSize: 34,
    color: colors.text,
  },
  mathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: spacing.sm,
  },
  mathValue: {
    fontFamily: font.semibold,
    fontSize: 15,
    color: colors.text,
  },
  strongLabel: {
    fontFamily: font.bold,
  },
  strongValue: {
    fontFamily: font.extrabold,
    fontSize: 17,
  },
  dividerLine: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  actionCol: {
    gap: spacing.sm,
  },
  actionHint: {
    ...type.caption,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});
