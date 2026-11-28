import { getSupabase } from '@/lib/supabase/client';
import type { SearchHit, SearchParams, Territory, Theme } from '@/lib/types';

/** Message d'erreur lisible (sans détails techniques de la base). */
export function friendlyError(error: unknown): string {
  const msg = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : '';
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'Connexion à la base impossible. Vérifiez votre réseau puis réessayez.';
  }
  if (/lat, lon et radius_km/i.test(msg)) return 'Rayon GPS : renseignez latitude, longitude et rayon ensemble.';
  if (/Quota atteint/i.test(msg)) return msg;
  return 'Une erreur est survenue. Réessayez dans un instant.';
}

/** Retire les clés vides pour garder une requête (et une URL) propres. */
export function cleanParams(p: SearchParams): SearchParams {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as SearchParams;
}

export async function searchContent(params: SearchParams): Promise<SearchHit[]> {
  const { data, error } = await getSupabase().rpc('search_content', { p_params: cleanParams(params) });
  if (error) throw error;
  return (data ?? []) as SearchHit[];
}

export async function searchTerritories(q: string, types?: string[]): Promise<Territory[]> {
  const { data, error } = await getSupabase().rpc('search_territories', {
    p_q: q,
    p_types: types ?? null,
    p_limit: 8,
  });
  if (error) throw error;
  return (data ?? []) as Territory[];
}

export async function fetchThemes(): Promise<Theme[]> {
  const { data, error } = await getSupabase()
    .from('themes')
    .select('slug,label,group_name,tone,sort_order')
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as Theme[];
}
