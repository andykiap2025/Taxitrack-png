import { LinearGradient } from 'expo-linear-gradient';
import {
  Banknote,
  CarTaxiFront,
  CheckCircle2,
  ClipboardList,
  Gauge,
  TrendingUp,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Screen,
  SkeletonCard,
  StatTile,
} from '@/components/ui';
import { formatDateLong, formatPGK, todayISO } from '@/lib/format';
import { colors, font, gradients, radius, shadow, spacing, type } from '@/lib/theme';

/**
 * Phase 1 design preview — verifies fonts, tokens and every core component.
 * Replaced by the real dashboard + auth routing in Phase 3.
 */
export default function DesignPreview() {
  const [amount, setAmount] = useState('');

  return (
    <Screen>
      {/* Hero header — the dashboard will use this pattern */}
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, shadow.raised]}
      >
        <View style={styles.heroBadgeRow}>
          <View style={styles.heroLogo}>
            <CarTaxiFront color={colors.accent} size={26} />
          </View>
          <Badge label="Phase 1 · Design preview" tone="warning" />
        </View>
        <Text style={styles.heroTitle}>TaxiTrack PNG</Text>
        <Text style={styles.heroSub}>{formatDateLong(todayISO())} · Port Moresby</Text>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Tonight's takings</Text>
            <Text style={styles.heroStatValue}>{formatPGK(1355)}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Checked in</Text>
            <Text style={styles.heroStatValue}>4 / 5</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Stat tiles */}
      <View style={styles.tileRow}>
        <StatTile
          label="Targets met"
          value="3 of 5"
          sub="2 drivers short"
          subColor={colors.warning}
          icon={<TrendingUp color={colors.primary} size={18} />}
        />
        <StatTile
          label="Fortnight gross"
          value={formatPGK(14820, { decimals: 0 })}
          sub="Day 9 of 14"
          icon={<Banknote color={colors.primary} size={18} />}
        />
      </View>

      {/* Sample list card — driver check-in row pattern */}
      <Text style={type.sectionTitle}>Components</Text>
      <Card onPress={() => {}}>
        <View style={styles.rowBetween}>
          <View style={styles.rowLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>JK</Text>
            </View>
            <View>
              <Text style={type.cardTitle}>John Kaupa</Text>
              <Text style={type.caption}>LAE 224 · Toyota Corolla</Text>
            </View>
          </View>
          <View style={styles.rowRight}>
            <Text style={styles.amount}>{formatPGK(210)}</Text>
            <Badge label="Target met" tone="success" dot />
          </View>
        </View>
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <View style={styles.rowLeft}>
            <View style={[styles.avatar, { backgroundColor: colors.dangerSoft }]}>
              <Text style={[styles.avatarText, { color: colors.danger }]}>PM</Text>
            </View>
            <View>
              <Text style={type.cardTitle}>Peter Mek</Text>
              <Text style={type.caption}>POM 118 · Nissan Tiida</Text>
            </View>
          </View>
          <View style={styles.rowRight}>
            <Text style={styles.amount}>{formatPGK(142)}</Text>
            <Badge label={`Short ${formatPGK(38, { decimals: 0 })}`} tone="danger" dot />
          </View>
        </View>
      </Card>

      {/* Badges */}
      <View style={styles.badgeRow}>
        <Badge label="On time" tone="success" />
        <Badge label="Due in 14 days" tone="warning" />
        <Badge label="Rego expired" tone="danger" />
        <Badge label="In service" tone="info" />
        <Badge label="Off road" tone="neutral" />
      </View>

      {/* Inputs */}
      <Input
        label="Amount declared"
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        prefix={<Text style={styles.currencyPrefix}>K</Text>}
        hint="Gross takings declared by the driver"
      />
      <Input
        label="Odometer reading"
        placeholder="e.g. 84,250"
        keyboardType="number-pad"
        suffix={<Gauge color={colors.textMuted} size={20} />}
        error="Odometer is required"
      />

      {/* Buttons */}
      <Button title="Save check-in" fullWidth icon={<CheckCircle2 color={colors.onAccent} size={18} />} />
      <View style={styles.buttonRow}>
        <Button title="Secondary" variant="secondary" size="md" />
        <Button title="Outline" variant="outline" size="md" />
        <Button title="Ghost" variant="ghost" size="md" />
      </View>

      {/* Loading + empty states */}
      <Text style={type.sectionTitle}>States</Text>
      <SkeletonCard />
      <Card padded={false}>
        <EmptyState
          icon={<ClipboardList color={colors.textMuted} size={30} />}
          title="No takings recorded tonight"
          message="Entries appear here as drivers check in at 11pm."
          actionLabel="Start check-in"
          onAction={() => {}}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.xxs,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  heroLogo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: font.extrabold,
    fontSize: 28,
    color: colors.textOnDark,
  },
  heroSub: {
    fontFamily: font.medium,
    fontSize: 13,
    color: colors.textOnDarkMuted,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  heroStat: {
    flex: 1,
    gap: 2,
  },
  heroDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: spacing.md,
  },
  heroStatLabel: {
    fontFamily: font.medium,
    fontSize: 12,
    color: colors.textOnDarkMuted,
  },
  heroStatValue: {
    fontFamily: font.extrabold,
    fontSize: 22,
    color: colors.textOnDark,
  },
  tileRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: spacing.xxs,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: font.bold,
    fontSize: 14,
    color: colors.success,
  },
  amount: {
    fontFamily: font.bold,
    fontSize: 17,
    color: colors.text,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  currencyPrefix: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.textSecondary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
