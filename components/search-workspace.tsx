'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Filter, LayoutList, RotateCcw, Save, Table2 } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { CyberCard } from '@/components/ui/cyber-card';
import { NeonButton } from '@/components/ui/neon-button';
import { TerminalLoader } from '@/components/ui/terminal-loader';
import { Chip, Tag } from '@/components/chip';
import { SearchBar } from '@/components/search-bar';
import { SearchFilters, inputCls, type FilterSection } from '@/components/search-filters';
import { ResultCard, detailHref, formatDate } from '@/components/result-card';
import { friendlyError, searchContent } from '@/lib/api';
import { getSupabase } from '@/lib/supabase/client';
import { useSources, useThemes } from '@/lib/use-reference';
import {
  PAGE_SIZE,
  hasCriteria,
  parseQuery,
  toQuery,
  toSavedFilters,
  toSearchParams,
  type UiState,
} from '@/lib/search-url';
import type { ContentKind, SearchHit } from '@/lib/types';

export type WorkspaceVariant = 'search' | 'press' | 'data' | 'threats';

interface VariantConfig {
  title: string;
  intro: string;
  fixedKinds?: ContentKind[];
  sections: FilterSection[];
  placeholder: string;
  empty: string;
}

const VARIANTS: Record<WorkspaceVariant, VariantConfig> = {
  search: {
    title: 'Recherche',
    intro: 'Moteur unifié : presse, jeux de données et menaces, avec filtres géographiques, thématiques et techniques.',
    sections: ['kinds', 'themes', 'territory', 'gps', 'dates', 'entities', 'content_types', 'sources', 'dataset', 'threat'],
    placeholder: 'Ex. drone ET Occitanie, « free party », ingérence SAUF sport…',
    empty: 'Aucun résultat. Élargissez la période, retirez un filtre ou simplifiez la requête.',
  },
  press: {
    title: 'Flux presse',
    intro: 'Chronologie de la presse locale, régionale et spécialisée.',
    fixedKinds: ['article'],
    sections: ['themes', 'territory', 'dates', 'content_types', 'sources', 'entities'],
    placeholder: 'Rechercher dans la presse…',
    empty: 'Aucun article pour ces critères. Les flux sont collectés à l’étape 5 : la base peut encore être vide.',
  },
  data: {
    title: 'Jeux de données',
    intro: 'Explorer les jeux de données ouverts de data.gouv.fr (métadonnées et liens ; jamais les fichiers).',
    fixedKinds: ['dataset'],
    sections: ['themes', 'territory', 'dates', 'dataset'],
    placeholder: 'Rechercher un jeu de données : population, budget, sécurité routière…',
    empty: 'Aucun jeu de données pour ces critères. L’indexation data.gouv.fr est prévue à l’étape 5 : la base peut encore être vide.',
  },
  threats: {
    title: 'Veille cyber & ingérences',
    intro: 'Cyberattaques, cybercriminalité, ingérences, désinformation et vulnérabilités.',
    fixedKinds: ['threat'],
    sections: ['threat', 'themes', 'territory', 'gps', 'dates', 'entities'],
    placeholder: 'Rechercher une menace, un acteur, un CVE…',
    empty: 'Aucune menace pour ces critères. La collecte CERT-FR / ANSSI est prévue à l’étape 5 : la base peut encore être vide.',
  },
};

type Status = 'loading' | 'error' | 'done';

