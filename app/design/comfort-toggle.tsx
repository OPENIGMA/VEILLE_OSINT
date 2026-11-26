'use client';

import { useEffect, useState } from 'react';
import { NeonButton } from '@/components/ui/neon-button';

const STORAGE_KEY = 'veille-osint:comfort';

/** Bascule le mode "confort" : réduit l'intensité des néons (data-comfort sur <html>). */
export function ComfortToggle() {
  const [comfort, setComfort] = useState(false);

  // Restaure la préférence enregistrée (le stockage peut être indisponible : try/catch)
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') setComfort(true);
    } catch {
      /* ignoré */
    }
  }, []);

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
      onClick={() => setComfort((c) => !c)}
    >
      Mode confort : {comfort ? 'activé' : 'désactivé'}
    </NeonButton>
  );
}
