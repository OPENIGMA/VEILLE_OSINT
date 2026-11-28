import { cn } from '@/lib/utils';
import { neonTone, type NeonTone } from '@/lib/neon';

/** Pastille de filtre (bouton à bascule). aria-pressed pour les lecteurs d'écran. */
export function Chip({
  pressed,
  onClick,
  tone = 'cyan',
  children,
  disabled,
}: {
  pressed: boolean;
  onClick: () => void;
  tone?: NeonTone;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        neonTone[tone],
        'inline-flex items-center rounded-full border px-3 py-1 font-mono text-xs transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--neon))]',
        'hover:shadow-[0_0_14px_rgb(var(--neon)/var(--glow-opacity))] disabled:opacity-50',
        pressed
          ? 'border-[rgb(var(--neon))] bg-[rgb(var(--neon)/0.18)] text-[rgb(var(--neon))] shadow-[0_0_14px_rgb(var(--neon)/var(--glow-opacity))]'
          : 'border-[rgb(var(--neon)/0.35)] bg-transparent text-cyber-text',
      )}
    >
      {children}
    </button>
  );
}

/** Étiquette non interactive (thème, type, gravité). */
export function Tag({ tone = 'cyan', children }: { tone?: NeonTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        neonTone[tone],
        'inline-flex items-center rounded border border-[rgb(var(--neon)/0.4)] bg-[rgb(var(--neon)/0.1)] px-2 py-0.5 font-mono text-[11px] text-[rgb(var(--neon))]',
      )}
    >
      {children}
    </span>
  );
}
