'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { TerminalLoader } from '@/components/ui/terminal-loader';
import { CyberCard } from '@/components/ui/cyber-card';

/**
 * Garde d'accès CÔTÉ NAVIGATEUR.
 *
 * Le site est un export statique : un middleware Next.js ne peut pas s'exécuter.
 * Cette garde sert donc uniquement à l'ergonomie (rediriger vers /login, ne pas
 * afficher d'écrans vides). La VRAIE protection des données est la RLS de
 * Supabase : même en contournant cette garde, un utilisateur non connecté ne peut
 * rien lire ni écrire.
 */
export function RequireAuth({
  admin = false,
  children,
}: {
  admin?: boolean;
  children: React.ReactNode;
}) {
  const { loading, user, profile, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login/?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  // Session en cours de lecture, ou redirection en cours
  if (loading || !user || (admin && !profile)) {
    return (
      <TerminalLoader
        label="Vérification de la session"
        lines={['> vérification de la session…', '> contrôle des droits d\'accès…']}
      />
    );
  }

  if (admin && !isAdmin) {
    return (
      <CyberCard tone="magenta" role="alert" className="space-y-2">
        <h1 className="font-mono text-xl font-bold text-[rgb(var(--neon))]">Accès refusé</h1>
        <p className="text-cyber-muted">Cette page est réservée aux administrateurs.</p>
      </CyberCard>
    );
  }

  return <>{children}</>;
}
