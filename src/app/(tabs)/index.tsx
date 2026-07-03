import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  AlertTriangle,
  CarTaxiFront,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileWarning,
  Moon,
  RefreshCw,
  Wrench,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
import { formatDateLong, formatPGK, nowPOMMinutes, todayISO } from '@/lib/format';
import { initialsOf } from '@/lib/labels';
import { subscribeQueue, type QueuedItem } from '@/lib/offlineQueue';
import { supabase } from '@/lib/supabase';
import { colors, font, gradients, radius, shadow, spacing, type } from '@/lib/theme';
import { serviceState } from '@/lib/service';
import type { ComplianceDoc, DailyTakings, ServiceRecord, Vehicle } from '@/types/db';

type ExpiringDoc = ComplianceDoc & {
  vehicle: { plate_no: string } | null;
  driver: { full_name: string } | null;
};

export default function Dashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  const date = defaultBusinessDate();
  const [bundle, setBundle] = useState<CheckinBundle | null>(null);
  const [rows, setRows] = useState<DailyTakings[]>([]);
  const [queued, setQueued] = useState<QueuedItem[]>([]);
  const [expiring, setExpiring] = useState<ExpiringDoc[]>([]);
  const [serviceDue, setServiceDue] = useState<{ vehicle: Vehicle; label: string; tone: 'danger' | 'warning' }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    const [b, t, docs, svc] = await Promise.all([
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
    ]);
    setBundle(b.bundle);
    setRows(t.rows);
    if (!docs.error) setExpiring((docs.data ?? []) as unknown as ExpiringDoc[]);

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

  // Merge server + queued entries for tonight.
  const entries = useMemo(() => {
    const map = new Map<string, { received: number; shortfall: number; queued: boolean }>();
    for (const r of rows) {
      map.set(r.driver_id, {
        received: r.amount_received,
        shortfall: r.shortfall_amount,
        queued: false,
      });
    }
    for (const item of queued) {
      if (item.payload.date !== date) continue;
      const p = item.payload;
      map.set(p.driver_id, {
        received: p.amount_received,
        shortfall: p.target_amount === null ? 0 : Math.max(p.target_amount - p.amount_received, 0),
        queued: true,
      });
    }
    return map;
  }, [rows, queued, date]);

  const drivers = bundle?.drivers ?? [];
  const recorded = drivers.filter((d) => entries.has(d.id));
  const pending = drivers.filter((d) => !entries.has(d.id));
  const totalTonight = [...entries.values()].reduce((s, e) => s + e.received, 0);
  const shortfalls = recorded
    .map((d) => ({ driver: d, entry: entries.get(d.id)! }))
    .filter((x) => x.entry.shortfall > 0);

  // After 23:30 POM, still-pending drivers are flagged as missed.
  const pastEscalation = date === todayISO() && nowPOMMinutes() >= 23 * 60 + 30;

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
            <Text style={styles.heroDate}>{formatDateLong(date)} · Port Moresby</Text>
          </View>
          <View style={styles.heroLogo}>
            <CarTaxiFront color={colors.accent} size={24} />
          </View>
        </View>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Tonight's takings</Text>
            <Text style={styles.heroStatValue}>{formatPGK(totalTonight, { decimals: 0 })}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Checked in</Text>
            <Text style={styles.heroStatValue}>
              {recorded.length} / {drivers.length}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.actionsRow}>
        <Button
          title="Start check-in"
          size="md"
          icon={<ClipboardCheck color={colors.onAccent} size={17} />}
          onPress={() => router.navigate('/checkin')}
          style={styles.actionBtn}
        />
        <SyncChip />
      </View>

      {shortfalls.length > 0 && (
        <>
          <Text style={type.sectionTitle}>Shortfall flags</Text>
          <Card padded={false}>
            {shortfalls.map(({ driver, entry }, idx) => (
              <Pressable
                key={driver.id}
                onPress={() =>
                  router.push({ pathname: '/takings/entry', params: { driverId: driver.id, date } })
                }
                style={({ pressed }) => [
                  styles.boardRow,
                  idx < shortfalls.length - 1 && styles.divider,
                  pressed && { backgroundColor: colors.surfaceMuted },
                ]}
              >
                <View style={[styles.rowIcon, { backgroundColor: colors.dangerSoft }]}>
                  <AlertTriangle color={colors.danger} size={17} />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={type.bodyMedium}>{driver.full_name}</Text>
                  <Text style={type.caption}>Handed in {formatPGK(entry.received)}</Text>
                </View>
                <Badge label={`Short ${formatPGK(entry.shortfall, { decimals: 0 })}`} tone="danger" />
              </Pressable>
            ))}
          </Card>
        </>
      )}

      {expiring.length > 0 && (
        <>
          <Text style={type.sectionTitle}>Expiring soon</Text>
          <Card padded={false}>
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
                    {doc.vehicle?.plate_no ?? doc.driver?.full_name ?? '—'}
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

      {serviceDue.length > 0 && (
        <>
          <Text style={type.sectionTitle}>Service due</Text>
          <Card padded={false}>
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

      <Text style={type.sectionTitle}>Tonight's board</Text>
      {loading ? (
        <SkeletonCard />
      ) : drivers.length === 0 ? (
        <Card>
          <Text style={type.body}>
            Add vehicles and drivers in the Fleet tab to see the nightly board here.
          </Text>
        </Card>
      ) : (
        <Card padded={false}>
          {[...recorded, ...pending].map((d, idx) => {
            const entry = entries.get(d.id);
            const missed = !entry && pastEscalation;
            return (
              <Pressable
                key={d.id}
                onPress={() =>
                  router.push({ pathname: '/takings/entry', params: { driverId: d.id, date } })
                }
                style={({ pressed }) => [
                  styles.boardRow,
                  idx < drivers.length - 1 && styles.divider,
                  pressed && { backgroundColor: colors.surfaceMuted },
                ]}
              >
                <View
                  style={[
                    styles.rowIcon,
                    entry
                      ? entry.queued
                        ? { backgroundColor: colors.warningSoft }
                        : { backgroundColor: colors.successSoft }
                      : missed
                        ? { backgroundColor: colors.dangerSoft }
                        : { backgroundColor: colors.surfaceMuted },
                  ]}
                >
                  {entry ? (
                    entry.queued ? (
                      <RefreshCw color={colors.warning} size={16} />
                    ) : (
                      <CheckCircle2 color={colors.success} size={17} />
                    )
                  ) : missed ? (
                    <AlertTriangle color={colors.danger} size={16} />
                  ) : (
                    <Text style={styles.rowInitials}>{initialsOf(d.full_name)}</Text>
                  )}
                </View>
                <View style={styles.rowInfo}>
                  <Text style={type.bodyMedium}>{d.full_name}</Text>
                  <Text style={type.caption}>
                    {entry
                      ? `${formatPGK(entry.received)}${entry.queued ? ' · waiting to sync' : ''}`
                      : missed
                        ? 'No check-in recorded'
                        : 'Not checked in yet'}
                  </Text>
                </View>
                {entry ? (
                  entry.shortfall > 0 ? (
                    <Badge label="Short" tone="danger" dot />
                  ) : (
                    <Badge label="In" tone="success" dot />
                  )
                ) : missed ? (
                  <Badge label="Missed" tone="danger" dot />
                ) : (
                  <View style={styles.pendingIcons}>
                    <Moon color={colors.textMuted} size={15} />
                    <ChevronRight color={colors.textMuted} size={17} />
                  </View>
                )}
              </Pressable>
            );
          })}
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
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  heroStat: { flex: 1, gap: 2 },
  heroDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: spacing.md,
  },
  heroStatLabel: {
    fontFamily: font.medium,
    fontSize: 12,
    color: colors.textOnDarkMuted,
  },
  heroStatValue: {
    fontFamily: font.extrabold,
    fontSize: 22,
    color: colors.textOnDark,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInitials: {
    fontFamily: font.bold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  rowInfo: {
    flex: 1,
    gap: 1,
  },
  pendingIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
