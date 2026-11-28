'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BellRing,
  Database,
  Info,
  LayoutDashboard,
  LogIn,
  LogOut,
  Map as MapIcon,
  Menu,
  Newspaper,
  Radar,
  Rss,
  Search,
  ShieldAlert,
  User,
  UserPlus,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { neonTone, type NeonTone } from '@/lib/neon';
import { useAuth } from '@/components/auth-provider';
import { ComfortToggle } from '@/components/comfort-toggle';
import { NeonButton } from '@/components/ui/neon-button';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  tone?: NeonTone;
}

const PUBLIC_NAV: NavItem[] = [
  { href: '/search/', label: 'Recherche', icon: Search },
  { href: '/map/', label: 'Carte', icon: MapIcon },
  { href: '/press/', label: 'Presse', icon: Newspaper },
  { href: '/data/', label: 'Données', icon: Database },
  { href: '/threats/', label: 'Menaces & ingérences', icon: ShieldAlert, tone: 'magenta' },
  { href: '/about/', label: 'Méthodologie', icon: Info },
];

const MEMBER_NAV: NavItem[] = [
  { href: '/dashboard/', label: 'Espace personnel', icon: LayoutDashboard },
  { href: '/alerts/', label: 'Alertes', icon: BellRing, tone: 'amber' },
  { href: '/account/', label: 'Mon compte', icon: User },
];

const ADMIN_NAV: NavItem[] = [{ href: '/sources/', label: 'Sources RSS', icon: Rss, tone: 'lime' }];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href);
}

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        neonTone[item.tone ?? 'cyan'],
        'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--neon))]',
        active
          ? 'bg-[rgb(var(--neon)/0.1)] text-[rgb(var(--neon))]'
          : 'text-cyber-muted hover:bg-[rgb(var(--neon)/0.06)] hover:text-cyber-text',
      )}
    >
      {/* Indicateur actif : barre latérale avec halo */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-[rgb(var(--neon))] transition-opacity',
          active
            ? 'opacity-100 shadow-[0_0_12px_rgb(var(--neon)/var(--glow-strong))]'
            : 'opacity-0',
        )}
      />
      <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-[rgb(var(--neon))]" />
      <span>{item.label}</span>
    </Link>
  );
}

function NavGroup({ title, items, pathname, onNavigate }: { title?: string; items: NavItem[]; pathname: string; onNavigate?: () => void }) {
  return (
    <div className="space-y-1">
      {title && (
        <p className="px-3 pb-1 pt-4 font-mono text-[11px] uppercase tracking-widest text-cyber-muted">{title}</p>
      )}
      {items.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { user, isAdmin, signOut, loading } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-2 px-5 py-5 font-mono text-lg font-bold text-cyber-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan"
      >
        <Radar aria-hidden="true" className="h-6 w-6" />
        veille-osint
      </Link>

      <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto px-2 pb-4">
        <NavGroup items={[{ href: '/', label: 'Accueil', icon: Radar }]} pathname={pathname === '/' ? '/' : ''} onNavigate={onNavigate} />
        <NavGroup title="Explorer" items={PUBLIC_NAV} pathname={pathname} onNavigate={onNavigate} />
        {user && <NavGroup title="Mon espace" items={MEMBER_NAV} pathname={pathname} onNavigate={onNavigate} />}
        {isAdmin && <NavGroup title="Administration" items={ADMIN_NAV} pathname={pathname} onNavigate={onNavigate} />}
      </nav>

      <div className="space-y-2 border-t border-cyber-cyan/20 p-3">
        <p className="flex items-center gap-2 px-2 font-mono text-xs text-cyber-muted">
          <span aria-hidden="true" className="text-cyber-lime">●</span>
          {loading ? 'session…' : user ? 'connecté' : 'visiteur'}
        </p>
        {!loading && user ? (
          <NeonButton
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              onNavigate?.();
              void signOut();
            }}
          >
            <LogOut aria-hidden="true" className="h-4 w-4" /> Déconnexion
          </NeonButton>
        ) : (
          !loading && (
            <div className="grid grid-cols-2 gap-2">
              <NeonButton asChild variant="outline" size="sm">
                <Link href="/login/" onClick={onNavigate}>
                  <LogIn aria-hidden="true" className="h-4 w-4" /> Connexion
                </Link>
              </NeonButton>
              <NeonButton asChild variant="ghost" size="sm">
                <Link href="/register/" onClick={onNavigate}>
                  <UserPlus aria-hidden="true" className="h-4 w-4" /> Inscription
                </Link>
              </NeonButton>
            </div>
          )
        )}
        <ComfortToggle />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);

  // Ferme le tiroir à chaque changement de page
  useEffect(() => setOpen(false), [pathname]);

  // Tiroir mobile : Échap ferme, le focus entre dans le tiroir puis revient au bouton
  useEffect(() => {
    if (!open) return;
    const previous = menuButton.current;
    drawer.current?.querySelector<HTMLElement>('a,button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'Tab' && drawer.current) {
        const items = drawer.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled])');
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [open]);

  return (
    <>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-cyber-cyan focus:px-4 focus:py-2 focus:font-mono focus:text-sm focus:font-semibold focus:text-cyber-bg"
      >
        Aller au contenu
      </a>

      {/* Sidebar fixe (≥ 1024 px) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-cyber-cyan/20 bg-cyber-card/80 backdrop-blur-[12px] lg:block">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Header : mobile / tablette */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-cyber-cyan/20 bg-cyber-bg/90 px-4 py-3 backdrop-blur-[12px] lg:hidden">
        <Link href="/" className="flex items-center gap-2 font-mono font-bold text-cyber-cyan">
          <Radar aria-hidden="true" className="h-5 w-5" /> veille-osint
        </Link>
        <NeonButton
          ref={menuButton}
          variant="outline"
          size="sm"
          aria-expanded={open}
          aria-controls="menu-mobile"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X aria-hidden="true" className="h-4 w-4" /> : <Menu aria-hidden="true" className="h-4 w-4" />}
          Menu
        </NeonButton>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            tabIndex={-1}
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div
            id="menu-mobile"
            ref={drawer}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-cyber-cyan/30 bg-cyber-card"
          >
            <SidebarContent pathname={pathname} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <main id="contenu" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 font-mono text-xs text-cyber-muted sm:px-6 lg:px-8">
          veille-osint · données ouvertes et sources publiques ·{' '}
          <Link href="/about/" className="underline hover:text-cyber-cyan">
            méthodologie & mentions légales
          </Link>
        </footer>
      </div>
    </>
  );
}
