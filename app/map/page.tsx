import Link from 'next/link';
import type { Metadata } from 'next';
import { CyberCard } from '@/components/ui/cyber-card';
import { NeonButton } from '@/components/ui/neon-button';

export const metadata: Metadata = { title: 'Carte' };

export default function MapPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-mono text-3xl font-bold text-cyber-cyan">Carte territoriale</h1>
        <p className="max-w-3xl text-cyber-muted">
          Articles et menaces géolocalisés, regroupés par zone, avec fond de carte sombre.
        </p>
      </header>
      <CyberCard tone="amber" className="space-y-3">
        <p className="font-mono text-sm uppercase tracking-widest text-cyber-amber">En construction</p>
        <p>
          La carte interactive arrive avec les composants avancés (étape 6). En attendant, la recherche
          sait déjà filtrer par territoire, par code postal et par rayon GPS.
        </p>
        <div className="flex flex-wrap gap-3">
          <NeonButton asChild>
            <Link href="/search/">Ouvrir la recherche géographique</Link>
          </NeonButton>
        </div>
      </CyberCard>
    </div>
  );
}
