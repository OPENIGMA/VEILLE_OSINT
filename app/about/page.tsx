import type { Metadata } from 'next';
import { CyberCard } from '@/components/ui/cyber-card';

export const metadata: Metadata = { title: 'Méthodologie et mentions légales' };

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <CyberCard className="space-y-2">
    <h2 className="font-mono text-lg font-bold text-cyber-cyan">{title}</h2>
    <div className="space-y-2 text-cyber-text/90">{children}</div>
  </CyberCard>
);

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-mono text-3xl font-bold text-cyber-cyan">Méthodologie et mentions légales</h1>
        <p className="max-w-3xl text-cyber-muted">Ce que contient la plateforme, d’où viennent les données, et ce qu’elle ne fait pas.</p>
      </header>

      <Section title="Principe">
        <p>
          veille-osint rassemble des <strong>sources ouvertes</strong> : flux RSS de presse et d’institutions, jeux de
          données ouverts de data.gouv.fr, bulletins publics de cybersécurité. Rien n’est collecté derrière une
          connexion, un mot de passe ou un paywall.
        </p>
      </Section>

      <Section title="Ce qui est stocké">
        <ul className="list-disc space-y-1 pl-5">
          <li>Presse : titre, court extrait, date, lien vers l’original. Le texte intégral reste chez l’éditeur.</li>
          <li>Données : métadonnées et lien vers data.gouv.fr, jamais les fichiers eux-mêmes.</li>
          <li>Menaces : titre, résumé, gravité, lien source.</li>
        </ul>
        <p>Les thématiques et territoires sont rattachés automatiquement ; ils peuvent comporter des erreurs. Vérifiez toujours à la source.</p>
      </Section>

      <Section title="Vos données (RGPD)">
        <ul className="list-disc space-y-1 pl-5">
          <li>Un compte contient votre e-mail, vos recherches, alertes et favoris. Rien n’est partagé avec d’autres utilisateurs.</li>
          <li>Depuis « Mon compte », vous pouvez exporter toutes vos données et supprimer définitivement votre compte.</li>
          <li>Les mots de passe sont hachés (bcrypt) par le service d’authentification ; ils ne sont jamais lisibles.</li>
          <li>Aucun suivi publicitaire, aucun cookie tiers.</li>
        </ul>
      </Section>

      <Section title="Accessibilité">
        <p>
          La plateforme vise le niveau WCAG 2.1 AA : navigation au clavier, contrastes vérifiés, respect de la
          préférence « réduire les animations », et un <strong>mode confort</strong> (halos atténués) activable dans le menu.
        </p>
      </Section>

      <Section title="Mentions légales">
        <p>
          <strong>Éditeur du site :</strong> <span className="text-cyber-amber">[à compléter : nom ou raison sociale, contact]</span>
        </p>
        <p>
          <strong>Hébergement :</strong> Cloudflare, Inc. (site) · Supabase, Inc. (base de données, région UE).
        </p>
      </Section>
    </div>
  );
}
