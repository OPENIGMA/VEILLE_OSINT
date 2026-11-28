'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import { CyberCard } from '@/components/ui/cyber-card';
import type { NeonTone } from '@/lib/neon';

/** Compteur « terminal » : le nombre monte jusqu'à sa valeur (sans animation si mouvement réduit). */
export function StatCounter({
  label,
  value,
  tone = 'cyan',
  loading = false,
}: {
  label: string;
  value: number | null;
  tone?: NeonTone;
  loading?: boolean;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    if (value === null) return;
    if (reduce) {
      setShown(value);
      return;
    }
    const controls = animate(prev.current, value, {
      duration: 0.9,
      ease: 'easeOut',
      onUpdate: (v) => setShown(Math.round(v)),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, reduce]);

  return (
    <CyberCard tone={tone} className="space-y-1">
      <p className="font-mono text-xs uppercase tracking-widest text-cyber-muted">{label}</p>
      <p className="font-mono text-3xl font-bold tabular-nums text-[rgb(var(--neon))]">
        {loading ? '…' : value === null ? '—' : shown.toLocaleString('fr-FR')}
        <span aria-hidden="true" className="ml-1 inline-block animate-blink motion-reduce:animate-none">
          ▍
        </span>
      </p>
      {/* Valeur finale pour les lecteurs d'écran (l'animation est masquée) */}
      <span className="sr-only">{value === null ? 'indisponible' : value.toLocaleString('fr-FR')}</span>
    </CyberCard>
  );
}
