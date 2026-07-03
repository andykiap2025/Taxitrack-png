import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  CalendarDays,
  CarFront,
  Home,
  IdCard,
  ImageIcon,
  MapPin,
  MinusCircle,
  Pencil,
  Phone,
  Plus,
  Scale,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  Input,
  Screen,
  ScreenHeader,
  Sheet,
  SkeletonCard,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { signedUrl } from '@/lib/storage';
import { daysUntil, expiryLabel, toneForDays } from '@/lib/alerts';
import { formatDate, formatDateShort, formatPGK, todayISO } from '@/lib/format';
import { DRIVER_STATUS, initialsOf } from '@/lib/labels';
import {
  balanceLabel,
  DEDUCTION_TYPE_LABELS,
  LEDGER_STATUS_LABELS,
  openBalance,
} from '@/lib/ledger';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing, type } from '@/lib/theme';
import type {
  BalanceLedgerEntry,
  DailyTakings,
  Deduction,
  DeductionType,
  Driver,
  Vehicle,
} from '@/types/db';

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
  ledgerRecent: (BalanceLedgerEntry & { vehicle: { plate_no: string } | null })[];
  ledgerOpen: Pick<BalanceLedgerEntry, 'entry_type' | 'amount' | 'status'>[];
  takings: DailyTakings[];
  deductions: Deduction[];
};

const DEDUCTION_TYPES: DeductionType[] = ['fuel', 'advance', 'fine', 'repair', 'other'];

