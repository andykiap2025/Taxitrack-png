import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeftRight,
  CalendarDays,
  CarFront,
  IdCard,
  Pencil,
  Phone,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  Screen,
  ScreenHeader,
  SkeletonCard,
  Sheet,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { daysUntil, expiryLabel, toneForDays } from '@/lib/alerts';
import { formatDate, todayISO } from '@/lib/format';
import { DRIVER_STATUS, initialsOf } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing, type } from '@/lib/theme';
import type { Driver, Vehicle } from '@/types/db';

type AssignmentRow = {
  id: string;
  start_date: string;
  end_date: string | null;
  vehicle: { id: string; plate_no: string; make: string; model: string } | null;
};

type VehicleOption = Vehicle & {
  assignments: { id: string; end_date: string | null; driver: { id: string; full_name: string } | null }[];
};

type Detail = {
  driver: Driver;
  assignments: AssignmentRow[];
};

export default function DriverDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { role } = useAuth();
  const isOwner = role === 'owner';

  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const q = useSupabaseQuery<Detail>(async () => {
    const [d, a] = await Promise.all([
      supabase.from('drivers').select('*').eq('id', id).single(),
      supabase
        .from('assignments')
        .select('id, start_date, end_date, vehicle:vehicles(id, plate_no, make, model)')
        .eq('driver_id', id)
        .order('start_date', { ascending: false }),
    ]);
    const error = d.error ?? a.error;
    return {
      data: error
        ? null
        : { driver: d.data as Driver, assignments: (a.data ?? []) as unknown as AssignmentRow[] },
      error,
    };
  }, [id]);

  // Vehicle picker options (loaded when the sheet opens).
  const options = useSupabaseQuery<VehicleOption[]>(
    () =>
      supabase
        .from('vehicles')
        .select('*, assignments(id, end_date, driver:drivers(id, full_name))')
        .is('assignments.end_date', null)
        .neq('status', 'retired')
        .order('plate_no'),
  );

  const driver = q.data?.driver;
  const current = q.data?.assignments.find((a) => !a.end_date) ?? null;

  const assign = async (vehicleId: string | null) => {
    if (!driver) return;
    setBusy(true);
    const today = todayISO();

    // Close this driver's open assignment.
    let error = (
      await supabase
        .from('assignments')
        .update({ end_date: today })
        .eq('driver_id', driver.id)
        .is('end_date', null)
    ).error;

    if (!error && vehicleId) {
      // Free the vehicle from any other holder, then open the new assignment.
      error = (
        await supabase
          .from('assignments')
          .update({ end_date: today })
          .eq('vehicle_id', vehicleId)
          .is('end_date', null)
      ).error;
      if (!error) {
        error = (
          await supabase
            .from('assignments')
            .insert({ driver_id: driver.id, vehicle_id: vehicleId, start_date: today })
        ).error;
      }
    }

    setBusy(false);
    if (error) {
      Alert.alert('Could not update assignment', error.message);
      return;
    }
    setSheetOpen(false);
    q.refetch();
  };

  if (q.loading || !driver) {
    return (
      <Screen bottomInset={spacing.xl}>
        <ScreenHeader title="Driver" />
        <SkeletonCard />
        <SkeletonCard />
      </Screen>
    );
  }

  const status = DRIVER_STATUS[driver.status];

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader
        title={driver.full_name}
        subtitle={driver.phone ?? undefined}
        accessory={
          isOwner ? (
            <Pressable
              onPress={() => router.push({ pathname: '/driver/form', params: { id: driver.id } })}
              style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}
              accessibilityLabel="Edit driver"
            >
              <Pencil color={colors.primary} size={18} />
            </Pressable>
          ) : undefined
        }
      />

      <Card>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsOf(driver.full_name)}</Text>
          </View>
          <View style={styles.badges}>
            <Badge label={status.label} tone={status.tone} dot />
            {driver.license_expiry ? (
              <Badge
                label={`License · ${expiryLabel(driver.license_expiry)}`}
                tone={toneForDays(daysUntil(driver.license_expiry))}
              />
            ) : (
              <Badge label="No license on file" tone="warning" />
            )}
          </View>
        </View>

        <View style={styles.infoRows}>
          <InfoRow
            icon={<IdCard color={colors.textSecondary} size={17} />}
            label="License"
            value={driver.license_no ?? '—'}
          />
          <InfoRow
            icon={<Phone color={colors.textSecondary} size={17} />}
            label="Phone"
            value={driver.phone ?? '—'}
          />
          <InfoRow
            icon={<CalendarDays color={colors.textSecondary} size={17} />}
            label="Started"
            value={driver.date_started ? formatDate(driver.date_started) : '—'}
          />
        </View>
      </Card>

      <Text style={type.sectionTitle}>Vehicle</Text>
      <Card>
        <View style={styles.vehicleRow}>
          <View style={styles.vehicleIcon}>
            <CarFront color={colors.primary} size={22} />
          </View>
          <View style={styles.vehicleInfo}>
            {current?.vehicle ? (
              <>
                <Text style={type.cardTitle}>{current.vehicle.plate_no}</Text>
                <Text style={type.caption}>
                  {current.vehicle.make} {current.vehicle.model} · since{' '}
                  {formatDate(current.start_date)}
                </Text>
              </>
            ) : (
              <>
                <Text style={type.cardTitle}>No vehicle assigned</Text>
                <Text style={type.caption}>Assign a taxi so takings default to it</Text>
              </>
            )}
          </View>
        </View>
        {isOwner && (
          <Button
            title={current ? 'Change assignment' : 'Assign vehicle'}
            variant="outline"
            size="md"
            fullWidth
            icon={<ArrowLeftRight color={colors.primary} size={17} />}
            onPress={() => setSheetOpen(true)}
          />
        )}
      </Card>

      {q.data!.assignments.length > 0 && (
        <>
          <Text style={type.sectionTitle}>Assignment history</Text>
          <Card padded={false}>
            {q.data!.assignments.map((a, idx) => (
              <View
                key={a.id}
                style={[styles.historyRow, idx < q.data!.assignments.length - 1 && styles.divider]}
              >
                <View style={styles.historyInfo}>
                  <Text style={type.bodyMedium}>{a.vehicle?.plate_no ?? 'Unknown vehicle'}</Text>
                  <Text style={type.caption}>
                    {formatDate(a.start_date)} → {a.end_date ? formatDate(a.end_date) : 'current'}
                  </Text>
                </View>
                {!a.end_date && <Badge label="Current" tone="success" dot />}
              </View>
            ))}
          </Card>
        </>
      )}

      <Text style={type.sectionTitle}>Coming next</Text>
      <Card>
        <Text style={type.body}>
          Takings history (Phase 6), balance ledger (Phase 7) and pay history (Phase 8) will
          appear here.
        </Text>
      </Card>

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Assign vehicle">
        <View style={styles.optionList}>
          {(options.data ?? []).map((v) => {
            const holder = v.assignments.find((a) => !a.end_date)?.driver;
            const isCurrent = current?.vehicle?.id === v.id;
            return (
              <Pressable
                key={v.id}
                disabled={busy}
                onPress={() => assign(v.id)}
                style={({ pressed }) => [
                  styles.option,
                  isCurrent && styles.optionCurrent,
                  pressed && { backgroundColor: colors.surfaceMuted },
                ]}
              >
                <View style={styles.optionInfo}>
                  <Text style={type.bodyMedium}>{v.plate_no}</Text>
                  <Text style={type.caption}>
                    {v.make} {v.model}
                    {holder && holder.id !== driver.id ? ` · currently ${holder.full_name}` : ''}
                  </Text>
                </View>
                {isCurrent && <Badge label="Current" tone="success" />}
              </Pressable>
            );
          })}
          {current && (
            <Button
              title="Unassign (no vehicle)"
              variant="ghost"
              size="md"
              fullWidth
              loading={busy}
              onPress={() => assign(null)}
            />
          )}
        </View>
      </Sheet>
    </Screen>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      {icon}
      <Text style={[type.label, styles.infoLabel]}>{label}</Text>
      <Text style={type.bodyMedium}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  editBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: font.bold,
    fontSize: 18,
    color: colors.info,
  },
  badges: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  infoRows: {
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoLabel: {
    width: 64,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  vehicleIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleInfo: {
    flex: 1,
    gap: 2,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  historyInfo: {
    flex: 1,
    gap: 1,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionList: {
    gap: spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionCurrent: {
    borderColor: colors.success,
  },
  optionInfo: {
    flex: 1,
    gap: 1,
  },
});
