import { useRouter } from 'expo-router';
import { CarFront, Plus, Search, Users } from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useMemo } from 'react';

import { DriverCard, type DriverWithAssignment } from '@/components/DriverCard';
import { VehicleCard, type AssignedDriver } from '@/components/VehicleCard';
import {
  Card,
  EmptyState,
  Input,
  Screen,
  Segmented,
  SkeletonCard,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, shadow, spacing, type } from '@/lib/theme';
import type { Vehicle } from '@/types/db';

type Section = 'vehicles' | 'drivers';
type StatusFilter = 'all' | 'active' | 'off';

export default function FleetScreen() {
  const router = useRouter();
  const { role } = useAuth();
  const [section, setSection] = useState<Section>('vehicles');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const vehicles = useSupabaseQuery<Vehicle[]>(
    () => supabase.from('vehicles').select('*').order('plate_no'),
  );

  const drivers = useSupabaseQuery<DriverWithAssignment[]>(
    () =>
      supabase
        .from('drivers')
        .select('*, assignments(id, end_date, vehicle:vehicles(id, plate_no))')
        .is('assignments.end_date', null)
        .order('full_name'),
  );

  const canEdit = role === 'owner';

  // vehicle id → current holder, from the drivers' open assignments.
  const driverByVehicle = useMemo(() => {
    const map = new Map<string, AssignedDriver>();
    for (const d of drivers.data ?? []) {
      for (const a of d.assignments) {
        if (!a.end_date && a.vehicle) map.set(a.vehicle.id, { id: d.id, name: d.full_name });
      }
    }
    return map;
  }, [drivers.data]);

  const q = query.trim().toLowerCase();
  const allVehicles = vehicles.data ?? [];
  const counts = {
    all: allVehicles.length,
    active: allVehicles.filter((v) => v.status === 'active').length,
    off: allVehicles.filter((v) => v.status === 'off_road' || v.status === 'in_service').length,
  };
  const visibleVehicles = allVehicles
    .filter((v) =>
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
          ? v.status === 'active'
          : v.status === 'off_road' || v.status === 'in_service',
    )
    .filter(
      (v) =>
        q.length === 0 ||
        v.plate_no.toLowerCase().includes(q) ||
        `${v.make} ${v.model}`.toLowerCase().includes(q),
    );
  const visibleDrivers = (drivers.data ?? []).filter(
    (d) => q.length === 0 || d.full_name.toLowerCase().includes(q),
  );

  const FilterChip = ({ value, label }: { value: StatusFilter; label: string }) => {
    const active = statusFilter === value;
    return (
      <Pressable
        onPress={() => setStatusFilter(value)}
        style={[styles.chip, active && styles.chipActive]}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      </Pressable>
    );
  };

  const addButton = canEdit ? (
    <Pressable
      onPress={() => router.push(section === 'vehicles' ? '/vehicle/form' : '/driver/form')}
      style={({ pressed }) => [styles.addBtn, shadow.card, pressed && styles.addPressed]}
      accessibilityRole="button"
      accessibilityLabel={section === 'vehicles' ? 'Add vehicle' : 'Add driver'}
    >
      <Plus color="#FFFFFF" size={22} />
    </Pressable>
  ) : undefined;

  return (
    <Screen title="Fleet" titleAccessory={addButton} style={styles.content}>
      <Segmented<Section>
        options={[
          { value: 'vehicles', label: 'Vehicles' },
          { value: 'drivers', label: 'Drivers' },
        ]}
        value={section}
        onChange={setSection}
      />

      <Input
        placeholder="Search plate or model"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        prefix={<Search color={colors.textMuted} size={19} />}
      />

      {section === 'vehicles' && (
        <View style={styles.chipRow}>
          <FilterChip value="all" label={`All · ${counts.all}`} />
          <FilterChip value="active" label={`Active · ${counts.active}`} />
          <FilterChip value="off" label={`Off road · ${counts.off}`} />
        </View>
      )}

      {section === 'vehicles' ? (
        <View style={styles.list}>
          {vehicles.loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : vehicles.error ? (
            <Card>
              <Text style={type.body}>Couldn't load vehicles: {vehicles.error}</Text>
            </Card>
          ) : allVehicles.length === 0 ? (
            <Card padded={false}>
              <EmptyState
                icon={<CarFront color={colors.textMuted} size={30} />}
                title="No vehicles yet"
                message="Add your first taxi to start tracking targets and takings."
                actionLabel={canEdit ? 'Add vehicle' : undefined}
                onAction={canEdit ? () => router.push('/vehicle/form') : undefined}
              />
            </Card>
          ) : visibleVehicles.length === 0 ? (
            <Card>
              <Text style={type.body}>No vehicles match your search or filter.</Text>
            </Card>
          ) : (
            visibleVehicles.map((v) => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                driver={driverByVehicle.get(v.id) ?? null}
                onNoDriver={() => setSection('drivers')}
              />
            ))
          )}
        </View>
      ) : (
        <View style={styles.list}>
          {drivers.loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : drivers.error ? (
            <Card>
              <Text style={type.body}>Couldn't load drivers: {drivers.error}</Text>
            </Card>
          ) : !drivers.data || drivers.data.length === 0 ? (
            <Card padded={false}>
              <EmptyState
                icon={<Users color={colors.textMuted} size={30} />}
                title="No drivers yet"
                message="Add drivers to assign them to taxis and record their takings."
                actionLabel={canEdit ? 'Add driver' : undefined}
                onAction={canEdit ? () => router.push('/driver/form') : undefined}
              />
            </Card>
          ) : visibleDrivers.length === 0 ? (
            <Card>
              <Text style={type.body}>No drivers match your search.</Text>
            </Card>
          ) : (
            visibleDrivers.map((d) => <DriverCard key={d.id} driver={d} />)
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Centered column on wide screens (tablet/web), full width on phones.
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  list: {
    gap: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: '#EEF1F5',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontFamily: font.semibold,
    fontSize: 12,
    color: '#4B5563',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPressed: {
    transform: [{ scale: 0.94 }],
  },
});
