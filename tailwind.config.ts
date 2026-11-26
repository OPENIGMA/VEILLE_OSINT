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
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(0, 240, 255, 0.4)',
        'glow-magenta': '0 0 20px rgba(255, 0, 229, 0.4)',
        'glow-lime': '0 0 20px rgba(57, 255, 20, 0.4)',
        'glow-amber': '0 0 20px rgba(255, 184, 0, 0.4)',
      },
      backgroundImage: {
        'cyber-grid':
          'linear-gradient(rgba(0, 240, 255, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.07) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '40px 40px',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0, 240, 255, 0.25)' },
          '50%': { boxShadow: '0 0 24px rgba(0, 240, 255, 0.55)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        blink: {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
      },
      animation: {
        'glow-pulse': 'glow-pulse 2.4s ease-in-out infinite',
        scan: 'scan 3s linear infinite',
        blink: 'blink 1s steps(1) infinite',
      },
    },
  },
  plugins: [animate],
};

export default config;
