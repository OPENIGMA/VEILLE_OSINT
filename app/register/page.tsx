import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth-form';
import { TerminalLoader } from '@/components/ui/terminal-loader';

export const metadata: Metadata = { title: 'Inscription' };

export default function RegisterPage() {
  return (
    <Suspense fallback={<TerminalLoader label="Chargement" />}>
      <AuthForm mode="register" />
    </Suspense>
  );
}
