import type { Metadata } from 'next';
import { SourcesAdmin } from './sources-admin';

export const metadata: Metadata = { title: 'Sources RSS (admin)' };

export default function SourcesPage() {
  return <SourcesAdmin />;
}
