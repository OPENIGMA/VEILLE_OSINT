'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { StatCounter } from '@/components/stat-counter';
import { CyberCard } from '@/components/ui/cyber-card';
import { NeonButton } from '@/components/ui/neon-button';
import { ListState } from '@/components/list-state';
import { replayHref } from '@/components/saved-search-link';
import { useAlerts, useFavorites, useHistory, useSavedSearches } from '@/lib/use-user-data';

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const saved = useSavedSearches();
  const favs = useFavorites();
  const alerts = useAlerts();
  const history = useHistory();
  const name = profile?.display_name || user?.email?.split('@')[0] || '';

  return (
    <div className="space-y-6">
      <p className="text-lg">
        Bonjour <span className="font-mono text-cyber-cyan">{name}</span>.
      </p>

      <section aria-label="Vos chiffres" className="grid gap-3 sm:grid-cols-3">
        <StatCounter label="Recherches enregistrées" value={saved.loading ? null : saved.rows.length} loading={saved.loading} />
        <StatCounter label="Favoris" value={favs.loading ? null : favs.rows.length} tone="amber" loading={favs.loading} />
        <StatCounter label="Alertes actives" value={alerts.loading ? null : alerts.rows.filter((a) => a.is_active).length} tone="magenta" loading={alerts.loading} />
      </section>

      <section aria-labelledby="h-rec" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="h-rec" className="font-mono text-xl font-bold">Recherches récentes</h2>
          <NeonButton asChild variant="ghost" size="sm">
            <Link href="/dashboard/history/">Tout l’historique →</Link>
          </NeonButton>
        </div>
        <ListState
          loading={history.loading}
          error={history.error}
          empty={history.rows.length === 0}
          emptyText="Votre historique est vide : lancez une recherche pour le remplir."
          onRetry={history.reload}
        >
          <ul className="space-y-2">
            {history.rows.slice(0, 5).map((h) => (
              <li key={h.id}>
                <CyberCard className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-mono text-sm">{h.query || '(filtres seuls)'}</span>
                  <NeonButton asChild variant="outline" size="sm">
                    <Link href={replayHref(h)}>Relancer</Link>
                  </NeonButton>
                </CyberCard>
              </li>
            ))}
          </ul>
        </ListState>
      </section>
    </div>
  );
}
