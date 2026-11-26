import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { neonTone } from '@/lib/neon';

const neonButtonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-mono font-semibold uppercase tracking-wider transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--neon))] focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
  {
    variants: {
      tone: neonTone,
      variant: {
        // Plein : texte sombre sur néon (contraste ≥ 5,8:1 sur les 4 tons)
        solid:
          'bg-[rgb(var(--neon))] text-cyber-bg hover:shadow-[0_0_20px_rgb(var(--neon)/var(--glow-strong))]',
        outline:
          'border border-[rgb(var(--neon)/0.6)] bg-transparent text-[rgb(var(--neon))] hover:border-[rgb(var(--neon))] hover:bg-[rgb(var(--neon)/0.1)] hover:shadow-[0_0_20px_rgb(var(--neon)/var(--glow-opacity))]',
        ghost:
          'bg-transparent text-[rgb(var(--neon))] hover:bg-[rgb(var(--neon)/0.1)]',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-5 text-sm',
        lg: 'h-12 px-7 text-base',
      },
    },
    defaultVariants: { tone: 'cyan', variant: 'solid', size: 'md' },
  },
);

export interface NeonButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof neonButtonVariants> {
  /** Rend l'enfant à la place du <button> (ex. un lien <a> ou <Link> stylé comme un bouton). */
  asChild?: boolean;
}

const NeonButton = React.forwardRef<HTMLButtonElement, NeonButtonProps>(
  ({ className, tone, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        // Évite de soumettre un formulaire par accident
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(neonButtonVariants({ tone, variant, size }), className)}
        {...props}
      />
    );
  },
);
NeonButton.displayName = 'NeonButton';

export { NeonButton, neonButtonVariants };
