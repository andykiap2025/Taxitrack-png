import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Text, View, StyleSheet } from 'react-native';

import { PhotoPicker, type PickedPhoto } from '@/components/PhotoPicker';
import {
  Button,
  Card,
  Input,
  Screen,
  ScreenHeader,
  Segmented,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { uploadBase64 } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { spacing, type, colors, font } from '@/lib/theme';
import type { Vehicle, VehicleClass } from '@/types/db';

const CLASS_TARGETS: Record<VehicleClass, number> = { standard: 180, new: 210 };

export default function VehicleForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { role } = useAuth();
  const editing = !!id;

  const [plate, setPlate] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [vclass, setVclass] = useState<VehicleClass>('standard');
  const [target, setTarget] = useState('180');
  const [odometer, setOdometer] = useState('');
  const [engineNo, setEngineNo] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [existing, setExisting] = useState<Vehicle | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!editing);

  const existingPhotoUrl = useSignedUrl('fleet-photos', existing?.photo_url);

  useEffect(() => {
    if (!editing) return;
    supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        const v = data as Vehicle | null;
        if (v) {
          setPlate(v.plate_no);
          setMake(v.make);
          setModel(v.model);
          setYear(v.year ? String(v.year) : '');
          setVclass(v.vehicle_class);
          setTarget(String(v.daily_target));
          setOdometer(String(v.odometer_current));
          setEngineNo(v.engine_no ?? '');
          setExisting(v);
        }
        setLoaded(true);
      });
  }, [editing, id]);

  // Class picker auto-sets the default target (still editable).
  const changeClass = (next: VehicleClass) => {
    setVclass(next);
    setTarget(String(CLASS_TARGETS[next]));
  };

  const save = async () => {
    const errs: Record<string, string> = {};
    const targetNum = Number(target);
    const odoNum = Number(odometer || '0');
    const yearNum = year ? Number(year) : null;
    if (!plate.trim()) errs.plate = 'Plate number is required';
    if (!Number.isFinite(targetNum) || targetNum <= 0) errs.target = 'Enter a valid daily target';
    if (!Number.isFinite(odoNum) || odoNum < 0) errs.odometer = 'Enter a valid odometer reading';
    if (year && (!Number.isInteger(yearNum) || yearNum! < 1980 || yearNum! > 2100))
      errs.year = 'Enter a valid year';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true);
    const payload = {
      plate_no: plate.trim().toUpperCase(),
      make: make.trim(),
      model: model.trim(),
      year: yearNum,
      vehicle_class: vclass,
      daily_target: targetNum,
      odometer_current: Math.round(odoNum),
      engine_no: engineNo.trim() || null,
    };

    // Save the record first so the photo has an id to live under.
    let vehicleId = id ?? null;
    if (editing) {
      const { error } = await supabase.from('vehicles').update(payload).eq('id', id);
      if (error) {
        setBusy(false);
        Alert.alert(
          'Could not save',
          /duplicate|unique/i.test(error.message)
            ? `A vehicle with plate ${payload.plate_no} already exists.`
            : error.message,
        );
        return;
      }
    } else {
      const { data, error } = await supabase.from('vehicles').insert(payload).select('id').single();
      if (error) {
        setBusy(false);
        Alert.alert(
          'Could not save',
          /duplicate|unique/i.test(error.message)
            ? `A vehicle with plate ${payload.plate_no} already exists.`
            : error.message,
        );
        return;
      }
      vehicleId = (data as { id: string }).id;
    }

    if (photo && vehicleId) {
      const path = `vehicles/${vehicleId}/photo-${Date.now()}.jpg`;
      const err = await uploadBase64('fleet-photos', path, photo.base64, 'image/jpeg');
      if (!err) {
        await supabase.from('vehicles').update({ photo_url: path }).eq('id', vehicleId);
      } else {
        Alert.alert('Photo upload failed', `${err}\n\nThe vehicle was saved without the photo.`);
      }
    }

    setBusy(false);
    router.back();
  };

  if (role !== 'owner') {
    return (
      <Screen bottomInset={spacing.xl}>
        <ScreenHeader title={editing ? 'Edit vehicle' : 'Add vehicle'} />
        <Card>
          <Text style={type.body}>Only the owner can manage vehicles.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader title={editing ? 'Edit vehicle' : 'Add vehicle'} />

      {loaded && (
        <Card style={styles.form}>
          <PhotoPicker
            label="Vehicle photo"
            photo={photo}
            onPicked={setPhoto}
            existingUrl={existingPhotoUrl}
          />
          <Input
            label="Plate number"
            placeholder="e.g. POM 106"
            autoCapitalize="characters"
            value={plate}
            onChangeText={setPlate}
            error={errors.plate}
          />
          <Input
            label="Engine number"
            placeholder="e.g. 2NZ-4128876"
            autoCapitalize="characters"
            value={engineNo}
            onChangeText={setEngineNo}
          />
          <View style={styles.row}>
            <Input
              label="Make"
              placeholder="Toyota"
              value={make}
              onChangeText={setMake}
              containerStyle={styles.flex}
            />
            <Input
              label="Model"
              placeholder="Corolla"
              value={model}
              onChangeText={setModel}
              containerStyle={styles.flex}
            />
          </View>
          <Input
            label="Year"
            placeholder="2020"
            keyboardType="number-pad"
            value={year}
            onChangeText={setYear}
            error={errors.year}
          />

          <View>
            <Text style={styles.pickerLabel}>Vehicle class</Text>
            <Segmented<VehicleClass>
              options={[
                { value: 'standard', label: 'Standard · K180' },
                { value: 'new', label: 'Newer · K210' },
              ]}
              value={vclass}
              onChange={changeClass}
            />
          </View>

          <Input
            label="Daily target"
            keyboardType="decimal-pad"
            value={target}
            onChangeText={setTarget}
            prefix={<Text style={styles.prefix}>K</Text>}
            hint="Auto-set by class — adjust if this vehicle has a custom target"
            error={errors.target}
          />
          <Input
            label="Current odometer (km)"
            placeholder="e.g. 84250"
            keyboardType="number-pad"
            value={odometer}
            onChangeText={setOdometer}
            error={errors.odometer}
          />

          <Button
            title={editing ? 'Save changes' : 'Add vehicle'}
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
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  pickerLabel: {
    ...type.label,
    marginBottom: spacing.xxs,
  },
  prefix: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.textSecondary,
  },
});
