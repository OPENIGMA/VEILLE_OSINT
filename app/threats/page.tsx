import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SearchWorkspace } from '@/components/search-workspace';
import { ThreatStats } from '@/components/threat-stats';
import { TerminalLoader } from '@/components/ui/terminal-loader';

export const metadata: Metadata = { title: 'Veille cyber & ingérences' };

export default function ThreatsPage() {
  return (
    <div className="space-y-8">
      <ThreatStats />
      <Suspense fallback={<TerminalLoader label="Chargement de la veille" />}>
        <SearchWorkspace variant="threats" />
      </Suspense>
    </div>
  );
}
