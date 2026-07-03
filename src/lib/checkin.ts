/**
 * Check-in data loading with an offline cache, plus business-time rules.
 * The 11pm check-in must work with no connectivity: the fleet bundle and
 * the night's entries are cached on every successful load, and reads fall
 * back to cache when the network is down.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { nowPOMMinutes, todayISO } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { CheckinStatus, DailyTakings, Driver, Vehicle } from '@/types/db';

const BUNDLE_KEY = 'taxitrack.checkin.bundle';
const TAKINGS_KEY = (date: string) => `taxitrack.checkin.takings.${date}`;

export type CheckinBundle = {
  drivers: Driver[];
  vehicles: Vehicle[];
  /** driver_id → vehicle_id for current (open) assignments. */
  assignments: Record<string, string>;
  /** vehicle ids with an open downtime entry — targets suppressed. */
  downtimeVehicleIds: string[];
};

export async function loadBundle(): Promise<{ bundle: CheckinBundle | null; fromCache: boolean; error: string | null }> {
  try {
    const [d, v, a, dt] = await Promise.all([
      supabase.from('drivers').select('*').eq('status', 'active').order('full_name'),
      supabase.from('vehicles').select('*').neq('status', 'retired').order('plate_no'),
      supabase.from('assignments').select('driver_id, vehicle_id').is('end_date', null),
      supabase.from('downtime_log').select('vehicle_id').is('end_date', null),
    ]);
    const error = d.error ?? v.error ?? a.error ?? dt.error;
    if (error) throw new Error(error.message);

    const assignments: Record<string, string> = {};
    for (const row of (a.data ?? []) as { driver_id: string; vehicle_id: string }[]) {
      assignments[row.driver_id] = row.vehicle_id;
    }
    const bundle: CheckinBundle = {
      drivers: (d.data ?? []) as Driver[],
      vehicles: (v.data ?? []) as Vehicle[],
      assignments,
      downtimeVehicleIds: ((dt.data ?? []) as { vehicle_id: string }[]).map((r) => r.vehicle_id),
    };
    AsyncStorage.setItem(BUNDLE_KEY, JSON.stringify(bundle)).catch(() => {});
    return { bundle, fromCache: false, error: null };
  } catch (err) {
    const cached = await AsyncStorage.getItem(BUNDLE_KEY);
    if (cached) return { bundle: JSON.parse(cached), fromCache: true, error: null };
    return { bundle: null, fromCache: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function loadTakingsForDate(
  date: string,
): Promise<{ rows: DailyTakings[]; fromCache: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase.from('daily_takings').select('*').eq('date', date);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as DailyTakings[];
    AsyncStorage.setItem(TAKINGS_KEY(date), JSON.stringify(rows)).catch(() => {});
    return { rows, fromCache: false, error: null };
  } catch (err) {
    const cached = await AsyncStorage.getItem(TAKINGS_KEY(date));
    if (cached) return { rows: JSON.parse(cached), fromCache: true, error: null };
    return { rows: [], fromCache: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Default business date for entry: just after midnight the crew is still
 * closing out the previous night, so before 4am default to yesterday.
 */
export function defaultBusinessDate(): string {
  const today = todayISO();
  if (nowPOMMinutes() < 4 * 60) {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  return today;
}

/** on_time until 23:30 POM on the business night; anything later is late. */
export function computeCheckinStatus(businessDate: string): CheckinStatus {
  if (businessDate === todayISO() && nowPOMMinutes() <= 23 * 60 + 30) return 'on_time';
  return 'late';
}

/** Locked after 24h (or explicit lock), unless inside an owner unlock window. */
export function isTakingsLocked(t: Pick<DailyTakings, 'locked' | 'created_at' | 'unlocked_until'>): boolean {
  if (t.unlocked_until && new Date(t.unlocked_until).getTime() > Date.now()) return false;
  if (t.locked) return true;
  return Date.now() - new Date(t.created_at).getTime() > 24 * 60 * 60 * 1000;
}
