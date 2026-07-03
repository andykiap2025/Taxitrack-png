import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

type Fetcher<T> = () => PromiseLike<{ data: T | null; error: { message: string } | null }>;

type Result<T> = {
  data: T | null;
  /** True only on the very first load (no data yet). */
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  refreshing: boolean;
  /** Pull-to-refresh variant: keeps current data visible while reloading. */
  refresh: () => Promise<void>;
};

/**
 * Small focus-aware fetch hook: loads on screen focus (so lists refresh
 * after add/edit), exposes pull-to-refresh state. `deps` restart the query.
 */
export function useSupabaseQuery<T>(fetcher: Fetcher<T>, deps: unknown[] = []): Result<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    try {
      const { data: d, error: e } = await fetcherRef.current();
      if (e) {
        setError(e.message);
      } else {
        setData(d);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return {
    data,
    loading: loading && data === null,
    error,
    refetch: () => load(),
    refreshing,
    refresh: () => load(true),
  };
}
