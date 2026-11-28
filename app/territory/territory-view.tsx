'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CyberCard } from '@/components/ui/cyber-card';
import { NeonButton } from '@/components/ui/neon-button';
import { Tag } from '@/components/chip';
import { DetailState, type DetailStatus } from '@/components/detail-state';
import { FavoriteButton } from '@/components/favorite-button';
import { ResultCard } from '@/components/result-card';
import { friendlyError, searchContent } from '@/lib/api';
import { getSupabase } from '@/lib/supabase/client';
import { useThemes } from '@/lib/use-reference';
import { TERRITORY_TYPES, type SearchHit, type Territory } from '@/lib/types';

export function TerritoryView() {
  const code = useSearchParams().get('code') ?? '';
  const { themeMap } = useThemes();
  const [status, setStatus] = useState<DetailStatus>('loading');
  const [error, setError] = useState('');
  const [t, setT] = useState<Territory | null>(null);
  const [chain, setChain] = useState<Territory[]>([]);
  const [hits, setHits] = useState<SearchHit[] | null>(null);

  useEffect(() => {
    if (!/^(zds|reg|dep|epci|com|colom)-[0-9A-Za-z-]{1,12}$/.test(code)) {
      setStatus('notfound');
      return;
    }
    let active = true;
    setStatus('loading');
    setHits(null);
    (async () => {
      const supabase = getSupabase();
      const { data, error: e } = await supabase
        .from('territories')
        .select('id,type,code,name,parent_id,postal_codes,population,lat,lon')
        .eq('id', code)
        .maybeSingle();
      if (!active) return;
      if (e) {
        setError(friendlyError(e));
        setStatus('error');
        return;
      }
      if (!data) {
        setStatus('notfound');
        return;
      }
      setT(data as Territory);
      setStatus('ready');

      // Hiérarchie (zone → région → département → …) pour le fil d'Ariane
      const { data: ids } = await supabase.rpc('territory_lineage', { p_ids: [code] });
      const others = ((ids as string[] | null) ?? []).filter((i) => i !== code);
      if (others.length > 0) {
        const { data: rows } = await supabase.from('territories').select('id,type,code,name,parent_id,postal_codes,population').in('id', others);
        if (active && rows) {
          const order = ['zds', 'reg', 'dep', 'epci', 'com'];
          setChain((rows as Territory[]).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type)));
        }
      }
      try {
        const res = await searchContent({ territories: [code], sort: 'date', limit: 10 });
        if (active) setHits(res);
      } catch {
        if (active) setHits([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [code]);

  if (status !== 'ready' || !t) return <DetailState status={status === 'ready' ? 'loading' : status} error={error} backHref="/search/" backLabel="Recherche" />;

  return (
    <div className="space-y-6">
      <NeonButton asChild variant="ghost" size="sm">
        <Link href="/search/">← Recherche</Link>
      </NeonButton>
      <header className="space-y-2">
        <Tag>{TERRITORY_TYPES[t.type]}</Tag>
        <h1 className="font-mono text-3xl font-bold text-cyber-cyan">{t.name}</h1>
        {chain.length > 0 && (
          <nav aria-label="Hiérarchie du territoire">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-cyber-muted">
              {chain.map((c, i) => (
                <li key={c.id} className="flex items-center gap-1">
                  {i > 0 && <span aria-hidden="true">›</span>}
                  <Link href={`/territory/?code=${encodeURIComponent(c.id)}`} className="underline hover:text-cyber-cyan">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        )}
      </header>

      <CyberCard className="space-y-3">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3 border-b border-cyber-cyan/10 py-1">
            <dt className="text-cyber-muted">Code</dt>
            <dd className="font-mono">{t.code}</dd>
          </div>
          {t.population != null && (
            <div className="flex justify-between gap-3 border-b border-cyber-cyan/10 py-1">
              <dt className="text-cyber-muted">Population</dt>
              <dd className="font-mono">{t.population.toLocaleString('fr-FR')}</dd>
            </div>
          )}
          {t.postal_codes.length > 0 && (
            <div className="flex justify-between gap-3 border-b border-cyber-cyan/10 py-1 sm:col-span-2">
              <dt className="text-cyber-muted">Codes postaux</dt>
              <dd className="font-mono">{t.postal_codes.slice(0, 12).join(', ')}{t.postal_codes.length > 12 ? '…' : ''}</dd>
            </div>
          )}
        </dl>
        <div className="flex flex-wrap items-center gap-3">
          <NeonButton asChild>
            <Link href={`/search/?terr=${encodeURIComponent(t.id)}`}>Tout rechercher ici</Link>
          </NeonButton>
          <FavoriteButton targetType="territory" targetId={t.id} />
        </div>
      </CyberCard>

      <section aria-labelledby="h-last" className="space-y-3">
        <h2 id="h-last" className="font-mono text-xl font-bold">Derniers contenus</h2>
        {hits === null && <p className="text-sm text-cyber-muted">Chargement…</p>}
        {hits && hits.length === 0 && (
          <CyberCard tone="amber" className="text-sm text-cyber-muted">
            Aucun contenu rattaché à ce territoire pour le moment.
          </CyberCard>
        )}
        {hits && hits.length > 0 && (
          <ul className="space-y-3">
            {hits.map((h, i) => (
              <li key={`${h.kind}-${h.id}`}>
                <ResultCard hit={h} themeMap={themeMap} index={i} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
