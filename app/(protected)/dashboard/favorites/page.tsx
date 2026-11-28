'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { CyberCard } from '@/components/ui/cyber-card';
import { NeonButton } from '@/components/ui/neon-button';
import { Tag } from '@/components/chip';
import { ListState } from '@/components/list-state';
import { inputCls } from '@/components/search-filters';
import { getSupabase } from '@/lib/supabase/client';
import { useFavorites } from '@/lib/use-user-data';
import type { FavoriteRow } from '@/lib/types';

const LABEL: Record<FavoriteRow['target_type'], string> = { article: 'Presse', dataset: 'Données', threat: 'Menace', territory: 'Territoire' };

interface Target { title: string; href: string; external: boolean }

/** Retrouve titres et liens des éléments favoris (une requête par type). */
function useTargets(rows: FavoriteRow[]) {
  const [map, setMap] = useState<Record<string, Target>>({});
  const key = rows.map((r) => r.id).join(',');
  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = getSupabase();
      const ids = (t: FavoriteRow['target_type']) => rows.filter((r) => r.target_type === t).map((r) => r.target_id);
      const out: Record<string, Target> = {};
      const [a, d, th, te] = await Promise.all([
        ids('article').length ? supabase.from('articles_rss').select('id,title').in('id', ids('article')) : null,
        ids('dataset').length ? supabase.from('datasets_datagouv').select('id,title').in('id', ids('dataset')) : null,
        ids('threat').length ? supabase.from('threats').select('id,title,url').in('id', ids('threat')) : null,
        ids('territory').length ? supabase.from('territories').select('id,name').in('id', ids('territory')) : null,
      ]);
      for (const r of (a?.data as { id: number; title: string }[]) ?? []) out[`article:${r.id}`] = { title: r.title, href: `/article/?id=${r.id}`, external: false };
      for (const r of (d?.data as { id: string; title: string }[]) ?? []) out[`dataset:${r.id}`] = { title: r.title, href: `/dataset/?id=${encodeURIComponent(r.id)}`, external: false };
      for (const r of (th?.data as { id: number; title: string; url: string }[]) ?? []) out[`threat:${r.id}`] = { title: r.title, href: r.url, external: true };
      for (const r of (te?.data as { id: string; name: string }[]) ?? []) out[`territory:${r.id}`] = { title: r.name, href: `/territory/?code=${encodeURIComponent(r.id)}`, external: false };
      if (active) setMap(out);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return map;
}

export default function FavoritesPage() {
  const { rows, loading, error, reload } = useFavorites();
  const targets = useTargets(rows);
  const [msg, setMsg] = useState('');

  const remove = async (id: string) => {
    const { error: e } = await getSupabase().from('favorites').delete().eq('id', id);
    if (e) setMsg('Suppression impossible.');
    else reload();
  };
  const saveNote = async (id: string, note: string) => {
    const { error: e } = await getSupabase().from('favorites').update({ note: note.trim() || null }).eq('id', id);
    setMsg(e ? 'Note non enregistrée.' : '');
  };

  return (
    <section aria-labelledby="h-f" className="space-y-4">
      <h2 id="h-f" className="font-mono text-xl font-bold">Favoris</h2>
      {msg && <p role="alert" className="text-sm text-cyber-magenta">{msg}</p>}
      <ListState loading={loading} error={error} empty={rows.length === 0} emptyText="Aucun favori. Cliquez sur l’étoile d’un résultat pour l’ajouter." onRetry={reload}>
        <ul className="space-y-3">
          {rows.map((f) => {
            const t = targets[`${f.target_type}:${f.target_id}`];
            return (
              <li key={f.id}>
                <CyberCard tone="amber" className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag tone="amber">{LABEL[f.target_type]}</Tag>
                    {t ? (
                      t.external ? (
                        <a href={t.href} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-cyber-amber">{t.title}<span className="sr-only"> (nouvel onglet)</span></a>
                      ) : (
                        <Link href={t.href} className="font-semibold hover:text-cyber-amber">{t.title}</Link>
                      )
                    ) : (
                      <span className="text-cyber-muted">Élément supprimé ou indisponible</span>
                    )}
                    <NeonButton size="sm" variant="ghost" tone="magenta" className="ml-auto" onClick={() => void remove(f.id)}>
                      <Trash2 aria-hidden="true" className="h-4 w-4" /> Retirer
                      <span className="sr-only"> des favoris</span>
                    </NeonButton>
                  </div>
                  <div>
                    <label htmlFor={`note-${f.id}`} className="sr-only">Note personnelle</label>
                    <input
                      id={`note-${f.id}`}
                      defaultValue={f.note ?? ''}
                      maxLength={500}
                      placeholder="Note personnelle (enregistrée en quittant le champ)"
                      onBlur={(e) => {
                        if (e.target.value !== (f.note ?? '')) void saveNote(f.id, e.target.value);
                      }}
                      className={inputCls}
                    />
                  </div>
                </CyberCard>
              </li>
            );
          })}
        </ul>
      </ListState>
    </section>
  );
}
