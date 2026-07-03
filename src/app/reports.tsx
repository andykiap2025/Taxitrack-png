import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Banknote, CalendarCheck2, FileDown, Target, TrendingUp } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { BarChart, type BarDatum } from '@/components/BarChart';
import { Badge, Card, Screen, ScreenHeader, Segmented, SkeletonCard, StatTile } from '@/components/ui';
import { formatDate, formatDateShort, formatPGK, todayISO } from '@/lib/format';
import { periodForDate, shiftPeriod, type Period } from '@/lib/payroll';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, shadow, spacing, type } from '@/lib/theme';
import type { AppSettings } from '@/types/db';

type RangeKey = 'this_fn' | 'last_fn' | '30d';

type TakingsRow = {
  date: string;
  driver_id: string;
  vehicle_id: string;
  amount_received: number;
  shortfall_amount: number;
  surplus_amount: number;
  target_met: boolean | null;
};

type Report = {
  range: Period;
  byDay: BarDatum[];
  totals: { gross: number; entries: number; targetMetPct: number | null; shortfalls: number };
  drivers: {
    id: string;
    name: string;
    days: number;
    gross: number;
    avg: number;
    shortfallDays: number;
  }[];
  vehicles: {
    id: string;
    plate: string;
    gross: number;
    serviceCost: number;
    incidentCost: number;
    profit: number;
  }[];
};

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function ReportsScreen() {
  const [rangeKey, setRangeKey] = useState<RangeKey>('this_fn');
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (key: RangeKey) => {
    setLoading(true);
    const { data: s } = await supabase.from('app_settings').select('*').eq('id', 1).single();
    const settings = s as AppSettings | null;
    const today = todayISO();
    const current = periodForDate(today, settings?.pay_period_anchor ?? '2026-01-05');
    const range: Period =
      key === 'this_fn'
        ? current
        : key === 'last_fn'
          ? shiftPeriod(current, -1)
          : { start: addDays(today, -29), end: today };

    const [tk, svc, inc, drv, veh] = await Promise.all([
      supabase
        .from('daily_takings')
        .select('date, driver_id, vehicle_id, amount_received, shortfall_amount, surplus_amount, target_met')
        .gte('date', range.start)
        .lte('date', range.end),
      supabase
        .from('service_records')
        .select('vehicle_id, cost')
        .gte('service_date', range.start)
        .lte('service_date', range.end),
      supabase
        .from('incidents')
        .select('vehicle_id, cost, deduction_id')
        .gte('date', range.start)
        .lte('date', range.end),
      supabase.from('drivers').select('id, full_name'),
      supabase.from('vehicles').select('id, plate_no'),
    ]);
    const error = tk.error ?? svc.error ?? inc.error ?? drv.error ?? veh.error;
    if (error) {
      Alert.alert('Reports', error.message);
      setLoading(false);
      return;
    }

    const rows = (tk.data ?? []) as TakingsRow[];
    const driverNames = new Map(((drv.data ?? []) as { id: string; full_name: string }[]).map((d) => [d.id, d.full_name]));
    const plates = new Map(((veh.data ?? []) as { id: string; plate_no: string }[]).map((v) => [v.id, v.plate_no]));

    // Daily trend, zero-filled across the range.
    const sums = new Map<string, number>();
    for (const r of rows) sums.set(r.date, (sums.get(r.date) ?? 0) + Number(r.amount_received));
    const byDay: BarDatum[] = [];
    for (let d = range.start; d <= range.end; d = addDays(d, 1)) {
      byDay.push({ key: d, label: formatDateShort(d), value: sums.get(d) ?? 0 });
    }

    // Totals.
    const gross = rows.reduce((sum, r) => sum + Number(r.amount_received), 0);
    const withTarget = rows.filter((r) => r.target_met !== null);
    const totals = {
      gross,
      entries: rows.length,
      targetMetPct:
        withTarget.length > 0
          ? Math.round((withTarget.filter((r) => r.target_met).length / withTarget.length) * 100)
          : null,
      shortfalls: rows.reduce((sum, r) => sum + Number(r.shortfall_amount), 0),
    };

    // Driver ranking.
    const perDriver = new Map<string, { days: number; gross: number; shortfallDays: number }>();
    for (const r of rows) {
      const cur = perDriver.get(r.driver_id) ?? { days: 0, gross: 0, shortfallDays: 0 };
      cur.days += 1;
      cur.gross += Number(r.amount_received);
      if (Number(r.shortfall_amount) > 0) cur.shortfallDays += 1;
      perDriver.set(r.driver_id, cur);
    }
    const driverRows = [...perDriver.entries()]
      .map(([id, v]) => ({
        id,
        name: driverNames.get(id) ?? 'Unknown',
        days: v.days,
        gross: v.gross,
        avg: v.days > 0 ? v.gross / v.days : 0,
        shortfallDays: v.shortfallDays,
      }))
      .sort((a, b) => b.gross - a.gross);

    // Vehicle profitability: takings − service − incident costs.
    const perVehicle = new Map<string, { gross: number; serviceCost: number; incidentCost: number }>();
    for (const r of rows) {
      const cur = perVehicle.get(r.vehicle_id) ?? { gross: 0, serviceCost: 0, incidentCost: 0 };
      cur.gross += Number(r.amount_received);
      perVehicle.set(r.vehicle_id, cur);
    }
    for (const r of (svc.data ?? []) as { vehicle_id: string; cost: number }[]) {
      const cur = perVehicle.get(r.vehicle_id) ?? { gross: 0, serviceCost: 0, incidentCost: 0 };
      cur.serviceCost += Number(r.cost);
      perVehicle.set(r.vehicle_id, cur);
    }
    for (const r of (inc.data ?? []) as { vehicle_id: string; cost: number; deduction_id: string | null }[]) {
      // Costs charged to a driver come back via deductions — not a vehicle cost.
      if (r.deduction_id) continue;
      const cur = perVehicle.get(r.vehicle_id) ?? { gross: 0, serviceCost: 0, incidentCost: 0 };
      cur.incidentCost += Number(r.cost);
      perVehicle.set(r.vehicle_id, cur);
    }
    const vehicleRows = [...perVehicle.entries()]
      .map(([id, v]) => ({
        id,
        plate: plates.get(id) ?? 'Unknown',
        ...v,
        profit: v.gross - v.serviceCost - v.incidentCost,
      }))
      .sort((a, b) => b.profit - a.profit);

    setReport({ range, byDay, totals, drivers: driverRows, vehicles: vehicleRows });
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(rangeKey);
    }, [load, rangeKey]),
  );

  const exportPDF = async () => {
    if (!report) return;
    setExporting(true);
    const html = reportHTML(report);
    try {
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Safco Taxi report' });
        }
      }
    } catch (err) {
      Alert.alert('Export failed', err instanceof Error ? err.message : String(err));
    }
    setExporting(false);
  };

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader
        title="Reports"
        subtitle={report ? `${formatDate(report.range.start)} – ${formatDate(report.range.end)}` : undefined}
        accessory={
          <Pressable
            onPress={exportPDF}
            disabled={exporting || !report}
            style={({ pressed }) => [styles.exportBtn, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Export PDF"
          >
            <FileDown color={colors.primary} size={19} />
          </Pressable>
        }
      />

      <Segmented<RangeKey>
        options={[
          { value: 'this_fn', label: 'This fortnight' },
          { value: 'last_fn', label: 'Last fortnight' },
          { value: '30d', label: '30 days' },
        ]}
        value={rangeKey}
        onChange={setRangeKey}
      />

      {loading || !report ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : (
        <>
          <View style={styles.tiles}>
            <StatTile
              label="Gross takings"
              value={formatPGK(report.totals.gross, { decimals: 0 })}
              icon={<Banknote color={colors.primary} size={18} />}
            />
            <StatTile
              label="Targets met"
              value={report.totals.targetMetPct !== null ? `${report.totals.targetMetPct}%` : '—'}
              sub={`${report.totals.entries} entries`}
              icon={<Target color={colors.primary} size={18} />}
            />
          </View>

          <Text style={type.sectionTitle}>Daily takings</Text>
          <Card>
            <BarChart data={report.byDay} formatValue={(v) => formatPGK(v, { decimals: 0 })} />
          </Card>

          <Text style={type.sectionTitle}>Driver ranking</Text>
          <Card padded={false}>
            {report.drivers.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={type.body}>No takings in this range.</Text>
              </View>
            ) : (
              report.drivers.map((d, idx) => (
                <View key={d.id} style={[styles.row, idx < report.drivers.length - 1 && styles.divider]}>
                  <View style={[styles.rank, idx === 0 && styles.rankTop]}>
                    <Text style={[styles.rankText, idx === 0 && styles.rankTextTop]}>{idx + 1}</Text>
                  </View>
                  <View style={styles.info}>
                    <Text style={type.bodyMedium}>{d.name}</Text>
                    <Text style={type.caption}>
                      {d.days} days · avg {formatPGK(d.avg, { decimals: 0 })}/day
                    </Text>
                  </View>
                  <View style={styles.right}>
                    <Text style={styles.amount}>{formatPGK(d.gross, { decimals: 0 })}</Text>
                    {d.shortfallDays > 0 ? (
                      <Badge label={`${d.shortfallDays} short days`} tone="warning" />
                    ) : (
                      <Badge label="No shorts" tone="success" />
                    )}
                  </View>
                </View>
              ))
            )}
          </Card>

          <Text style={type.sectionTitle}>Vehicle profitability</Text>
          <Card padded={false}>
            {report.vehicles.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={type.body}>No activity in this range.</Text>
              </View>
            ) : (
              report.vehicles.map((v, idx) => (
                <View key={v.id} style={[styles.row, idx < report.vehicles.length - 1 && styles.divider]}>
                  <View style={styles.info}>
                    <Text style={type.bodyMedium}>{v.plate}</Text>
                    <Text style={type.caption}>
                      Takings {formatPGK(v.gross, { decimals: 0 })}
                      {v.serviceCost > 0 ? ` · service −${formatPGK(v.serviceCost, { decimals: 0 })}` : ''}
                      {v.incidentCost > 0 ? ` · incidents −${formatPGK(v.incidentCost, { decimals: 0 })}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.amount, v.profit < 0 && { color: colors.danger }]}>
                    {formatPGK(v.profit, { decimals: 0 })}
                  </Text>
                </View>
              ))
            )}
          </Card>

          <View style={styles.footRow}>
            <TrendingUp size={13} color={colors.textMuted} />
            <Text style={type.caption}>
              Vehicle profit = takings − service − incident costs (driver-charged costs excluded).
            </Text>
          </View>
        </>
      )}
    </Screen>
  );
}

function reportHTML(r: Report): string {
  const driverRows = r.drivers
    .map(
      (d, i) =>
        `<tr><td>${i + 1}</td><td>${d.name}</td><td class="num">${d.days}</td><td class="num">${formatPGK(d.avg, { decimals: 0 })}</td><td class="num">${d.shortfallDays}</td><td class="num"><b>${formatPGK(d.gross)}</b></td></tr>`,
    )
    .join('');
  const vehicleRows = r.vehicles
    .map(
      (v) =>
        `<tr><td>${v.plate}</td><td class="num">${formatPGK(v.gross)}</td><td class="num">${formatPGK(v.serviceCost)}</td><td class="num">${formatPGK(v.incidentCost)}</td><td class="num"><b>${formatPGK(v.profit)}</b></td></tr>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #101828; padding: 32px; }
  .head { background:#0B1220; color:#fff; border-radius:14px; padding:20px 26px; }
  .head h1 { margin:0; font-size:20px; } .head .sub { color:rgba(255,255,255,.7); font-size:12px; margin-top:4px; }
  h2 { font-size:15px; margin:26px 0 8px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { text-align:left; color:#5B6779; font-weight:600; border-bottom:2px solid #101828; padding:6px 8px; }
  th.num, td.num { text-align:right; }
  td { padding:7px 8px; border-bottom:1px solid #E3E8F0; }
  .kpis { display:flex; gap:24px; margin-top:18px; font-size:13px; }
  .kpis b { display:block; font-size:18px; }
  </style></head><body>
  <div class="head"><h1>Fleet report · Safco Taxi Service</h1>
  <div class="sub">${formatDate(r.range.start)} – ${formatDate(r.range.end)} · Built by Skyworks Systems © 2026</div></div>
  <div class="kpis">
    <div>Gross takings<b>${formatPGK(r.totals.gross)}</b></div>
    <div>Entries<b>${r.totals.entries}</b></div>
    <div>Targets met<b>${r.totals.targetMetPct !== null ? `${r.totals.targetMetPct}%` : '—'}</b></div>
    <div>Total shortfalls<b>${formatPGK(r.totals.shortfalls)}</b></div>
  </div>
  <h2>Driver ranking</h2>
  <table><tr><th>#</th><th>Driver</th><th class="num">Days</th><th class="num">Avg/day</th><th class="num">Short days</th><th class="num">Gross</th></tr>${driverRows}</table>
  <h2>Vehicle profitability</h2>
  <table><tr><th>Vehicle</th><th class="num">Takings</th><th class="num">Service</th><th class="num">Incidents</th><th class="num">Profit</th></tr>${vehicleRows}</table>
  </body></html>`;
}

const styles = StyleSheet.create({
  exportBtn: {
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
  tiles: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  emptyRow: {
    padding: spacing.md,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rank: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankTop: {
    backgroundColor: colors.accent,
  },
  rankText: {
    fontFamily: font.bold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  rankTextTop: {
    color: colors.onAccent,
  },
  info: {
    flex: 1,
    gap: 1,
  },
  right: {
    alignItems: 'flex-end',
    gap: spacing.xxs,
  },
  amount: {
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.text,
  },
  footRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
