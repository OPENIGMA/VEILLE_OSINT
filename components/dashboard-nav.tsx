'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/dashboard/', label: "Vue d'ensemble" },
  { href: '/dashboard/searches/', label: 'Recherches' },
  { href: '/dashboard/favorites/', label: 'Favoris' },
  { href: '/dashboard/history/', label: 'Historique' },
];

/** Sous-navigation de l'espace personnel. */
export function DashboardNav() {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label="Espace personnel" className="flex gap-1 overflow-x-auto border-b border-cyber-cyan/20 pb-px">
      {LINKS.map((l) => {
        const active = l.href === '/dashboard/' ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap rounded-t-md border-b-2 px-4 py-2 font-mono text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan',
              active
                ? 'border-cyber-cyan bg-cyber-cyan/10 text-cyber-cyan'
                : 'border-transparent text-cyber-muted hover:text-cyber-text',
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
