import type { Metadata } from 'next';
// Polices auto-hébergées (pas de requête vers Google Fonts au build)
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'veille-osint',
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
      <body>{children}</body>
    </html>
  );
}
