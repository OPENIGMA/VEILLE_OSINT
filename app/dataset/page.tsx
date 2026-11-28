import { Suspense } from 'react';
import type { Metadata } from 'next';
import { DatasetView } from './dataset-view';
import { TerminalLoader } from '@/components/ui/terminal-loader';

export const metadata: Metadata = { title: 'Jeu de données' };

export default function DatasetPage() {
  return (
    <Suspense fallback={<TerminalLoader label="Chargement du jeu de données" />}>
      <DatasetView />
    </Suspense>
  );
}
