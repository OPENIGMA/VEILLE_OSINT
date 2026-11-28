'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Tag } from '@/components/chip';
import { getSupabase } from '@/lib/supabase/client';

/** Liste de territoires (identifiants → noms), chacun lié à sa fiche. */
export function TerritoryLinks({ ids }: { ids: string[] }) {
  const [names, setNames] = useState<Record<string, string>>({});
  const key = ids.join(',');
  useEffect(() => {
    if (ids.length === 0) return;
    let active = true;
    getSupabase()
      .from('territories')
      .select('id,name')
      .in('id', ids)
      .then(({ data }) => {
        if (!active || !data) return;
        setNames(Object.fromEntries((data as { id: string; name: string }[]).map((r) => [r.id, r.name])));
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (ids.length === 0) return <span className="text-cyber-muted">Non localisé</span>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <li key={id}>
          <Link href={`/territory/?code=${encodeURIComponent(id)}`} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan">
            <Tag>{names[id] ?? id}</Tag>
          </Link>
        </li>
      ))}
    </ul>
  );
}
