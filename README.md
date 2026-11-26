# veille-osint

Plateforme web OSINT économique et territoriale : presse locale et spécialisée, jeux de données ouverts (data.gouv.fr), veille cyber et ingérences. Focus initial Occitanie, PACA, Corse, schéma de données national + Outre-mer.

> État : **ÉTAPE 0** — structure Next.js minimale pour valider le build Cloudflare Pages.

## Stack (100 % free tier)

| Couche | Technologie |
| --- | --- |
| Frontend | Next.js 14 (App Router, export statique) |
| Styling | Tailwind CSS + shadcn/ui + Framer Motion |
| Carte / graphiques | Leaflet (CartoDB Dark Matter) + Chart.js |
| Backend / DB | Supabase (PostgreSQL, Auth, Edge Functions, RLS) |
| Ingestion | Cloudflare Workers (cron) + KV |
| CI/CD | GitHub → Cloudflare Pages (auto-déploiement sur `main`) |

## Développement local

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # export statique dans out/
```

## Déploiement Cloudflare Pages

Réglages du projet Pages :

- **Framework preset** : Next.js (Static HTML Export)
- **Build command** : `npm run build`
- **Build output directory** : `out`
- **Variable d'environnement** : `NODE_VERSION=20` (ou fichier `.nvmrc`, déjà présent)

Chaque push sur `main` redéclenche le déploiement.

## Variables d'environnement (étapes suivantes)

À définir dans Cloudflare Pages (jamais dans le repo) :

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Direction artistique

« Cyber Néon / Mission Control » : fond `#0A0E1A`, cyan `#00F0FF`, magenta `#FF00E5`, lime `#39FF14`, ambre `#FFB800`. Accessibilité WCAG 2.1 AA (focus visibles, `prefers-reduced-motion`, mode confort prévu).
