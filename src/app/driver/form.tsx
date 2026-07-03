import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  Input,
  Screen,
  ScreenHeader,
  Segmented,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, parseDMY } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { spacing, type } from '@/lib/theme';
import type { Driver, DriverStatus } from '@/types/db';

export default function DriverForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { role } = useAuth();
  const editing = !!id;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [dateStarted, setDateStarted] = useState('');
  const [status, setStatus] = useState<DriverStatus>('active');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!editing);

  useEffect(() => {
    if (!editing) return;
    supabase
      .from('drivers')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        const d = data as Driver | null;
        if (d) {
          setName(d.full_name);
          setPhone(d.phone ?? '');
          setLicenseNo(d.license_no ?? '');
          setLicenseExpiry(d.license_expiry ? formatDate(d.license_expiry) : '');
          setDateStarted(d.date_started ? formatDate(d.date_started) : '');
          setStatus(d.status);
        }
        setLoaded(true);
      });
  }, [editing, id]);

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Driver name is required';
    const expiryISO = licenseExpiry.trim() ? parseDMY(licenseExpiry) : null;
    if (licenseExpiry.trim() && !expiryISO) errs.licenseExpiry = 'Use DD/MM/YYYY';
    const startedISO = dateStarted.trim() ? parseDMY(dateStarted) : null;
    if (dateStarted.trim() && !startedISO) errs.dateStarted = 'Use DD/MM/YYYY';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true);
    const payload = {
      full_name: name.trim(),
      phone: phone.trim() || null,
      license_no: licenseNo.trim() || null,
      license_expiry: expiryISO,
      date_started: startedISO,
      status,
    };
    const { error } = editing
      ? await supabase.from('drivers').update(payload).eq('id', id)
      : await supabase.from('drivers').insert(payload);
    setBusy(false);

    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }
    router.back();
  };

  if (role !== 'owner') {
    return (
      <Screen bottomInset={spacing.xl}>
        <ScreenHeader title={editing ? 'Edit driver' : 'Add driver'} />
        <Card>
          <Text style={type.body}>Only the owner can manage drivers.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader title={editing ? 'Edit driver' : 'Add driver'} />

      {loaded && (
        <Card style={styles.form}>
          <Input
            label="Full name"
            placeholder="e.g. John Kaupa"
            value={name}
            onChangeText={setName}
            error={errors.name}
          />
          <Input
            label="Phone"
            placeholder="+675 7XXX XXXX"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <View style={styles.row}>
            <Input
              label="License number"
              placeholder="L-00000"
              autoCapitalize="characters"
              value={licenseNo}
              onChangeText={setLicenseNo}
              containerStyle={styles.flex}
            />
            <Input
              label="License expiry"
              placeholder="DD/MM/YYYY"
              keyboardType="numbers-and-punctuation"
              value={licenseExpiry}
              onChangeText={setLicenseExpiry}
              error={errors.licenseExpiry}
              containerStyle={styles.flex}
            />
          </View>
          <Input
            label="Date started"
            placeholder="DD/MM/YYYY"
            keyboardType="numbers-and-punctuation"
            value={dateStarted}
            onChangeText={setDateStarted}
            error={errors.dateStarted}
          />

          {editing && (
            <View>
              <Text style={styles.pickerLabel}>Status</Text>
              <Segmented<DriverStatus>
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                  { value: 'suspended', label: 'Suspended' },
                ]}
                value={status}
                onChange={setStatus}
              />
            </View>
          )}

          <Button
            title={editing ? 'Save changes' : 'Add driver'}
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
});
