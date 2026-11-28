'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { CyberCard } from '@/components/ui/cyber-card';
import { NeonButton } from '@/components/ui/neon-button';
import { inputCls } from '@/components/search-filters';
import { getSupabase } from '@/lib/supabase/client';
import { safeNext } from '@/lib/safe-next';

export const MIN_PASSWORD = 10;

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm text-cyber-muted">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-cyber-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Déjà connecté : inutile de rester sur cette page
  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, router, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (mode === 'register' && password.length < MIN_PASSWORD) {
      setError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`);
      return;
    }
    setBusy(true);
    const supabase = getSupabase();
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        // Message volontairement unique : ne révèle pas si l'adresse existe
        if (err) setError(/confirm/i.test(err.message) ? 'Adresse e-mail non confirmée : ouvrez le message reçu à l’inscription.' : 'E-mail ou mot de passe incorrect.');
        else router.replace(next);
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/login/`,
          },
        });
        if (err) {
          setError(/password|weak|short/i.test(err.message) ? 'Mot de passe refusé : choisissez-en un plus long et moins courant.' : 'Inscription impossible pour le moment.');
        } else if (data.session) {
          router.replace(next);
        } else {
          // Message identique que l'adresse soit nouvelle ou déjà inscrite
          setInfo('Si cette adresse est valide, un e-mail de confirmation vient d’être envoyé. Cliquez sur le lien qu’il contient, puis connectez-vous.');
        }
      }
    } catch {
      setError('Connexion impossible. Vérifiez votre réseau puis réessayez.');
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError('Saisissez d’abord votre adresse e-mail ci-dessus.');
      return;
    }
    try {
      await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/account/` });
    } catch {
      /* même réponse dans tous les cas */
    }
    setInfo('Si cette adresse correspond à un compte, un lien de réinitialisation vient d’être envoyé.');
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="font-mono text-3xl font-bold text-cyber-cyan">{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h1>
      <CyberCard>
        <form onSubmit={submit} className="space-y-4" noValidate={false}>
          {mode === 'register' && (
            <Field id="a-name" label="Nom affiché (facultatif)">
              <input id="a-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoComplete="nickname" className={inputCls} />
            </Field>
          )}
          <Field id="a-email" label="Adresse e-mail">
            <input id="a-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={inputCls} />
          </Field>
          <Field
            id="a-pass"
            label="Mot de passe"
            hint={mode === 'register' ? `Au moins ${MIN_PASSWORD} caractères.` : undefined}
          >
            <input
              id="a-pass"
              type="password"
              required
              minLength={mode === 'register' ? MIN_PASSWORD : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              aria-describedby={mode === 'register' ? 'a-pass-hint' : undefined}
              className={inputCls}
            />
          </Field>

          {error && (
            <p role="alert" className="text-sm text-cyber-magenta">
              {error}
            </p>
          )}
          {info && (
            <p role="status" className="text-sm text-cyber-lime">
              {info}
            </p>
          )}

          <NeonButton type="submit" className="w-full" disabled={busy}>
            {busy ? 'Patientez…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </NeonButton>
          {mode === 'login' && (
            <NeonButton variant="ghost" size="sm" className="w-full" onClick={forgot}>
              Mot de passe oublié ?
            </NeonButton>
          )}
        </form>
      </CyberCard>
      <p className="text-sm text-cyber-muted">
        {mode === 'login' ? (
          <>
            Pas encore de compte ?{' '}
            <Link href="/register/" className="text-cyber-cyan underline">
              Créer un compte
            </Link>
          </>
        ) : (
          <>
            Déjà inscrit ?{' '}
            <Link href="/login/" className="text-cyber-cyan underline">
              Se connecter
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
