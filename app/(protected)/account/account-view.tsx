'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, LogOut, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { MIN_PASSWORD } from '@/components/auth-form';
import { ComfortToggle } from '@/components/comfort-toggle';
import { CyberCard } from '@/components/ui/cyber-card';
import { NeonButton } from '@/components/ui/neon-button';
import { inputCls } from '@/components/search-filters';
import { getSupabase } from '@/lib/supabase/client';

type Msg = { ok: boolean; text: string } | null;

function Feedback({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-sm text-cyber-lime' : 'text-sm text-cyber-magenta'}>
      {msg.text}
    </p>
  );
}

export function AccountView() {
  const router = useRouter();
  const { user, profile, refreshProfile, signOut } = useAuth();

  const [name, setName] = useState('');
  const [nameMsg, setNameMsg] = useState<Msg>(null);
  useEffect(() => setName(profile?.display_name ?? ''), [profile?.display_name]);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await getSupabase().from('profiles').update({ display_name: name.trim() || null }).eq('id', user.id);
    setNameMsg(error ? { ok: false, text: 'Enregistrement impossible.' } : { ok: true, text: 'Nom enregistré.' });
    if (!error) await refreshProfile();
  };

  const [pwd, setPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState<Msg>(null);
  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < MIN_PASSWORD) {
      setPwdMsg({ ok: false, text: `Au moins ${MIN_PASSWORD} caractères.` });
      return;
    }
    const { error } = await getSupabase().auth.updateUser({ password: pwd });
    setPwdMsg(error ? { ok: false, text: 'Mot de passe refusé : choisissez-en un plus long et moins courant.' } : { ok: true, text: 'Mot de passe modifié.' });
    if (!error) setPwd('');
  };

  const [exportMsg, setExportMsg] = useState<Msg>(null);
  const exportData = async () => {
    setExportMsg(null);
    const { data, error } = await getSupabase().rpc('export_my_data');
    if (error || !data) {
      setExportMsg({ ok: false, text: 'Export impossible.' });
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veille-osint-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMsg({ ok: true, text: 'Fichier téléchargé.' });
  };

  const [confirm, setConfirm] = useState('');
  const [delMsg, setDelMsg] = useState<Msg>(null);
  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirm !== 'SUPPRIMER') {
      setDelMsg({ ok: false, text: 'Tapez exactement SUPPRIMER pour confirmer.' });
      return;
    }
    const { error } = await getSupabase().rpc('delete_my_account', { p_confirm: confirm });
    if (error) {
      setDelMsg({ ok: false, text: 'Suppression impossible. Réessayez.' });
      return;
    }
    await signOut();
    router.replace('/');
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-mono text-3xl font-bold text-cyber-cyan">Mon compte</h1>
        <p className="text-cyber-muted">{user?.email}</p>
      </header>

      <CyberCard className="space-y-3">
        <h2 className="font-mono text-lg font-bold">Profil</h2>
        <form onSubmit={saveName} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="ac-name" className="mb-1 block text-sm text-cyber-muted">Nom affiché</label>
            <input id="ac-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>
          <NeonButton type="submit">Enregistrer</NeonButton>
        </form>
        <Feedback msg={nameMsg} />
        <div className="space-y-1 border-t border-cyber-cyan/20 pt-3">
          <p className="text-sm text-cyber-muted">Affichage (mémorisé sur votre compte) :</p>
          <ComfortToggle />
        </div>
      </CyberCard>

      <CyberCard className="space-y-3">
        <h2 className="font-mono text-lg font-bold">Mot de passe</h2>
        <form onSubmit={changePassword} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="ac-pwd" className="mb-1 block text-sm text-cyber-muted">Nouveau mot de passe</label>
            <input id="ac-pwd" type="password" autoComplete="new-password" minLength={MIN_PASSWORD} value={pwd} onChange={(e) => setPwd(e.target.value)} className={inputCls} />
          </div>
          <NeonButton type="submit">Modifier</NeonButton>
        </form>
        <Feedback msg={pwdMsg} />
      </CyberCard>

      <CyberCard tone="lime" className="space-y-3">
        <h2 className="font-mono text-lg font-bold">Mes données (RGPD)</h2>
        <p className="text-sm text-cyber-muted">Téléchargez tout ce que la plateforme conserve sur vous : profil, recherches, alertes, favoris.</p>
        <NeonButton tone="lime" variant="outline" onClick={() => void exportData()}>
          <Download aria-hidden="true" className="h-4 w-4" /> Exporter mes données
        </NeonButton>
        <Feedback msg={exportMsg} />
      </CyberCard>

      <CyberCard tone="magenta" className="space-y-3">
        <h2 className="font-mono text-lg font-bold text-cyber-magenta">Supprimer mon compte</h2>
        <p className="text-sm text-cyber-muted">Action définitive : votre compte, vos recherches, alertes et favoris sont effacés immédiatement.</p>
        <form onSubmit={deleteAccount} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="ac-del" className="mb-1 block text-sm text-cyber-muted">Tapez SUPPRIMER pour confirmer</label>
            <input id="ac-del" value={confirm} autoComplete="off" onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
          </div>
          <NeonButton type="submit" tone="magenta" variant="outline">
            <Trash2 aria-hidden="true" className="h-4 w-4" /> Supprimer définitivement
          </NeonButton>
        </form>
        <Feedback msg={delMsg} />
      </CyberCard>

      <NeonButton variant="ghost" onClick={() => void signOut()}>
        <LogOut aria-hidden="true" className="h-4 w-4" /> Se déconnecter
      </NeonButton>
    </div>
  );
}
