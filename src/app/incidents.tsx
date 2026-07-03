import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Camera, Plus, Siren } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Card, EmptyState, Screen, ScreenHeader, SkeletonCard } from '@/components/ui';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { formatDate, formatPGK } from '@/lib/format';
import { signedUrl } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { colors, radius, shadow, spacing, type } from '@/lib/theme';
import type { Incident, IncidentType } from '@/types/db';

type IncidentRow = Incident & {
  vehicle: { plate_no: string } | null;
  driver: { full_name: string } | null;
};

const TYPE_LABELS: Record<IncidentType, string> = {
  accident: 'Accident',
  fine: 'Fine',
  damage: 'Damage',
  theft: 'Theft',
  other: 'Other',
};

export default function IncidentsScreen() {
  const router = useRouter();

  const q = useSupabaseQuery<IncidentRow[]>(
    () =>
      supabase
        .from('incidents')
        .select('*, vehicle:vehicles(plate_no), driver:drivers(full_name)')
        .order('date', { ascending: false })
        .limit(40),
  );

  const incidents = q.data ?? [];

  const openPhotos = async (inc: IncidentRow) => {
    if (inc.photos.length === 0) return;
    const url = await signedUrl('incident-photos', inc.photos[0]);
    if (url) await WebBrowser.openBrowserAsync(url);
  };

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader
        title="Incidents"
        subtitle="Accidents, fines, damage & theft"
        accessory={
          <Pressable
            onPress={() => router.push('/incidents/form')}
            style={({ pressed }) => [styles.addBtn, shadow.accentGlow, pressed && { transform: [{ scale: 0.94 }] }]}
            accessibilityLabel="Report incident"
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
      ) : incidents.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<Siren color={colors.textMuted} size={30} />}
            title="No incidents"
            message="Long may it last. Report accidents, fines and damage here with photos."
            actionLabel="Report incident"
            onAction={() => router.push('/incidents/form')}
          />
        </Card>
      ) : (
        <Card padded={false}>
          {incidents.map((inc, idx) => (
            <Pressable
              key={inc.id}
              onPress={() => openPhotos(inc)}
              style={({ pressed }) => [
                styles.row,
                idx < incidents.length - 1 && styles.divider,
                pressed && inc.photos.length > 0 && { backgroundColor: colors.surfaceMuted },
              ]}
            >
              <View
                style={[
                  styles.icon,
                  { backgroundColor: inc.type === 'fine' ? colors.warningSoft : colors.dangerSoft },
                ]}
              >
                <Siren color={inc.type === 'fine' ? colors.warning : colors.danger} size={17} />
              </View>
              <View style={styles.info}>
                <Text style={type.bodyMedium}>
                  {TYPE_LABELS[inc.type]} · {inc.vehicle?.plate_no ?? '—'}
                  {Number(inc.cost) > 0 ? ` · ${formatPGK(Number(inc.cost))}` : ''}
                </Text>
                <Text style={type.caption} numberOfLines={1}>
                  {formatDate(inc.date)}
                  {inc.driver ? ` · ${inc.driver.full_name}` : ''}
                  {inc.police_report_no ? ` · Police ${inc.police_report_no}` : ''}
                  {inc.description ? ` — ${inc.description}` : ''}
                </Text>
              </View>
              {inc.photos.length > 0 && (
                <View style={styles.photoTag}>
                  <Camera color={colors.info} size={13} />
                  <Text style={styles.photoCount}>{inc.photos.length}</Text>
                </View>
              )}
              {inc.deduction_id && <Badge label="Charged" tone="warning" />}
            </Pressable>
          ))}
        </Card>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 1,
  },
  photoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.infoSoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
  },
  photoCount: {
    ...type.caption,
    color: colors.info,
  },
});
