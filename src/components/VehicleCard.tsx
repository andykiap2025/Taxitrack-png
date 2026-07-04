import { useRouter } from 'expo-router';
import { CarFront, ChevronRight } from 'lucide-react-native';
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

const STATUS_NOTE: Partial<Record<Vehicle['status'], string>> = {
  off_road: 'Off road',
  in_service: 'In service',
  retired: 'Retired',
};

type Props = {
  vehicle: Vehicle;
  /** Current holder from the open assignment; null = unassigned. */
  driver: AssignedDriver;
  /** Called when "No driver assigned" is tapped (assign flow). */
  onNoDriver?: () => void;
};

export function VehicleCard({ vehicle, driver, onNoDriver }: Props) {
  const router = useRouter();
  const note = STATUS_NOTE[vehicle.status];

  return (
    <Card
      style={styles.card}
      onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: vehicle.id } })}
    >
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <CarFront color={colors.primary} size={20} />
        </View>
        <View style={styles.info}>
          <View style={styles.plateRow}>
            <Text style={type.cardTitle}>{vehicle.plate_no}</Text>
            <View style={[styles.dot, { backgroundColor: DOT[vehicle.status] }]} />
            <View style={styles.flex} />
            <View style={styles.tag}>
              <Text style={styles.tagText}>
                {VEHICLE_CLASS[vehicle.vehicle_class]} ·{' '}
                {formatPGK(vehicle.daily_target, { decimals: 0 })}
              </Text>
            </View>
          </View>
          <Text style={type.caption} numberOfLines={1}>
            {titleCase([vehicle.make, vehicle.model].filter(Boolean).join(' '))}
            {vehicle.year ? ` ${vehicle.year}` : ''}
            {note ? ` · ${note}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.footerDivider} />

      <Pressable
        onPress={
          driver
            ? () => router.push({ pathname: '/driver/[id]', params: { id: driver.id } })
            : onNoDriver
        }
        style={({ pressed }) => [styles.footerRow, pressed && { opacity: 0.7 }]}
        hitSlop={4}
      >
        {driver ? (
          <View style={styles.driverPill}>
            <View style={styles.chipAvatar}>
              <Text style={styles.chipInitials}>{initialsOf(driver.name)}</Text>
            </View>
            <Text style={styles.chipName} numberOfLines={1}>
              {titleCase(driver.name)}
            </Text>
          </View>
        ) : (
          <View style={styles.noDriverPill}>
            <Text style={styles.noDriverText}>No driver assigned</Text>
          </View>
        )}
        <View style={styles.flex} />
        <ChevronRight color="#9CA3AF" size={16} />
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F7F9FD',
    borderWidth: 1,
    borderColor: '#DCE2EC',
    borderRadius: 14,
    paddingVertical: 12,
  },
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: '#E3E9F5',
    borderWidth: 1,
    borderColor: '#D3DCEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 1,
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
    backgroundColor: '#E3E9F5',
    borderWidth: 1,
    borderColor: '#D3DCEE',
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
  },
  tagText: {
    fontFamily: font.semibold,
    fontSize: 11,
    color: colors.primary,
  },
  footerDivider: {
    height: 0.5,
    backgroundColor: '#E5E8EC',
    marginTop: 8,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  driverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E3E9F5',
    borderWidth: 1,
    borderColor: '#D3DCEE',
    borderRadius: radius.full,
    paddingVertical: 3,
    paddingLeft: 3,
    paddingRight: 10,
  },
  chipAvatar: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipInitials: {
    fontFamily: font.bold,
    fontSize: 9,
    color: '#FFFFFF',
  },
  chipName: {
    fontFamily: font.semibold,
    fontSize: 12,
    color: colors.text,
  },
  noDriverPill: {
    backgroundColor: '#FEF3C7',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  noDriverText: {
    fontFamily: font.semibold,
    fontSize: 11,
    color: '#B45309',
  },
});
