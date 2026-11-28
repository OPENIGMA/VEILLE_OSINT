import { CyberCard } from '@/components/ui/cyber-card';
import { NeonButton } from '@/components/ui/neon-button';

/** Chargement / erreur / vide pour les listes de l'espace personnel. */
export function ListState({
  loading,
  error,
  empty,
  emptyText,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string;
  empty: boolean;
  emptyText: string;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  if (loading) return <p className="font-mono text-sm text-cyber-muted" role="status">Chargement…</p>;
  if (error)
    return (
      <CyberCard tone="magenta" role="alert" className="space-y-3">
        <p>{error}</p>
        <NeonButton tone="magenta" variant="outline" size="sm" onClick={onRetry}>
          Réessayer
        </NeonButton>
      </CyberCard>
    );
  if (empty) return <CyberCard tone="amber" className="text-sm text-cyber-muted">{emptyText}</CyberCard>;
  return <>{children}</>;
}
