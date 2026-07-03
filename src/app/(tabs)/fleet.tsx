import { useRouter } from 'expo-router';
import { CarFront, Plus, Users } from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { VehicleCard } from '@/components/VehicleCard';
import {
  Card,
  EmptyState,
  Screen,
  Segmented,
  SkeletonCard,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/lib/supabase';
import { colors, radius, shadow, spacing, type } from '@/lib/theme';
import type { Vehicle } from '@/types/db';

type Section = 'vehicles' | 'drivers';

export default function FleetScreen() {
  const router = useRouter();
  const { role } = useAuth();
  const [section, setSection] = useState<Section>('vehicles');

  const vehicles = useSupabaseQuery<Vehicle[]>(
    () => supabase.from('vehicles').select('*').order('plate_no'),
  );

  const canEdit = role === 'owner';

  const addButton = canEdit ? (
    <Pressable
      onPress={() =>
        section === 'vehicles' ? router.push('/vehicle/form') : undefined
      }
      style={({ pressed }) => [styles.addBtn, shadow.accentGlow, pressed && styles.addPressed]}
      accessibilityRole="button"
      accessibilityLabel={section === 'vehicles' ? 'Add vehicle' : 'Add driver'}
    >
      <Plus color={colors.onAccent} size={22} />
    </Pressable>
  ) : undefined;

  return (
    <Screen title="Fleet" titleAccessory={addButton}>
      <Segmented<Section>
        options={[
          { value: 'vehicles', label: 'Vehicles' },
          { value: 'drivers', label: 'Drivers' },
        ]}
        value={section}
        onChange={setSection}
      />

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
          ) : !vehicles.data || vehicles.data.length === 0 ? (
            <Card padded={false}>
              <EmptyState
                icon={<CarFront color={colors.textMuted} size={30} />}
                title="No vehicles yet"
                message="Add your first taxi to start tracking targets and takings."
                actionLabel={canEdit ? 'Add vehicle' : undefined}
                onAction={canEdit ? () => router.push('/vehicle/form') : undefined}
              />
            </Card>
          ) : (
            vehicles.data.map((v) => <VehicleCard key={v.id} vehicle={v} />)
          )}
        </View>
      ) : (
        <Card padded={false}>
          <EmptyState
            icon={<Users color={colors.textMuted} size={30} />}
            title="Drivers"
            message="Driver management arrives in Phase 5."
          />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPressed: {
    transform: [{ scale: 0.94 }],
  },
});
