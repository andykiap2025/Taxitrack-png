import { useRouter } from 'expo-router';
import { Plus, Wrench } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Card, EmptyState, Screen, ScreenHeader, SkeletonCard } from '@/components/ui';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { formatDate, formatPGK } from '@/lib/format';
import { serviceState } from '@/lib/service';
import { supabase } from '@/lib/supabase';
import { colors, radius, shadow, spacing, type } from '@/lib/theme';
import type { ServiceRecord, Vehicle } from '@/types/db';

type Data = {
  vehicles: Vehicle[];
  /** Latest service per vehicle id. */
  latest: Record<string, ServiceRecord>;
  history: (ServiceRecord & { vehicle: { plate_no: string } | null })[];
};

export default function ServiceScreen() {
  const router = useRouter();

  const q = useSupabaseQuery<Data>(async () => {
    const [v, s] = await Promise.all([
      supabase.from('vehicles').select('*').neq('status', 'retired').order('plate_no'),
      supabase
        .from('service_records')
        .select('*, vehicle:vehicles(plate_no)')
        .order('service_date', { ascending: false })
        .limit(60),
    ]);
    const error = v.error ?? s.error;
    if (error) return { data: null, error };
    const history = (s.data ?? []) as Data['history'];
    const latest: Record<string, ServiceRecord> = {};
    for (const rec of history) {
      if (!latest[rec.vehicle_id]) latest[rec.vehicle_id] = rec;
    }
    return { data: { vehicles: (v.data ?? []) as Vehicle[], latest, history }, error: null };
  });

  const vehicles = q.data?.vehicles ?? [];

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader
        title="Servicing"
        subtitle="Every 3 months or 5,000 km — whichever first"
        accessory={
          <Pressable
            onPress={() => router.push('/service/form')}
            style={({ pressed }) => [styles.addBtn, shadow.accentGlow, pressed && { transform: [{ scale: 0.94 }] }]}
            accessibilityLabel="Log service"
          >
            <Plus color={colors.onAccent} size={22} />
          </Pressable>
        }
      />

      {q.loading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : vehicles.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<Wrench color={colors.textMuted} size={30} />}
            title="No vehicles"
            message="Add vehicles in the Fleet tab to track their servicing."
          />
        </Card>
      ) : (
        <>
          <Text style={type.sectionTitle}>Fleet status</Text>
          <Card padded={false}>
            {vehicles.map((v, idx) => {
              const last = q.data!.latest[v.id] ?? null;
              const state = serviceState(v, last);
              return (
                <Pressable
                  key={v.id}
                  onPress={() => router.push({ pathname: '/service/form', params: { vehicleId: v.id } })}
                  style={({ pressed }) => [
                    styles.row,
                    idx < vehicles.length - 1 && styles.divider,
                    pressed && { backgroundColor: colors.surfaceMuted },
                  ]}
                >
                  <View style={styles.icon}>
                    <Wrench
                      color={
                        state.tone === 'danger'
                          ? colors.danger
                          : state.tone === 'warning'
                            ? colors.warning
                            : colors.primary
                      }
                      size={18}
                    />
                  </View>
                  <View style={styles.info}>
                    <Text style={type.bodyMedium}>{v.plate_no}</Text>
                    <Text style={type.caption}>
                      {last
                        ? `Last ${formatDate(last.service_date)} at ${last.odometer_at_service.toLocaleString('en-US')} km`
                        : 'Tap to log the first service'}
                    </Text>
                  </View>
                  <Badge label={state.label} tone={state.tone} />
                </Pressable>
              );
            })}
          </Card>

          {q.data!.history.length > 0 && (
            <>
              <Text style={type.sectionTitle}>Service history</Text>
              <Card padded={false}>
                {q.data!.history.slice(0, 12).map((rec, idx, arr) => (
                  <View key={rec.id} style={[styles.row, idx < arr.length - 1 && styles.divider]}>
                    <View style={styles.info}>
                      <Text style={type.bodyMedium}>
                        {rec.vehicle?.plate_no ?? '—'} · {formatPGK(Number(rec.cost))}
                      </Text>
                      <Text style={type.caption}>
                        {formatDate(rec.service_date)} ·{' '}
                        {rec.odometer_at_service.toLocaleString('en-US')} km
                        {rec.workshop ? ` · ${rec.workshop}` : ''}
                        {rec.notes ? ` — ${rec.notes}` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 1,
  },
});
