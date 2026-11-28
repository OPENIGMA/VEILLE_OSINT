'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { CyberCard } from '@/components/ui/cyber-card';
import { NeonButton } from '@/components/ui/neon-button';
import { Tag } from '@/components/chip';
import { ListState } from '@/components/list-state';
import { inputCls } from '@/components/search-filters';
import { formatDate } from '@/components/result-card';
import { getSupabase } from '@/lib/supabase/client';
import { useAlerts, useSavedSearches } from '@/lib/use-user-data';
import type { AlertRow } from '@/lib/types';

const FREQ: Record<AlertRow['frequency'], string> = {
  immediate: 'Immédiate',
  quotidienne: 'Quotidienne',
  hebdomadaire: 'Hebdomadaire',
};

export function AlertsView() {
  const preselect = useSearchParams().get('search') ?? '';
  const alerts = useAlerts();
  const searches = useSavedSearches();
  const [searchId, setSearchId] = useState(preselect);
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<AlertRow['frequency']>('quotidienne');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Pré-remplit le nom avec celui de la recherche choisie
  useEffect(() => {
    const s = searches.rows.find((r) => r.id === searchId);
    if (s && !name) setName(s.name ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchId, searches.rows]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!searchId) {
      setMsg({ ok: false, text: 'Choisissez une recherche enregistrée.' });
      return;
    }
    const { error } = await getSupabase().from('alerts').insert({ search_id: searchId, name: name.trim(), frequency, is_active: true });
    if (error) {
      setMsg({ ok: false, text: /quota/i.test(error.message) ? 'Limite de 20 alertes atteinte.' : 'Création impossible.' });
    } else {
      setMsg({ ok: true, text: 'Alerte créée.' });
      setName('');
      alerts.reload();
    }
  };

  const update = async (id: string, patch: Partial<Pick<AlertRow, 'is_active' | 'frequency'>>) => {
    const { error } = await getSupabase().from('alerts').update(patch).eq('id', id);
    if (error) setMsg({ ok: false, text: 'Modification impossible.' });
    else alerts.reload();
  };
  const remove = async (id: string) => {
    const { error } = await getSupabase().from('alerts').delete().eq('id', id);
    if (error) setMsg({ ok: false, text: 'Suppression impossible.' });
    else alerts.reload();
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-mono text-3xl font-bold text-cyber-cyan">Alertes</h1>
        <p className="max-w-3xl text-cyber-muted">
          Une alerte surveille une recherche enregistrée et vous prévient des nouveaux résultats.
        </p>
      </header>

      <CyberCard tone="amber" role="note" className="text-sm">
        <strong className="font-mono text-cyber-amber">Bientôt :</strong> vous pouvez déjà créer et gérer vos alertes ;
        l’envoi des e-mails sera activé à l’étape 6.
      </CyberCard>

      <section aria-labelledby="h-new" className="space-y-3">
        <h2 id="h-new" className="font-mono text-xl font-bold">Nouvelle alerte</h2>
        <CyberCard>
          <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="al-search" className="mb-1 block text-sm text-cyber-muted">Recherche à surveiller</label>
              <select id="al-search" value={searchId} onChange={(e) => setSearchId(e.target.value)} className={inputCls}>
                <option value="">— choisir —</option>
                {searches.rows.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {!searches.loading && searches.rows.length === 0 && (
                <p className="mt-1 text-xs text-cyber-muted">Aucune recherche enregistrée : enregistrez-en une depuis la page Recherche.</p>
              )}
            </div>
            <div>
              <label htmlFor="al-name" className="mb-1 block text-sm text-cyber-muted">Nom de l’alerte</label>
              <input id="al-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="al-freq" className="mb-1 block text-sm text-cyber-muted">Fréquence</label>
              <select id="al-freq" value={frequency} onChange={(e) => setFrequency(e.target.value as AlertRow['frequency'])} className={inputCls}>
                {Object.entries(FREQ).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <NeonButton type="submit" tone="amber">Créer l’alerte</NeonButton>
            </div>
          </form>
        </CyberCard>
        {msg && (
          <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-sm text-cyber-lime' : 'text-sm text-cyber-magenta'}>{msg.text}</p>
        )}
      </section>

      <section aria-labelledby="h-list" className="space-y-3">
        <h2 id="h-list" className="font-mono text-xl font-bold">Mes alertes</h2>
        <ListState loading={alerts.loading} error={alerts.error} empty={alerts.rows.length === 0} emptyText="Aucune alerte." onRetry={alerts.reload}>
          <ul className="space-y-3">
            {alerts.rows.map((a) => (
              <li key={a.id}>
                <CyberCard tone={a.is_active ? 'amber' : 'cyan'} className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{a.name}</h3>
                    <Tag tone={a.is_active ? 'lime' : 'cyan'}>{a.is_active ? 'Active' : 'En pause'}</Tag>
                    <span className="ml-auto font-mono text-xs text-cyber-muted">créée le {formatDate(a.created_at)}</span>
                  </div>
                  <p className="font-mono text-xs text-cyber-muted">
                    Recherche : {a.search?.name ?? '—'}{a.search?.query ? ` (« ${a.search.query} »)` : ''}
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label htmlFor={`f-${a.id}`} className="mb-1 block text-xs text-cyber-muted">Fréquence</label>
                      <select
                        id={`f-${a.id}`}
                        value={a.frequency}
                        onChange={(e) => void update(a.id, { frequency: e.target.value as AlertRow['frequency'] })}
                        className={`${inputCls} h-8 w-auto py-0 text-xs`}
                      >
                        {Object.entries(FREQ).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <NeonButton size="sm" variant="outline" onClick={() => void update(a.id, { is_active: !a.is_active })}>
                      {a.is_active ? 'Mettre en pause' : 'Réactiver'}
                    </NeonButton>
                    <NeonButton size="sm" variant="ghost" tone="magenta" onClick={() => void remove(a.id)}>
                      <Trash2 aria-hidden="true" className="h-4 w-4" /> Supprimer
                      <span className="sr-only"> l’alerte {a.name}</span>
                    </NeonButton>
                  </div>
                </CyberCard>
              </li>
            ))}
          </ul>
        </ListState>
      </section>
    </div>
  );
}
