import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Card } from '@/components/ui';
import { daysUntil } from '@/lib/alerts';
import { DRIVER_STATUS, initialsOf } from '@/lib/labels';
import { colors, font, identityColor, radius, spacing, type } from '@/lib/theme';
import type { Driver } from '@/types/db';

export type DriverWithAssignment = Driver & {
  assignments: {
    id: string;
    end_date: string | null;
    vehicle: { id: string; plate_no: string } | null;
  }[];
};

export function DriverCard({ driver }: { driver: DriverWithAssignment }) {
  const router = useRouter();
  const status = DRIVER_STATUS[driver.status];
  const vehicle = driver.assignments.find((a) => !a.end_date)?.vehicle ?? null;
  const licenseDays = driver.license_expiry ? daysUntil(driver.license_expiry) : null;
  const idc = identityColor(driver.id);

  return (
    <Card onPress={() => router.push({ pathname: '/driver/[id]', params: { id: driver.id } })}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: idc.soft }]}>
          <Text style={[styles.avatarText, { color: idc.strong }]}>
            {initialsOf(driver.full_name)}
          </Text>
        </View>
        <View style={styles.info}>
          <Text style={type.cardTitle}>{driver.full_name}</Text>
          <Text style={type.caption} numberOfLines={1}>
            {vehicle ? `Drives ${vehicle.plate_no}` : 'No vehicle assigned'}
            {driver.phone ? ` · ${driver.phone}` : ''}
          </Text>
        </View>
        <View style={styles.right}>
          {licenseDays !== null && licenseDays <= 30 ? (
            <Badge
              label={licenseDays < 0 ? 'License expired' : `License ${licenseDays}d`}
              tone={licenseDays <= 7 ? 'danger' : 'warning'}
            />
          ) : (
            <Badge label={status.label} tone={status.tone} dot />
          )}
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
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    backgroundColor: colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.info,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  right: {
    alignItems: 'flex-end',
  },
});
