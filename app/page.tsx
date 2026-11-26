import Link from 'next/link';
import { CyberCard } from '@/components/ui/cyber-card';
import { NeonButton } from '@/components/ui/neon-button';

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <CyberCard active className="space-y-4 px-10 py-8 text-center">
        <h1 className="font-mono text-4xl font-bold tracking-tight text-cyber-cyan">
          veille-osint
        </h1>
        <p className="font-mono text-sm text-cyber-muted">
          <span className="text-cyber-lime" aria-hidden="true">
            ●
          </span>{' '}
          système en ligne
        </p>
        <NeonButton asChild variant="outline" size="sm">
          <Link href="/design/">design system</Link>
        </NeonButton>
      </CyberCard>
    </main>
  );
}
