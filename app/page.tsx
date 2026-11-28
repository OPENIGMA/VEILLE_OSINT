'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Map as MapIcon, ShieldAlert } from 'lucide-react';
import { CyberCard } from '@/components/ui/cyber-card';
import { NeonButton } from '@/components/ui/neon-button';
import { SearchBar } from '@/components/search-bar';
import { StatCounter } from '@/components/stat-counter';
import { Tag } from '@/components/chip';
import { formatDate } from '@/components/result-card';
import { friendlyError, searchContent } from '@/lib/api';
import { neonTone } from '@/lib/neon';
import { cn } from '@/lib/utils';
import { useCounts } from '@/lib/use-counts';
import { useThemes } from '@/lib/use-reference';
import type { SearchHit } from '@/lib/types';

export default function HomePage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const counts = useCounts();
  const { themes } = useThemes();
  const [latest, setLatest] = useState<SearchHit[] | null>(null);
  const [latestError, setLatestError] = useState('');

  useEffect(() => {
    let active = true;
    searchContent({ kinds: ['threat'], sort: 'date', limit: 5 })
      .then((rows) => active && setLatest(rows))
      .catch((e) => active && setLatestError(friendlyError(e)));
    return () => {
      active = false;
    };
  }, []);

  const groups = Array.from(new Set(themes.map((t) => t.group_name)));

  return (
    <div className="space-y-10">
      <section className="space-y-5 pt-2">
        <div>
          <h1 className="font-mono text-4xl font-bold tracking-tight text-cyber-cyan sm:text-5xl">veille-osint</h1>
          <p className="mt-2 max-w-2xl text-lg text-cyber-muted">
            <span className="text-cyber-lime" aria-hidden="true">
              ●{' '}
            </span>
            Presse, données ouvertes, menaces cyber et ingérences : tout chercher au même endroit.
            Focus Occitanie, PACA, Corse ; base nationale et outre-mer.
          </p>
        </div>
        <form
          role="search"
          aria-label="Recherche rapide"
          onSubmit={(e) => {
            e.preventDefault();
            const v = q.trim();
            router.push(v ? `/search/?q=${encodeURIComponent(v)}` : '/search/');
          }}
        >
          <SearchBar value={q} onChange={setQ} large />
        </form>
      </section>

      <section aria-label="Indicateurs" className="grid gap-3 sm:grid-cols-3">
        <StatCounter label="Articles" value={counts.articles} loading={counts.loading} />
        <StatCounter label="Jeux de données" value={counts.datasets} tone="lime" loading={counts.loading} />
        <StatCounter label="Menaces" value={counts.threats} tone="magenta" loading={counts.loading} />
      </section>

      <section aria-labelledby="h-themes" className="space-y-4">
        <h2 id="h-themes" className="font-mono text-xl font-bold">
          Raccourcis thématiques
        </h2>
        {themes.length === 0 && <p className="text-sm text-cyber-muted">Thématiques en cours de chargement…</p>}
        {groups.map((g) => (
          <div key={g} className="space-y-2">
            <h3 className="text-sm text-cyber-muted">{g}</h3>
            <ul className="flex flex-wrap gap-2">
              {themes
                .filter((t) => t.group_name === g)
                .map((t) => (
                  <li key={t.slug}>
                    <Link
                      href={`/search/?t=${encodeURIComponent(t.slug)}`}
                      className={cn(
                        neonTone[t.tone],
                        'inline-flex rounded-full border border-[rgb(var(--neon)/0.4)] px-3 py-1 font-mono text-xs text-cyber-text transition-all',
                        'hover:-translate-y-0.5 hover:border-[rgb(var(--neon))] hover:text-[rgb(var(--neon))] hover:shadow-[0_0_14px_rgb(var(--neon)/var(--glow-opacity))]',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--neon))] motion-reduce:hover:translate-y-0',
                      )}
                    >
                      {t.label}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="h-alertes" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="h-alertes" className="flex items-center gap-2 font-mono text-xl font-bold">
              <ShieldAlert aria-hidden="true" className="h-5 w-5 text-cyber-magenta" /> Dernières alertes
            </h2>
            <NeonButton asChild variant="ghost" size="sm" tone="magenta">
              <Link href="/threats/">Tout voir →</Link>
            </NeonButton>
          </div>
          {latest === null && !latestError && <p className="text-sm text-cyber-muted">Chargement…</p>}
          {latestError && (
            <CyberCard tone="magenta" role="alert" className="text-sm">
              {latestError}
            </CyberCard>
          )}
          {latest && latest.length === 0 && (
            <CyberCard tone="amber" className="text-sm text-cyber-muted">
              Aucune alerte pour le moment. La collecte CERT-FR / ANSSI démarre à l’étape 5.
            </CyberCard>
          )}
          {latest && latest.length > 0 && (
            <ul className="space-y-2">
              {latest.map((h) => (
                <li key={h.id}>
                  <CyberCard tone="magenta" className="flex flex-wrap items-center gap-2">
                    <a
                      href={h.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 hover:text-cyber-magenta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-magenta"
                    >
                      {h.title}
                      <span className="sr-only"> (nouvel onglet)</span>
                    </a>
                    <Tag tone="magenta">{formatDate(h.published_at)}</Tag>
                  </CyberCard>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="h-carte" className="space-y-3">
          <h2 id="h-carte" className="flex items-center gap-2 font-mono text-xl font-bold">
            <MapIcon aria-hidden="true" className="h-5 w-5 text-cyber-cyan" /> Carte territoriale
          </h2>
          <CyberCard className="space-y-3">
            <p className="text-sm text-cyber-muted">
              Explorer les articles et menaces géolocalisés sur fond sombre (carte interactive en cours de
              construction).
            </p>
            <NeonButton asChild variant="outline" size="sm">
              <Link href="/map/">Ouvrir la carte</Link>
            </NeonButton>
          </CyberCard>
        </section>
      </div>
    </div>
  );
}
