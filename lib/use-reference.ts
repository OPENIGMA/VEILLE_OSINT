'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchThemes } from '@/lib/api';
import { getSupabase } from '@/lib/supabase/client';
import type { SourceRss, Theme } from '@/lib/types';

// Référentiels quasi statiques : un seul chargement par visite
let themesCache: Theme[] | null = null;
let sourcesCache: SourceRss[] | null = null;

export function useThemes() {
  const [themes, setThemes] = useState<Theme[]>(themesCache ?? []);
  useEffect(() => {
    if (themesCache) return;
    let active = true;
    fetchThemes()
      .then((t) => {
        themesCache = t;
        if (active) setThemes(t);
      })
      .catch(() => {
        /* la recherche reste utilisable sans les libellés */
      });
    return () => {
      active = false;
    };
  }, []);
  const themeMap = useMemo(() => new Map(themes.map((t) => [t.slug, t])), [themes]);
  return { themes, themeMap };
}

export function useSources(): SourceRss[] {
  const [sources, setSources] = useState<SourceRss[]>(sourcesCache ?? []);
  useEffect(() => {
    if (sourcesCache) return;
    let active = true;
    getSupabase()
      .from('sources_rss')
      .select('id,name,feed_url,site_url,kind,scope,territory_ids,themes,language,fetch_interval_minutes,is_active')
      .eq('is_active', true)
      .order('name')
      .limit(60)
      .then(({ data }) => {
        if (!active || !data) return;
        sourcesCache = data as SourceRss[];
        setSources(sourcesCache);
      });
    return () => {
      active = false;
    };
  }, []);
  return sources;
}