export function SearchWorkspace({ variant }: { variant: WorkspaceVariant }) {
  const cfg = VARIANTS[variant];
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { themes, themeMap } = useThemes();
  const sources = useSources();

  const urlKey = searchParams.toString();
  const committed = parseQuery(new URLSearchParams(urlKey));

  // Brouillon : modifié par le formulaire, appliqué à l'envoi
  const [draft, setDraft] = useState<UiState>(committed);
  useEffect(() => {
    setDraft(parseQuery(new URLSearchParams(urlKey)));
  }, [urlKey]);
  const patch = useCallback((p: Partial<UiState>) => setDraft((d) => ({ ...d, ...p })), []);

  const [status, setStatus] = useState<Status>('loading');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<'list' | 'table'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const reqId = useRef(0);
  const lastLogged = useRef('');

  // Lance la recherche à chaque changement d'URL
  useEffect(() => {
    const state = parseQuery(new URLSearchParams(urlKey));
    const id = ++reqId.current;
    setStatus('loading');
    searchContent(toSearchParams(state, cfg.fixedKinds))
      .then((rows) => {
        if (id !== reqId.current) return;
        setHasNext(rows.length > PAGE_SIZE);
        setHits(rows.slice(0, PAGE_SIZE));
        setStatus('done');
      })
      .catch((e) => {
        if (id !== reqId.current) return;
        setError(friendlyError(e));
        setStatus('error');
      });
  }, [urlKey, retry, cfg.fixedKinds]);

  // Historique personnel : une ligne par recherche distincte (connecté uniquement)
  useEffect(() => {
    if (!user) return;
    const state = parseQuery(new URLSearchParams(urlKey));
    if (state.page > 1 || !hasCriteria(state)) return;
    const key = `${pathname}?${toQuery({ ...state, page: 1 })}`;
    if (lastLogged.current === key) return;
    lastLogged.current = key;
    void getSupabase()
      .from('searches')
      .insert({ query: state.q?.trim() ?? '', filters: toSavedFilters(state, cfg.fixedKinds), is_saved: false });
  }, [user, urlKey, pathname, cfg.fixedKinds]);

  const go = (state: UiState) => {
    const qs = toQuery(state);
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFiltersOpen(false);
    go({ ...draft, entities: (draft.entities ?? []).map((s) => s.trim()).filter(Boolean), page: 1 });
  };

  const reset = () => {
    setDraft(parseQuery(new URLSearchParams('')));
    router.push(pathname);
  };

  // Enregistrement de la recherche courante
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    setSaveMsg(null);
    if (!saveName.trim()) {
      setSaveMsg({ ok: false, text: 'Donnez un nom à la recherche.' });
      return;
    }
    const { error: err } = await getSupabase()
      .from('searches')
      .insert({
        name: saveName.trim(),
        query: committed.q?.trim() ?? '',
        filters: toSavedFilters(committed, cfg.fixedKinds),
        is_saved: true,
      });
    if (err) {
      setSaveMsg({ ok: false, text: /quota/i.test(err.message) ? 'Limite de 50 recherches enregistrées atteinte.' : 'Enregistrement impossible.' });
    } else {
      setSaveMsg({ ok: true, text: 'Recherche enregistrée (voir Espace personnel).' });
      setSaving(false);
      setSaveName('');
    }
  };

  const goPage = (page: number) => go({ ...committed, page });
  const sortValue = draft.sort ?? (draft.q?.trim() ? 'relevance' : 'date');
  const activeCount = hasCriteria(committed);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-mono text-3xl font-bold text-cyber-cyan">{cfg.title}</h1>
        <p className="max-w-3xl text-cyber-muted">{cfg.intro}</p>
      </header>

      <form onSubmit={submit} className="space-y-4" role="search" aria-label={cfg.title}>
        <SearchBar value={draft.q ?? ''} onChange={(q) => patch({ q })} placeholder={cfg.placeholder} />

        <details className="rounded-md border border-cyber-cyan/20 px-3 py-2 text-sm text-cyber-muted">
          <summary className="cursor-pointer font-mono text-xs uppercase tracking-widest text-cyber-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan">
            Aide à la recherche avancée
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Plusieurs mots = tous requis. <code className="font-mono text-cyber-text">ET</code> est facultatif.
            </li>
            <li>
              <code className="font-mono text-cyber-text">drone OU cyberattaque</code> : l’un ou l’autre.
            </li>
            <li>
              <code className="font-mono text-cyber-text">ingérence SAUF sport</code> (ou{' '}
              <code className="font-mono text-cyber-text">-sport</code>) : exclusion.
            </li>
            <li>
              <code className="font-mono text-cyber-text">&quot;free party&quot;</code> : expression exacte.
            </li>
            <li>Les opérateurs s’écrivent EN MAJUSCULES ; « ou », « et », « sans » restent de simples mots. Accents sans importance.</li>
          </ul>
        </details>

        <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          {/* Filtres */}
          <aside aria-label="Filtres" className="space-y-3">
            <NeonButton
              variant="outline"
              className="w-full lg:hidden"
              aria-expanded={filtersOpen}
              aria-controls="panneau-filtres"
              onClick={() => setFiltersOpen((o) => !o)}
            >
              <Filter aria-hidden="true" className="h-4 w-4" /> Filtres {activeCount ? '(actifs)' : ''}
            </NeonButton>
            <CyberCard
              id="panneau-filtres"
              className={`${filtersOpen ? 'block' : 'hidden'} space-y-5 lg:block`}
            >
              <SearchFilters state={draft} onChange={patch} sections={cfg.sections} themes={themes} sources={sources} />
              <div className="flex flex-wrap gap-2 border-t border-cyber-cyan/20 pt-4">
                <NeonButton type="submit">Appliquer</NeonButton>
                <NeonButton variant="ghost" onClick={reset}>
                  <RotateCcw aria-hidden="true" className="h-4 w-4" /> Réinitialiser
                </NeonButton>
              </div>
            </CyberCard>
          </aside>

          {/* Résultats */}
          <section aria-label="Résultats" className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-mono text-sm text-cyber-muted" role="status" aria-live="polite">
                {status === 'loading' && 'Recherche en cours…'}
                {status === 'done' &&
                  (hits.length === 0
                    ? 'Aucun résultat'
                    : `${hits.length}${hasNext ? '+' : ''} résultat${hits.length > 1 ? 's' : ''} · page ${committed.page}`)}
                {status === 'error' && 'Erreur'}
              </p>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-cyber-muted">
                  Tri
                  <select
                    value={sortValue}
                    onChange={(e) => {
                      const sort = e.target.value as 'relevance' | 'date';
                      patch({ sort });
                      go({ ...committed, sort, page: 1 });
                    }}
                    className={`${inputCls} h-8 w-auto py-0 font-mono text-xs`}
                  >
                    <option value="relevance" disabled={!committed.q?.trim()}>
                      Pertinence
                    </option>
                    <option value="date">Date</option>
                  </select>
                </label>
                <div role="group" aria-label="Affichage" className="flex gap-1">
                  <Chip pressed={view === 'list'} onClick={() => setView('list')}>
                    <LayoutList aria-hidden="true" className="mr-1 h-3 w-3" /> Liste
                  </Chip>
                  <Chip pressed={view === 'table'} onClick={() => setView('table')}>
                    <Table2 aria-hidden="true" className="mr-1 h-3 w-3" /> Tableau
                  </Chip>
                </div>
              </div>
            </div>

            {user && activeCount && (
              <div className="space-y-2">
                {!saving ? (
                  <NeonButton variant="ghost" size="sm" onClick={() => setSaving(true)}>
                    <Save aria-hidden="true" className="h-4 w-4" /> Enregistrer cette recherche
                  </NeonButton>
                ) : (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[14rem] flex-1">
                      <label htmlFor="save-name" className="mb-1 block text-xs text-cyber-muted">
                        Nom de la recherche
                      </label>
                      <input
                        id="save-name"
                        maxLength={120}
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void save();
                          }
                        }}
                        className={inputCls}
                      />
                    </div>
                    <NeonButton size="sm" tone="lime" onClick={() => void save()}>
                      Enregistrer
                    </NeonButton>
                    <NeonButton size="sm" variant="ghost" onClick={() => setSaving(false)}>
                      Annuler
                    </NeonButton>
                  </div>
                )}
                {saveMsg && (
                  <p role={saveMsg.ok ? 'status' : 'alert'} className={saveMsg.ok ? 'text-sm text-cyber-lime' : 'text-sm text-cyber-magenta'}>
                    {saveMsg.text}
                  </p>
                )}
              </div>
            )}

            {status === 'loading' && (
              <TerminalLoader
                label="Recherche en cours"
                lines={['> interrogation de la base…', '> classement des résultats…']}
              />
            )}

            {status === 'error' && (
              <CyberCard tone="magenta" role="alert" className="space-y-3">
                <p className="text-cyber-text">{error}</p>
                <NeonButton tone="magenta" variant="outline" size="sm" onClick={() => setRetry((n) => n + 1)}>
                  Réessayer
                </NeonButton>
              </CyberCard>
            )}

            {status === 'done' && hits.length === 0 && (
              <CyberCard tone="amber" className="text-cyber-muted">
                {cfg.empty}
              </CyberCard>
            )}

            {status === 'done' && hits.length > 0 && view === 'list' && (
              <ul className="space-y-3">
                {hits.map((h, i) => (
                  <li key={`${h.kind}-${h.id}`}>
                    <ResultCard hit={h} themeMap={themeMap} index={i} />
                  </li>
                ))}
              </ul>
            )}

            {status === 'done' && hits.length > 0 && view === 'table' && (
              <div className="overflow-x-auto rounded-lg border border-cyber-cyan/30">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <caption className="sr-only">Résultats de la recherche</caption>
                  <thead className="bg-cyber-card font-mono text-xs uppercase tracking-wider text-cyber-cyan">
                    <tr>
                      <th scope="col" className="px-3 py-2">Type</th>
                      <th scope="col" className="px-3 py-2">Titre</th>
                      <th scope="col" className="px-3 py-2">Source</th>
                      <th scope="col" className="px-3 py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyber-cyan/10">
                    {hits.map((h) => {
                      const href = detailHref(h);
                      return (
                        <tr key={`${h.kind}-${h.id}`} className="hover:bg-cyber-cyan/5">
                          <td className="px-3 py-2">
                            <Tag tone={h.kind === 'threat' ? 'magenta' : h.kind === 'dataset' ? 'lime' : 'cyan'}>
                              {h.kind === 'threat' ? 'Menace' : h.kind === 'dataset' ? 'Données' : 'Presse'}
                            </Tag>
                          </td>
                          <td className="px-3 py-2">
                            {href ? (
                              <Link href={href} className="hover:text-cyber-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan">
                                {h.title}
                              </Link>
                            ) : (
                              <a href={h.url} target="_blank" rel="noopener noreferrer" className="hover:text-cyber-cyan">
                                {h.title}
                                <span className="sr-only"> (nouvel onglet)</span>
                              </a>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-cyber-muted">{h.source_name ?? '—'}</td>
                          <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-cyber-muted">{formatDate(h.published_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {status === 'done' && (committed.page > 1 || hasNext) && (
              <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-2">
                <NeonButton variant="outline" size="sm" disabled={committed.page <= 1} onClick={() => goPage(committed.page - 1)}>
                  ← Précédent
                </NeonButton>
                <span className="font-mono text-xs text-cyber-muted">Page {committed.page}</span>
                <NeonButton variant="outline" size="sm" disabled={!hasNext} onClick={() => goPage(committed.page + 1)}>
                  Suivant →
                </NeonButton>
              </nav>
            )}
          </section>
        </div>
      </form>
    </div>
  );
}
