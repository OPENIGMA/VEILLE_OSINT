/**
 * Tons néon. Chaque classe définit la variable CSS `--neon` (canaux RGB séparés
 * par des espaces) ; les composants s'en servent via `rgb(var(--neon) / <alpha>)`.
 * Une seule définition de style suffit ainsi pour les quatre couleurs.
 *
 * Usage sémantique :
 *  - cyan    : action principale, liens actifs
 *  - magenta : alerte critique, cyberattaque, ingérence
 *  - lime    : statut en ligne, succès
 *  - amber   : alerte modérée
 */
export const neonTone = {
  cyan: '[--neon:0_240_255]',
  magenta: '[--neon:255_0_229]',
  lime: '[--neon:57_255_20]',
  amber: '[--neon:255_184_0]',
} as const;

export type NeonTone = keyof typeof neonTone;
