'use client';

import { CyberCard } from '@/components/ui/cyber-card';
import { NeonButton } from '@/components/ui/neon-button';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <CyberCard tone="magenta" role="alert" className="space-y-3">
      <h1 className="font-mono text-2xl font-bold text-cyber-magenta">Une erreur est survenue</h1>
      <p className="text-cyber-muted">La page n’a pas pu s’afficher. Réessayez ; si le problème persiste, revenez à l’accueil.</p>
      <div className="flex gap-3">
        <NeonButton tone="magenta" variant="outline" onClick={reset}>
          Réessayer
        </NeonButton>
        <NeonButton asChild variant="ghost">
          <a href="/">Accueil</a>
        </NeonButton>
      </div>
    </CyberCard>
  );
}
