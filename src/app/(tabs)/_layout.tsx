import { Tabs } from 'expo-router';
import React from 'react';

import { TabBar } from '@/components/TabBar';
import { useAuth } from '@/hooks/useAuth';

export default function TabsLayout() {
  const { role, session } = useAuth();

  // Wait for the role before drawing tabs (profile loads once per session,
  // then comes from cache offline).
  if (session && !role) return null;

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="checkin" />
      <Tabs.Screen name="fleet" />
      <Tabs.Screen name="payroll" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}
