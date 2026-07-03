import { useFocusEffect, useRouter } from 'expo-router';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Users,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SyncChip } from '@/components/SyncChip';
import { Card, EmptyState, Screen, SkeletonCard } from '@/components/ui';
import {
  defaultBusinessDate,
  loadBundle,
  loadTakingsForDate,
  type CheckinBundle,
} from '@/lib/checkin';
import { formatDateLong, formatPGK } from '@/lib/format';
import { initialsOf, titleCase } from '@/lib/labels';
import { flushQueue, subscribeQueue, type QueuedItem } from '@/lib/offlineQueue';
import { colors, font, radius, spacing, type } from '@/lib/theme';
import type { DailyTakings, Driver } from '@/types/db';

// Status colors — used ONLY in the pill badge and the card's left strip.
const STATUS = {
  over: { strip: '#16A34A', pillBg: '#DCFCE7', pillFg: '#16A34A' },
  short: { strip: '#DC2626', pillBg: '#FEE2E2', pillFg: '#DC2626' },
  none: { strip: '#6B7280', pillBg: '#EEF1F5', pillFg: '#6B7280' },
} as const;

type RowState =
  | { kind: 'pending' }
  | { kind: 'recorded'; amount: number; shortfall: number; surplus: number; noTarget: boolean; queued: boolean };

