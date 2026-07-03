import { useRouter } from 'expo-router';
import { CarFront } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { formatPGK } from '@/lib/format';
import { initialsOf, titleCase, VEHICLE_CLASS } from '@/lib/labels';
import { colors, font, radius, spacing, type } from '@/lib/theme';
import type { Vehicle } from '@/types/db';

export type AssignedDriver = { id: string; name: string } | null;

const DOT = {
  active: '#16A34A',
  in_service: '#D97706',
  off_road: '#D97706',
  retired: '#9CA3AF',
} as const;

type Props = {
  vehicle: Vehicle;
  /** Current holder from the open assignment; null = unassigned. */
  driver: AssignedDriver;
  /** Called when "No driver assigned" is tapped (assign flow). */
  onNoDriver?: () => void;
};

export function VehicleCard({ vehicle, driver, onNoDriver }: Props) {
  const router = useRouter();

  return (
    <Card
      style={styles.card}
      onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: vehicle.id } })}
    >
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <CarFront color={colors.primary} size={22} />
        </View>
        <View style={styles.info}>
          <View style={styles.plateRow}>
            <Text style={type.cardTitle}>{vehicle.plate_no}</Text>
            <View style={[styles.dot, { backgroundColor: DOT[vehicle.status] }]} />
          </View>
          <Text style={type.caption} numberOfLines={1}>
            {titleCase([vehicle.make, vehicle.model].filter(Boolean).join(' '))}
            {vehicle.year ? ` ${vehicle.year}` : ''}
          </Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>
            {VEHICLE_CLASS[vehicle.vehicle_class]} · {formatPGK(vehicle.daily_target, { decimals: 0 })}
          </Text>
        </View>
      </View>

      {/* Footer: only the assigned driver. */}
      <View style={styles.footerDivider} />
      {driver ? (
        <Pressable
          onPress={() => router.push({ pathname: '/driver/[id]', params: { id: driver.id } })}
          style={({ pressed }) => [styles.driverChip, pressed && { opacity: 0.7 }]}
          hitSlop={4}
        >
          <View style={styles.chipAvatar}>
            <Text style={styles.chipInitials}>{initialsOf(driver.name)}</Text>
          </View>
          <Text style={styles.chipName} numberOfLines={1}>
            {titleCase(driver.name)}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onNoDriver}
          style={({ pressed }) => [styles.noDriverPill, pressed && { opacity: 0.7 }]}
          hitSlop={4}
        >
          <Text style={styles.noDriverText}>No driver assigned</Text>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#E5E8EC',
    borderRadius: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    backgroundColor: '#EEF1F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  plateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
  },
  tag: {
    backgroundColor: '#EEF1F5',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  tagText: {
    fontFamily: font.semibold,
    fontSize: 12,
    color: '#4B5563',
  },
  footerDivider: {
    height: 1,
    backgroundColor: '#EEF1F5',
    marginVertical: spacing.sm,
  },
  driverChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  chipAvatar: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipInitials: {
    fontFamily: font.bold,
    fontSize: 10,
    color: '#FFFFFF',
  },
  chipName: {
    fontFamily: font.semibold,
    fontSize: 13,
    color: colors.text,
  },
  noDriverPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  noDriverText: {
    fontFamily: font.semibold,
    fontSize: 12,
    color: '#B45309',
  },
});
