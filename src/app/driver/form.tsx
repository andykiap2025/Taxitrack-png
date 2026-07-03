import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChevronDown } from 'lucide-react-native';

import { PhotoPicker, type PickedPhoto } from '@/components/PhotoPicker';
import {
  Button,
  Card,
  Input,
  Screen,
  ScreenHeader,
  Segmented,
  Sheet,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { formatDate, parseDMY } from '@/lib/format';
import { PNG_PROVINCES } from '@/lib/labels';
import { uploadBase64 } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing, type } from '@/lib/theme';
import type { Driver, DriverStatus, Profile } from '@/types/db';

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
  const [loginUserId, setLoginUserId] = useState<string | null>(null);
  const [loginOptions, setLoginOptions] = useState<Profile[]>([]);
  const [province, setProvince] = useState<string | null>(null);
  const [residence, setResidence] = useState('');
  const [facePhoto, setFacePhoto] = useState<PickedPhoto | null>(null);
  const [licensePhoto, setLicensePhoto] = useState<PickedPhoto | null>(null);
  const [existing, setExisting] = useState<Driver | null>(null);
  const [provinceOpen, setProvinceOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!editing);

  const existingFaceUrl = useSignedUrl('fleet-photos', existing?.photo_url);
  const existingLicenseUrl = useSignedUrl('fleet-photos', existing?.license_photo_url);

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
          setLoginUserId(d.user_id);
          setProvince(d.province);
          setResidence(d.residence ?? '');
          setExisting(d);
        }
        setLoaded(true);
      });
  }, [editing, id]);

  // Driver-role logins not yet linked to another driver (owner links them
  // here so the driver can see their own takings and payslips).
  useEffect(() => {
    if (role !== 'owner') return;
    Promise.all([
      supabase.from('profiles').select('*').eq('role', 'driver'),
      supabase.from('drivers').select('id, user_id').not('user_id', 'is', null),
    ]).then(([p, d]) => {
      const taken = new Set(
        ((d.data ?? []) as { id: string; user_id: string }[])
          .filter((x) => x.id !== id)
          .map((x) => x.user_id),
      );
      setLoginOptions(((p.data ?? []) as Profile[]).filter((x) => !taken.has(x.id)));
    });
  }, [role, id]);

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
      user_id: loginUserId,
      province,
      residence: residence.trim() || null,
    };

    // Save the record first so photos have an id to live under.
    let driverId = id ?? null;
    if (editing) {
      const { error } = await supabase.from('drivers').update(payload).eq('id', id);
      if (error) {
        setBusy(false);
        Alert.alert('Could not save', error.message);
        return;
      }
    } else {
      const { data, error } = await supabase.from('drivers').insert(payload).select('id').single();
      if (error) {
        setBusy(false);
        Alert.alert('Could not save', error.message);
        return;
      }
      driverId = (data as { id: string }).id;
    }

    // Upload any picked photos, then attach their paths.
    const patch: Record<string, string> = {};
    if (facePhoto && driverId) {
      const path = `drivers/${driverId}/face-${Date.now()}.jpg`;
      const err = await uploadBase64('fleet-photos', path, facePhoto.base64, 'image/jpeg');
      if (err) {
        setBusy(false);
        Alert.alert('Photo upload failed', err);
        return;
      }
      patch.photo_url = path;
    }
    if (licensePhoto && driverId) {
      const path = `drivers/${driverId}/license-${Date.now()}.jpg`;
      const err = await uploadBase64('fleet-photos', path, licensePhoto.base64, 'image/jpeg');
      if (err) {
        setBusy(false);
        Alert.alert('License photo upload failed', err);
        return;
      }
      patch.license_photo_url = path;
    }
    if (Object.keys(patch).length > 0 && driverId) {
      const { error } = await supabase.from('drivers').update(patch).eq('id', driverId);
      if (error) {
        setBusy(false);
        Alert.alert('Could not attach photos', error.message);
        return;
      }
    }

    setBusy(false);
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
          <PhotoPicker
            label="Driver photo"
            photo={facePhoto}
            onPicked={setFacePhoto}
            existingUrl={existingFaceUrl}
            square
          />
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

          <View>
            <Text style={styles.pickerLabel}>Province of origin</Text>
            <Pressable
              onPress={() => setProvinceOpen(true)}
              style={({ pressed }) => [styles.selectField, pressed && { backgroundColor: colors.surfaceMuted }]}
            >
              <Text style={province ? styles.selectValue : styles.selectPlaceholder}>
                {province ?? 'Select province'}
              </Text>
              <ChevronDown color={colors.textMuted} size={18} />
            </Pressable>
          </View>
          <Input
            label="Place of residence"
            placeholder="e.g. Gerehu Stage 4, Port Moresby"
            value={residence}
            onChangeText={setResidence}
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
          <PhotoPicker
            label="License photo"
            photo={licensePhoto}
            onPicked={setLicensePhoto}
            existingUrl={existingLicenseUrl}
          />
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

          <View>
            <Text style={styles.pickerLabel}>App login (optional)</Text>
            {loginOptions.length === 0 && !loginUserId ? (
              <Text style={type.caption}>
                No driver logins available. Create one with scripts/create-users.mjs
                (see supabase/README.md), then link it here so the driver can view
                their own takings and payslips.
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chips}>
                  <Pressable
                    onPress={() => setLoginUserId(null)}
                    style={[styles.chip, loginUserId === null && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, loginUserId === null && styles.chipTextActive]}>
                      No login
                    </Text>
                  </Pressable>
                  {loginOptions.map((p) => {
                    const active = p.id === loginUserId;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => setLoginUserId(p.id)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {p.full_name || 'Driver account'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>

          <Button
            title={editing ? 'Save changes' : 'Add driver'}
            fullWidth
            loading={busy}
            onPress={save}
          />
        </Card>
      )}

      <Sheet visible={provinceOpen} onClose={() => setProvinceOpen(false)} title="Province of origin">
        <ScrollView style={styles.provinceList}>
          {PNG_PROVINCES.map((p) => (
            <Pressable
              key={p}
              onPress={() => {
                setProvince(p);
                setProvinceOpen(false);
              }}
              style={({ pressed }) => [
                styles.provinceRow,
                pressed && { backgroundColor: colors.surfaceMuted },
              ]}
            >
              <Text style={[type.bodyMedium, province === p && { color: colors.info }]}>{p}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
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
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  selectValue: {
    fontFamily: font.medium,
    fontSize: 16,
    color: colors.text,
  },
  selectPlaceholder: {
    fontFamily: font.medium,
    fontSize: 16,
    color: colors.textMuted,
  },
  provinceList: {
    maxHeight: 420,
  },
  provinceRow: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