export default function CheckinScreen() {
  const router = useRouter();
  const [date, setDate] = useState(defaultBusinessDate());
  const [bundle, setBundle] = useState<CheckinBundle | null>(null);
  const [rows, setRows] = useState<DailyTakings[]>([]);
  const [queued, setQueued] = useState<QueuedItem[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [b, t] = await Promise.all([loadBundle(), loadTakingsForDate(date)]);
    setBundle(b.bundle);
    setRows(t.rows);
    setFromCache(b.fromCache || t.fromCache);
    setError(b.error ?? t.error);
    setLoading(false);
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      load();
      flushQueue();
      const unsub = subscribeQueue((s) => {
        setQueued(s.pending);
        if (!s.syncing) load();
      });
      return unsub;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  const today = defaultBusinessDate();

  const shiftDate = (delta: number) => {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    const next = d.toISOString().slice(0, 10);
    if (next > today) return;
    setDate(next);
    setLoading(true);
  };

  // Merge server rows with locally queued entries (queue wins the display).
  const rowByDriver = useMemo(() => {
    const map = new Map<string, RowState>();
    for (const r of rows) {
      map.set(r.driver_id, {
        kind: 'recorded',
        amount: r.amount_received,
        shortfall: r.shortfall_amount,
        surplus: r.surplus_amount,
        noTarget: r.target_amount === null,
        queued: false,
      });
    }
    for (const item of queued) {
      if (item.payload.date !== date) continue;
      const p = item.payload;
      const target = p.target_amount;
      map.set(p.driver_id, {
        kind: 'recorded',
        amount: p.amount_received,
        shortfall: target === null ? 0 : Math.max(target - p.amount_received, 0),
        surplus: target === null ? 0 : Math.max(p.amount_received - target, 0),
        noTarget: target === null,
        queued: true,
      });
    }
    return map;
  }, [rows, queued, date]);

  const drivers = bundle?.drivers ?? [];
  const vehicleById = useMemo(
    () => new Map((bundle?.vehicles ?? []).map((v) => [v.id, v])),
    [bundle],
  );

  // Unrecorded drivers first, then recorded.
  const pendingDrivers = drivers.filter((d) => !rowByDriver.has(d.id));
  const recordedDrivers = drivers.filter((d) => rowByDriver.has(d.id));

  const recordedCount = recordedDrivers.length;
  const totalReceived = recordedDrivers.reduce((sum, d) => {
    const s = rowByDriver.get(d.id);
    return s?.kind === 'recorded' ? sum + s.amount : sum;
  }, 0);

  const openEntry = (driverId: string) =>
    router.push({ pathname: '/takings/entry', params: { driverId, date } });

  const DriverRow = ({ d }: { d: Driver }) => {
    const state = rowByDriver.get(d.id) ?? ({ kind: 'pending' } as RowState);
    const assignedVehicle = bundle?.assignments[d.id]
      ? vehicleById.get(bundle.assignments[d.id])
      : undefined;

    const recorded = state.kind === 'recorded';
    const status = !recorded
      ? STATUS.none
      : state.noTarget
        ? STATUS.none
        : state.shortfall > 0
          ? STATUS.short
          : STATUS.over;

    const pillLabel = !recorded
      ? null
      : state.noTarget
        ? 'No target'
        : state.shortfall > 0
          ? `Short ${formatPGK(state.shortfall, { decimals: 0 })}`
          : state.surplus > 0
            ? `+${formatPGK(state.surplus, { decimals: 0 })} over`
            : 'On target';

    return (
      <Card
        key={d.id}
        onPress={() => openEntry(d.id)}
        style={StyleSheet.flatten([
          styles.cardBase,
          recorded
            ? { borderLeftColor: status.strip, borderLeftWidth: 3 }
            : styles.cardPending,
        ])}
      >
        <View style={styles.row}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsOf(d.full_name)}</Text>
            {recorded && (
              <View style={styles.checkBadge}>
                <Check color="#FFFFFF" size={9} strokeWidth={4} />
              </View>
            )}
          </View>
          <View style={styles.info}>
            <Text style={[type.cardTitle, !recorded && styles.mutedTitle]}>
              {titleCase(d.full_name)}
            </Text>
            <Text style={type.caption} numberOfLines={1}>
              {assignedVehicle ? assignedVehicle.plate_no : 'No regular taxi'}
              {recorded && state.queued ? ' · waiting to sync' : ''}
            </Text>
          </View>
          <View style={styles.right}>
            {recorded ? (
              <>
                <Text style={styles.amount}>{formatPGK(state.amount)}</Text>
                <View style={[styles.pill, { backgroundColor: status.pillBg }]}>
                  <Text style={[styles.pillText, { color: status.pillFg }]}>{pillLabel}</Text>
                </View>
              </>
            ) : (
              <View style={styles.pendingRight}>
                <Text style={styles.pendingText}>Tap to enter</Text>
                <ChevronRight color={STATUS.none.strip} size={18} />
              </View>
            )}
          </View>
        </View>
      </Card>
    );
  };

  return (
    <Screen title="Check-in" titleAccessory={<SyncChip />}>
      {/* Date navigator — brand navy, the anchor of the screen */}
      <Card style={styles.dateCard}>
        <Pressable onPress={() => shiftDate(-1)} style={styles.dateBtn} hitSlop={8}>
          <ChevronLeft color="#FFFFFF" size={22} />
        </Pressable>
        <View style={styles.dateMiddle}>
          <Text style={styles.dateText}>
            {date === today ? 'Tonight' : formatDateLong(date)}
          </Text>
          <Text style={styles.dateSub}>
            {recordedCount} of {drivers.length} recorded · {formatPGK(totalReceived)}
          </Text>
        </View>
        <Pressable
          onPress={() => shiftDate(1)}
          style={[styles.dateBtn, date >= today && styles.dateBtnDisabled]}
          hitSlop={8}
          disabled={date >= today}
        >
          <ChevronRight color="#FFFFFF" size={22} />
        </Pressable>
      </Card>

      {fromCache && (
        <View style={styles.offlineNote}>
          <CloudOff size={14} color={STATUS.none.strip} />
          <Text style={styles.offlineText}>
            Offline — showing saved data. Entries will sync when back online.
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.list}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : !bundle || drivers.length === 0 ? (
        <Card padded={false} style={styles.cardBase}>
          <EmptyState
            icon={<Users color={colors.textMuted} size={30} />}
            title={error ? "Couldn't load drivers" : 'No active drivers'}
            message={
              error
                ? 'Connect to the internet once so driver data can be saved for offline use.'
                : 'Add drivers in the Fleet tab; they appear here for nightly check-in.'
            }
          />
        </Card>
      ) : (
        <View style={styles.list}>
          {pendingDrivers.length > 0 && (
            <>
              <Text style={[styles.sectionHead, { color: STATUS.short.strip }]}>
                Not checked in yet
              </Text>
              {pendingDrivers.map((d) => (
                <DriverRow key={d.id} d={d} />
              ))}
            </>
          )}
          {recordedDrivers.length > 0 && (
            <>
              <Text style={[styles.sectionHead, { color: STATUS.over.strip }]}>Checked in</Text>
              {recordedDrivers.map((d) => (
                <DriverRow key={d.id} d={d} />
              ))}
            </>
          )}
          <Text style={styles.hint}>
            Skip drivers who didn't work — no entry means no target for them.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Rule 1: white cards, 1px #E5E8EC border, radius 16 — no pastel fills.
  cardBase: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E8EC',
    borderRadius: 16,
  },
  cardPending: {
    borderStyle: 'dashed',
    borderColor: '#D6DBE2',
    borderLeftWidth: 3,
    borderLeftColor: STATUS.none.strip,
  },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.primary,
    borderWidth: 0,
    borderRadius: 16,
  },
  dateBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBtnDisabled: {
    opacity: 0.35,
  },
  dateMiddle: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  dateText: {
    fontFamily: font.extrabold,
    fontSize: 21,
    color: '#FFFFFF',
  },
  dateSub: {
    fontFamily: font.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
  },
  offlineNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#EEF1F5',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  offlineText: {
    ...type.caption,
    color: STATUS.none.strip,
    flex: 1,
  },
  list: {
    gap: spacing.sm,
  },
  sectionHead: {
    ...type.label,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xxs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  hint: {
    ...type.caption,
    paddingHorizontal: spacing.xxs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Rule 4: neutral avatar circle, green check badge overlay when recorded.
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    backgroundColor: '#EEF1F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: font.bold,
    fontSize: 15,
    color: '#4B5563',
  },
  checkBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 17,
    height: 17,
    borderRadius: radius.full,
    backgroundColor: STATUS.over.strip,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  mutedTitle: {
    color: '#6B7280',
  },
  right: {
    alignItems: 'flex-end',
    gap: spacing.xxs,
  },
  amount: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.text,
  },
  pill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  pillText: {
    fontFamily: font.semibold,
    fontSize: 12,
  },
  pendingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  pendingText: {
    fontFamily: font.medium,
    fontSize: 13,
    color: '#6B7280',
  },
});
