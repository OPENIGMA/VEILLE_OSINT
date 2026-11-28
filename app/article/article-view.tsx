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
import { CONTENT_TYPES } from '@/lib/types';

interface Article {
  id: number;
  url: string;
  title: string;
  excerpt: string | null;
  author: string | null;
  published_at: string;
  content_type: string;
  themes: string[];
  territory_ids: string[];
  entities: string[];
  source: { name: string; site_url: string | null } | null;
}

export function ArticleView() {
  const id = useSearchParams().get('id') ?? '';
  const { themeMap } = useThemes();
  const [status, setStatus] = useState<DetailStatus>('loading');
  const [error, setError] = useState('');
  const [a, setA] = useState<Article | null>(null);

  useEffect(() => {
    if (!/^\d{1,18}$/.test(id)) {
      setStatus('notfound');
      return;
    }
    let active = true;
    setStatus('loading');
    getSupabase()
      .from('articles_rss')
      .select('id,url,title,excerpt,author,published_at,content_type,themes,territory_ids,entities,source:sources_rss(name,site_url)')
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
          setA(data as unknown as Article);
          setStatus('ready');
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (status !== 'ready' || !a) return <DetailState status={status === 'ready' ? 'loading' : status} error={error} backHref="/press/" backLabel="Flux presse" />;

  return (
    <article className="space-y-6">
      <NeonButton asChild variant="ghost" size="sm">
        <Link href="/press/">← Flux presse</Link>
      </NeonButton>
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tag>{CONTENT_TYPES[a.content_type] ?? a.content_type}</Tag>
          {a.themes.map((slug) => (
            <Tag key={slug} tone={themeMap.get(slug)?.tone ?? 'cyan'}>
              {themeMap.get(slug)?.label ?? slug}
            </Tag>
          ))}
        </div>
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{a.title}</h1>
        <p className="font-mono text-sm text-cyber-muted">
          {formatDate(a.published_at)}
          {a.source?.name ? ` · ${a.source.name}` : ''}
          {a.author ? ` · ${a.author}` : ''}
        </p>
      </header>

      <CyberCard className="space-y-4">
        {a.excerpt ? <p className="leading-relaxed">{a.excerpt}</p> : <p className="text-cyber-muted">Pas d’extrait disponible.</p>}
        <p className="text-xs text-cyber-muted">
          Extrait uniquement : le texte intégral reste chez l’éditeur.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <NeonButton asChild>
            <a href={a.url} target="_blank" rel="noopener noreferrer">
              Lire l’article <ExternalLink aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only">(nouvel onglet)</span>
            </a>
          </NeonButton>
          <FavoriteButton targetType="article" targetId={String(a.id)} />
        </div>
      </CyberCard>

      <section aria-labelledby="h-terr" className="space-y-2">
        <h2 id="h-terr" className="font-mono text-sm uppercase tracking-widest text-cyber-cyan">Territoires</h2>
        <TerritoryLinks ids={a.territory_ids} />
      </section>

      {a.entities.length > 0 && (
        <section aria-labelledby="h-ent" className="space-y-2">
          <h2 id="h-ent" className="font-mono text-sm uppercase tracking-widest text-cyber-cyan">Entités</h2>
          <ul className="flex flex-wrap gap-1.5">
            {a.entities.map((e) => (
              <li key={e}>
                <Link href={`/search/?ent=${encodeURIComponent(e)}`} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan">
                  <Tag tone="lime">{e}</Tag>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
