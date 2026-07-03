import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  CarFront,
  CheckCircle2,
  FileCheck2,
  Gauge,
  Pencil,
  Wrench,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  Screen,
  ScreenHeader,
  Segmented,
  SkeletonCard,
  StatTile,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { DOC_TYPE_LABELS, daysUntil, expiryLabel, toneForDays } from '@/lib/alerts';
import { formatDate, formatPGK, todayISO } from '@/lib/format';
import { VEHICLE_CLASS, VEHICLE_STATUS } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { colors, identityColor, radius, shadow, spacing, type } from '@/lib/theme';
import { Input, Sheet } from '@/components/ui';
import type {
  ComplianceDoc,
  DowntimeLog,
  DowntimeReason,
  ServiceRecord,
  Vehicle,
} from '@/types/db';

type Detail = {
  vehicle: Vehicle;
  docs: ComplianceDoc[];
  downtime: DowntimeLog[];
  lastService: ServiceRecord | null;
};

export default function VehicleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { role } = useAuth();
  const isOwner = role === 'owner';

  const [sheetOpen, setSheetOpen] = useState(false);
  const [reason, setReason] = useState<DowntimeReason>('service');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const q = useSupabaseQuery<Detail>(async () => {
    const [v, docs, down, svc] = await Promise.all([
      supabase.from('vehicles').select('*').eq('id', id).single(),
      supabase
        .from('compliance_docs')
        .select('*')
        .eq('vehicle_id', id)
        .order('expiry_date'),
      supabase
        .from('downtime_log')
        .select('*')
        .eq('vehicle_id', id)
        .order('start_date', { ascending: false })
        .limit(5),
      supabase
        .from('service_records')
        .select('*')
        .eq('vehicle_id', id)
        .order('service_date', { ascending: false })
        .limit(1),
    ]);
    const error = v.error ?? docs.error ?? down.error ?? svc.error;
    return {
      data: error
        ? null
        : {
            vehicle: v.data as Vehicle,
            docs: (docs.data ?? []) as ComplianceDoc[],
            downtime: (down.data ?? []) as DowntimeLog[],
            lastService: ((svc.data ?? [])[0] as ServiceRecord | undefined) ?? null,
          },
      error,
    };
  }, [id]);

  const vehicle = q.data?.vehicle;
  const openDowntime = q.data?.downtime.find((d) => !d.end_date);
  const photoUrl = useSignedUrl('fleet-photos', vehicle?.photo_url);

  const markOffRoad = async () => {
    if (!vehicle) return;
    setBusy(true);
    const { error: e1 } = await supabase
      .from('downtime_log')
      .insert({ vehicle_id: vehicle.id, start_date: todayISO(), reason, notes: notes || null });
    const { error: e2 } = e1
      ? { error: e1 }
      : await supabase.from('vehicles').update({ status: 'off_road' }).eq('id', vehicle.id);
    setBusy(false);
    if (e1 || e2) {
      Alert.alert('Could not update', (e1 ?? e2)!.message);
      return;
    }
    setSheetOpen(false);
    setNotes('');
    q.refetch();
  };

  const backOnRoad = async () => {
    if (!vehicle) return;
    setBusy(true);
    const { error: e1 } = await supabase
      .from('downtime_log')
      .update({ end_date: todayISO() })
      .eq('vehicle_id', vehicle.id)
      .is('end_date', null);
    const { error: e2 } = e1
      ? { error: e1 }
      : await supabase.from('vehicles').update({ status: 'active' }).eq('id', vehicle.id);
    setBusy(false);
    if (e1 || e2) {
      Alert.alert('Could not update', (e1 ?? e2)!.message);
      return;
    }
    q.refetch();
  };

  if (q.loading || !vehicle) {
    return (
      <Screen bottomInset={spacing.xl}>
        <ScreenHeader title="Vehicle" />
        <SkeletonCard />
        <SkeletonCard />
      </Screen>
    );
  }

  const status = VEHICLE_STATUS[vehicle.status];

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader
        title={vehicle.plate_no}
        subtitle={[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ')}
        accessory={
          isOwner ? (
            <Pressable
              onPress={() => router.push({ pathname: '/vehicle/form', params: { id: vehicle.id } })}
              style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}
              accessibilityLabel="Edit vehicle"
            >
              <Pencil color={colors.primary} size={18} />
            </Pressable>
          ) : undefined
        }
      />

      {photoUrl && (
        <View style={styles.photoShadow}>
          <Image source={{ uri: photoUrl }} style={styles.photoBanner} />
        </View>
      )}

      <Card tint={identityColor(vehicle.id).soft}>
        <View style={styles.badgeRow}>
          <Badge label={status.label} tone={status.tone} dot />
          <Badge label={`${VEHICLE_CLASS[vehicle.vehicle_class]} class`} tone="info" />
          {openDowntime ? (
            <Badge label={`Off road since ${formatDate(openDowntime.start_date)}`} tone="warning" />
          ) : null}
        </View>
        <View style={styles.tileRow}>
          <StatTile
            label="Daily target"
            value={formatPGK(vehicle.daily_target, { decimals: 0 })}
            sub={openDowntime ? 'Suppressed (off road)' : 'Applies 7 days/week'}
            subColor={openDowntime ? colors.warning : undefined}
            icon={<CarFront color={colors.primary} size={18} />}
          />
          <StatTile
            label="Odometer"
            value={`${vehicle.odometer_current.toLocaleString('en-US')} km`}
            icon={<Gauge color={colors.primary} size={18} />}
          />
        </View>
        {vehicle.engine_no ? (
          <Text style={styles.engineNo}>Engine no. {vehicle.engine_no}</Text>
        ) : null}
        {isOwner &&
          (vehicle.status === 'active' ? (
            <Button
              title="Mark off-road"
              variant="outline"
              fullWidth
              icon={<AlertTriangle color={colors.warning} size={18} />}
              onPress={() => setSheetOpen(true)}
            />
          ) : vehicle.status !== 'retired' ? (
            <Button
              title="Back on road"
              fullWidth
              loading={busy}
              icon={<CheckCircle2 color={colors.onAccent} size={18} />}
              onPress={backOnRoad}
            />
          ) : null)}
      </Card>

      <Text style={type.sectionTitle}>Compliance</Text>
      {q.data!.docs.length === 0 ? (
        <Card>
          <Text style={type.body}>No documents recorded yet — added in Phase 10.</Text>
        </Card>
      ) : (
        <Card padded={false}>
          {q.data!.docs.map((doc, idx) => (
            <View
              key={doc.id}
              style={[styles.docRow, idx < q.data!.docs.length - 1 && styles.divider]}
            >
              <View style={styles.docIcon}>
                <FileCheck2 color={colors.primary} size={18} />
              </View>
              <View style={styles.docInfo}>
                <Text style={type.bodyMedium}>{DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}</Text>
                <Text style={type.caption}>
                  {doc.reference_no ? `${doc.reference_no} · ` : ''}
                  expires {formatDate(doc.expiry_date)}
                </Text>
              </View>
              <Badge label={expiryLabel(doc.expiry_date)} tone={toneForDays(daysUntil(doc.expiry_date))} />
            </View>
          ))}
        </Card>
      )}

      <Text style={type.sectionTitle}>Service</Text>
      <Card>
        {q.data!.lastService ? (
          <View style={styles.serviceRow}>
            <View style={styles.docIcon}>
              <Wrench color={colors.primary} size={18} />
            </View>
            <View style={styles.docInfo}>
              <Text style={type.bodyMedium}>
                Last serviced {formatDate(q.data!.lastService.service_date)} ·{' '}
                {formatPGK(q.data!.lastService.cost)}
              </Text>
              <Text style={type.caption}>
                Next due{' '}
                {q.data!.lastService.next_due_date
                  ? formatDate(q.data!.lastService.next_due_date)
                  : '—'}{' '}
                or {q.data!.lastService.next_due_odometer?.toLocaleString('en-US')} km
              </Text>
            </View>
            {q.data!.lastService.next_due_date ? (
              <Badge
                label={expiryLabel(q.data!.lastService.next_due_date)}
                tone={toneForDays(daysUntil(q.data!.lastService.next_due_date))}
              />
            ) : null}
          </View>
        ) : (
          <Text style={type.body}>No service records yet — full module in Phase 9.</Text>
        )}
      </Card>

      {q.data!.downtime.length > 0 && (
        <>
          <Text style={type.sectionTitle}>Downtime history</Text>
          <Card padded={false}>
            {q.data!.downtime.map((d, idx) => (
              <View
                key={d.id}
                style={[styles.docRow, idx < q.data!.downtime.length - 1 && styles.divider]}
              >
                <View style={styles.docInfo}>
                  <Text style={type.bodyMedium}>
                    {d.reason === 'service' ? 'Servicing' : d.reason === 'accident' ? 'Accident' : 'Other'}
                    {d.notes ? ` — ${d.notes}` : ''}
                  </Text>
                  <Text style={type.caption}>
                    {formatDate(d.start_date)} → {d.end_date ? formatDate(d.end_date) : 'ongoing'}
                  </Text>
                </View>
                {!d.end_date && <Badge label="Open" tone="warning" dot />}
              </View>
            ))}
          </Card>
        </>
      )}

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Mark off-road">
        <Text style={type.body}>
          Daily targets are suppressed while the vehicle is off the road.
        </Text>
        <Segmented<DowntimeReason>
          options={[
            { value: 'service', label: 'Service' },
            { value: 'accident', label: 'Accident' },
            { value: 'other', label: 'Other' },
          ]}
          value={reason}
          onChange={setReason}
        />
        <Input
          label="Notes (optional)"
          placeholder="e.g. waiting on parts"
          value={notes}
          onChangeText={setNotes}
        />
        <Button title="Confirm off-road" fullWidth loading={busy} onPress={markOffRoad} />
      </Sheet>
    </Screen>
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
    ...shadow.card,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  photoShadow: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    ...shadow.card,
  },
  photoBanner: {
    width: '100%',
    height: 170,
    borderRadius: radius.lg,
  },
  engineNo: {
    ...type.caption,
    marginBottom: spacing.md,
  },
  tileRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  docIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: {
    flex: 1,
    gap: 1,
  },
});
