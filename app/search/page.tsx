import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SearchWorkspace } from '@/components/search-workspace';
import { TerminalLoader } from '@/components/ui/terminal-loader';

export const metadata: Metadata = { title: 'Recherche' };

export default function SearchPage() {
  return (
    <Suspense fallback={<TerminalLoader label="Chargement de la recherche" />}>
      <SearchWorkspace variant="search" />
    </Suspense>
  );
}
