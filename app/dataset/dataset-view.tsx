'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { CyberCard } from '@/components/ui/cyber-card';
import { NeonButton } from '@/components/ui/neon-button';
import { Tag } from '@/components/chip';
import { DetailState, type DetailStatus } from '@/components/detail-state';
import { FavoriteButton } from '@/components/favorite-button';
import { TerritoryLinks } from '@/components/territory-links';
import { formatDate } from '@/components/result-card';
import { friendlyError } from '@/lib/api';
import { getSupabase } from '@/lib/supabase/client';
import { useThemes } from '@/lib/use-reference';

interface Dataset {
  id: string;
  title: string;
  description_short: string | null;
  producer: string | null;
  tags: string[];
  license: string | null;
  formats: string[];
  frequency: string | null;
  url: string;
  created_at_source: string | null;
  published_at: string | null;
  resources_count: number;
  themes: string[];
  territory_ids: string[];
}

export function DatasetView() {
  const id = useSearchParams().get('id') ?? '';
  const { themeMap } = useThemes();
  const [status, setStatus] = useState<DetailStatus>('loading');
  const [error, setError] = useState('');
  const [d, setD] = useState<Dataset | null>(null);

  useEffect(() => {
    if (!id || id.length > 64) {
      setStatus('notfound');
      return;
    }
    let active = true;
    setStatus('loading');
    getSupabase()
      .from('datasets_datagouv')
      .select('id,title,description_short,producer,tags,license,formats,frequency,url,created_at_source,published_at,resources_count,themes,territory_ids')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error: e }) => {
        if (!active) return;
        if (e) {
          setError(friendlyError(e));
          setStatus('error');
        } else if (!data) {
          setStatus('notfound');
        } else {
          setD(data as Dataset);
          setStatus('ready');
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (status !== 'ready' || !d) return <DetailState status={status === 'ready' ? 'loading' : status} error={error} backHref="/data/" backLabel="Jeux de données" />;

  const rows: [string, React.ReactNode][] = [
    ['Producteur', d.producer ?? '—'],
    ['Licence', d.license ?? '—'],
    ['Fréquence de mise à jour', d.frequency ?? '—'],
    ['Dernière modification', formatDate(d.published_at)],
    ['Création', formatDate(d.created_at_source)],
    ['Ressources', d.resources_count],
  ];

  return (
    <article className="space-y-6">
      <NeonButton asChild variant="ghost" size="sm">
        <Link href="/data/">← Jeux de données</Link>
      </NeonButton>
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {d.formats.map((f) => (
            <Tag key={f} tone="lime">{f.toUpperCase()}</Tag>
          ))}
          {d.themes.map((slug) => (
            <Tag key={slug} tone={themeMap.get(slug)?.tone ?? 'cyan'}>{themeMap.get(slug)?.label ?? slug}</Tag>
          ))}
        </div>
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{d.title}</h1>
      </header>

      <CyberCard tone="lime" className="space-y-4">
        {d.description_short ? <p className="leading-relaxed">{d.description_short}</p> : <p className="text-cyber-muted">Pas de description.</p>}
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-cyber-lime/10 py-1">
              <dt className="text-cyber-muted">{k}</dt>
              <dd className="font-mono">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center gap-3">
          <NeonButton asChild tone="lime">
            <a href={d.url} target="_blank" rel="noopener noreferrer">
              Ouvrir sur data.gouv.fr <ExternalLink aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only">(nouvel onglet)</span>
            </a>
          </NeonButton>
          <FavoriteButton targetType="dataset" targetId={d.id} />
        </div>
      </CyberCard>

      {d.tags.length > 0 && (
        <section aria-labelledby="h-tags" className="space-y-2">
          <h2 id="h-tags" className="font-mono text-sm uppercase tracking-widest text-cyber-cyan">Mots-clés</h2>
          <ul className="flex flex-wrap gap-1.5">
            {d.tags.map((t) => (
              <li key={t}><Tag>{t}</Tag></li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="h-terr" className="space-y-2">
        <h2 id="h-terr" className="font-mono text-sm uppercase tracking-widest text-cyber-cyan">Territoires</h2>
        <TerritoryLinks ids={d.territory_ids} />
      </section>
    </article>
  );
}
