import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase côté navigateur.
 *
 * L'URL du projet et la clé « publishable » sont PUBLIQUES par conception : elles
 * finissent dans le code envoyé au navigateur. La sécurité repose sur la RLS
 * (voir supabase/migrations), jamais sur le secret de cette clé.
 * JAMAIS la clé « service_role » ici.
 *
 * Valeurs par défaut = projet VEILLE_OSINT ; surchargeables par variables
 * d'environnement (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).
 */
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://wuesfrzxjhdwuudxivfh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_5OCn372IREoqaJxu3ars4g_rWzMrM0P';

let client: SupabaseClient | null = null;

/** Instance unique (évite plusieurs écouteurs d'authentification). */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
