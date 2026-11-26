'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { neonTone, type NeonTone } from '@/lib/neon';

const DEFAULT_LINES = [
  '> initialisation du module de veille…',
  '> connexion aux sources ouvertes…',
  '> indexation des résultats…',
];

export interface TerminalLoaderProps {
  /** Lignes affichées en machine à écrire, en boucle. */
  lines?: string[];
  /** Texte lu par les lecteurs d'écran (l'animation, elle, est masquée). */
  label?: string;
  tone?: NeonTone;
  className?: string;
}

const CHAR_DELAY_MS = 28;
const LINE_DELAY_MS = 350;
const LOOP_DELAY_MS = 1200;

export function TerminalLoader({
  lines = DEFAULT_LINES,
  label = 'Chargement en cours',
  tone = 'cyan',
  className,
}: TerminalLoaderProps) {
  const reduceMotion = useReducedMotion();
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    // Mouvement réduit : toutes les lignes sont affichées d'un coup, sans timer.
    if (reduceMotion || lines.length === 0) return;

    const current = lines[lineIndex] ?? '';
    let timer: ReturnType<typeof setTimeout>;

    if (charIndex < current.length) {
      timer = setTimeout(() => setCharIndex((c) => c + 1), CHAR_DELAY_MS);
    } else if (lineIndex < lines.length - 1) {
      timer = setTimeout(() => {
        setLineIndex((i) => i + 1);
        setCharIndex(0);
      }, LINE_DELAY_MS);
    } else {
      timer = setTimeout(() => {
        setLineIndex(0);
        setCharIndex(0);
      }, LOOP_DELAY_MS);
    }

    return () => clearTimeout(timer);
  }, [reduceMotion, lines, lineIndex, charIndex]);

  const visible = reduceMotion
    ? lines
    : [...lines.slice(0, lineIndex), (lines[lineIndex] ?? '').slice(0, charIndex)];

  return (
    <div
      role="status"
      className={cn(
        neonTone[tone],
        'rounded-lg border border-[rgb(var(--neon)/0.3)] bg-cyber-card/70 p-4 font-mono text-sm text-[rgb(var(--neon))] backdrop-blur-[12px]',
        className,
      )}
    >
      <span className="sr-only">{label}</span>
      {/* Animation purement visuelle : masquée aux lecteurs d'écran pour éviter l'annonce lettre par lettre */}
      <div aria-hidden="true" className="min-h-[4.5rem] space-y-1">
        {visible.map((text, i) => (
          <motion.p
            key={i}
            initial={reduceMotion ? false : { opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
            {text}
            {i === visible.length - 1 && (
              <span className="ml-0.5 inline-block animate-blink motion-reduce:animate-none">
                ▍
              </span>
            )}
          </motion.p>
        ))}
      </div>
    </div>
  );
}
