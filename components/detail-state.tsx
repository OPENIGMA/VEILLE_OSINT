'use client';

import Link from 'next/link';
import { CyberCard } from '@/components/ui/cyber-card';
import { NeonButton } from '@/components/ui/neon-button';
import { TerminalLoader } from '@/components/ui/terminal-loader';

export type DetailStatus = 'loading' | 'error' | 'notfound' | 'ready';

/** États communs des pages de détail : chargement, erreur réseau, introuvable. */
export function DetailState({ status, error, backHref, backLabel }: { status: Exclude<DetailStatus, 'ready'>; error?: string; backHref: string; backLabel: string }) {
  if (status === 'loading') return <TerminalLoader label="Chargement de la fiche" />;
  return (
    <CyberCard tone={status === 'error' ? 'magenta' : 'amber'} role={status === 'error' ? 'alert' : 'status'} className="space-y-3">
      <p>{status === 'error' ? error || 'Une erreur est survenue.' : 'Cette fiche est introuvable (supprimée ou identifiant invalide).'}</p>
      <NeonButton asChild variant="outline" size="sm">
        <Link href={backHref}>← {backLabel}</Link>
      </NeonButton>
    </CyberCard>
  );
}
