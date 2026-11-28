'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { CyberCard } from '@/components/ui/cyber-card';
import { Tag } from '@/components/chip';
import { FavoriteButton } from '@/components/favorite-button';
import type { NeonTone } from '@/lib/neon';
import type { SearchHit, Theme } from '@/lib/types';

const KIND_LABEL: Record<SearchHit['kind'], string> = {
  article: 'Presse',
  dataset: 'Données',
  threat: 'Menace',
};

const KIND_TONE: Record<SearchHit['kind'], NeonTone> = {
  article: 'cyan',
  dataset: 'lime',
  threat: 'magenta',
};

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Lien interne vers la fiche (menaces : directement la source externe). */
export function detailHref(hit: Pick<SearchHit, 'kind' | 'id'>): string | null {
  if (hit.kind === 'article') return `/article/?id=${encodeURIComponent(hit.id)}`;
  if (hit.kind === 'dataset') return `/dataset/?id=${encodeURIComponent(hit.id)}`;
  return null;
}

export function ResultCard({
  hit,
  themeMap,
  index = 0,
}: {
  hit: SearchHit;
  themeMap: Map<string, Theme>;
  index?: number;
}) {
  const tone = KIND_TONE[hit.kind];
  const href = detailHref(hit);
  const favType = hit.kind;

  return (
    <CyberCard
      tone={tone}
      className="animate-fade-in-up space-y-2 motion-reduce:animate-none"
      style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone={tone}>{KIND_LABEL[hit.kind]}</Tag>
        {hit.themes.slice(0, 4).map((slug) => {
          const t = themeMap.get(slug);
          return (
            <Tag key={slug} tone={t?.tone ?? 'cyan'}>
              {t?.label ?? slug}
            </Tag>
          );
        })}
        <span className="ml-auto font-mono text-xs text-cyber-muted">{formatDate(hit.published_at)}</span>
      </div>

      <h3 className="text-base font-semibold leading-snug">
        {href ? (
          <Link
            href={href}
            className="rounded-sm hover:text-[rgb(var(--neon))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--neon))]"
          >
            {hit.title}
          </Link>
        ) : (
          <a
            href={hit.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm hover:text-[rgb(var(--neon))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--neon))]"
          >
            {hit.title}
            <span className="sr-only"> (nouvel onglet)</span>
          </a>
        )}
      </h3>

      {hit.snippet && <p className="line-clamp-3 text-sm text-cyber-muted">{hit.snippet}</p>}

      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-cyber-muted">
        {hit.source_name && <span className="font-mono">{hit.source_name}</span>}
        <a
          href={hit.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline hover:text-cyber-cyan"
        >
          Source <ExternalLink aria-hidden="true" className="h-3 w-3" />
          <span className="sr-only">(nouvel onglet)</span>
        </a>
        <span className="ml-auto">
          <FavoriteButton targetType={favType} targetId={hit.id} />
        </span>
      </div>
    </CyberCard>
  );
}
