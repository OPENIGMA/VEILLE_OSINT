'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/api';
import type { AlertRow, FavoriteRow, SavedSearch } from '@/lib/types';

interface Loaded<T> {
  rows: T[];
  loading: boolean;
  error: string;
  reload: () => void;
}

function useRows<T>(fetcher: () => PromiseLike<{ data: unknown; error: { message: string } | null }>): Loaded<T> {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.resolve(fetcher()).then(
      ({ data, error: e }) => {
        if (!active) return;
        if (e) setError(friendlyError(e));
        else {
          setError('');
          setRows((data as T[]) ?? []);
        }
        setLoading(false);
      },
      (e) => {
        if (!active) return;
        setError(friendlyError(e));
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  return { rows, loading, error, reload };
}

const SEARCH_COLS = 'id,name,query,filters,is_saved,created_at';

export function useSavedSearches() {
  return useRows<SavedSearch>(() =>
    getSupabase().from('searches').select(SEARCH_COLS).eq('is_saved', true).order('created_at', { ascending: false }).limit(100),
  );
}

export function useHistory() {
  return useRows<SavedSearch>(() =>
    getSupabase().from('searches').select(SEARCH_COLS).eq('is_saved', false).order('created_at', { ascending: false }).limit(100),
  );
}

export function useFavorites() {
  return useRows<FavoriteRow>(() =>
    getSupabase().from('favorites').select('id,target_type,target_id,note,created_at').order('created_at', { ascending: false }).limit(1000),
  );
}

export interface AlertWithSearch extends AlertRow {
  search: { name: string | null; query: string } | null;
}

export function useAlerts() {
  return useRows<AlertWithSearch>(() =>
    getSupabase()
      .from('alerts')
      .select('id,search_id,name,frequency,is_active,last_sent_at,created_at,search:searches(name,query)')
      .order('created_at', { ascending: false })
      .limit(50),
  );
}
