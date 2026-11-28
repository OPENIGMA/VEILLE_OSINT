'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';

interface AuthState {
  /** true tant que la session n'a pas été lue (évite un flash « déconnecté »). */
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (userId: string | null) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await getSupabase()
      .from('profiles')
      .select('id,display_name,role,comfort_mode,preferences')
      .eq('id', userId)
      .maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    let active = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) return;
        setSession(data.session);
        await loadProfile(data.session?.user.id ?? null);
      })
      .catch(() => {
        /* réseau indisponible : on reste déconnecté */
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      // Appel différé : ne pas appeler Supabase dans le callback d'authentification
      setTimeout(() => {
        void loadProfile(next?.user.id ?? null);
      }, 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      user: session?.user ?? null,
      profile,
      isAdmin: profile?.role === 'admin',
      refreshProfile: () => loadProfile(session?.user.id ?? null),
      signOut: async () => {
        await getSupabase().auth.signOut();
      },
    }),
    [loading, session, profile, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
