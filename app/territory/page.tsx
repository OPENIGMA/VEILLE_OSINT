import { Suspense } from 'react';
import type { Metadata } from 'next';
import { TerritoryView } from './territory-view';
import { TerminalLoader } from '@/components/ui/terminal-loader';

export const metadata: Metadata = { title: 'Territoire' };

export default function TerritoryPage() {
  return (
    <Suspense fallback={<TerminalLoader label="Chargement du territoire" />}>
      <TerritoryView />
    </Suspense>
  );
}
