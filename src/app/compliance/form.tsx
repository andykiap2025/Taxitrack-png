import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, ImageIcon } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  Input,
  Screen,
  ScreenHeader,
  Segmented,
  SkeletonCard,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { DOC_TYPE_LABELS } from '@/lib/alerts';
import { formatDate, parseDMY, todayISO } from '@/lib/format';
import { uploadBase64 } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing, type } from '@/lib/theme';
import type { ComplianceDoc, DocOwnerType, DocType, Driver, Vehicle } from '@/types/db';

const VEHICLE_DOCS: DocType[] = ['registration', 'safety_sticker', 'mvil_insurance', 'taxi_permit'];
const DRIVER_DOCS: DocType[] = ['drivers_license'];

/** Auto-suggested validity per document type (months). */
const VALID_MONTHS: Partial<Record<DocType, number>> = {
  registration: 12,
  mvil_insurance: 12,
  taxi_permit: 12,
  safety_sticker: 6,
};

function addMonths(dateISO: string, months: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export default function ComplianceForm() {
  const { docId } = useLocalSearchParams<{ docId?: string }>();
  const router = useRouter();
  const { role } = useAuth();
  const renewing = !!docId;

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [ownerType, setOwnerType] = useState<DocOwnerType>('vehicle');
  const [entityId, setEntityId] = useState<string | null>(null);
  const [docType, setDocType] = useState<DocType>('registration');
  const [issue, setIssue] = useState(formatDate(todayISO()));
  const [expiry, setExpiry] = useState('');
  const [refNo, setRefNo] = useState('');
  const [photo, setPhoto] = useState<{ base64: string; uri: string } | null>(null);
  const [existingUrl, setExistingUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [v, d] = await Promise.all([
        supabase.from('vehicles').select('*').neq('status', 'retired').order('plate_no'),
        supabase.from('drivers').select('*').order('full_name'),
      ]);
      setVehicles((v.data ?? []) as Vehicle[]);
      setDrivers((d.data ?? []) as Driver[]);

      if (docId) {
        const { data } = await supabase
          .from('compliance_docs')
          .select('*')
          .eq('id', docId)
          .single();
        const doc = data as ComplianceDoc | null;
        if (doc) {
          setOwnerType(doc.owner_type);
          setEntityId(doc.vehicle_id ?? doc.driver_id);
          setDocType(doc.doc_type);
          if (doc.issue_date) setIssue(formatDate(doc.issue_date));
          setExpiry(formatDate(doc.expiry_date));
          setRefNo(doc.reference_no ?? '');
          setExistingUrl(doc.document_url);
        }
      }
      setLoaded(true);
    })();
  }, [docId]);

  const suggestExpiry = (nextType: DocType, issueDMY: string) => {
    const months = VALID_MONTHS[nextType];
    const issueISO = parseDMY(issueDMY);
    if (months && issueISO) setExpiry(formatDate(addMonths(issueISO, months)));
  };

  const changeOwnerType = (next: DocOwnerType) => {
    setOwnerType(next);
    setEntityId(null);
    const first = next === 'vehicle' ? VEHICLE_DOCS[0] : DRIVER_DOCS[0];
    setDocType(first);
    suggestExpiry(first, issue);
  };

  const pickPhoto = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.5, base64: true });
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.base64) {
      setPhoto({ base64: asset.base64, uri: asset.uri });
    }
  };

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!entityId) errs.entity = ownerType === 'vehicle' ? 'Pick the vehicle' : 'Pick the driver';
    const expiryISO = parseDMY(expiry);
    if (!expiryISO) errs.expiry = 'Use DD/MM/YYYY';
    const issueISO = issue.trim() ? parseDMY(issue) : null;
    if (issue.trim() && !issueISO) errs.issue = 'Use DD/MM/YYYY';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true);

    let documentUrl = existingUrl;
    if (photo) {
      const path = `${ownerType}/${entityId}/${docType}-${Date.now()}.jpg`;
      const upErr = await uploadBase64('compliance-docs', path, photo.base64, 'image/jpeg');
      if (upErr) {
        setBusy(false);
        Alert.alert('Photo upload failed', upErr);
        return;
      }
      documentUrl = path;
    }

    const payload = {
      owner_type: ownerType,
      vehicle_id: ownerType === 'vehicle' ? entityId : null,
      driver_id: ownerType === 'driver' ? entityId : null,
      doc_type: docType,
      issue_date: issueISO,
      expiry_date: expiryISO,
      reference_no: refNo.trim() || null,
      document_url: documentUrl,
    };

    const { error } = renewing
      ? await supabase.from('compliance_docs').update(payload).eq('id', docId)
      : await supabase.from('compliance_docs').insert(payload);
    setBusy(false);
    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }
    router.back();
  };

  const entities = ownerType === 'vehicle' ? vehicles : drivers;
  const docTypes = ownerType === 'vehicle' ? VEHICLE_DOCS : DRIVER_DOCS;

  if (role !== 'owner') {
    return (
      <Screen bottomInset={spacing.xl}>
        <ScreenHeader title={renewing ? 'Renew document' : 'Add document'} />
        <Card>
          <Text style={type.body}>Only the owner can add or renew documents.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader title={renewing ? 'Renew document' : 'Add document'} />

      {!loaded ? (
        <SkeletonCard />
      ) : (
        <Card style={styles.form}>
          <View>
            <Text style={styles.label}>Belongs to</Text>
            <Segmented<DocOwnerType>
              options={[
                { value: 'vehicle', label: 'Vehicle' },
                { value: 'driver', label: 'Driver' },
              ]}
              value={ownerType}
              onChange={changeOwnerType}
            />
          </View>

          <View>
            <Text style={styles.label}>{ownerType === 'vehicle' ? 'Vehicle' : 'Driver'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chips}>
                {entities.map((e) => {
                  const label = 'plate_no' in e ? e.plate_no : e.full_name;
                  const active = e.id === entityId;
                  return (
                    <Pressable
                      key={e.id}
                      onPress={() => setEntityId(e.id)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            {errors.entity ? <Text style={styles.error}>{errors.entity}</Text> : null}
          </View>

          <View>
            <Text style={styles.label}>Document type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chips}>
                {docTypes.map((t) => {
                  const active = t === docType;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => {
                        setDocType(t);
                        suggestExpiry(t, issue);
                      }}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {DOC_TYPE_LABELS[t]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          <View style={styles.row}>
            <Input
              label="Issue date"
              placeholder="DD/MM/YYYY"
              value={issue}
              onChangeText={(v) => {
                setIssue(v);
                suggestExpiry(docType, v);
              }}
              error={errors.issue}
              containerStyle={styles.flex}
            />
            <Input
              label="Expiry date"
              placeholder="DD/MM/YYYY"
              value={expiry}
              onChangeText={setExpiry}
              error={errors.expiry}
              containerStyle={styles.flex}
            />
          </View>
          <Input
            label="Reference number (optional)"
            placeholder="e.g. REG-4471"
            autoCapitalize="characters"
            value={refNo}
            onChangeText={setRefNo}
          />

          <View>
            <Text style={styles.label}>Document photo</Text>
            {photo ? (
              <Image source={{ uri: photo.uri }} style={styles.preview} />
            ) : existingUrl ? (
              <Text style={type.caption}>A photo is already on file — add a new one to replace it.</Text>
            ) : null}
            <View style={styles.photoRow}>
              <Button
                title="Camera"
                variant="outline"
                size="md"
                icon={<Camera color={colors.primary} size={17} />}
                onPress={() => pickPhoto(true)}
                style={styles.flex}
              />
              <Button
                title="Gallery"
                variant="outline"
                size="md"
                icon={<ImageIcon color={colors.primary} size={17} />}
                onPress={() => pickPhoto(false)}
                style={styles.flex}
              />
            </View>
          </View>

          <Button
            title={renewing ? 'Save renewal' : 'Add document'}
            fullWidth
            loading={busy}
            onPress={save}
          />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
  label: {
    ...type.label,
    marginBottom: spacing.xxs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipText: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.onPrimary,
  },
  error: {
    ...type.caption,
    color: colors.danger,
    marginTop: spacing.xxs,
  },
  preview: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.surfaceMuted,
  },
  photoRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
