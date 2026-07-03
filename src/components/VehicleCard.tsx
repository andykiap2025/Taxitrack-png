import { useRouter } from 'expo-router';
import { CarFront } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Card } from '@/components/ui';
import { formatPGK } from '@/lib/format';
import { VEHICLE_CLASS, VEHICLE_STATUS } from '@/lib/labels';
import { colors, font, identityColor, radius, spacing, type } from '@/lib/theme';
import type { Vehicle } from '@/types/db';

export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const router = useRouter();
  const status = VEHICLE_STATUS[vehicle.status];
  const idc = identityColor(vehicle.id);

  return (
    <Card onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: vehicle.id } })}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: idc.soft }]}>
          <CarFront color={idc.strong} size={22} />
        </View>
        <View style={styles.info}>
          <Text style={type.cardTitle}>{vehicle.plate_no}</Text>
          <Text style={type.caption} numberOfLines={1}>
            {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ')} ·{' '}
            {VEHICLE_CLASS[vehicle.vehicle_class]}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.target}>{formatPGK(vehicle.daily_target, { decimals: 0 })}/day</Text>
          <Badge label={status.label} tone={status.tone} dot />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  right: {
    alignItems: 'flex-end',
    gap: spacing.xxs,
  },
  target: {
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.text,
  },
});
