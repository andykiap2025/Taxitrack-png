import { useFocusEffect, useRouter } from 'expo-router';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronRight as Chevron,
  CloudOff,
  Moon,
  RefreshCw,
  Users,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SyncChip } from '@/components/SyncChip';
import { Badge, Card, EmptyState, Screen, SkeletonCard } from '@/components/ui';
import {
  defaultBusinessDate,
  loadBundle,
  loadTakingsForDate,
  type CheckinBundle,
} from '@/lib/checkin';
import { formatDateLong, formatPGK } from '@/lib/format';
import { initialsOf } from '@/lib/labels';
import { flushQueue, subscribeQueue, type QueuedItem } from '@/lib/offlineQueue';
import { colors, font, identityColor, radius, spacing, type } from '@/lib/theme';
import type { DailyTakings } from '@/types/db';

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

  const recordedCount = drivers.filter((d) => rowByDriver.has(d.id)).length;
  const totalReceived = drivers.reduce((sum, d) => {
    const s = rowByDriver.get(d.id);
    return s?.kind === 'recorded' ? sum + s.amount : sum;
  }, 0);

  return (
    <Screen title="Check-in" titleAccessory={<SyncChip />}>
      {/* Date navigator */}
      <Card style={styles.dateCard}>
        <Pressable onPress={() => shiftDate(-1)} style={styles.dateBtn} hitSlop={8}>
          <ChevronLeft color={colors.text} size={20} />
        </Pressable>
        <View style={styles.dateMiddle}>
          <Text style={styles.dateText}>
            {date === today ? 'Tonight' : formatDateLong(date)}
          </Text>
          <Text style={type.caption}>
            {recordedCount} of {drivers.length} recorded · {formatPGK(totalReceived)}
          </Text>
        </View>
        <Pressable
          onPress={() => shiftDate(1)}
          style={[styles.dateBtn, date >= today && styles.dateBtnDisabled]}
          hitSlop={8}
          disabled={date >= today}
        >
          <ChevronRight color={date >= today ? colors.textMuted : colors.text} size={20} />
        </Pressable>
      </Card>

      {fromCache && (
        <View style={styles.offlineNote}>
          <CloudOff size={14} color={colors.warning} />
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
        <Card padded={false}>
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
          <Text style={styles.hint}>
            Tap a driver as their taxi checks in. Skip drivers who didn't work — no entry
            means no target for them.
          </Text>
          {drivers.map((d) => {
            const state = rowByDriver.get(d.id) ?? { kind: 'pending' as const };
            const assignedVehicle = bundle.assignments[d.id]
              ? vehicleById.get(bundle.assignments[d.id])
              : undefined;
            return (
              <Card
                key={d.id}
                tint={identityColor(d.id).soft}
                onPress={() =>
                  router.push({ pathname: '/takings/entry', params: { driverId: d.id, date } })
                }
              >
                <View style={styles.row}>
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: '#FFFFFF' },
                    ]}
                  >
                    {state.kind === 'recorded' ? (
                      state.queued ? (
                        <RefreshCw color={colors.warning} size={18} />
                      ) : (
                        <CheckCircle2 color={colors.success} size={20} />
                      )
                    ) : (
                      <Text style={[styles.avatarText, { color: identityColor(d.id).strong }]}>
                        {initialsOf(d.full_name)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.info}>
                    <Text style={type.cardTitle}>{d.full_name}</Text>
                    <Text style={type.caption} numberOfLines={1}>
                      {assignedVehicle ? assignedVehicle.plate_no : 'No regular taxi'}
                      {state.kind === 'recorded' && state.queued ? ' · waiting to sync' : ''}
                    </Text>
                  </View>
                  <View style={styles.right}>
                    {state.kind === 'recorded' ? (
                      <>
                        <Text style={styles.amount}>{formatPGK(state.amount)}</Text>
                        {state.noTarget ? (
                          <Badge label="No target" tone="neutral" />
                        ) : state.shortfall > 0 ? (
                          <Badge
                            label={`Short ${formatPGK(state.shortfall, { decimals: 0 })}`}
                            tone="danger"
                            dot
                          />
                        ) : state.surplus > 0 ? (
                          <Badge
                            label={`+${formatPGK(state.surplus, { decimals: 0 })} over`}
                            tone="success"
                            dot
                          />
                        ) : (
                          <Badge label="On target" tone="success" dot />
                        )}
                      </>
                    ) : (
                      <View style={styles.pendingRight}>
                        <Moon color={colors.textMuted} size={16} />
                        <Chevron color={colors.textMuted} size={18} />
                      </View>
                    )}
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  dateBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBtnDisabled: {
    opacity: 0.4,
  },
  dateMiddle: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  dateText: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.text,
  },
  offlineNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  offlineText: {
    ...type.caption,
    color: colors.warning,
    flex: 1,
  },
  list: {
    gap: spacing.sm,
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
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarDone: {
    backgroundColor: colors.successSoft,
  },
  avatarQueued: {
    backgroundColor: colors.warningSoft,
  },
  avatarText: {
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.textSecondary,
  },
  info: {
    flex: 1,
    gap: 2,
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
  pendingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
