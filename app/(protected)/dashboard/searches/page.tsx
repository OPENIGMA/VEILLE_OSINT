'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BellPlus, Trash2 } from 'lucide-react';
import { CyberCard } from '@/components/ui/cyber-card';
import { NeonButton } from '@/components/ui/neon-button';
import { ListState } from '@/components/list-state';
import { replayHref } from '@/components/saved-search-link';
import { getSupabase } from '@/lib/supabase/client';
import { useSavedSearches } from '@/lib/use-user-data';
import { formatDate } from '@/components/result-card';

export default function SavedSearchesPage() {
  const { rows, loading, error, reload } = useSavedSearches();
  const [msg, setMsg] = useState('');

  const remove = async (id: string) => {
    setMsg('');
    const { error: e } = await getSupabase().from('searches').delete().eq('id', id);
    if (e) setMsg('Suppression impossible.');
    else reload();
  };

  return (
    <section aria-labelledby="h-s" className="space-y-4">
      <h2 id="h-s" className="font-mono text-xl font-bold">Recherches enregistrées</h2>
      {msg && <p role="alert" className="text-sm text-cyber-magenta">{msg}</p>}
      <ListState loading={loading} error={error} empty={rows.length === 0} emptyText="Aucune recherche enregistrée. Depuis la page Recherche, utilisez « Enregistrer cette recherche »." onRetry={reload}>
        <ul className="space-y-3">
          {rows.map((s) => (
            <li key={s.id}>
              <CyberCard className="space-y-3">
                <div>
                  <h3 className="font-semibold">{s.name}</h3>
                  <p className="font-mono text-xs text-cyber-muted">
                    {s.query ? `« ${s.query} » · ` : ''}créée le {formatDate(s.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <NeonButton asChild size="sm">
                    <Link href={replayHref(s)}>Lancer</Link>
                  </NeonButton>
                  <NeonButton asChild size="sm" variant="outline" tone="amber">
                    <Link href={`/alerts/?search=${s.id}`}>
                      <BellPlus aria-hidden="true" className="h-4 w-4" /> Créer une alerte
                    </Link>
                  </NeonButton>
                  <NeonButton size="sm" variant="ghost" tone="magenta" onClick={() => void remove(s.id)}>
                    <Trash2 aria-hidden="true" className="h-4 w-4" /> Supprimer
                    <span className="sr-only"> la recherche {s.name}</span>
                  </NeonButton>
                </div>
              </CyberCard>
            </li>
          ))}
        </ul>
      </ListState>
    </section>
  );
}
