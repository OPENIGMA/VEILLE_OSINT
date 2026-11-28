'use client';

import { useEffect, useState } from 'react';
import { NeonButton } from '@/components/ui/neon-button';
import { useAuth } from '@/components/auth-provider';
import { getSupabase } from '@/lib/supabase/client';

const STORAGE_KEY = 'veille-osint:comfort';

/** Bascule le mode "confort" : réduit l'intensité des néons (data-comfort sur <html>). */
export function ComfortToggle() {
  const [comfort, setComfort] = useState(false);
  const { user, profile } = useAuth();

  // Restaure la préférence enregistrée (le stockage peut être indisponible : try/catch)
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') setComfort(true);
    } catch {
      /* ignoré */
    }
  }, []);

  // Connecté : la préférence enregistrée dans le profil suit l'utilisateur d'un appareil à l'autre
  useEffect(() => {
    if (profile?.comfort_mode) setComfort(true);
  }, [profile?.comfort_mode]);

  const toggle = () => {
    const next = !comfort;
    setComfort(next);
    if (user) void getSupabase().from('profiles').update({ comfort_mode: next }).eq('id', user.id);
  };

  useEffect(() => {
    document.documentElement.dataset.comfort = comfort ? 'true' : 'false';
    try {
      localStorage.setItem(STORAGE_KEY, comfort ? '1' : '0');
    } catch {
      /* ignoré */
    }
  }, [comfort]);

  return (
    <NeonButton
      variant="outline"
      tone="amber"
      size="sm"
      aria-pressed={comfort}
      onClick={toggle}
    >
      Mode confort : {comfort ? 'activé' : 'désactivé'}
    </NeonButton>
  );
}
