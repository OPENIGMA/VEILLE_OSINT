'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { CyberCard } from '@/components/ui/cyber-card';
import { NeonButton } from '@/components/ui/neon-button';
import { Chip, Tag } from '@/components/chip';
import { ListState } from '@/components/list-state';
import { inputCls } from '@/components/search-filters';
import { friendlyError } from '@/lib/api';
import { getSupabase } from '@/lib/supabase/client';
import { useThemes } from '@/lib/use-reference';
import type { SourceRss } from '@/lib/types';

const KINDS = ['presse', 'cyber', 'institutionnel', 'economie', 'geopolitique', 'officiel'];
const SCOPES = ['nationale', 'regionale', 'departementale', 'locale', 'specialisee'];

const EMPTY = { name: '', feed_url: '', site_url: '', kind: 'presse', scope: 'nationale', fetch_interval_minutes: 60, themes: [] as string[] };

export function SourcesAdmin() {
  const { themes } = useThemes();
  const [rows, setRows] = useState<SourceRss[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await getSupabase()
      .from('sources_rss')
      .select('id,name,feed_url,site_url,kind,scope,territory_ids,themes,language,fetch_interval_minutes,is_active')
      .order('name');
    if (e) setError(friendlyError(e));
    else {
      setError('');
      setRows((data as SourceRss[]) ?? []);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    // Seules les adresses http(s) publiques sont acceptées ; le Worker revalidera (étape 5)
    if (!/^https:\/\//i.test(form.feed_url.trim())) {
      setMsg({ ok: false, text: 'L’adresse du flux doit commencer par https://' });
      return;
    }
    const { error: err } = await getSupabase().from('sources_rss').insert({
      name: form.name.trim(),
      feed_url: form.feed_url.trim(),
      site_url: form.site_url.trim() || null,
      kind: form.kind,
      scope: form.scope,
      fetch_interval_minutes: form.fetch_interval_minutes,
      themes: form.themes,
    });
    if (err) setMsg({ ok: false, text: /duplicate|unique/i.test(err.message) ? 'Ce flux existe déjà.' : 'Ajout impossible : vérifiez les champs.' });
    else {
      setMsg({ ok: true, text: 'Source ajoutée.' });
      setForm(EMPTY);
      void load();
    }
  };

  const toggle = async (s: SourceRss) => {
    const { error: err } = await getSupabase().from('sources_rss').update({ is_active: !s.is_active }).eq('id', s.id);
    if (err) setMsg({ ok: false, text: 'Modification impossible.' });
    else void load();
  };
  const remove = async (s: SourceRss) => {
    if (!window.confirm(`Supprimer la source « ${s.name} » ? Les articles déjà collectés sont conservés.`)) return;
    const { error: err } = await getSupabase().from('sources_rss').delete().eq('id', s.id);
    if (err) setMsg({ ok: false, text: 'Suppression impossible.' });
    else void load();
  };

  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-mono text-3xl font-bold text-cyber-lime">Sources RSS</h1>
        <p className="max-w-3xl text-cyber-muted">Flux collectés automatiquement par le Worker (étape 5). Réservé aux administrateurs.</p>
      </header>

      <section aria-labelledby="h-add" className="space-y-3">
        <h2 id="h-add" className="font-mono text-xl font-bold">Ajouter une source</h2>
        <CyberCard tone="lime">
          <form onSubmit={add} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="s-name" className="mb-1 block text-sm text-cyber-muted">Nom</label>
              <input id="s-name" required minLength={2} maxLength={120} value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="s-site" className="mb-1 block text-sm text-cyber-muted">Site (facultatif)</label>
              <input id="s-site" type="url" value={form.site_url} onChange={(e) => set('site_url', e.target.value)} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="s-feed" className="mb-1 block text-sm text-cyber-muted">Adresse du flux RSS / Atom</label>
              <input id="s-feed" type="url" required placeholder="https://…" value={form.feed_url} onChange={(e) => set('feed_url', e.target.value)} className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label htmlFor="s-kind" className="mb-1 block text-sm text-cyber-muted">Type</label>
              <select id="s-kind" value={form.kind} onChange={(e) => set('kind', e.target.value)} className={inputCls}>
                {KINDS.map((k) => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="s-scope" className="mb-1 block text-sm text-cyber-muted">Portée</label>
              <select id="s-scope" value={form.scope} onChange={(e) => set('scope', e.target.value)} className={inputCls}>
                {SCOPES.map((k) => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="s-int" className="mb-1 block text-sm text-cyber-muted">Intervalle de collecte (minutes, 15 à 1440)</label>
              <input id="s-int" type="number" min={15} max={1440} value={form.fetch_interval_minutes} onChange={(e) => set('fetch_interval_minutes', Number(e.target.value))} className={`${inputCls} font-mono`} />
            </div>
            <fieldset className="sm:col-span-2">
              <legend className="mb-1 text-sm text-cyber-muted">Thématiques par défaut</legend>
              <div className="flex flex-wrap gap-1.5">
                {themes.map((t) => (
                  <Chip key={t.slug} tone={t.tone} pressed={form.themes.includes(t.slug)} onClick={() => set('themes', form.themes.includes(t.slug) ? form.themes.filter((x) => x !== t.slug) : [...form.themes, t.slug])}>
                    {t.label}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <div className="sm:col-span-2">
              <NeonButton type="submit" tone="lime">Ajouter</NeonButton>
            </div>
          </form>
        </CyberCard>
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-sm text-cyber-lime' : 'text-sm text-cyber-magenta'}>{msg.text}</p>}
      </section>

      <section aria-labelledby="h-src" className="space-y-3">
        <h2 id="h-src" className="font-mono text-xl font-bold">Sources configurées ({rows.length})</h2>
        <ListState loading={loading} error={error} empty={rows.length === 0} emptyText="Aucune source pour le moment. Ajoutez-en une ci-dessus." onRetry={() => void load()}>
          <ul className="space-y-3">
            {rows.map((s) => (
              <li key={s.id}>
                <CyberCard tone={s.is_active ? 'lime' : 'cyan'} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{s.name}</h3>
                    <Tag tone="lime">{s.kind}</Tag>
                    <Tag>{s.scope}</Tag>
                    <Tag tone={s.is_active ? 'lime' : 'amber'}>{s.is_active ? 'Active' : 'Désactivée'}</Tag>
                  </div>
                  <p className="break-all font-mono text-xs text-cyber-muted">{s.feed_url}</p>
                  <div className="flex flex-wrap gap-2">
                    <NeonButton size="sm" variant="outline" tone="lime" onClick={() => void toggle(s)}>
                      {s.is_active ? 'Désactiver' : 'Activer'}
                    </NeonButton>
                    <NeonButton size="sm" variant="ghost" tone="magenta" onClick={() => void remove(s)}>
                      <Trash2 aria-hidden="true" className="h-4 w-4" /> Supprimer
                      <span className="sr-only"> {s.name}</span>
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
