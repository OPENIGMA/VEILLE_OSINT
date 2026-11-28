import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AlertsView } from './alerts-view';
import { TerminalLoader } from '@/components/ui/terminal-loader';

export const metadata: Metadata = { title: 'Alertes' };

export default function AlertsPage() {
  return (
    <Suspense fallback={<TerminalLoader label="Chargement des alertes" />}>
      <AlertsView />
    </Suspense>
  );
}
