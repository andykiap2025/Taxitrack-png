import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, ImageIcon } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, Input, Screen, ScreenHeader } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, parseDMY, todayISO } from '@/lib/format';
import { uploadBase64 } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing, type } from '@/lib/theme';
import type { DeductionType, Driver, IncidentType, Vehicle } from '@/types/db';

const TYPES: { value: IncidentType; label: string }[] = [
  { value: 'accident', label: 'Accident' },
  { value: 'fine', label: 'Fine' },
  { value: 'damage', label: 'Damage' },
  { value: 'theft', label: 'Theft' },
  { value: 'other', label: 'Other' },
];

/** Deduction category when the cost is charged to the driver. */
const CHARGE_TYPE: Record<IncidentType, DeductionType> = {
  fine: 'fine',
  accident: 'repair',
  damage: 'repair',
  theft: 'other',
  other: 'other',
};

type Photo = { base64: string; uri: string };

export default function IncidentForm() {
  const router = useRouter();
  const { role } = useAuth();
  const isOwner = role === 'owner';

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [incType, setIncType] = useState<IncidentType>('accident');
  const [date, setDate] = useState(formatDate(todayISO()));
  const [cost, setCost] = useState('');
  const [description, setDescription] = useState('');
  const [policeNo, setPoliceNo] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [chargeDriver, setChargeDriver] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('vehicles').select('*').neq('status', 'retired').order('plate_no'),
      supabase.from('drivers').select('*').eq('status', 'active').order('full_name'),
    ]).then(([v, d]) => {
      setVehicles((v.data ?? []) as Vehicle[]);
      setDrivers((d.data ?? []) as Driver[]);
    });
  }, []);

  const addPhoto = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.5, base64: true });
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.base64) {
      setPhotos((prev) => [...prev, { base64: asset.base64!, uri: asset.uri }]);
    }
  };

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!vehicleId) errs.vehicle = 'Pick the vehicle';
    const dateISO = parseDMY(date);
    if (!dateISO) errs.date = 'Use DD/MM/YYYY';
    const costNum = Number(cost || '0');
    if (!Number.isFinite(costNum) || costNum < 0) errs.cost = 'Enter a valid cost';
    if (chargeDriver && !driverId) errs.driver = 'Pick the driver being charged';
    if (chargeDriver && costNum <= 0) errs.cost = 'A charge needs a cost amount';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true);

    // Upload photos first.
    const paths: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      const path = `${vehicleId}/${Date.now()}-${i}.jpg`;
      const err = await uploadBase64('incident-photos', path, photos[i].base64, 'image/jpeg');
      if (err) {
        setBusy(false);
        Alert.alert('Photo upload failed', err);
        return;
      }
      paths.push(path);
    }

    // Optional one-tap charge: create the deduction, then link it.
    let deductionId: string | null = null;
    if (chargeDriver && driverId) {
      const { data, error } = await supabase
        .from('deductions')
        .insert({
          driver_id: driverId,
          type: CHARGE_TYPE[incType],
          amount: costNum,
          date: dateISO,
          description: `Incident: ${incType}${description.trim() ? ` — ${description.trim()}` : ''}`,
        })
        .select('id')
        .single();
      if (error) {
        setBusy(false);
        Alert.alert('Could not create deduction', error.message);
        return;
      }
      deductionId = (data as { id: string }).id;
    }

    const { error } = await supabase.from('incidents').insert({
      vehicle_id: vehicleId,
      driver_id: driverId,
      date: dateISO,
      type: incType,
      description: description.trim() || null,
      cost: costNum,
      police_report_no: policeNo.trim() || null,
      photos: paths,
      deduction_id: deductionId,
    });
    setBusy(false);
    if (error) {
      Alert.alert('Could not save incident', error.message);
      return;
    }
    router.back();
  };

  const Chips = <T extends string>({
    items,
    value,
    onChange,
    error,
  }: {
    items: { value: T; label: string }[];
    value: T | null;
    onChange: (v: T) => void;
    error?: string;
  }) => (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chips}>
          {items.map((it) => {
            const active = it.value === value;
            return (
              <Pressable
                key={it.value}
                onPress={() => onChange(it.value)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{it.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader title="Report incident" />
      <Card style={styles.form}>
        <View>
          <Text style={styles.label}>Type</Text>
          <Chips items={TYPES} value={incType} onChange={setIncType} />
        </View>
        <View>
          <Text style={styles.label}>Vehicle</Text>
          <Chips
            items={vehicles.map((v) => ({ value: v.id, label: v.plate_no }))}
            value={vehicleId}
            onChange={setVehicleId}
            error={errors.vehicle}
          />
        </View>
        <View>
          <Text style={styles.label}>Driver involved (optional)</Text>
          <Chips
            items={drivers.map((d) => ({ value: d.id, label: d.full_name }))}
            value={driverId}
            onChange={(v) => setDriverId(v === driverId ? null : v)}
            error={errors.driver}
          />
        </View>

        <View style={styles.row}>
          <Input
            label="Date"
            placeholder="DD/MM/YYYY"
            value={date}
            onChangeText={setDate}
            error={errors.date}
            containerStyle={styles.flex}
          />
          <Input
            label="Cost"
            placeholder="0.00"
            keyboardType="decimal-pad"
            value={cost}
            onChangeText={setCost}
            prefix={<Text style={styles.prefix}>K</Text>}
            error={errors.cost}
            containerStyle={styles.flex}
          />
        </View>
        <Input
          label="Description"
          placeholder="What happened?"
          value={description}
          onChangeText={setDescription}
        />
        <Input
          label="Police report no. (optional)"
          placeholder="e.g. RPT-2231"
          autoCapitalize="characters"
          value={policeNo}
          onChangeText={setPoliceNo}
        />

        <View>
          <Text style={styles.label}>Photos</Text>
          {photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.previewRow}>
                {photos.map((p, i) => (
                  <Image key={i} source={{ uri: p.uri }} style={styles.preview} />
                ))}
              </View>
            </ScrollView>
          )}
          <View style={styles.photoRow}>
            <Button
              title="Camera"
              variant="outline"
              size="md"
              icon={<Camera color={colors.primary} size={17} />}
              onPress={() => addPhoto(true)}
              style={styles.flex}
            />
            <Button
              title="Gallery"
              variant="outline"
              size="md"
              icon={<ImageIcon color={colors.primary} size={17} />}
              onPress={() => addPhoto(false)}
              style={styles.flex}
            />
          </View>
        </View>

        {isOwner && (
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={type.bodyMedium}>Charge cost to driver</Text>
              <Text style={type.caption}>
                Creates a {CHARGE_TYPE[incType]} deduction taken from their next pay.
              </Text>
            </View>
            <Switch
              value={chargeDriver}
              onValueChange={setChargeDriver}
              trackColor={{ true: colors.primary, false: colors.borderStrong }}
              thumbColor={colors.surface}
            />
          </View>
        )}

        <Button title="Save incident" fullWidth loading={busy} onPress={save} />
      </Card>
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
  prefix: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.textSecondary,
  },
  previewRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  preview: {
    width: 84,
    height: 84,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  photoRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  switchText: {
    flex: 1,
    gap: 2,
  },
});
