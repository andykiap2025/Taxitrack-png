import {
  BarChart3,
  ChevronRight,
  LogOut,
  Settings,
  Siren,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';
import React from 'react';
import { useRouter } from 'expo-router';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, Screen } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { colors, font, radius, spacing, type } from '@/lib/theme';

type MenuItem = {
  icon: LucideIcon;
  label: string;
  caption: string;
  soon?: boolean;
  ownerOnly?: boolean;
  staffOnly?: boolean;
  onPress?: () => void;
};

export default function MoreScreen() {
  const { profile, role, signOut } = useAuth();
  const router = useRouter();

  const initials = (profile?.full_name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const items: MenuItem[] = [
    {
      icon: Wrench,
      label: 'Service & Compliance',
      caption: 'Rego, stickers, MVIL, licenses',
      staffOnly: true,
      onPress: () => router.push('/compliance'),
    },
    {
      icon: Siren,
      label: 'Incidents',
      caption: 'Accidents, fines, damage — with photos',
      staffOnly: true,
      onPress: () => router.push('/incidents'),
    },
    {
      icon: BarChart3,
      label: 'Reports',
      caption: 'Profitability, trends, rankings',
      staffOnly: true,
      onPress: () => router.push('/reports'),
    },
    {
      icon: Settings,
      label: 'Settings',
      caption: 'Rates, targets, policies',
      ownerOnly: true,
      onPress: () => router.push('/settings'),
    },
  ];

  const confirmSignOut = () => {
    if (Platform.OS === 'web') {
      signOut();
      return;
    }
    Alert.alert('Sign out', 'Sign out of TaxiTrack PNG?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const visibleItems = items
    .filter((i) => !i.ownerOnly || role === 'owner')
    .filter((i) => !i.staffOnly || role === 'owner' || role === 'supervisor');

  return (
    <Screen title="More">
      <Card>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={type.cardTitle}>{profile?.full_name || '—'}</Text>
            <Badge
              label={role ? role.charAt(0).toUpperCase() + role.slice(1) : '—'}
              tone={role === 'owner' ? 'info' : 'neutral'}
            />
          </View>
        </View>
      </Card>

      {visibleItems.length > 0 && (
      <Card padded={false}>
        {visibleItems.map((item, idx, arr) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={item.label}
                onPress={item.onPress}
                disabled={item.soon}
                style={({ pressed }) => [
                  styles.menuItem,
                  idx < arr.length - 1 && styles.menuDivider,
                  pressed && styles.menuPressed,
                ]}
              >
                <View style={styles.menuIcon}>
                  <Icon color={colors.primary} size={20} />
                </View>
                <View style={styles.menuText}>
                  <Text style={type.bodyMedium}>{item.label}</Text>
                  <Text style={type.caption}>{item.caption}</Text>
                </View>
                {item.soon ? (
                  <Badge label="Soon" tone="neutral" />
                ) : (
                  <ChevronRight color={colors.textMuted} size={18} />
                )}
              </Pressable>
            );
          })}
      </Card>
      )}

      <Button
        title="Sign out"
        variant="danger"
        fullWidth
        icon={<LogOut color={colors.danger} size={18} />}
        onPress={confirmSignOut}
      />

      <Text style={styles.version}>TaxiTrack PNG v1.0.0 · Skyworks Communication and Computing</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: font.bold,
    fontSize: 17,
    color: colors.onPrimary,
  },
  profileInfo: {
    gap: spacing.xxs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  menuDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    flex: 1,
    gap: 1,
  },
  version: {
    ...type.caption,
    textAlign: 'center',
  },
});
