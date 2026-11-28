import type { ContentKind, SearchParams } from '@/lib/types';

/**
 * L'état d'une recherche vit dans l'URL (/search/?q=drone&t=drones&terr=dep-31) :
 * une recherche est partageable, rejouable, et le bouton « précédent » fonctionne.
 */

const list = (v: string | null): string[] =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const num = (v: string | null): number | undefined => {
  if (v === null || v.trim() === '') return undefined;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

const KINDS: ContentKind[] = ['article', 'dataset', 'threat'];

export interface UiState extends SearchParams {
  page: number;
}

export function parseQuery(sp: URLSearchParams): UiState {
  const kinds = list(sp.get('kinds')).filter((k): k is ContentKind => (KINDS as string[]).includes(k));
  const sort = sp.get('sort');
  return {
    q: sp.get('q') ?? '',
    kinds,
    themes: list(sp.get('t')),
    territories: list(sp.get('terr')),
    postal_code: sp.get('cp') ?? '',
    lat: num(sp.get('lat')),
    lon: num(sp.get('lon')),
    radius_km: num(sp.get('r')),
    date_from: sp.get('from') ?? '',
    date_to: sp.get('to') ?? '',
    sort: sort === 'date' || sort === 'relevance' ? sort : undefined,
    formats: list(sp.get('fmt')),
    licence: sp.get('lic') ?? '',
    producer: sp.get('prod') ?? '',
    content_types: list(sp.get('ctype')),
    severities: list(sp.get('sev')),
    threat_kinds: list(sp.get('tkind')),
    entities: list(sp.get('ent')),
    sources: list(sp.get('src')),
    page: Math.max(1, Math.floor(num(sp.get('page')) ?? 1)),
  };
}

export function toQuery(s: Partial<UiState>): string {
  const sp = new URLSearchParams();
  const set = (k: string, v: string | number | undefined | null) => {
    if (v === undefined || v === null || v === '') return;
    sp.set(k, String(v));
  };
  const setList = (k: string, v: string[] | undefined) => {
    if (v && v.length > 0) sp.set(k, v.join(','));
  };
  set('q', s.q?.trim());
  setList('kinds', s.kinds);
  setList('t', s.themes);
  setList('terr', s.territories);
  set('cp', s.postal_code?.trim());
  set('lat', s.lat);
  set('lon', s.lon);
  set('r', s.radius_km);
  set('from', s.date_from);
  set('to', s.date_to);
  set('sort', s.sort);
  setList('fmt', s.formats);
  set('lic', s.licence?.trim());
  set('prod', s.producer?.trim());
  setList('ctype', s.content_types);
  setList('sev', s.severities);
  setList('tkind', s.threat_kinds);
  setList('ent', s.entities);
  setList('src', s.sources);
  if (s.page && s.page > 1) set('page', s.page);
  return sp.toString();
}

export const PAGE_SIZE = 20;

/** Convertit l'état de l'interface en paramètres pour search_content(). */
export function toSearchParams(s: UiState, fixedKinds?: ContentKind[]): SearchParams {
  const kinds = fixedKinds ?? (s.kinds && s.kinds.length > 0 ? s.kinds : undefined);
  const hasGps = s.lat !== undefined && s.lon !== undefined && s.radius_km !== undefined;
  return {
    q: s.q?.trim(),
    kinds,
    themes: s.themes,
    territories: s.territories,
    postal_code: s.postal_code?.trim(),
    ...(hasGps ? { lat: s.lat, lon: s.lon, radius_km: s.radius_km } : {}),
    // date_to : inclusif côté interface → < lendemain côté base
    date_from: s.date_from ? `${s.date_from}T00:00:00` : undefined,
    date_to: s.date_to ? nextDay(s.date_to) : undefined,
    sort: s.sort,
    formats: s.formats,
    licence: s.licence?.trim(),
    producer: s.producer?.trim(),
    content_types: s.content_types,
    severities: s.severities,
    threat_kinds: s.threat_kinds,
    entities: s.entities,
    sources: s.sources,
    // +1 : permet de savoir s'il existe une page suivante
    limit: PAGE_SIZE + 1,
    offset: (s.page - 1) * PAGE_SIZE,
  };
}

function nextDay(iso: string): string | undefined {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T00:00:00`;
}

/** Filtres à enregistrer : exécutables tels quels par search_content (sans q, limit, offset). */
export function toSavedFilters(s: UiState, fixedKinds?: ContentKind[]): SearchParams {
  const { q: _q, limit: _l, offset: _o, ...rest } = toSearchParams(s, fixedKinds);
  void _q;
  void _l;
  void _o;
  return rest;
}

/** Inverse : reconstruit l'état de l'interface depuis une recherche enregistrée. */
export function savedToUiState(query: string, f: SearchParams): UiState {
  const day = (v?: string) => (v ? v.slice(0, 10) : '');
  let dateTo = '';
  if (f.date_to) {
    const d = new Date(`${day(f.date_to)}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      d.setDate(d.getDate() - 1);
      const p = (n: number) => String(n).padStart(2, '0');
      dateTo = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }
  }
  return {
    q: query,
    kinds: f.kinds,
    themes: f.themes,
    territories: f.territories,
    postal_code: f.postal_code,
    lat: f.lat,
    lon: f.lon,
    radius_km: f.radius_km,
    date_from: day(f.date_from),
    date_to: dateTo,
    sort: f.sort,
    formats: f.formats,
    licence: f.licence,
    producer: f.producer,
    content_types: f.content_types,
    severities: f.severities,
    threat_kinds: f.threat_kinds,
    entities: f.entities,
    sources: f.sources,
    page: 1,
  };
}

/** Vrai si au moins un critère est renseigné (hors pagination et tri). */
export function hasCriteria(s: UiState): boolean {
  return Boolean(
    s.q?.trim() ||
      s.kinds?.length ||
      s.themes?.length ||
      s.territories?.length ||
      s.postal_code?.trim() ||
      s.radius_km !== undefined ||
      s.date_from ||
      s.date_to ||
      s.formats?.length ||
      s.licence?.trim() ||
      s.producer?.trim() ||
      s.content_types?.length ||
      s.severities?.length ||
      s.threat_kinds?.length ||
      s.entities?.length ||
      s.sources?.length,
  );
}
