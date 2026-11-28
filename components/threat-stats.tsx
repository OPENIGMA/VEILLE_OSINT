'use client';

import { StatCounter } from '@/components/stat-counter';
import { useCounts } from '@/lib/use-counts';

export function ThreatStats() {
  const c = useCounts();
  return (
    <section aria-label="Indicateurs de menaces" className="grid gap-3 sm:grid-cols-2">
      <StatCounter label="Menaces recensées" value={c.threats} tone="magenta" loading={c.loading} />
      <StatCounter label="Élevées ou critiques · 30 jours" value={c.critical} tone="amber" loading={c.loading} />
    </section>
  );
}
