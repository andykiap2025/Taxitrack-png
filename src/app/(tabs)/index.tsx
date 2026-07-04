import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { ClipboardCheck, FileWarning, Wrench } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { DriverHome } from '@/components/DriverHome';
import { SyncChip } from '@/components/SyncChip';
import { Badge, Button, Card, Screen, SkeletonCard } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { DOC_TYPE_LABELS, daysUntil, expiryLabel, toneForDays } from '@/lib/alerts';
import {
  defaultBusinessDate,
  loadBundle,
  loadTakingsForDate,
  type CheckinBundle,
} from '@/lib/checkin';
import { formatDateLong, formatPGK, todayISO } from '@/lib/format';
import { initialsOf, titleCase } from '@/lib/labels';
import { subscribeQueue, type QueuedItem } from '@/lib/offlineQueue';
import { periodForDate } from '@/lib/payroll';
import { serviceState } from '@/lib/service';
import { supabase } from '@/lib/supabase';
import { colors, font, gradients, radius, shadow, spacing, type } from '@/lib/theme';
import type { AppSettings, ComplianceDoc, DailyTakings, ServiceRecord, Vehicle } from '@/types/db';

type ExpiringDoc = ComplianceDoc & {
  vehicle: { plate_no: string } | null;
  driver: { full_name: string } | null;
};

// Variance pill colors (status only lives here).
const PILL = {
  over: { bg: '#DCFCE7', fg: '#16A34A' },
  short: { bg: '#FEE2E2', fg: '#DC2626' },
  met: { bg: '#EEF1F5', fg: '#6B7280' },
} as const;

export default function HomeScreen() {
  const { role } = useAuth();
  // Swap whole components so hook order stays stable across role changes.
  return role === 'driver' ? <DriverHome /> : <OwnerDashboard />;
}

type BoardEntry = {
  driverId: string;
  name: string;
  plate: string | null;
  received: number;
  shortfall: number;
  surplus: number;
  noTarget: boolean;
  queued: boolean;
};

function OwnerDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  const date = defaultBusinessDate();
  const [bundle, setBundle] = useState<CheckinBundle | null>(null);
  const [rows, setRows] = useState<DailyTakings[]>([]);
  const [queued, setQueued] = useState<QueuedItem[]>([]);
  const [expiring, setExpiring] = useState<ExpiringDoc[]>([]);
  const [serviceDue, setServiceDue] = useState<
    { vehicle: Vehicle; label: string; tone: 'danger' | 'warning' }[]
  >([]);
  const [fortnightGross, setFortnightGross] = useState(0);
  const [paydayDays, setPaydayDays] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    const today = todayISO();

    const [b, t, docs, svc, settings] = await Promise.all([
      loadBundle(),
      loadTakingsForDate(date),
      supabase
        .from('compliance_docs')
        .select('*, vehicle:vehicles(plate_no), driver:drivers(full_name)')
        .lte('expiry_date', soon.toISOString().slice(0, 10))
        .order('expiry_date')
        .limit(4),
      supabase
        .from('service_records')
        .select('*')
        .order('service_date', { ascending: false })
        .limit(30),
      supabase.from('app_settings').select('pay_period_anchor').eq('id', 1).single(),
    ]);
    setBundle(b.bundle);
    setRows(t.rows);
    if (!docs.error) setExpiring((docs.data ?? []) as unknown as ExpiringDoc[]);

    // Fortnight-so-far gross + days to payday.
    const anchor =
      (settings.data as Pick<AppSettings, 'pay_period_anchor'> | null)?.pay_period_anchor ??
      '2026-01-05';
    const period = periodForDate(today, anchor);
    setPaydayDays(Math.max(daysUntil(period.end), 0));
    const { data: fn } = await supabase
      .from('daily_takings')
      .select('amount_received')
      .gte('date', period.start)
      .lte('date', period.end);
    if (fn) {
      setFortnightGross(
        (fn as { amount_received: number }[]).reduce((s, r) => s + Number(r.amount_received), 0),
      );
    }

    if (!svc.error && b.bundle) {
      const latest: Record<string, ServiceRecord> = {};
      for (const rec of (svc.data ?? []) as ServiceRecord[]) {
        if (!latest[rec.vehicle_id]) latest[rec.vehicle_id] = rec;
      }
      const due = b.bundle.vehicles
        .map((v) => ({ vehicle: v, state: serviceState(v, latest[v.id] ?? null) }))
        // "No record yet" only nags on the service screen, not the dashboard.
        .filter((x) => x.state.needsAttention && latest[x.vehicle.id])
        .slice(0, 3)
        .map((x) => ({
          vehicle: x.vehicle,
          label: x.state.label,
          tone: (x.state.tone === 'danger' ? 'danger' : 'warning') as 'danger' | 'warning',
        }));
      setServiceDue(due);
    }
    setLoading(false);
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      load();
      const unsub = subscribeQueue((s) => setQueued(s.pending));
      return unsub;
    }, [load]),
  );

  const drivers = bundle?.drivers ?? [];
  const vehicleById = useMemo(
    () => new Map((bundle?.vehicles ?? []).map((v) => [v.id, v])),
    [bundle],
  );

  // Merge server + queued entries for tonight, sorted shortfalls-first.
  const board = useMemo<BoardEntry[]>(() => {
    const map = new Map<string, BoardEntry>();
    for (const r of rows) {
      const d = drivers.find((x) => x.id === r.driver_id);
      map.set(r.driver_id, {
        driverId: r.driver_id,
        name: d?.full_name ?? 'Unknown',
        plate: vehicleById.get(r.vehicle_id)?.plate_no ?? null,
        received: Number(r.amount_received),
        shortfall: Number(r.shortfall_amount),
        surplus: Number(r.surplus_amount),
        noTarget: r.target_amount === null,
        queued: false,
      });
    }
    for (const item of queued) {
      if (item.payload.date !== date) continue;
      const p = item.payload;
      const d = drivers.find((x) => x.id === p.driver_id);
      const target = p.target_amount;
      map.set(p.driver_id, {
        driverId: p.driver_id,
        name: d?.full_name ?? 'Unknown',
        plate: vehicleById.get(p.vehicle_id)?.plate_no ?? null,
        received: p.amount_received,
        shortfall: target === null ? 0 : Math.max(target - p.amount_received, 0),
        surplus: target === null ? 0 : Math.max(p.amount_received - target, 0),
        noTarget: target === null,
        queued: true,
      });
    }
    return [...map.values()].sort((a, b) => {
      const aShort = a.shortfall > 0 ? 1 : 0;
      const bShort = b.shortfall > 0 ? 1 : 0;
      if (aShort !== bShort) return bShort - aShort;
      return b.received - a.received;
    });
  }, [rows, queued, date, drivers, vehicleById]);

  const recordedCount = board.length;
  const pendingCount = Math.max(drivers.length - recordedCount, 0);
  const totalTonight = board.reduce((s, e) => s + e.received, 0);
  const allRecorded = drivers.length > 0 && pendingCount === 0;

  return (
    <Screen style={styles.content}>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, shadow.raised]}
      >
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroGreeting}>Hi {titleCase(firstName)} 👋</Text>
            <Text style={styles.heroDate}>{formatDateLong(date)} · Port Moresby</Text>
          </View>
          <View style={styles.heroRight}>
            <Image
              source={require('@/assets/play_store/icon_main_512x512.png')}
              style={styles.heroLogo}
            />
            <SyncChip />
          </View>
        </View>
        <View style={styles.statGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Tonight's takings</Text>
            <Text style={styles.statValue}>{formatPGK(totalTonight, { decimals: 0 })}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Checked in</Text>
            <Text style={styles.statValue}>
              {recordedCount} / {drivers.length}
            </Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Fortnight so far</Text>
            <Text style={styles.statValue}>{formatPGK(fortnightGross, { decimals: 0 })}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Payday</Text>
            <Text style={styles.statValue}>
              {paydayDays === null ? '—' : paydayDays === 0 ? 'Today' : `in ${paydayDays}d`}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Context-aware CTA */}
      {allRecorded ? (
        <Button
          title="Review tonight's check-in"
          variant="outline"
          fullWidth
          icon={<ClipboardCheck color={colors.primary} size={18} />}
          onPress={() => router.navigate('/checkin')}
        />
      ) : (
        <Button
          title={`Start check-in${pendingCount > 0 ? ` (${pendingCount} left)` : ''}`}
          variant="secondary"
          fullWidth
          icon={<ClipboardCheck color={colors.onPrimary} size={18} />}
          onPress={() => router.navigate('/checkin')}
        />
      )}

      <Text style={type.sectionTitle}>Tonight's board</Text>
      {loading ? (
        <SkeletonCard />
      ) : drivers.length === 0 ? (
        <Card style={styles.boardCard}>
          <Text style={type.body}>
            Add vehicles and drivers in the Fleet tab to see the nightly board here.
          </Text>
        </Card>
      ) : board.length === 0 ? (
        <Card style={styles.boardCard}>
          <Text style={type.body}>No takings recorded yet tonight — tap Start check-in.</Text>
        </Card>
      ) : (
        <Card padded={false} style={styles.boardCard}>
          {board.map((e, idx) => {
            const pill = e.shortfall > 0 ? PILL.short : e.surplus > 0 ? PILL.over : PILL.met;
            const pillLabel =
              e.shortfall > 0
                ? `Short ${formatPGK(e.shortfall, { decimals: 0 })}`
                : e.surplus > 0
                  ? `+${formatPGK(e.surplus, { decimals: 0 })}`
                  : e.noTarget
                    ? 'No target'
                    : 'Met';
            return (
              <Pressable
                key={e.driverId}
                onPress={() =>
                  router.push({
                    pathname: '/takings/entry',
                    params: { driverId: e.driverId, date },
                  })
                }
                style={({ pressed }) => [
                  styles.boardRow,
                  idx < board.length - 1 && styles.divider,
                  pressed && { backgroundColor: colors.surfaceMuted },
                ]}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initialsOf(e.name)}</Text>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={type.bodyMedium} numberOfLines={1}>
                    {titleCase(e.name)}
                  </Text>
                  {e.queued ? <Text style={type.caption}>waiting to sync</Text> : null}
                </View>
                {e.plate ? (
                  <View style={styles.plateChip}>
                    <Text style={styles.plateChipText}>{e.plate}</Text>
                  </View>
                ) : null}
                <Text style={styles.amount}>{formatPGK(e.received, { decimals: 0 })}</Text>
                <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                  <Text style={[styles.pillText, { color: pill.fg }]}>{pillLabel}</Text>
                </View>
              </Pressable>
            );
          })}
        </Card>
      )}

      {serviceDue.length > 0 && (
        <>
          <Text style={type.sectionTitle}>Service due</Text>
          <Card padded={false} style={styles.boardCard}>
            {serviceDue.map((s, idx) => (
              <Pressable
                key={s.vehicle.id}
                onPress={() => router.push('/service')}
                style={({ pressed }) => [
                  styles.boardRow,
                  idx < serviceDue.length - 1 && styles.divider,
                  pressed && { backgroundColor: colors.surfaceMuted },
                ]}
              >
                <View
                  style={[
                    styles.rowIcon,
                    { backgroundColor: s.tone === 'danger' ? colors.dangerSoft : colors.warningSoft },
                  ]}
                >
                  <Wrench color={s.tone === 'danger' ? colors.danger : colors.warning} size={16} />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={type.bodyMedium}>{s.vehicle.plate_no}</Text>
                  <Text style={type.caption}>Tap to log or schedule the service</Text>
                </View>
                <Badge label={s.label} tone={s.tone} />
              </Pressable>
            ))}
          </Card>
        </>
      )}

      {expiring.length > 0 && (
        <>
          <Text style={type.sectionTitle}>Expiring soon</Text>
          <Card padded={false} style={styles.boardCard}>
            {expiring.map((doc, idx) => (
              <Pressable
                key={doc.id}
                onPress={() => router.push('/compliance')}
                style={({ pressed }) => [
                  styles.boardRow,
                  idx < expiring.length - 1 && styles.divider,
                  pressed && { backgroundColor: colors.surfaceMuted },
                ]}
              >
                <View style={[styles.rowIcon, { backgroundColor: colors.warningSoft }]}>
                  <FileWarning color={colors.warning} size={17} />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={type.bodyMedium}>
                    {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type} ·{' '}
                    {doc.vehicle?.plate_no ?? titleCase(doc.driver?.full_name ?? '—')}
                  </Text>
                  <Text style={type.caption}>Tap to renew in Compliance</Text>
                </View>
                <Badge
                  label={expiryLabel(doc.expiry_date)}
                  tone={toneForDays(daysUntil(doc.expiry_date))}
                />
              </Pressable>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  hero: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  heroRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  heroLogo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  statCell: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  statLabel: {
    fontFamily: font.medium,
    fontSize: 12,
    color: colors.textOnDarkMuted,
  },
  statValue: {
    fontFamily: font.extrabold,
    fontSize: 20,
    color: colors.textOnDark,
  },
  boardCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E8EC',
    borderRadius: 14,
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F5',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: '#EEF1F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: font.bold,
    fontSize: 12,
    color: '#4B5563',
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
    gap: 1,
  },
  plateChip: {
    backgroundColor: '#E3E9F5',
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
  },
  plateChipText: {
    fontFamily: font.semibold,
    fontSize: 11,
    color: colors.primary,
  },
  amount: {
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.text,
    minWidth: 56,
    textAlign: 'right',
  },
  pill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    minWidth: 64,
    alignItems: 'center',
  },
  pillText: {
    fontFamily: font.semibold,
    fontSize: 11,
  },
});
