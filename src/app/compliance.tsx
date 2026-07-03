import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { FileCheck2, ImageIcon, Plus, ShieldCheck, Wrench } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Card, EmptyState, Screen, ScreenHeader, SkeletonCard } from '@/components/ui';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { DOC_TYPE_LABELS, daysUntil, expiryLabel, toneForDays } from '@/lib/alerts';
import { signedUrl } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { colors, radius, shadow, spacing, type } from '@/lib/theme';
import type { ComplianceDoc } from '@/types/db';

type DocRow = ComplianceDoc & {
  vehicle: { plate_no: string } | null;
  driver: { full_name: string } | null;
};

export default function ComplianceScreen() {
  const router = useRouter();

  const q = useSupabaseQuery<DocRow[]>(
    () =>
      supabase
        .from('compliance_docs')
        .select('*, vehicle:vehicles(plate_no), driver:drivers(full_name)')
        .order('expiry_date'),
  );

  const docs = q.data ?? [];
  const attention = docs.filter((d) => daysUntil(d.expiry_date) <= 30);
  const ok = docs.filter((d) => daysUntil(d.expiry_date) > 30);

  const viewPhoto = async (doc: DocRow) => {
    if (!doc.document_url) return;
    const url = await signedUrl('compliance-docs', doc.document_url);
    if (url) await WebBrowser.openBrowserAsync(url);
  };

  const DocList = ({ items }: { items: DocRow[] }) => (
    <Card padded={false}>
      {items.map((doc, idx) => (
        <Pressable
          key={doc.id}
          onPress={() => router.push({ pathname: '/compliance/form', params: { docId: doc.id } })}
          style={({ pressed }) => [
            styles.row,
            idx < items.length - 1 && styles.divider,
            pressed && { backgroundColor: colors.surfaceMuted },
          ]}
        >
          <View style={styles.icon}>
            <FileCheck2 color={colors.primary} size={18} />
          </View>
          <View style={styles.info}>
            <Text style={type.bodyMedium}>
              {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type} ·{' '}
              {doc.vehicle?.plate_no ?? doc.driver?.full_name ?? '—'}
            </Text>
            <Text style={type.caption}>
              {doc.reference_no ? `${doc.reference_no} · ` : ''}tap to renew
            </Text>
          </View>
          {doc.document_url ? (
            <Pressable onPress={() => viewPhoto(doc)} hitSlop={8} style={styles.photoBtn}>
              <ImageIcon color={colors.info} size={18} />
            </Pressable>
          ) : null}
          <Badge label={expiryLabel(doc.expiry_date)} tone={toneForDays(daysUntil(doc.expiry_date))} />
        </Pressable>
      ))}
    </Card>
  );

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader
        title="Compliance"
        subtitle="Rego · safety stickers · MVIL · licenses"
        accessory={
          <Pressable
            onPress={() => router.push('/compliance/form')}
            style={({ pressed }) => [styles.addBtn, shadow.accentGlow, pressed && { transform: [{ scale: 0.94 }] }]}
            accessibilityLabel="Add document"
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
      ) : docs.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<ShieldCheck color={colors.textMuted} size={30} />}
            title="No documents yet"
            message="Add registrations, safety stickers, MVIL insurance and licenses to get expiry alerts."
            actionLabel="Add document"
            onAction={() => router.push('/compliance/form')}
          />
        </Card>
      ) : (
        <>
          {attention.length > 0 && (
            <>
              <Text style={type.sectionTitle}>Needs attention</Text>
              <DocList items={attention} />
            </>
          )}
          {ok.length > 0 && (
            <>
              <Text style={type.sectionTitle}>Up to date</Text>
              <DocList items={ok} />
            </>
          )}
        </>
      )}

      <Card style={styles.serviceNote} onPress={() => router.push('/service')}>
        <Wrench color={colors.primary} size={18} />
        <Text style={[type.bodyMedium, styles.serviceText]}>
          Vehicle servicing — schedules, history and next-due tracking
        </Text>
      </Card>
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
  photoBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
  },
  serviceText: {
    flex: 1,
  },
});
