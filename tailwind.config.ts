import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        // Palette "Cyber Néon / Mission Control"
        cyber: {
          bg: '#0A0E1A', // fond principal (bleu nuit profond)
          card: '#0F1420', // fond secondaire / cartes (glassmorphism)
          cyan: '#00F0FF', // néon principal : CTA, liens actifs, icônes
          magenta: '#FF00E5', // néon secondaire : alertes critiques, cyber, ingérences
          lime: '#39FF14', // néon tertiaire : statuts "online", succès
          amber: '#FFB800', // warning : alertes modérées
          text: '#E6EDF3', // texte principal
          muted: '#8B949E', // texte secondaire
        },
        // Tokens sémantiques (compatibles shadcn/ui), pilotés par globals.css
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        sans: ['Inter Variable', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: [
          'JetBrains Mono Variable',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      // Les intensités passent par --glow-opacity / --glow-strong :
      // le mode "confort" (data-comfort="true") les réduit globalement.
      boxShadow: {
        'glow-cyan': '0 0 20px rgb(0 240 255 / var(--glow-opacity))',
        'glow-magenta': '0 0 20px rgb(255 0 229 / var(--glow-opacity))',
        'glow-lime': '0 0 20px rgb(57 255 20 / var(--glow-opacity))',
        'glow-amber': '0 0 20px rgb(255 184 0 / var(--glow-opacity))',
      },
      backgroundImage: {
        // Grille cyberpunk (opacité 7 %, dans la plage demandée 5-10 %)
        'cyber-grid':
          'linear-gradient(rgba(0, 240, 255, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.07) 1px, transparent 1px)',
        // Balayage radar (loader)
        radar:
          'conic-gradient(from 0deg, rgb(var(--neon, 0 240 255) / 0.5), transparent 25%)',
      },
      backgroundSize: {
        grid: '40px 40px',
      },
      keyframes: {
        // Pulsation du halo (barre de recherche au focus, éléments actifs)
        'glow-pulse': {
          '0%, 100%': {
            boxShadow: '0 0 8px rgb(var(--neon, 0 240 255) / 0.25)',
          },
          '50%': {
            boxShadow: '0 0 24px rgb(var(--neon, 0 240 255) / 0.6)',
          },
        },
        // Ligne de balayage (effet scanner)
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        // Radar : rotation du faisceau
        'radar-sweep': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        // Curseur de terminal
        blink: {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
        // Effet machine à écrire (à combiner avec overflow-hidden + whitespace-nowrap)
        typewriter: {
          from: { width: '0' },
          to: { width: '100%' },
        },
        // Apparition des résultats
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'glow-pulse': 'glow-pulse 2.4s ease-in-out infinite',
        scan: 'scan 3s linear infinite',
        'radar-sweep': 'radar-sweep 2.4s linear infinite',
        blink: 'blink 1s steps(1) infinite',
        typewriter: 'typewriter 2s steps(30, end) forwards',
        'fade-in-up': 'fade-in-up 0.3s ease-out both',
      },
    },
  },
  plugins: [animate],
};

export default config;
