import { RequireAuth } from '@/components/require-auth';

/** Toutes les pages de ce groupe exigent une session (garde côté navigateur + RLS côté base). */
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
