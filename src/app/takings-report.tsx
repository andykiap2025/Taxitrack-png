import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { ChevronLeft, ChevronRight, FileDown, Sheet as SheetIcon } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  addDays as dfAddDays,
  addMonths,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
} from 'date-fns';

import { Button, Card, Screen, ScreenHeader, Segmented, SkeletonCard } from '@/components/ui';
import { formatDate, formatDateShort, formatName, formatPGK, todayISO } from '@/lib/format';
import { periodForDate, type Period } from '@/lib/payroll';
import { supabase } from '@/lib/supabase';
import type { AppSettings } from '@/types/db';
import { colors, font, radius, spacing, type } from '@/lib/theme';

type PeriodKind = 'day' | 'week' | 'fortnight' | 'month' | 'term';

type Row = {
  id: string;
  date: string;
  vehicle: string;
  driver: string;
  amount: number;
};

const KIND_LABELS: Record<PeriodKind, string> = {
  day: 'Daily',
  week: 'Weekly',
  fortnight: 'Fortnightly',
  month: 'Monthly',
  term: 'Termly',
};

function iso(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function rangeFor(kind: PeriodKind, anchorISO: string, payAnchor: string): Period {
  const anchor = parseISO(anchorISO);
  switch (kind) {
    case 'day':
      return { start: anchorISO, end: anchorISO };
    case 'week':
      return {
        start: iso(startOfWeek(anchor, { weekStartsOn: 1 })),
        end: iso(endOfWeek(anchor, { weekStartsOn: 1 })),
      };
    case 'fortnight':
      return periodForDate(anchorISO, payAnchor);
    case 'month':
      return { start: iso(startOfMonth(anchor)), end: iso(endOfMonth(anchor)) };
    case 'term':
      return { start: iso(startOfQuarter(anchor)), end: iso(endOfQuarter(anchor)) };
  }
}

function shiftAnchor(kind: PeriodKind, anchorISO: string, dir: 1 | -1): string {
  const anchor = parseISO(anchorISO);
  switch (kind) {
    case 'day':
      return iso(dfAddDays(anchor, dir));
    case 'week':
      return iso(dfAddDays(anchor, 7 * dir));
    case 'fortnight':
      return iso(dfAddDays(anchor, 14 * dir));
    case 'month':
      return iso(addMonths(anchor, dir));
    case 'term':
      return iso(addMonths(anchor, 3 * dir));
  }
}

export default function TakingsReport() {
  const [kind, setKind] = useState<PeriodKind>('day');
  const [anchor, setAnchor] = useState(todayISO());
  const [payAnchor, setPayAnchor] = useState('2026-01-05');
  const [range, setRange] = useState<Period | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (k: PeriodKind, a: string) => {
    setLoading(true);
    const { data: s } = await supabase.from('app_settings').select('pay_period_anchor').eq('id', 1).single();
    const pa = (s as Pick<AppSettings, 'pay_period_anchor'> | null)?.pay_period_anchor ?? '2026-01-05';
    setPayAnchor(pa);
    const r = rangeFor(k, a, pa);
    setRange(r);

    const { data, error } = await supabase
      .from('daily_takings')
      .select('id, date, amount_received, driver:drivers(full_name), vehicle:vehicles(plate_no)')
      .gte('date', r.start)
      .lte('date', r.end)
      .order('date')
      .limit(1000);
    if (error) {
      Alert.alert('Report', error.message);
      setLoading(false);
      return;
    }
    type Raw = {
      id: string;
      date: string;
      amount_received: number;
      driver: { full_name: string } | null;
      vehicle: { plate_no: string } | null;
    };
    setRows(
      ((data ?? []) as unknown as Raw[]).map((r) => ({
        id: r.id,
        date: r.date,
        vehicle: r.vehicle?.plate_no ?? '—',
        driver: formatName(r.driver?.full_name ?? '—'),
        amount: Number(r.amount_received),
      })),
    );
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(kind, anchor);
    }, [load, kind, anchor]),
  );

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const rangeLabel = range
    ? range.start === range.end
      ? formatDate(range.start)
      : `${formatDate(range.start)} – ${formatDate(range.end)}`
    : '…';
  const fileStamp = range ? `${range.start}_${range.end}` : 'report';

  // ------------------------------------------------------------ exports

  const exportPDF = async () => {
    if (!range) return;
    setBusy('pdf');
    const html = tableHTML(KIND_LABELS[kind], rangeLabel, rows, total);
    try {
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Takings ${rangeLabel}`,
          });
        }
      }
    } catch (err) {
      Alert.alert('PDF export failed', err instanceof Error ? err.message : String(err));
    }
    setBusy(null);
  };

  const exportExcel = async () => {
    if (!range) return;
    setBusy('csv');
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      'Date,Vehicle,Driver,Takings (K)',
      ...rows.map((r) => `${formatDate(r.date)},${esc(r.vehicle)},${esc(r.driver)},${r.amount.toFixed(2)}`),
      `,,TOTAL,${total.toFixed(2)}`,
    ];
    const csv = lines.join('\r\n');
    const filename = `takings_${fileStamp}.csv`;
    try {
      if (Platform.OS === 'web') {
        // Browser: trigger a normal file download.
        const doc = (globalThis as unknown as { document: any }).document;
        const url = (globalThis as unknown as { URL: any }).URL.createObjectURL(
          new (globalThis as unknown as { Blob: any }).Blob([csv], { type: 'text/csv' }),
        );
        const a = doc.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
      } else {
        const uri = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(uri, csv, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'text/csv',
            dialogTitle: filename,
          });
        }
      }
    } catch (err) {
      Alert.alert('Excel export failed', err instanceof Error ? err.message : String(err));
    }
    setBusy(null);
  };

  // ------------------------------------------------------------ render

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader title="Takings register" subtitle="Table report · PDF & Excel export" />

      <Segmented<PeriodKind>
        options={[
          { value: 'day', label: 'Day' },
          { value: 'week', label: 'Week' },
          { value: 'fortnight', label: 'F/night' },
          { value: 'month', label: 'Month' },
          { value: 'term', label: 'Term' },
        ]}
        value={kind}
        onChange={(k) => {
          setKind(k);
          setAnchor(todayISO());
        }}
      />

      {/* Range navigator */}
      <Card style={styles.navCard}>
        <Pressable onPress={() => setAnchor(shiftAnchor(kind, anchor, -1))} style={styles.navBtn} hitSlop={8}>
          <ChevronLeft color={colors.text} size={20} />
        </Pressable>
        <View style={styles.navMiddle}>
          <Text style={styles.navText}>{rangeLabel}</Text>
          <Text style={type.caption}>
            {KIND_LABELS[kind]} · {rows.length} entries · {formatPGK(total)}
          </Text>
        </View>
        <Pressable onPress={() => setAnchor(shiftAnchor(kind, anchor, 1))} style={styles.navBtn} hitSlop={8}>
          <ChevronRight color={colors.text} size={20} />
        </Pressable>
      </Card>

      <View style={styles.exportRow}>
        <Button
          title="PDF"
          variant="secondary"
          size="md"
          loading={busy === 'pdf'}
          icon={<FileDown color={colors.onPrimary} size={16} />}
          onPress={exportPDF}
          style={styles.exportBtn}
        />
        <Button
          title="Excel (CSV)"
          variant="outline"
          size="md"
          loading={busy === 'csv'}
          icon={<SheetIcon color={colors.primary} size={16} />}
          onPress={exportExcel}
          style={styles.exportBtn}
        />
      </View>

      {/* Table */}
      {loading ? (
        <SkeletonCard />
      ) : rows.length === 0 ? (
        <Card>
          <Text style={type.body}>No takings recorded in this {KIND_LABELS[kind].toLowerCase()} period.</Text>
        </Card>
      ) : (
        <Card padded={false}>
          <View style={[styles.tr, styles.thead]}>
            <Text style={[styles.th, styles.colDate]}>Date</Text>
            <Text style={[styles.th, styles.colVehicle]}>Taxi</Text>
            <Text style={[styles.th, styles.colDriver]}>Driver</Text>
            <Text style={[styles.th, styles.colAmount]}>Takings</Text>
          </View>
          {rows.map((r, idx) => (
            <View key={r.id} style={[styles.tr, idx % 2 === 1 && styles.trAlt]}>
              <Text style={[styles.td, styles.colDate]}>{formatDateShort(r.date)}</Text>
              <Text style={[styles.td, styles.colVehicle]}>{r.vehicle}</Text>
              <Text style={[styles.td, styles.colDriver]} numberOfLines={1}>
                {r.driver}
              </Text>
              <Text style={[styles.td, styles.colAmount, styles.num]}>
                {formatPGK(r.amount, { decimals: 2 })}
              </Text>
            </View>
          ))}
          <View style={[styles.tr, styles.tfoot]}>
            <Text style={[styles.th, styles.colDate]}></Text>
            <Text style={[styles.th, styles.colVehicle]}></Text>
            <Text style={[styles.th, styles.colDriver]}>TOTAL</Text>
            <Text style={[styles.th, styles.colAmount, styles.num]}>{formatPGK(total)}</Text>
          </View>
        </Card>
      )}
    </Screen>
  );
}

function tableHTML(kindLabel: string, rangeLabel: string, rows: Row[], total: number): string {
  const body = rows
    .map(
      (r, i) =>
        `<tr${i % 2 ? ' class="alt"' : ''}><td>${formatDate(r.date)}</td><td>${r.vehicle}</td><td>${r.driver}</td><td class="num">${formatPGK(r.amount)}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #101828; padding: 28px; }
  .head { background:#0B1220; color:#fff; border-radius:12px; padding:18px 24px; margin-bottom:18px; }
  .head h1 { margin:0; font-size:18px; } .head .sub { color:rgba(255,255,255,.7); font-size:12px; margin-top:4px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { text-align:left; color:#5B6779; font-weight:600; border-bottom:2px solid #101828; padding:7px 8px; }
  th.num, td.num { text-align:right; }
  td { padding:6px 8px; border-bottom:1px solid #E3E8F0; }
  tr.alt td { background:#F6F8FC; }
  tr.total td { font-weight:800; border-top:2px solid #101828; border-bottom:none; font-size:14px; }
  </style></head><body>
  <div class="head"><h1>Takings register · ${kindLabel}</h1>
  <div class="sub">${rangeLabel} · Safeco Taxi Service · Built by Skyworks Systems © 2026</div></div>
  <table>
    <tr><th>Date</th><th>Vehicle</th><th>Driver</th><th class="num">Takings</th></tr>
    ${body}
    <tr class="total"><td></td><td></td><td>TOTAL (${rows.length} entries)</td><td class="num">${formatPGK(total)}</td></tr>
  </table>
  </body></html>`;
}

const styles = StyleSheet.create({
  navCard: {
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
  navMiddle: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  navText: {
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.text,
  },
  exportRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  exportBtn: {
    flex: 1,
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  trAlt: {
    backgroundColor: colors.surfaceMuted,
  },
  thead: {
    borderBottomWidth: 2,
    borderBottomColor: colors.borderStrong,
  },
  tfoot: {
    borderBottomWidth: 0,
    borderTopWidth: 2,
    borderTopColor: colors.borderStrong,
  },
  th: {
    fontFamily: font.bold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  td: {
    fontFamily: font.medium,
    fontSize: 13,
    color: colors.text,
  },
  num: {
    textAlign: 'right',
  },
  colDate: {
    width: 58,
  },
  colVehicle: {
    width: 70,
  },
  colDriver: {
    flex: 1,
  },
  colAmount: {
    width: 84,
  },
});
