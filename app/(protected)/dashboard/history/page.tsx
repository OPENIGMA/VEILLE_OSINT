'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CyberCard } from '@/components/ui/cyber-card';
import { NeonButton } from '@/components/ui/neon-button';
import { ListState } from '@/components/list-state';
import { replayHref } from '@/components/saved-search-link';
import { inputCls } from '@/components/search-filters';
import { formatDate } from '@/components/result-card';
import { getSupabase } from '@/lib/supabase/client';
import { useHistory } from '@/lib/use-user-data';

export default function HistoryPage() {
  const { rows, loading, error, reload } = useHistory();
  const [msg, setMsg] = useState('');
  const [naming, setNaming] = useState<string | null>(null);
  const [name, setName] = useState('');

  const clear = async () => {
    setMsg('');
    const { error: e } = await getSupabase().from('searches').delete().eq('is_saved', false);
    if (e) setMsg('Impossible de vider l’historique.');
    else reload();
  };

  const keep = async (id: string) => {
    setMsg('');
    if (!name.trim()) {
      setMsg('Donnez un nom à la recherche.');
      return;
    }
    const { error: e } = await getSupabase().from('searches').update({ name: name.trim(), is_saved: true }).eq('id', id);
    if (e) setMsg(/quota/i.test(e.message) ? 'Limite de 50 recherches enregistrées atteinte.' : 'Enregistrement impossible.');
    else {
      setNaming(null);
      setName('');
      reload();
    }
  };

  return (
    <section aria-labelledby="h-h" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="h-h" className="font-mono text-xl font-bold">Historique</h2>
        {rows.length > 0 && (
          <NeonButton variant="outline" tone="magenta" size="sm" onClick={() => void clear()}>
            Vider l’historique
          </NeonButton>
        )}
      </div>
      <p className="text-sm text-cyber-muted">Les 100 dernières recherches sont conservées, 90 jours maximum.</p>
      {msg && <p role="alert" className="text-sm text-cyber-magenta">{msg}</p>}
      <ListState loading={loading} error={error} empty={rows.length === 0} emptyText="Historique vide." onRetry={reload}>
        <ul className="space-y-2">
          {rows.map((h) => (
            <li key={h.id}>
              <CyberCard className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm">{h.query || '(filtres seuls)'}</p>
                    <p className="font-mono text-xs text-cyber-muted">{formatDate(h.created_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    <NeonButton asChild size="sm" variant="outline">
                      <Link href={replayHref(h)}>Relancer</Link>
                    </NeonButton>
                    <NeonButton size="sm" variant="ghost" onClick={() => { setNaming(h.id); setName(h.query); }}>
                      Enregistrer
                    </NeonButton>
                  </div>
                </div>
                {naming === h.id && (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[14rem] flex-1">
                      <label htmlFor={`n-${h.id}`} className="mb-1 block text-xs text-cyber-muted">Nom</label>
                      <input
                        id={`n-${h.id}`}
                        value={name}
                        maxLength={120}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void keep(h.id);
                        }}
                        className={inputCls}
                      />
                    </div>
                    <NeonButton size="sm" tone="lime" onClick={() => void keep(h.id)}>Valider</NeonButton>
                    <NeonButton size="sm" variant="ghost" onClick={() => setNaming(null)}>Annuler</NeonButton>
                  </div>
                )}
              </CyberCard>
            </li>
          ))}
        </ul>
      </ListState>
    </section>
  );
}
