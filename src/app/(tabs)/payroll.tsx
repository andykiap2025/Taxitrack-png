import { useFocusEffect, useRouter } from 'expo-router';
import { Banknote, ChevronLeft, ChevronRight, ShieldAlert, Users } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Card, EmptyState, Screen, SkeletonCard, StatTile } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatPGK, todayISO } from '@/lib/format';
import { initialsOf } from '@/lib/labels';
import {
  computePayroll,
  dayOfPeriod,
  periodForDate,
  shiftPeriod,
  type Period,
} from '@/lib/payroll';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing, type } from '@/lib/theme';
import type {
  AppSettings,
  BalanceLedgerEntry,
  Driver,
  PayPeriod,
} from '@/types/db';

type DriverRow = {
  driver: Driver;
  netPay: number;
  grossTakings: number;
  daysWorked: number;
  status: 'preview' | 'finalised' | 'paid';
};

export default function PayrollScreen() {
  const { role } = useAuth();
  const router = useRouter();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [period, setPeriod] = useState<Period | null>(null);
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p?: Period | null) => {
    setLoading(true);
    const { data: s, error: sErr } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 1)
      .single();
    if (sErr || !s) {
      setError(sErr?.message ?? 'Settings not found');
      setLoading(false);
      return;
    }
    const st = s as AppSettings;
    setSettings(st);
    const per = p ?? periodForDate(todayISO(), st.pay_period_anchor);
    setPeriod(per);

    const [drv, pp, tk, lg, cr, ded] = await Promise.all([
      supabase.from('drivers').select('*').order('full_name'),
      supabase.from('pay_periods').select('*').eq('period_start', per.start),
      supabase
        .from('daily_takings')
        .select('driver_id, date, amount_received')
        .gte('date', per.start)
        .lte('date', per.end),
      supabase
        .from('balance_ledger')
        .select('*')
        .eq('status', 'outstanding')
        .gte('date', per.start)
        .lte('date', per.end),
      st.carry_forward_balance
        ? supabase.from('balance_ledger').select('*').eq('status', 'carried').lt('date', per.start)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('deductions').select('*').is('pay_period_id', null).lte('date', per.end),
    ]);
    const err = drv.error ?? pp.error ?? tk.error ?? lg.error ?? cr.error ?? ded.error;
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const drivers = (drv.data ?? []) as Driver[];
    const periods = (pp.data ?? []) as PayPeriod[];
    const takings = (tk.data ?? []) as { driver_id: string; date: string; amount_received: number }[];
    const ledger = (lg.data ?? []) as BalanceLedgerEntry[];
    const carried = (cr.data ?? []) as BalanceLedgerEntry[];
    const deductions = (ded.data ?? []) as { driver_id: string; amount: number }[];

    const result: DriverRow[] = [];
    for (const d of drivers) {
      const t = takings.filter((x) => x.driver_id === d.id);
      const stored = periods.find((x) => x.driver_id === d.id);
      if (!stored && t.length === 0 && d.status !== 'active') continue;

      if (stored) {
        result.push({
          driver: d,
          netPay: Number(stored.net_pay),
          grossTakings: Number(stored.gross_takings),
          daysWorked: t.length,
          status: stored.status === 'paid' ? 'paid' : 'finalised',
        });
      } else {
        const comp = computePayroll({
          takingsAmounts: t.map((x) => Number(x.amount_received)),
          ledgerEntries: ledger.filter((x) => x.driver_id === d.id),
          carriedEntries: carried.filter((x) => x.driver_id === d.id),
          deductionAmounts: deductions.filter((x) => x.driver_id === d.id).map((x) => Number(x.amount)),
          settings: st,
        });
        result.push({
          driver: d,
          netPay: comp.netPay,
          grossTakings: comp.grossTakings,
          daysWorked: t.length,
          status: 'preview',
        });
      }
    }
    setRows(result);
    setError(null);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(period);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  if (role !== 'owner') {
    return (
      <Screen title="Payroll">
        <Card padded={false}>
          <EmptyState
            icon={<ShieldAlert color={colors.textMuted} size={30} />}
            title="Owner only"
            message="Payroll is restricted to the owner account."
          />
        </Card>
      </Screen>
    );
  }

  const today = todayISO();
  const isCurrent = period ? period.start <= today && today <= period.end : false;
  const totalNet = rows.reduce((s, r) => s + r.netPay, 0);
  const totalGross = rows.reduce((s, r) => s + r.grossTakings, 0);

  return (
    <Screen title="Payroll">
      {/* Period navigator */}
      <Card style={styles.periodCard}>
        <Pressable
          onPress={() => period && load(shiftPeriod(period, -1))}
          style={styles.navBtn}
          hitSlop={8}
        >
          <ChevronLeft color={colors.text} size={20} />
        </Pressable>
        <View style={styles.periodMiddle}>
          <Text style={styles.periodText}>
            {period ? `${formatDate(period.start)} – ${formatDate(period.end)}` : '…'}
          </Text>
          <Text style={type.caption}>
            {isCurrent && period
              ? `Current fortnight · day ${dayOfPeriod(today, period)} of 14`
              : 'Fortnight'}
          </Text>
        </View>
        <Pressable
          onPress={() => period && load(shiftPeriod(period, 1))}
          style={[styles.navBtn, isCurrent && { opacity: 0.4 }]}
          hitSlop={8}
          disabled={isCurrent}
        >
          <ChevronRight color={colors.text} size={20} />
        </Pressable>
      </Card>

      <View style={styles.tiles}>
        <StatTile
          label="Fleet gross"
          value={formatPGK(totalGross, { decimals: 0 })}
          icon={<Banknote color={colors.primary} size={18} />}
        />
        <StatTile
          label="Total net pay"
          value={formatPGK(totalNet, { decimals: 0 })}
          sub={settings ? `${(settings.commission_rate * 100).toFixed(0)}% commission` : undefined}
          icon={<Users color={colors.primary} size={18} />}
        />
      </View>

      {loading ? (
        <View style={styles.list}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : error ? (
        <Card>
          <Text style={type.body}>Couldn't load payroll: {error}</Text>
        </Card>
      ) : rows.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<Banknote color={colors.textMuted} size={30} />}
            title="Nothing to pay"
            message="No drivers or takings in this fortnight."
          />
        </Card>
      ) : (
        <View style={styles.list}>
          {rows.map((r) => (
            <Card
              key={r.driver.id}
              onPress={() =>
                period &&
                router.push({
                  pathname: '/payroll/[driverId]',
                  params: { driverId: r.driver.id, start: period.start },
                })
              }
            >
              <View style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initialsOf(r.driver.full_name)}</Text>
                </View>
                <View style={styles.info}>
                  <Text style={type.cardTitle}>{r.driver.full_name}</Text>
                  <Text style={type.caption}>
                    {r.daysWorked} days · gross {formatPGK(r.grossTakings, { decimals: 0 })}
                  </Text>
                </View>
                <View style={styles.right}>
                  <Text style={styles.net}>{formatPGK(r.netPay)}</Text>
                  <Badge
                    label={r.status === 'paid' ? 'Paid' : r.status === 'finalised' ? 'Finalised' : 'Preview'}
                    tone={r.status === 'paid' ? 'success' : r.status === 'finalised' ? 'info' : 'neutral'}
                    dot={r.status !== 'preview'}
                  />
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  periodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodMiddle: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  periodText: {
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.text,
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    backgroundColor: colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.info,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  right: {
    alignItems: 'flex-end',
    gap: spacing.xxs,
  },
  net: {
    fontFamily: font.extrabold,
    fontSize: 17,
    color: colors.text,
  },
});
