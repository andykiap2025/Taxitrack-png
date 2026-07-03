import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** False until .env carries the project keys (see supabase/README.md). */
export const isSupabaseConfigured = url.length > 0 && anonKey.length > 0;

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder', {
      auth: {
        ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

/**
 * Shared Supabase client. Constructed lazily on first property access:
 * eager construction crashes Expo's static web export (the Node renderer
 * has no WebSocket for supabase realtime). Session persists in
 * AsyncStorage on native; web uses supabase-js defaults.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const value = getClient()[prop as keyof SupabaseClient];
    return typeof value === 'function' ? (value as Function).bind(client) : value;
  },
});
