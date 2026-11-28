import { RequireAuth } from '@/components/require-auth';

export default function SourcesLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth admin>{children}</RequireAuth>;
}
