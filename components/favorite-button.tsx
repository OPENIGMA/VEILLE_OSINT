'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { getSupabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { FavoriteRow } from '@/lib/types';

/** Ajoute/retire un favori. Invisible pour les visiteurs (la RLS l'interdirait de toute façon). */
export function FavoriteButton({
  targetType,
  targetId,
}: {
  targetType: FavoriteRow['target_type'];
  targetId: string;
}) {
  const { user } = useAuth();
  const [favId, setFavId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setFavId(null);
      return;
    }
    let active = true;
    getSupabase()
      .from('favorites')
      .select('id')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setFavId((data as { id: string } | null)?.id ?? null);
      });
    return () => {
      active = false;
    };
  }, [user, targetType, targetId]);

  if (!user) return null;

  const toggle = async () => {
    setBusy(true);
    setError(null);
    const supabase = getSupabase();
    if (favId) {
      const { error: e } = await supabase.from('favorites').delete().eq('id', favId);
      if (e) setError('Action impossible.');
      else setFavId(null);
    } else {
      const { data, error: e } = await supabase
        .from('favorites')
        .insert({ target_type: targetType, target_id: targetId })
        .select('id')
        .single();
      if (e) setError(/quota/i.test(e.message) ? 'Limite de 1 000 favoris atteinte.' : 'Action impossible.');
      else setFavId((data as { id: string }).id);
    }
    setBusy(false);
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={favId !== null}
        aria-label={favId ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        className={cn(
          'rounded-md p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan disabled:opacity-50',
          favId ? 'text-cyber-amber' : 'text-cyber-muted hover:text-cyber-amber',
        )}
      >
        <Star aria-hidden="true" className="h-5 w-5" fill={favId ? 'currentColor' : 'none'} />
      </button>
      {error && (
        <span role="alert" className="text-xs text-cyber-magenta">
          {error}
        </span>
      )}
    </span>
  );
}
