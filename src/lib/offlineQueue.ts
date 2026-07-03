/**
 * Offline mutation queue for daily takings.
 *
 * saveTakings() tries the server first; if the device is offline (or the
 * request fails on network grounds) the entry is stored in AsyncStorage
 * and replayed by flushQueue() — triggered on reconnect (expo-network
 * listener), app foreground, screen focus, and manual "sync now".
 *
 * Entries are upserts keyed on (driver_id, date), so replaying is
 * idempotent and a re-entry for the same driver/night simply overwrites
 * the queued value. Non-network failures (validation/RLS) are kept and
 * surfaced as `failed` so bad data never silently disappears.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { CheckinStatus } from '@/types/db';

const QUEUE_KEY = 'taxitrack.takings.queue';

export type TakingsUpsert = {
  date: string;
  driver_id: string;
  vehicle_id: string;
  is_relief_driver: boolean;
  amount_declared: number;
  amount_received: number;
  target_amount: number | null;
  odometer_reading: number | null;
  checkin_time: string;
  checkin_status: CheckinStatus;
  notes: string | null;
  entered_by: string | null;
};

export type QueuedItem = {
  /** driver|date — one queued entry per driver per night. */
  key: string;
  payload: TakingsUpsert;
  queuedAt: string;
  lastError?: string;
};

export type QueueState = {
  pending: QueuedItem[];
  syncing: boolean;
};

// ---------------------------------------------------------------- store

async function readQueue(): Promise<QueuedItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as QueuedItem[]) : [];
}

async function writeQueue(items: QueuedItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  emit();
}

// ---------------------------------------------------------------- events

const listeners = new Set<(state: QueueState) => void>();
let syncing = false;

async function emit() {
  const pending = await readQueue();
  const state: QueueState = { pending, syncing };
  listeners.forEach((fn) => fn(state));
}

export function subscribeQueue(fn: (state: QueueState) => void): () => void {
  listeners.add(fn);
  emit();
  return () => listeners.delete(fn);
}

export async function getQueueState(): Promise<QueueState> {
  return { pending: await readQueue(), syncing };
}

// ---------------------------------------------------------------- helpers

function looksLikeNetworkError(message: string): boolean {
  return /network|fetch|timeout|timed out|abort|socket|ENOTFOUND|ECONN/i.test(message);
}

async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return !!state.isConnected;
  } catch {
    return true; // assume online; the request itself will tell us
  }
}

async function upsertToServer(payload: TakingsUpsert): Promise<{ error: string | null; network: boolean }> {
  try {
    const { error } = await supabase
      .from('daily_takings')
      .upsert(payload, { onConflict: 'driver_id,date' });
    if (!error) return { error: null, network: false };
    return { error: error.message, network: looksLikeNetworkError(error.message) };
  } catch (err) {
    // Thrown (rather than returned) errors are transport-level failures.
    const message = err instanceof Error ? err.message : String(err);
    return { error: message, network: true };
  }
}

// ---------------------------------------------------------------- API

export type SaveResult =
  | { status: 'sent' }
  | { status: 'queued' }
  | { status: 'error'; message: string };

/** Save an entry: server first, queue on network failure. */
export async function saveTakings(payload: TakingsUpsert): Promise<SaveResult> {
  const key = `${payload.driver_id}|${payload.date}`;

  if (await isOnline()) {
    const { error, network } = await upsertToServer(payload);
    if (!error) return { status: 'sent' };
    if (!network) return { status: 'error', message: error };
  }

  const queue = await readQueue();
  const next = queue.filter((i) => i.key !== key);
  next.push({ key, payload, queuedAt: new Date().toISOString() });
  await writeQueue(next);
  return { status: 'queued' };
}

/** Replay queued entries. Network failures stay queued; other errors are kept and flagged. */
export async function flushQueue(): Promise<void> {
  if (syncing) return;
  const queue = await readQueue();
  if (queue.length === 0) return;
  if (!(await isOnline())) return;

  syncing = true;
  emit();
  try {
    const remaining: QueuedItem[] = [];
    for (const item of queue) {
      const { error, network } = await upsertToServer(item.payload);
      if (!error) continue;
      remaining.push({ ...item, lastError: error });
      if (network) {
        // Connection dropped mid-flush — keep the rest untouched.
        const idx = queue.indexOf(item);
        remaining.push(...queue.slice(idx + 1));
        break;
      }
    }
    await writeQueue(remaining);
  } finally {
    syncing = false;
    emit();
  }
}

/** Drop a failed queued entry (e.g. after the user reviews it). */
export async function discardQueued(key: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((i) => i.key !== key));
}

// ------------------------------------------------- background triggers

let started = false;

/** Idempotent: wires reconnect + app-foreground auto-sync. */
export function startQueueAutoFlush(): void {
  if (started) return;
  started = true;

  Network.addNetworkStateListener((s) => {
    if (s.isConnected) flushQueue();
  });
  AppState.addEventListener('change', (status) => {
    if (status === 'active') flushQueue();
  });
}
