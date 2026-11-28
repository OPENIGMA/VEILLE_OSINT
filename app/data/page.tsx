import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SearchWorkspace } from '@/components/search-workspace';
import { TerminalLoader } from '@/components/ui/terminal-loader';

export const metadata: Metadata = { title: 'Jeux de données' };

export default function DataPage() {
  return (
    <Suspense fallback={<TerminalLoader label="Chargement des jeux de données" />}>
      <SearchWorkspace variant="data" />
    </Suspense>
  );
}
