'use client';

import { Search } from 'lucide-react';
import { NeonButton } from '@/components/ui/neon-button';
import { cn } from '@/lib/utils';

/**
 * Barre de recherche principale : cadre néon cyan, pulsation au focus.
 * À placer DANS un <form> (le bouton envoie le formulaire).
 */
export function SearchBar({
  value,
  onChange,
  placeholder = 'Rechercher : drone, « free party » ET Occitanie, ingérence SAUF sport…',
  large = false,
  id = 'q',
  label = 'Recherche',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  large?: boolean;
  id?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        '[--neon:0_240_255] flex items-center gap-2 rounded-lg border border-cyber-cyan/60 bg-cyber-card/80 p-1.5 backdrop-blur-[12px]',
        'shadow-[0_0_20px_rgb(var(--neon)/var(--glow-opacity))]',
        'focus-within:border-cyber-cyan focus-within:animate-glow-pulse motion-reduce:focus-within:animate-none',
        'motion-reduce:focus-within:shadow-[0_0_24px_rgb(var(--neon)/var(--glow-strong))]',
      )}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search aria-hidden="true" className={cn('ml-2 shrink-0 text-cyber-cyan', large ? 'h-6 w-6' : 'h-5 w-5')} />
      <input
        id={id}
        name="q"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        maxLength={500}
        className={cn(
          // L'anneau de focus est porté par le cadre (focus-within), pas par le champ
          'min-w-0 flex-1 bg-transparent font-mono text-cyber-text placeholder:text-cyber-muted focus-visible:outline-none focus-visible:shadow-none',
          large ? 'h-12 text-base' : 'h-10 text-sm',
        )}
      />
      <NeonButton type="submit" size={large ? 'lg' : 'md'}>
        Rechercher
      </NeonButton>
    </div>
  );
}
