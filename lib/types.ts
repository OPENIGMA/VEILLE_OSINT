/** Types alignés sur le schéma SQL (supabase/migrations). */

export type ContentKind = 'article' | 'dataset' | 'threat';

export interface SearchHit {
  kind: ContentKind;
  id: string;
  title: string;
  snippet: string | null;
  url: string;
  source_name: string | null;
  published_at: string | null;
  themes: string[];
  territory_ids: string[];
  lat: number | null;
  lon: number | null;
  rank: number;
}

/** Paramètres de search_content() — même forme que searches.filters. */
export interface SearchParams {
  q?: string;
  kinds?: ContentKind[];
  territories?: string[];
  postal_code?: string;
  lat?: number;
  lon?: number;
  radius_km?: number;
  themes?: string[];
  entities?: string[];
  sources?: string[];
  content_types?: string[];
  licence?: string;
  producer?: string;
  formats?: string[];
  severities?: string[];
  threat_kinds?: string[];
  date_from?: string;
  date_to?: string;
  sort?: 'relevance' | 'date';
  limit?: number;
  offset?: number;
}

export interface Theme {
  slug: string;
  label: string;
  group_name: string;
  tone: 'cyan' | 'magenta' | 'lime' | 'amber';
  sort_order: number;
}

export interface Territory {
  id: string;
  type: 'zds' | 'reg' | 'dep' | 'epci' | 'com' | 'colom';
  code: string;
  name: string;
  parent_id: string | null;
  postal_codes: string[];
  population: number | null;
  lat?: number | null;
  lon?: number | null;
}

export interface Profile {
  id: string;
  display_name: string | null;
  role: 'user' | 'admin';
  comfort_mode: boolean;
  preferences: Record<string, unknown>;
}

export interface SourceRss {
  id: string;
  name: string;
  feed_url: string;
  site_url: string | null;
  kind: string;
  scope: string;
  territory_ids: string[];
  themes: string[];
  language: string;
  fetch_interval_minutes: number;
  is_active: boolean;
}

export interface SavedSearch {
  id: string;
  name: string | null;
  query: string;
  filters: SearchParams;
  is_saved: boolean;
  created_at: string;
}

export interface AlertRow {
  id: string;
  search_id: string;
  name: string;
  frequency: 'immediate' | 'quotidienne' | 'hebdomadaire';
  is_active: boolean;
  last_sent_at: string | null;
  created_at: string;
}

export interface FavoriteRow {
  id: string;
  target_type: 'article' | 'dataset' | 'threat' | 'territory';
  target_id: string;
  note: string | null;
  created_at: string;
}

export const THREAT_KINDS: Record<string, string> = {
  cyberattaque: 'Cyberattaque',
  cybercriminalite: 'Cybercriminalité',
  ingerence: 'Ingérence',
  desinformation: 'Désinformation',
  espionnage: 'Espionnage',
  vulnerabilite: 'Vulnérabilité',
  autre: 'Autre',
};

export const SEVERITIES: Record<string, { label: string; tone: 'cyan' | 'amber' | 'magenta' }> = {
  info: { label: 'Info', tone: 'cyan' },
  modere: { label: 'Modérée', tone: 'amber' },
  eleve: { label: 'Élevée', tone: 'amber' },
  critique: { label: 'Critique', tone: 'magenta' },
};

export const CONTENT_TYPES: Record<string, string> = {
  article: 'Article',
  communique: 'Communiqué',
  tribune: 'Tribune',
  video: 'Vidéo',
  podcast: 'Podcast',
  alerte: 'Alerte',
  publication_officielle: 'Publication officielle',
};

export const TERRITORY_TYPES: Record<string, string> = {
  zds: 'Zone de défense',
  reg: 'Région',
  dep: 'Département',
  epci: 'EPCI',
  com: 'Commune',
  colom: 'Outre-mer',
};
