import { savedToUiState, toQuery } from '@/lib/search-url';
import type { ContentKind, SavedSearch } from '@/lib/types';

/** Adresse de la page qui rejoue une recherche enregistrée. */
export function replayHref(s: Pick<SavedSearch, 'query' | 'filters'>): string {
  const kinds = s.filters.kinds ?? [];
  const only = kinds.length === 1 ? (kinds[0] as ContentKind) : null;
  const base = only === 'article' ? '/press/' : only === 'dataset' ? '/data/' : only === 'threat' ? '/threats/' : '/search/';
  const qs = toQuery(savedToUiState(s.query, s.filters));
  return qs ? `${base}?${qs}` : base;
}
