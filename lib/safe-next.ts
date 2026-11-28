/** Redirection après connexion : uniquement un chemin interne (jamais une URL externe). */
export function safeNext(value: string | null, fallback = '/dashboard/'): string {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
