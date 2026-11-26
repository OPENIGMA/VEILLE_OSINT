import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { neonTone } from '@/lib/neon';

const cyberCardVariants = cva(
  // Glassmorphism : fond translucide + flou 12px + bordure néon fine (1px)
  'relative rounded-lg border border-[rgb(var(--neon)/0.3)] bg-cyber-card/70 p-4 text-cyber-text backdrop-blur-[12px]',
  {
    variants: {
      tone: neonTone,
      // Carte cliquable : intensification du glow + translateY(-2px) au survol
      interactive: {
        true: 'transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgb(var(--neon)/0.7)] hover:shadow-[0_0_20px_rgb(var(--neon)/var(--glow-strong))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--neon))] motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        false: '',
      },
      // Carte active / sélectionnée : halo permanent
      active: {
        true: 'border-[rgb(var(--neon)/0.7)] shadow-[0_0_20px_rgb(var(--neon)/var(--glow-opacity))]',
        false: '',
      },
    },
    defaultVariants: { tone: 'cyan', interactive: false, active: false },
  },
);

export interface CyberCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cyberCardVariants> {
  /** Rend l'enfant à la place du <div> (ex. un <a> ou un <Link> : carte cliquable accessible). */
  asChild?: boolean;
}

const CyberCard = React.forwardRef<HTMLDivElement, CyberCardProps>(
  ({ className, tone, interactive, active, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'div';
    return (
      <Comp
        ref={ref}
        className={cn(cyberCardVariants({ tone, interactive, active }), className)}
        {...props}
      />
    );
  },
);
CyberCard.displayName = 'CyberCard';

export { CyberCard, cyberCardVariants };
