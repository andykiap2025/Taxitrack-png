import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, Gauge, Lock, RefreshCw } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  Input,
  Screen,
  ScreenHeader,
  SkeletonCard,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import {
  computeCheckinStatus,
  isTakingsLocked,
  loadBundle,
  loadTakingsForDate,
  type CheckinBundle,
} from '@/lib/checkin';
import { formatDateLong, formatPGK } from '@/lib/format';
import { getQueueState, saveTakings } from '@/lib/offlineQueue';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing, type } from '@/lib/theme';
import type { DailyTakings } from '@/types/db';

export default function TakingsEntry() {
  const { driverId, date } = useLocalSearchParams<{ driverId: string; date: string }>();
  const router = useRouter();
  const { session, role } = useAuth();

  const [bundle, setBundle] = useState<CheckinBundle | null>(null);
  const [existing, setExisting] = useState<DailyTakings | null>(null);
  const [wasQueued, setWasQueued] = useState(false);
  const [loading, setLoading] = useState(true);

  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [declared, setDeclared] = useState('');
  const [received, setReceived] = useState('');
  const [odometer, setOdometer] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    (async () => {
      const [b, t, q] = await Promise.all([
        loadBundle(),
        loadTakingsForDate(date),
        getQueueState(),
      ]);
      setBundle(b.bundle);

      const serverRow = t.rows.find((r) => r.driver_id === driverId) ?? null;
      const queuedItem = q.pending.find((i) => i.key === `${driverId}|${date}`) ?? null;

      if (queuedItem) {
        const p = queuedItem.payload;
        setWasQueued(true);
        setVehicleId(p.vehicle_id);
        setDeclared(String(p.amount_declared));
        setReceived(String(p.amount_received));
        setOdometer(String(p.odometer_reading));
        setNotes(p.notes ?? '');
      } else if (serverRow) {
        setExisting(serverRow);
        setVehicleId(serverRow.vehicle_id);
        setDeclared(String(serverRow.amount_declared));
        setReceived(String(serverRow.amount_received));
        setOdometer(String(serverRow.odometer_reading));
        setNotes(serverRow.notes ?? '');
      } else if (b.bundle) {
        setVehicleId(b.bundle.assignments[driverId] ?? null);
      }
      setLoading(false);
    })();
  }, [driverId, date]);

  const driver = bundle?.drivers.find((d) => d.id === driverId);
  const vehicles = bundle?.vehicles ?? [];
  const vehicle = vehicles.find((v) => v.id === vehicleId) ?? null;
  const assignedId = bundle?.assignments[driverId] ?? null;
  const isRelief = !!assignedId && !!vehicleId && vehicleId !== assignedId;

  const targetSuppressed = !!vehicleId && !!bundle?.downtimeVehicleIds.includes(vehicleId);
  const targetAmount = targetSuppressed ? null : (vehicle?.daily_target ?? null);

  const declaredNum = Number(declared || 'NaN');
  const receivedNum = Number(received || 'NaN');
  const variance =
    Number.isFinite(declaredNum) && Number.isFinite(receivedNum) ? declaredNum - receivedNum : 0;

  const outcome = useMemo(() => {
    if (!Number.isFinite(receivedNum) || targetAmount === null) return null;
    const diff = receivedNum - targetAmount;
    return diff >= 0
      ? { label: `Target met · +${formatPGK(diff, { decimals: 0 })}`, tone: 'success' as const }
      : { label: `Short ${formatPGK(-diff, { decimals: 0 })}`, tone: 'danger' as const };
  }, [receivedNum, targetAmount]);

  const locked = existing ? isTakingsLocked(existing) : false;
  const readOnly = locked;

  const unlock = async () => {
    if (!existing) return;
    setUnlocking(true);
    const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from('daily_takings')
      .update({ unlocked_until: until, unlocked_by: session?.user.id ?? null })
      .eq('id', existing.id);
    setUnlocking(false);
    if (error) {
      Alert.alert('Could not unlock', `${error.message}\n\nUnlocking requires a connection.`);
      return;
    }
    setExisting({ ...existing, unlocked_until: until });
  };

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!vehicleId) errs.vehicle = 'Pick the taxi driven';
    if (!Number.isFinite(declaredNum) || declaredNum < 0) errs.declared = 'Enter the declared amount';
    if (!Number.isFinite(receivedNum) || receivedNum < 0) errs.received = 'Enter the cash received';
    const odoNum = Number(odometer || 'NaN');
    if (!Number.isInteger(odoNum) || odoNum <= 0) errs.odometer = 'Odometer reading is required';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true);
    const result = await saveTakings({
      date,
      driver_id: driverId,
      vehicle_id: vehicleId!,
      is_relief_driver: isRelief,
      amount_declared: declaredNum,
      amount_received: receivedNum,
      target_amount: existing ? existing.target_amount : targetAmount,
      odometer_reading: odoNum,
      checkin_time: existing?.checkin_time ?? new Date().toISOString(),
      checkin_status: existing?.checkin_status ?? computeCheckinStatus(date),
      notes: notes.trim() || null,
      entered_by: session?.user.id ?? null,
    });
    setBusy(false);

    if (result.status === 'error') {
      Alert.alert('Could not save', result.message);
      return;
    }
    router.back();
  };

  if (loading) {
    return (
      <Screen bottomInset={spacing.xl}>
        <ScreenHeader title="Takings entry" />
        <SkeletonCard />
        <SkeletonCard />
      </Screen>
    );
  }

  if (!driver || !bundle) {
    return (
      <Screen bottomInset={spacing.xl}>
        <ScreenHeader title="Takings entry" />
        <Card>
          <Text style={type.body}>Driver not found. Go back and try again.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader title={driver.full_name} subtitle={formatDateLong(date)} />

      {(existing || wasQueued) && (
        <View style={styles.noticeRow}>
          {wasQueued ? (
            <Badge label="Saved on this phone — waiting to sync" tone="warning" />
          ) : (
            <Badge label="Editing existing entry" tone="info" />
          )}
        </View>
      )}

      {readOnly && (
        <Card style={styles.lockCard}>
          <View style={styles.lockRow}>
            <Lock color={colors.textSecondary} size={18} />
            <Text style={[type.bodyMedium, styles.lockText]}>
              Locked — entries can't be changed after 24 hours.
            </Text>
          </View>
          {role === 'owner' && (
            <Button
              title="Unlock for 1 hour (audited)"
              variant="outline"
              size="md"
              fullWidth
              loading={unlocking}
              onPress={unlock}
            />
          )}
        </Card>
      )}

      <Card style={styles.form}>
        {/* Vehicle picker */}
        <View>
          <Text style={styles.label}>Taxi driven {isRelief ? '· relief' : ''}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chips}>
              {vehicles.map((v) => {
                const active = v.id === vehicleId;
                const isAssigned = v.id === assignedId;
                return (
                  <Pressable
                    key={v.id}
                    disabled={readOnly}
                    onPress={() => setVehicleId(v.id)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {v.plate_no}
                      {isAssigned ? ' ★' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          {errors.vehicle ? <Text style={styles.error}>{errors.vehicle}</Text> : null}
          {isRelief && (
            <Text style={styles.reliefNote}>
              Relief day — takings still credit {driver.full_name}.
            </Text>
          )}
        </View>

        {/* Target line */}
        <View style={styles.targetRow}>
          <Text style={type.label}>Tonight's target</Text>
          {targetAmount === null ? (
            <Badge label={targetSuppressed ? 'Suppressed (vehicle off road)' : '—'} tone="neutral" />
          ) : (
            <Text style={styles.targetValue}>{formatPGK(targetAmount, { decimals: 0 })}</Text>
          )}
        </View>

        <Input
          label="Amount declared"
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={declared}
          onChangeText={setDeclared}
          editable={!readOnly}
          prefix={<Text style={styles.prefix}>K</Text>}
          error={errors.declared}
        />
        <Input
          label="Cash received"
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={received}
          onChangeText={setReceived}
          editable={!readOnly}
          prefix={<Text style={styles.prefix}>K</Text>}
          error={errors.received}
          suffix={
            !readOnly && declared && received !== declared ? (
              <Pressable onPress={() => setReceived(declared)} hitSlop={8}>
                <Text style={styles.sameLink}>= declared</Text>
              </Pressable>
            ) : undefined
          }
        />

        {variance !== 0 && Number.isFinite(variance) && (
          <View style={styles.varianceBox}>
            <Text style={styles.varianceText}>
              Variance {formatPGK(variance)} — declared vs cash received. Add a note below.
            </Text>
          </View>
        )}

        {outcome && !readOnly && (
          <View style={styles.outcomeRow}>
            <Badge label={outcome.label} tone={outcome.tone} dot />
          </View>
        )}

        <Input
          label="Odometer (km)"
          placeholder={vehicle ? `Last known ${vehicle.odometer_current.toLocaleString('en-US')}` : 'Reading'}
          keyboardType="number-pad"
          value={odometer}
          onChangeText={setOdometer}
          editable={!readOnly}
          suffix={<Gauge color={colors.textMuted} size={20} />}
          error={errors.odometer}
          hint={
            vehicle && Number(odometer) > 0 && Number(odometer) < vehicle.odometer_current
              ? `Below last known reading (${vehicle.odometer_current.toLocaleString('en-US')} km) — double-check`
              : undefined
          }
        />
        <Input
          label="Notes (optional)"
          placeholder="e.g. fuel receipt, variance reason"
          value={notes}
          onChangeText={setNotes}
          editable={!readOnly}
        />

        {!readOnly && (
          <Button
            title={existing || wasQueued ? 'Save changes' : 'Save check-in'}
            fullWidth
            loading={busy}
            icon={<CheckCircle2 color={colors.onAccent} size={18} />}
            onPress={save}
          />
        )}
      </Card>

      {!readOnly && (
        <View style={styles.syncHintRow}>
          <RefreshCw size={13} color={colors.textMuted} />
          <Text style={type.caption}>
            Works offline — entries sync automatically when connection returns.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  noticeRow: {
    flexDirection: 'row',
  },
  lockCard: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lockText: {
    flex: 1,
  },
  form: {
    gap: spacing.md,
  },
  label: {
    ...type.label,
    marginBottom: spacing.xxs,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipText: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.onPrimary,
  },
  error: {
    ...type.caption,
    color: colors.danger,
    marginTop: spacing.xxs,
  },
  reliefNote: {
    ...type.caption,
    color: colors.info,
    marginTop: spacing.xxs,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  targetValue: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.text,
  },
  prefix: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.textSecondary,
  },
  sameLink: {
    fontFamily: font.semibold,
    fontSize: 13,
    color: colors.info,
  },
  varianceBox: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  varianceText: {
    ...type.caption,
    color: colors.warning,
  },
  outcomeRow: {
    flexDirection: 'row',
  },
  syncHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    justifyContent: 'center',
  },
});
