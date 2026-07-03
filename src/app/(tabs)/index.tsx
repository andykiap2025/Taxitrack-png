import { LinearGradient } from 'expo-linear-gradient';
import { CarTaxiFront, ClipboardList } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, EmptyState, Screen } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { formatDateLong, todayISO } from '@/lib/format';
import { colors, font, gradients, radius, shadow, spacing } from '@/lib/theme';

/**
 * Dashboard shell — the live check-in board and takings stats land in
 * Phase 6; reports complete it in Phase 12.
 */
export default function Dashboard() {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  return (
    <Screen>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, shadow.raised]}
      >
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroGreeting}>Hi {firstName} 👋</Text>
            <Text style={styles.heroDate}>{formatDateLong(todayISO())} · Port Moresby</Text>
          </View>
          <View style={styles.heroLogo}>
            <CarTaxiFront color={colors.accent} size={24} />
          </View>
        </View>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Tonight's takings</Text>
            <Text style={styles.heroStatValue}>—</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Checked in</Text>
            <Text style={styles.heroStatValue}>—</Text>
          </View>
        </View>
      </LinearGradient>

      <Card padded={false}>
        <EmptyState
          icon={<ClipboardList color={colors.textMuted} size={30} />}
          title="No activity yet"
          message="Tonight's check-in board, takings vs targets and alerts will appear here."
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroGreeting: {
    fontFamily: font.extrabold,
    fontSize: 24,
    color: colors.textOnDark,
  },
  heroDate: {
    fontFamily: font.medium,
    fontSize: 13,
    color: colors.textOnDarkMuted,
    marginTop: 2,
  },
  heroLogo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  heroStat: { flex: 1, gap: 2 },
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
});
