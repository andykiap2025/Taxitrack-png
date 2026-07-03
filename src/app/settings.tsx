import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

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
import { supabase } from '@/lib/supabase';
import { colors, font, spacing, type } from '@/lib/theme';
import type { AppSettings, ShortfallPolicy, SurplusPolicy } from '@/types/db';

const SHORTFALL_HELP: Record<ShortfallPolicy, string> = {
  deduct: 'Shortfalls are deducted from the fortnightly pay (after surplus offsets).',
  carry_forward: 'Shortfalls carry to the next fortnight instead of being deducted.',
  flag_only: 'Shortfalls are only flagged — never deducted automatically.',
};

const SURPLUS_HELP: Record<SurplusPolicy, string> = {
  offset: 'A strong day cancels a weak day: surpluses offset shortfalls within the fortnight; only the net shortfall is deducted.',
  pay_through: 'No special treatment — surplus already increases pay through the 29% of gross.',
  bonus: 'On top of normal pay, surplus earns an extra bonus percentage set below.',
};

export default function SettingsScreen() {
  const { role } = useAuth();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [commission, setCommission] = useState('29');
  const [targetStd, setTargetStd] = useState('180');
  const [targetNew, setTargetNew] = useState('210');
  const [shortfallPolicy, setShortfallPolicy] = useState<ShortfallPolicy>('deduct');
  const [surplusPolicy, setSurplusPolicy] = useState<SurplusPolicy>('offset');
  const [bonusRate, setBonusRate] = useState('0');
  const [carryForward, setCarryForward] = useState(false);
  const [checkinTime, setCheckinTime] = useState('23:00');
  const [graceMin, setGraceMin] = useState('30');

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        const s = data as AppSettings | null;
        if (s) {
          setCommission(String(Math.round(s.commission_rate * 10000) / 100));
          setTargetStd(String(s.target_standard));
          setTargetNew(String(s.target_new));
          setShortfallPolicy(s.shortfall_policy);
          setSurplusPolicy(s.surplus_policy);
          setBonusRate(String(Math.round(s.surplus_bonus_rate * 10000) / 100));
          setCarryForward(s.carry_forward_balance);
          setCheckinTime(s.checkin_time.slice(0, 5));
          setGraceMin(String(s.checkin_grace_minutes));
        }
        setLoading(false);
      });
  }, []);

  const save = async () => {
    const commissionNum = Number(commission);
    const bonusNum = Number(bonusRate);
    const stdNum = Number(targetStd);
    const newNum = Number(targetNew);
    const graceNum = Number(graceMin);

    if (!Number.isFinite(commissionNum) || commissionNum <= 0 || commissionNum >= 100) {
      Alert.alert('Check commission', 'Commission must be a percentage between 0 and 100.');
      return;
    }
    if (!Number.isFinite(stdNum) || stdNum <= 0 || !Number.isFinite(newNum) || newNum <= 0) {
      Alert.alert('Check targets', 'Daily targets must be positive amounts.');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(checkinTime.trim())) {
      Alert.alert('Check check-in time', 'Use 24h HH:MM format, e.g. 23:00.');
      return;
    }

    setBusy(true);
    const { error } = await supabase
      .from('app_settings')
      .update({
        commission_rate: commissionNum / 100,
        target_standard: stdNum,
        target_new: newNum,
        shortfall_policy: shortfallPolicy,
        surplus_policy: surplusPolicy,
        surplus_bonus_rate: (Number.isFinite(bonusNum) ? bonusNum : 0) / 100,
        carry_forward_balance: carryForward,
        checkin_time: `${checkinTime.trim()}:00`,
        checkin_grace_minutes: Number.isFinite(graceNum) ? Math.round(graceNum) : 30,
      })
      .eq('id', 1);
    setBusy(false);
    if (error) {
      Alert.alert('Could not save settings', error.message);
      return;
    }
    Alert.alert('Saved', 'Settings updated. Existing records keep their snapshotted rates.');
  };

  if (role !== 'owner') {
    return (
      <Screen bottomInset={spacing.xl}>
        <ScreenHeader title="Settings" />
        <Card>
          <Text style={type.body}>Only the owner can change settings.</Text>
        </Card>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen bottomInset={spacing.xl}>
        <ScreenHeader title="Settings" />
        <SkeletonCard />
        <SkeletonCard />
      </Screen>
    );
  }

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader title="Settings" subtitle="Rates, targets & policies" />

      <Text style={type.sectionTitle}>Pay</Text>
      <Card style={styles.form}>
        <Input
          label="Driver commission (% of gross takings)"
          keyboardType="decimal-pad"
          value={commission}
          onChangeText={setCommission}
          suffix={<Text style={styles.suffix}>%</Text>}
          hint="Applied per fortnight. Snapshotted on each pay period — past payrolls never change."
        />
      </Card>

      <Text style={type.sectionTitle}>Daily targets</Text>
      <Card style={styles.form}>
        <View style={styles.row}>
          <Input
            label="Standard vehicle"
            keyboardType="decimal-pad"
            value={targetStd}
            onChangeText={setTargetStd}
            prefix={<Text style={styles.suffix}>K</Text>}
            containerStyle={styles.flex}
          />
          <Input
            label="Newer vehicle"
            keyboardType="decimal-pad"
            value={targetNew}
            onChangeText={setTargetNew}
            prefix={<Text style={styles.suffix}>K</Text>}
            containerStyle={styles.flex}
          />
        </View>
        <Text style={type.caption}>
          Defaults for new vehicles only — each vehicle keeps its own target, and past
          entries keep the target they were recorded with.
        </Text>
      </Card>

      <Text style={type.sectionTitle}>Shortfall policy</Text>
      <Card style={styles.form}>
        <Segmented<ShortfallPolicy>
          options={[
            { value: 'deduct', label: 'Deduct' },
            { value: 'carry_forward', label: 'Carry' },
            { value: 'flag_only', label: 'Flag only' },
          ]}
          value={shortfallPolicy}
          onChange={setShortfallPolicy}
        />
        <Text style={type.caption}>{SHORTFALL_HELP[shortfallPolicy]}</Text>
      </Card>

      <Text style={type.sectionTitle}>Surplus policy</Text>
      <Card style={styles.form}>
        <Segmented<SurplusPolicy>
          options={[
            { value: 'offset', label: 'Offset' },
            { value: 'pay_through', label: 'Pay-through' },
            { value: 'bonus', label: 'Bonus' },
          ]}
          value={surplusPolicy}
          onChange={setSurplusPolicy}
        />
        <Text style={type.caption}>{SURPLUS_HELP[surplusPolicy]}</Text>
        {surplusPolicy === 'bonus' && (
          <Input
            label="Bonus rate (% of surplus)"
            keyboardType="decimal-pad"
            value={bonusRate}
            onChangeText={setBonusRate}
            suffix={<Text style={styles.suffix}>%</Text>}
            hint="Surplus is already in gross takings — the bonus is extra on top, never double-counted."
          />
        )}
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={type.bodyMedium}>Carry balance across fortnights</Text>
            <Text style={type.caption}>
              Unused credits (or unresolved shortfalls) roll into the next pay period.
            </Text>
          </View>
          <Switch
            value={carryForward}
            onValueChange={setCarryForward}
            trackColor={{ true: colors.primary, false: colors.borderStrong }}
            thumbColor={colors.surface}
          />
        </View>
      </Card>

      <Text style={type.sectionTitle}>Nightly check-in</Text>
      <Card style={styles.form}>
        <View style={styles.row}>
          <Input
            label="Check-in time (24h)"
            placeholder="23:00"
            value={checkinTime}
            onChangeText={setCheckinTime}
            containerStyle={styles.flex}
          />
          <Input
            label="Grace (minutes)"
            keyboardType="number-pad"
            value={graceMin}
            onChangeText={setGraceMin}
            containerStyle={styles.flex}
          />
        </View>
        <Text style={type.caption}>
          Drivers not checked in by {checkinTime || '23:00'} + grace are flagged as missed.
        </Text>
      </Card>

      <Button title="Save settings" fullWidth loading={busy} onPress={save} />
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
  suffix: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.textSecondary,
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
