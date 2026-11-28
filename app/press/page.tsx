import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SearchWorkspace } from '@/components/search-workspace';
import { TerminalLoader } from '@/components/ui/terminal-loader';

export const metadata: Metadata = { title: 'Flux presse' };

export default function PressPage() {
  return (
    <Suspense fallback={<TerminalLoader label="Chargement du flux presse" />}>
      <SearchWorkspace variant="press" />
    </Suspense>
  );
}
