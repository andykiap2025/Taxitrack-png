import { useRouter } from 'expo-router';
import { CarFront, ChevronRight } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { daysUntil } from '@/lib/alerts';
import { formatName } from '@/lib/format';
import { initialsOf } from '@/lib/labels';
import { colors, font, radius, spacing, type } from '@/lib/theme';
import type { Driver } from '@/types/db';

export type DriverWithAssignment = Driver & {
  assignments: {
    id: string;
    end_date: string | null;
    vehicle: { id: string; plate_no: string } | null;
  }[];
};

const DOT = {
  active: '#16A34A',
  inactive: '#9CA3AF',
  suspended: '#DC2626',
} as const;

type Props = {
  driver: DriverWithAssignment;
  /** Tapped on "No taxi assigned" — opens the assign flow. */
  onNoTaxi?: () => void;
};

export function DriverCard({ driver, onNoTaxi }: Props) {
  const router = useRouter();
  const vehicle = driver.assignments.find((a) => !a.end_date)?.vehicle ?? null;
  const licenseDays = driver.license_expiry ? daysUntil(driver.license_expiry) : null;

  const licensePill =
    licenseDays !== null && licenseDays <= 30
      ? {
          label: licenseDays < 0 ? 'License expired' : `License ${licenseDays}d`,
          bg: licenseDays <= 7 ? '#FEE2E2' : '#FEF3C7',
          fg: licenseDays <= 7 ? '#DC2626' : '#B45309',
        }
      : null;

  return (
    <Card
      style={styles.card}
      onPress={() => router.push({ pathname: '/driver/[id]', params: { id: driver.id } })}
    >
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsOf(driver.full_name)}</Text>
        </View>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={type.cardTitle} numberOfLines={1}>
              {formatName(driver.full_name)}
            </Text>
            <View style={[styles.dot, { backgroundColor: DOT[driver.status] }]} />
          </View>
          <View style={styles.secondRow}>
            {vehicle ? (
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/vehicle/[id]', params: { id: vehicle.id } })
                }
                style={({ pressed }) => [styles.taxiChip, pressed && { opacity: 0.7 }]}
                hitSlop={4}
              >
                <CarFront color={colors.primary} size={12} />
                <Text style={styles.taxiChipText}>{vehicle.plate_no}</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={onNoTaxi}
                style={({ pressed }) => [styles.noTaxiPill, pressed && { opacity: 0.7 }]}
                hitSlop={4}
              >
                <Text style={styles.noTaxiText}>No taxi assigned</Text>
              </Pressable>
            )}
            {driver.phone ? (
              <Text style={type.caption} numberOfLines={1}>
                {driver.phone}
              </Text>
            ) : null}
          </View>
        </View>
        {licensePill ? (
          <View style={[styles.pill, { backgroundColor: licensePill.bg }]}>
            <Text style={[styles.pillText, { color: licensePill.fg }]}>{licensePill.label}</Text>
          </View>
        ) : (
          <ChevronRight color="#9CA3AF" size={16} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#E5E8EC',
    borderRadius: 14,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: '#EEF1F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: font.bold,
    fontSize: 13,
    color: colors.primary,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
  },
  secondRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  taxiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF1F5',
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
  },
  taxiChipText: {
    fontFamily: font.semibold,
    fontSize: 11,
    color: colors.primary,
  },
  noTaxiPill: {
    backgroundColor: '#FEF3C7',
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
  },
  noTaxiText: {
    fontFamily: font.semibold,
    fontSize: 11,
    color: '#B45309',
  },
  pill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
  },
  pillText: {
    fontFamily: font.semibold,
    fontSize: 11,
  },
});
