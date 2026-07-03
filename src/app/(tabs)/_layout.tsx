import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';

import { TabBar } from '@/components/TabBar';
import { useAuth } from '@/hooks/useAuth';
import { setupStaffNotifications } from '@/lib/notifications';

export default function TabsLayout() {
  const { role, session } = useAuth();

  // Nightly 23:30 reminder + compliance expiry alerts for staff.
  useEffect(() => {
    if (role === 'owner' || role === 'supervisor') setupStaffNotifications();
  }, [role]);

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
