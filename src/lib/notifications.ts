/**
 * Local notification scheduling (no push server needed):
 * - nightly 23:30 reminder to review the check-in board (missed check-in
 *   escalation per spec)
 * - compliance expiry alerts at the 30/14/7-day marks and on expiry day
 *
 * Rescheduled from scratch on each app open so the alerts always reflect
 * the current documents.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { daysUntil } from '@/lib/alerts';
import { DOC_TYPE_LABELS } from '@/lib/alerts';
import { supabase } from '@/lib/supabase';

const THRESHOLDS = [30, 14, 7, 0];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let scheduledThisSession = false;

/** Call once per session for owner/supervisor. Safe to re-call. */
export async function setupStaffNotifications(): Promise<void> {
  if (Platform.OS === 'web' || scheduledThisSession) return;
  scheduledThisSession = true;

  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Safeco Taxi alerts',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    await Notifications.cancelAllScheduledNotificationsAsync();

    // Nightly check-in reminder at the 23:30 escalation time.
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Safeco Taxi — 11:30pm check',
        body: 'Review tonight’s board: any taxis not checked in yet?',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 23,
        minute: 30,
      },
    });

    // Compliance expiry alerts.
    const { data } = await supabase
      .from('compliance_docs')
      .select(
        'doc_type, expiry_date, vehicle:vehicles(plate_no), driver:drivers(full_name)',
      )
      .gte('expiry_date', new Date().toISOString().slice(0, 10));

    type DocRow = {
      doc_type: string;
      expiry_date: string;
      vehicle: { plate_no: string } | null;
      driver: { full_name: string } | null;
    };

    let scheduled = 0;
    for (const doc of (data ?? []) as unknown as DocRow[]) {
      if (scheduled >= 48) break; // OS limits on pending notifications
      const days = daysUntil(doc.expiry_date);
      const who = doc.vehicle?.plate_no ?? doc.driver?.full_name ?? '';
      const label = DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type;
      for (const t of THRESHOLDS) {
        const lead = days - t;
        if (lead < 0) continue; // threshold already passed
        const fireAt = new Date();
        fireAt.setDate(fireAt.getDate() + lead);
        fireAt.setHours(8, 0, 0, 0);
        if (fireAt.getTime() <= Date.now()) continue;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Safeco Taxi — ${label} ${t === 0 ? 'expires today' : `expires in ${t} days`}`,
            body: `${who}: ${label} expiry. Renew before the taxi is off the road.`,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fireAt,
          },
        });
        scheduled++;
        if (scheduled >= 48) break;
      }
    }
  } catch {
    // Notifications are best-effort — never block the app on them.
  }
}
