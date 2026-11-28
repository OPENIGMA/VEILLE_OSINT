import type { Metadata } from 'next';
// Polices auto-hébergées (pas de requête vers Google Fonts au build)
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';
import { AuthProvider } from '@/components/auth-provider';
import { AppShell } from '@/components/app-shell';

export const metadata: Metadata = {
  title: { default: 'veille-osint', template: '%s · veille-osint' },
  description:
    'Plateforme OSINT économique et territoriale : presse, données ouvertes, veille cyber et ingérences.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="dark">
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
