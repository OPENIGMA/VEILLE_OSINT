'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';

type Table = 'articles_rss' | 'datasets_datagouv' | 'threats';

/** Compte les lignes d'une table (lecture publique, RLS). null = indisponible. */
async function count(table: Table): Promise<number | null> {
  const { count: c, error } = await getSupabase().from(table).select('*', { count: 'exact', head: true });
  return error ? null : c;
}

export interface Counts {
  articles: number | null;
  datasets: number | null;
  threats: number | null;
  critical: number | null;
  loading: boolean;
}

export function useCounts(): Counts {
  const [state, setState] = useState<Counts>({ articles: null, datasets: null, threats: null, critical: null, loading: true });
  useEffect(() => {
    let active = true;
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    (async () => {
      const supabase = getSupabase();
      const [articles, datasets, threats, crit] = await Promise.all([
        count('articles_rss'),
        count('datasets_datagouv'),
        count('threats'),
        supabase
          .from('threats')
          .select('*', { count: 'exact', head: true })
          .in('severity', ['eleve', 'critique'])
          .gte('published_at', since)
          .then(({ count: c, error }) => (error ? null : c)),
      ]);
      if (active) setState({ articles, datasets, threats, critical: crit, loading: false });
    })();
    return () => {
      active = false;
    };
  }, []);
  return state;
}
