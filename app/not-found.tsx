import Link from 'next/link';
import { CyberCard } from '@/components/ui/cyber-card';
import { NeonButton } from '@/components/ui/neon-button';

export default function NotFound() {
  return (
    <CyberCard tone="amber" className="space-y-3">
      <p className="font-mono text-sm text-cyber-amber">404</p>
      <h1 className="font-mono text-2xl font-bold">Page introuvable</h1>
      <p className="text-cyber-muted">Cette adresse n’existe pas ou a été déplacée.</p>
      <NeonButton asChild>
        <Link href="/">Retour à l’accueil</Link>
      </NeonButton>
    </CyberCard>
  );
}
