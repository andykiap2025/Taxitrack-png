import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Input, Screen, ScreenHeader } from '@/components/ui';
import { formatDate, parseDMY, todayISO } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing, type } from '@/lib/theme';
import type { Vehicle } from '@/types/db';

export default function ServiceForm() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<string | null>(vehicleId ?? null);
  const [date, setDate] = useState(formatDate(todayISO()));
  const [odometer, setOdometer] = useState('');
  const [cost, setCost] = useState('');
  const [workshop, setWorkshop] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from('vehicles')
      .select('*')
      .neq('status', 'retired')
      .order('plate_no')
      .then(({ data }) => setVehicles((data ?? []) as Vehicle[]));
  }, []);

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!selected) errs.vehicle = 'Pick the vehicle';
    const dateISO = parseDMY(date);
    if (!dateISO) errs.date = 'Use DD/MM/YYYY';
    const odoNum = odometer.trim() ? Number(odometer) : null;
    if (odoNum !== null && (!Number.isInteger(odoNum) || odoNum < 0))
      errs.odometer = 'Enter a valid reading or leave blank';
    const costNum = Number(cost || '0');
    if (!Number.isFinite(costNum) || costNum < 0) errs.cost = 'Enter a valid cost';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true);
    const { error } = await supabase.from('service_records').insert({
      vehicle_id: selected,
      service_date: dateISO,
      odometer_at_service: odoNum,
      cost: costNum,
      workshop: workshop.trim() || null,
      notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }
    router.back();
  };

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader title="Log service" />
      <Card style={styles.form}>
        <View>
          <Text style={styles.label}>Vehicle</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chips}>
              {vehicles.map((v) => {
                const active = v.id === selected;
                return (
                  <Pressable
                    key={v.id}
                    onPress={() => setSelected(v.id)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{v.plate_no}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          {errors.vehicle ? <Text style={styles.error}>{errors.vehicle}</Text> : null}
        </View>

        <View style={styles.row}>
          <Input
            label="Service date"
            placeholder="DD/MM/YYYY"
            value={date}
            onChangeText={setDate}
            error={errors.date}
            containerStyle={styles.flex}
          />
          <Input
            label="Odometer (km) — optional"
            placeholder="Leave blank"
            keyboardType="number-pad"
            value={odometer}
            onChangeText={setOdometer}
            error={errors.odometer}
            containerStyle={styles.flex}
          />
        </View>
        <Input
          label="Cost"
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={cost}
          onChangeText={setCost}
          prefix={<Text style={styles.prefix}>K</Text>}
          error={errors.cost}
        />
        <Input
          label="Workshop (optional)"
          placeholder="e.g. Ela Motors POM"
          value={workshop}
          onChangeText={setWorkshop}
        />
        <Input
          label="Notes (optional)"
          placeholder="e.g. oil + filters, brake pads"
          value={notes}
          onChangeText={setNotes}
        />
        <Text style={type.caption}>
          Next service is set automatically at +3 months (and +5,000 km if you enter a reading).
        </Text>
        <Button title="Save service" fullWidth loading={busy} onPress={save} />
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
});
