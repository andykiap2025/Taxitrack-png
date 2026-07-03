import {
  Banknote,
  CarFront,
  ClipboardCheck,
  LayoutDashboard,
  Menu,
  type LucideIcon,
} from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { colors, font, radius, shadow, spacing } from '@/lib/theme';
import type { UserRole } from '@/types/db';

type TabDef = {
  name: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
};

/**
 * Structural subset of the navigator's tabBar props — expo-router v57
 * vendors react-navigation, so we avoid importing its internal types.
 */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

const TABS: TabDef[] = [
  { name: 'index', label: 'Home', icon: LayoutDashboard, roles: ['owner', 'supervisor', 'driver'] },
  { name: 'checkin', label: 'Check-in', icon: ClipboardCheck, roles: ['owner', 'supervisor'] },
  { name: 'fleet', label: 'Fleet', icon: CarFront, roles: ['owner', 'supervisor'] },
  { name: 'payroll', label: 'Payroll', icon: Banknote, roles: ['owner'] },
  { name: 'more', label: 'More', icon: Menu, roles: ['owner', 'supervisor', 'driver'] },
];

/** Floating rounded bottom navigation, filtered by the user's role. */
export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { role } = useAuth();

  const visible = TABS.filter((t) => role && t.roles.includes(role));
  const activeName = state.routes[state.index]?.name;

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View style={[styles.bar, shadow.raised]}>
        {visible.map((tab) => {
          const active = activeName === tab.name;
          const Icon = tab.icon;
          return (
            <Pressable
              key={tab.name}
              onPress={() => navigation.navigate(tab.name as never)}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                <Icon size={21} color={active ? colors.onAccent : colors.textOnDarkMuted} />
              </View>
              <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    backgroundColor: 'transparent',
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  iconWrap: {
    width: 46,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.accent,
  },
  label: {
    fontFamily: font.semibold,
    fontSize: 11,
    color: colors.textOnDarkMuted,
  },
  labelActive: {
    color: colors.textOnDark,
  },
});
