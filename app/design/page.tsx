import type { Metadata } from 'next';
import Link from 'next/link';
import { CyberCard } from '@/components/ui/cyber-card';
import { NeonButton } from '@/components/ui/neon-button';
import { TerminalLoader } from '@/components/ui/terminal-loader';
import { ComfortToggle } from './comfort-toggle';

export const metadata: Metadata = {
  title: 'Design system — veille-osint',
};

// Ratios de contraste WCAG calculés sur le fond principal #0A0E1A
const palette = [
  { name: 'cyber-bg', hex: '#0A0E1A', role: 'Fond principal', ratio: null },
  { name: 'cyber-card', hex: '#0F1420', role: 'Cartes (glassmorphism)', ratio: null },
  { name: 'cyber-cyan', hex: '#00F0FF', role: 'CTA, liens actifs, icônes', ratio: '13,67' },
  { name: 'cyber-magenta', hex: '#FF00E5', role: 'Alertes critiques, cyber, ingérences', ratio: '5,85' },
  { name: 'cyber-lime', hex: '#39FF14', role: 'Statut en ligne, succès', ratio: '14,20' },
  { name: 'cyber-amber', hex: '#FFB800', role: 'Alertes modérées', ratio: '11,10' },
  { name: 'cyber-text', hex: '#E6EDF3', role: 'Texte principal', ratio: '16,30' },
  { name: 'cyber-muted', hex: '#8B949E', role: 'Texte secondaire', ratio: '6,26' },
];

export default function DesignPage() {
  return (
    <main className="container space-y-12 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-mono text-3xl font-bold text-cyber-cyan">
            design-system
          </h1>
          <p className="mt-1 text-cyber-muted">
            Cyber Néon / Mission Control — page de démonstration (étape 2)
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ComfortToggle />
          <NeonButton asChild variant="ghost" size="sm">
            <Link href="/">← accueil</Link>
          </NeonButton>
        </div>
      </header>

      <section aria-labelledby="palette" className="space-y-4">
        <h2 id="palette" className="font-mono text-xl text-cyber-text">
          Palette
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {palette.map((c) => (
            <li key={c.name}>
              <CyberCard className="space-y-2 p-3">
                <div
                  className="h-12 rounded-md border border-white/10"
                  style={{ backgroundColor: c.hex }}
                  aria-hidden="true"
                />
                <p className="font-mono text-sm text-cyber-text">{c.name}</p>
                <p className="font-mono text-xs text-cyber-muted">{c.hex}</p>
                <p className="text-xs text-cyber-muted">{c.role}</p>
                {c.ratio && (
                  <p className="font-mono text-xs text-cyber-lime">
                    contraste {c.ratio}:1
                  </p>
                )}
              </CyberCard>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="boutons" className="space-y-4">
        <h2 id="boutons" className="font-mono text-xl text-cyber-text">
          NeonButton
        </h2>
        <div className="space-y-4">
          {(['solid', 'outline', 'ghost'] as const).map((variant) => (
            <div key={variant} className="flex flex-wrap items-center gap-3">
              <span className="w-20 font-mono text-xs text-cyber-muted">
                {variant}
              </span>
              <NeonButton variant={variant} tone="cyan">
                Rechercher
              </NeonButton>
              <NeonButton variant={variant} tone="magenta">
                Menace
              </NeonButton>
              <NeonButton variant={variant} tone="lime">
                En ligne
              </NeonButton>
              <NeonButton variant={variant} tone="amber">
                Attention
              </NeonButton>
              <NeonButton variant={variant} disabled>
                Désactivé
              </NeonButton>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-20 font-mono text-xs text-cyber-muted">tailles</span>
            <NeonButton size="sm">sm</NeonButton>
            <NeonButton size="md">md</NeonButton>
            <NeonButton size="lg">lg</NeonButton>
          </div>
        </div>
      </section>

      <section aria-labelledby="cartes" className="space-y-4">
        <h2 id="cartes" className="font-mono text-xl text-cyber-text">
          CyberCard
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <CyberCard tone="cyan" interactive asChild>
            <a href="#cartes">
              <p className="font-mono text-xs text-cyber-cyan">ÉCONOMIE</p>
              <p className="mt-2 font-medium">Carte interactive</p>
              <p className="mt-1 text-sm text-cyber-muted">
                Survol : glow renforcé et léger relèvement.
              </p>
            </a>
          </CyberCard>
          <CyberCard tone="magenta" interactive asChild>
            <a href="#cartes">
              <p className="font-mono text-xs text-cyber-magenta">CYBERATTAQUE</p>
              <p className="mt-2 font-medium">Alerte critique</p>
              <p className="mt-1 text-sm text-cyber-muted">
                Magenta réservé aux menaces et ingérences.
              </p>
            </a>
          </CyberCard>
          <CyberCard tone="amber" active>
            <p className="font-mono text-xs text-cyber-amber">ALERTE MODÉRÉE</p>
            <p className="mt-2 font-medium">Carte active</p>
            <p className="mt-1 text-sm text-cyber-muted">
              Halo permanent pour l&apos;élément sélectionné.
            </p>
          </CyberCard>
          <CyberCard tone="lime">
            <p className="font-mono text-xs text-cyber-lime">
              <span aria-hidden="true">●</span> EN LIGNE
            </p>
            <p className="mt-2 font-medium">Carte statique</p>
            <p className="mt-1 text-sm text-cyber-muted">
              Glassmorphism : flou 12px et bordure néon fine.
            </p>
          </CyberCard>
        </div>
      </section>

      <section aria-labelledby="loader" className="space-y-4">
        <h2 id="loader" className="font-mono text-xl text-cyber-text">
          TerminalLoader
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <TerminalLoader />
          <TerminalLoader
            tone="magenta"
            label="Analyse des menaces en cours"
            lines={[
              '> scan des flux CERT-FR…',
              '> corrélation des indicateurs…',
              '> 0 menace critique détectée',
            ]}
          />
        </div>
      </section>
    </main>
  );
}