export default function DriverDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { role } = useAuth();
  const isOwner = role === 'owner';

  const [assignOpen, setAssignOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Deduction sheet state
  const [dedOpen, setDedOpen] = useState(false);
  const [dedType, setDedType] = useState<DeductionType>('fuel');
  const [dedAmount, setDedAmount] = useState('');
  const [dedNote, setDedNote] = useState('');
  const [dedError, setDedError] = useState<string | null>(null);
  const [dedBusy, setDedBusy] = useState(false);

  const q = useSupabaseQuery<Detail>(async () => {
    const [d, a, lr, lo, t, ded] = await Promise.all([
      supabase.from('drivers').select('*').eq('id', id).single(),
      supabase
        .from('assignments')
        .select('id, start_date, end_date, vehicle:vehicles(id, plate_no, make, model)')
        .eq('driver_id', id)
        .order('start_date', { ascending: false })
        .limit(6),
      supabase
        .from('balance_ledger')
        .select('*, vehicle:vehicles(plate_no)')
        .eq('driver_id', id)
        .order('date', { ascending: false })
        .limit(15),
      supabase
        .from('balance_ledger')
        .select('entry_type, amount, status')
        .eq('driver_id', id)
        .in('status', ['outstanding', 'carried']),
      supabase
        .from('daily_takings')
        .select('*')
        .eq('driver_id', id)
        .order('date', { ascending: false })
        .limit(10),
      supabase
        .from('deductions')
        .select('*')
        .eq('driver_id', id)
        .order('date', { ascending: false })
        .limit(10),
    ]);
    const error = d.error ?? a.error ?? lr.error ?? lo.error ?? t.error ?? ded.error;
    return {
      data: error
        ? null
        : {
            driver: d.data as Driver,
            assignments: (a.data ?? []) as unknown as AssignmentRow[],
            ledgerRecent: (lr.data ?? []) as unknown as Detail['ledgerRecent'],
            ledgerOpen: (lo.data ?? []) as Detail['ledgerOpen'],
            takings: (t.data ?? []) as DailyTakings[],
            deductions: (ded.data ?? []) as Deduction[],
          },
      error,
    };
  }, [id]);

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
  const faceUrl = useSignedUrl('fleet-photos', driver?.photo_url);

  const viewLicensePhoto = async () => {
    if (!driver?.license_photo_url) return;
    const url = await signedUrl('fleet-photos', driver.license_photo_url);
    if (url) await WebBrowser.openBrowserAsync(url);
  };

  const assign = async (vehicleId: string | null) => {
    if (!driver) return;
    setBusy(true);
    const today = todayISO();
    let error = (
      await supabase
        .from('assignments')
        .update({ end_date: today })
        .eq('driver_id', driver.id)
        .is('end_date', null)
    ).error;
    if (!error && vehicleId) {
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
    setAssignOpen(false);
    q.refetch();
  };

  const addDeduction = async () => {
    const amount = Number(dedAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setDedError('Enter a valid amount');
      return;
    }
    setDedError(null);
    setDedBusy(true);
    const { error } = await supabase.from('deductions').insert({
      driver_id: id,
      type: dedType,
      amount,
      date: todayISO(),
      description: dedNote.trim() || null,
    });
    setDedBusy(false);
    if (error) {
      Alert.alert('Could not save deduction', error.message);
      return;
    }
    setDedOpen(false);
    setDedAmount('');
    setDedNote('');
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
  const { credits, debits, balance } = openBalance(q.data!.ledgerOpen);
  const bal = balanceLabel(balance);

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

      {/* Profile */}
      <Card>
        <View style={styles.profileRow}>
          {faceUrl ? (
            <Image source={{ uri: faceUrl }} style={styles.avatarPhoto} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initialsOf(driver.full_name)}</Text>
            </View>
          )}
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
          <View style={styles.licenseRow}>
            <InfoRow icon={<IdCard color={colors.textSecondary} size={17} />} label="License" value={driver.license_no ?? '—'} />
            {driver.license_photo_url && (
              <Pressable onPress={viewLicensePhoto} style={styles.licensePhotoBtn} hitSlop={8}>
                <ImageIcon color={colors.info} size={16} />
                <Text style={styles.licensePhotoText}>View</Text>
              </Pressable>
            )}
          </View>
          <InfoRow icon={<Phone color={colors.textSecondary} size={17} />} label="Phone" value={driver.phone ?? '—'} />
          <InfoRow
            icon={<MapPin color={colors.textSecondary} size={17} />}
            label="Province"
            value={driver.province ?? '—'}
          />
          <InfoRow
            icon={<Home color={colors.textSecondary} size={17} />}
            label="Lives at"
            value={driver.residence ?? '—'}
          />
          <InfoRow
            icon={<CalendarDays color={colors.textSecondary} size={17} />}
            label="Started"
            value={driver.date_started ? formatDate(driver.date_started) : '—'}
          />
        </View>
      </Card>

      {/* Balance — the number the owner cares about */}
      <Card style={styles.balanceCard}>
        <View style={styles.balanceTop}>
          <View style={styles.balanceIcon}>
            <Scale color={balance < 0 ? colors.danger : colors.success} size={20} />
          </View>
          <View style={styles.balanceInfo}>
            <Text style={type.label}>Running balance</Text>
            <Text
              style={[
                styles.balanceValue,
                { color: balance < 0 ? colors.danger : balance > 0 ? colors.success : colors.text },
              ]}
            >
              {bal.label}
            </Text>
          </View>
        </View>
        <View style={styles.balanceSplit}>
          <Text style={type.caption}>
            Surplus credits {formatPGK(credits)} · Shortfall debits {formatPGK(debits)}
          </Text>
          <Text style={type.caption}>
            Netted at payroll — only a negative balance becomes a deduction.
          </Text>
        </View>
      </Card>

      {/* Vehicle */}
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
                  {current.vehicle.make} {current.vehicle.model} · since {formatDate(current.start_date)}
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
            onPress={() => setAssignOpen(true)}
          />
        )}
      </Card>

      {/* Takings history */}
      <Text style={type.sectionTitle}>Recent takings</Text>
      {q.data!.takings.length === 0 ? (
        <Card>
          <Text style={type.body}>No takings recorded yet.</Text>
        </Card>
      ) : (
        <Card padded={false}>
          {q.data!.takings.map((t, idx) => (
            <Pressable
              key={t.id}
              onPress={() =>
                router.push({ pathname: '/takings/entry', params: { driverId: driver.id, date: t.date } })
              }
              style={({ pressed }) => [
                styles.listRow,
                idx < q.data!.takings.length - 1 && styles.divider,
                pressed && { backgroundColor: colors.surfaceMuted },
              ]}
            >
              <Text style={[type.bodyMedium, styles.listDate]}>{formatDateShort(t.date)}</Text>
              <View style={styles.listMiddle}>
                <Text style={type.bodyMedium}>{formatPGK(t.amount_received)}</Text>
                {t.is_relief_driver && <Text style={type.caption}>relief day</Text>}
              </View>
              {t.target_amount === null ? (
                <Badge label="No target" tone="neutral" />
              ) : t.shortfall_amount > 0 ? (
                <Badge label={`Short ${formatPGK(t.shortfall_amount, { decimals: 0 })}`} tone="danger" />
              ) : (
                <Badge label={`+${formatPGK(t.surplus_amount, { decimals: 0 })}`} tone="success" />
              )}
            </Pressable>
          ))}
        </Card>
      )}

      {/* Ledger */}
      <Text style={type.sectionTitle}>Balance ledger</Text>
      {q.data!.ledgerRecent.length === 0 ? (
        <Card>
          <Text style={type.body}>No shortfalls or surpluses yet.</Text>
        </Card>
      ) : (
        <Card padded={false}>
          {q.data!.ledgerRecent.map((e, idx) => (
            <View key={e.id} style={[styles.listRow, idx < q.data!.ledgerRecent.length - 1 && styles.divider]}>
              {e.entry_type === 'surplus' ? (
                <ArrowUpCircle color={colors.success} size={20} />
              ) : (
                <ArrowDownCircle color={colors.danger} size={20} />
              )}
              <View style={styles.listMiddle}>
                <Text style={type.bodyMedium}>
                  {e.entry_type === 'surplus' ? 'Surplus credit' : 'Shortfall debit'} ·{' '}
                  {formatPGK(e.amount)}
                </Text>
                <Text style={type.caption}>
                  {formatDateShort(e.date)}
                  {e.vehicle ? ` · ${e.vehicle.plate_no}` : ''}
                </Text>
              </View>
              <Badge
                label={LEDGER_STATUS_LABELS[e.status]}
                tone={e.status === 'outstanding' ? (e.entry_type === 'surplus' ? 'success' : 'danger') : 'neutral'}
              />
            </View>
          ))}
        </Card>
      )}

      {/* Deductions */}
      <View style={styles.sectionRow}>
        <Text style={type.sectionTitle}>Deductions</Text>
        {isOwner && (
          <Pressable onPress={() => setDedOpen(true)} style={styles.smallAdd} accessibilityLabel="Add deduction">
            <Plus color={colors.primary} size={18} />
          </Pressable>
        )}
      </View>
      {q.data!.deductions.length === 0 ? (
        <Card>
          <Text style={type.body}>No deductions recorded.</Text>
        </Card>
      ) : (
        <Card padded={false}>
          {q.data!.deductions.map((d, idx) => (
            <View key={d.id} style={[styles.listRow, idx < q.data!.deductions.length - 1 && styles.divider]}>
              <MinusCircle color={colors.textSecondary} size={20} />
              <View style={styles.listMiddle}>
                <Text style={type.bodyMedium}>
                  {DEDUCTION_TYPE_LABELS[d.type]} · {formatPGK(d.amount)}
                </Text>
                <Text style={type.caption}>
                  {formatDateShort(d.date)}
                  {d.description ? ` · ${d.description}` : ''}
                </Text>
              </View>
              <Badge
                label={d.pay_period_id ? 'Applied' : 'Pending payroll'}
                tone={d.pay_period_id ? 'neutral' : 'warning'}
              />
            </View>
          ))}
        </Card>
      )}

      {/* Assign sheet */}
      <Sheet visible={assignOpen} onClose={() => setAssignOpen(false)} title="Assign vehicle">
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

      {/* Deduction sheet */}
      <Sheet visible={dedOpen} onClose={() => setDedOpen(false)} title="Add deduction">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chips}>
            {DEDUCTION_TYPES.map((t) => {
              const active = t === dedType;
              return (
                <Pressable
                  key={t}
                  onPress={() => setDedType(t)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {DEDUCTION_TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        <Input
          label="Amount"
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={dedAmount}
          onChangeText={setDedAmount}
          prefix={<Text style={styles.prefix}>K</Text>}
          error={dedError ?? undefined}
        />
        <Input
          label="Description (optional)"
          placeholder="e.g. fuel advance Waigani"
          value={dedNote}
          onChangeText={setDedNote}
        />
        <Button title="Save deduction" fullWidth loading={dedBusy} onPress={addDeduction} />
        <Text style={type.caption}>
          Deducted from this driver's next finalised pay period.
        </Text>
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
  avatarPhoto: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
  },
  licenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  licensePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.infoSoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
  },
  licensePhotoText: {
    fontFamily: font.semibold,
    fontSize: 12,
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
  balanceCard: {
    gap: spacing.sm,
  },
  balanceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  balanceIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceInfo: {
    flex: 1,
    gap: 2,
  },
  balanceValue: {
    fontFamily: font.extrabold,
    fontSize: 22,
  },
  balanceSplit: {
    gap: 2,
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
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  smallAdd: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  listDate: {
    width: 56,
  },
  listMiddle: {
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
  prefix: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.textSecondary,
  },
});
