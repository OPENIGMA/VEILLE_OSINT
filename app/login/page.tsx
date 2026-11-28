import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth-form';
import { TerminalLoader } from '@/components/ui/terminal-loader';

export const metadata: Metadata = { title: 'Connexion' };

export default function LoginPage() {
  return (
    <Suspense fallback={<TerminalLoader label="Chargement" />}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
