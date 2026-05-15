'use client';

import { useState, useEffect, useCallback, ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HomeIcon,
  UserGroupIcon,
  DocumentArrowUpIcon,
  BuildingOfficeIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  ChartBarSquareIcon,
  Squares2X2Icon,
  ArrowsRightLeftIcon,
  TvIcon,
  ClipboardDocumentListIcon,
  UsersIcon,
  RectangleStackIcon,
  CalendarDaysIcon,
  ShoppingCartIcon,
  DocumentTextIcon,
  BuildingOffice2Icon,
  FlagIcon,
  ShieldCheckIcon,
  TrophyIcon,
  EnvelopeIcon,
  AcademicCapIcon,
  UserCircleIcon,
  BeakerIcon,
  BriefcaseIcon,
  ListBulletIcon,
  UserPlusIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';
import { AdminContext, type AdminUser } from './adminContext';
import { adminFetch } from '@/lib/adminAuth';
import {
  adminAuthDebugClient,
  adminAuthDebugClientEnabled,
  redactEmail,
} from '@/lib/adminAuthDebug';
import { GlobalComposeButton } from './_components/GlobalComposeButton';

type NavRole = 'superadmin' | 'admin' | 'accountmanager';

const NAV: {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: boolean;
  roles: NavRole[];
}[] = [
  { label: 'Dashboard', href: '/admin', icon: HomeIcon, roles: ['superadmin', 'admin', 'accountmanager'] },
  { label: 'Leads CRM', href: '/admin/leads', icon: ChartBarSquareIcon, roles: ['superadmin', 'admin', 'accountmanager'] },
  { label: 'Reclamaties', href: '/admin/reclamaties', icon: FlagIcon, badge: true, roles: ['superadmin', 'admin', 'accountmanager'] },
  { label: 'Verdeling', href: '/admin/verdeling', icon: ArrowsRightLeftIcon, roles: ['superadmin'] },
  { label: 'Importeren', href: '/admin/import', icon: DocumentArrowUpIcon, roles: ['superadmin'] },
  { label: 'Klanten', href: '/admin/customers', icon: BuildingOfficeIcon, roles: ['superadmin', 'admin', 'accountmanager'] },
  { label: 'Mijn taken', href: '/admin/prospects/taken', icon: ListBulletIcon, roles: ['superadmin', 'admin', 'accountmanager'] },
  { label: 'Prospects', href: '/admin/prospects', icon: BriefcaseIcon, roles: ['superadmin', 'admin', 'accountmanager'] },
  { label: 'Partner-prospect AM', href: '/admin/partner-prospect-am', icon: UserPlusIcon, roles: ['superadmin'] },
  { label: 'Batches', href: '/admin/batches', icon: RectangleStackIcon, roles: ['superadmin', 'admin', 'accountmanager'] },
  { label: 'Levering batches', href: '/admin/batch-levering', icon: SignalIcon, roles: ['superadmin', 'admin', 'accountmanager'] },
  { label: 'Klant-afspraken', href: '/admin/appointments', icon: CalendarDaysIcon, roles: ['superadmin', 'admin', 'accountmanager'] },
  { label: 'Bestellingen', href: '/admin/orders', icon: ShoppingCartIcon, roles: ['superadmin', 'admin', 'accountmanager'] },
  { label: 'Facturen', href: '/admin/invoices', icon: DocumentTextIcon, roles: ['superadmin', 'admin', 'accountmanager'] },
  { label: 'Branches', href: '/admin/branches', icon: Squares2X2Icon, roles: ['superadmin', 'admin'] },
  { label: 'Plan-gesprekken', href: '/admin/agenda', icon: CalendarDaysIcon, roles: ['superadmin', 'admin', 'accountmanager'] },
  { label: 'Team-agenda', href: '/admin/team-agenda', icon: UserGroupIcon, roles: ['superadmin', 'admin', 'accountmanager'] },
  { label: 'Bedrijfsgegevens', href: '/admin/bedrijf', icon: BuildingOffice2Icon, roles: ['superadmin'] },
  { label: 'Koppelingen', href: '/admin/koppelingen', icon: Cog6ToothIcon, roles: ['superadmin'] },
  { label: 'Live', href: '/admin/live', icon: TvIcon, roles: ['superadmin', 'admin', 'accountmanager'] },
  { label: 'Mijn Account', href: '/admin/account', icon: UserCircleIcon, roles: ['superadmin', 'admin', 'accountmanager'] },
  { label: 'E-learning', href: '/admin/e-learning', icon: AcademicCapIcon, roles: ['superadmin', 'accountmanager'] },
  { label: 'E-mails', href: '/admin/emails', icon: EnvelopeIcon, roles: ['superadmin'] },
  { label: 'Activiteitenlog', href: '/admin/audit', icon: ClipboardDocumentListIcon, roles: ['superadmin'] },
  { label: 'AM Targets', href: '/admin/am-targets', icon: TrophyIcon, roles: ['superadmin'] },
  { label: 'Testpanel', href: '/admin/testpanel', icon: BeakerIcon, roles: ['superadmin'] },
  { label: 'Gebruikers', href: '/admin/users', icon: UsersIcon, roles: ['superadmin'] },
];

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  superadmin: { label: 'Superadmin', className: 'bg-brand-purple/20 text-brand-purple' },
  admin: { label: 'Admin', className: 'bg-sky-500/20 text-sky-300' },
  accountmanager: { label: 'Accountmanager', className: 'bg-amber-500/20 text-amber-300' },
};

function LoginScreen({ onLogin }: { onLogin: (u: AdminUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    console.info('[WL Admin]', 'login: POST /api/admin/auth/login start', {
      email: redactEmail(email),
    });
    try {
      const controller = new AbortController();
      const LOGIN_TIMEOUT_MS = 28_000;
      const timeoutId = window.setTimeout(() => {
        controller.abort();
        console.info('[WL Admin]', 'login: fetch nog bezig — timeout getriggerd', { ms: LOGIN_TIMEOUT_MS });
      }, LOGIN_TIMEOUT_MS);

      let res: Response;
      try {
        res = await fetch('/api/admin/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeoutId);
      }
      const ms = typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : null;
      let data: { error?: string; user?: AdminUser } = {};
      try {
        data = await res.json();
      } catch {
        console.info('[WL Admin]', 'login: response body is geen JSON', { status: res.status, durationMs: ms });
        throw new Error('Ongeldig antwoord van server');
      }
      console.info('[WL Admin]', 'login: response', {
        status: res.status,
        ok: res.ok,
        durationMs: ms,
        hasUser: !!data.user,
      });
      if (adminAuthDebugClientEnabled()) {
        adminAuthDebugClient('login: volledige response payload (geen wachtwoord)', {
          keys: data && typeof data === 'object' ? Object.keys(data) : [],
        });
      }
      if (!res.ok) throw new Error(data.error || 'Login mislukt');
      if (!data.user) throw new Error('Geen gebruikersdata in antwoord');
      onLogin(data.user);
    } catch (err: unknown) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      console.info('[WL Admin]', 'login: fout', {
        message: err instanceof Error ? err.message : String(err),
        aborted,
      });
      setError(
        aborted
          ? 'Server reageert te traag (timeout). Probeer opnieuw of controleer Supabase/Vercel-status.'
          : err instanceof Error
            ? err.message
            : 'Login mislukt',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-navy px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full bg-brand-purple/10 blur-[150px]" />
        <div className="absolute -right-40 bottom-1/4 h-[500px] w-[500px] rounded-full bg-brand-pink/8 blur-[150px]" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="mb-8 text-center">
          <Image src="/logo-wit.png" alt="WarmeLeads" width={160} height={48} className="mx-auto h-9 w-auto" />
          <p className="mt-3 text-sm text-white/40">Admin Panel</p>
        </div>
        <form onSubmit={submit} autoComplete="off" className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-xl">
          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-300">{error}</div>
          )}
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50">E-mail</label>
              <input
                type="email"
                name="wl-admin-email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30"
                placeholder="admin@warmeleads.eu"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50">Wachtwoord</label>
              <input
                type="password"
                name="wl-admin-password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30"
                placeholder="••••••••"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-button-gradient py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/20 transition hover:shadow-brand-orange/30 disabled:opacity-60"
          >
            {loading ? 'Inloggen...' : 'Inloggen'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function Sidebar({
  user,
  onLogout,
  pendingReclamations,
  pendingTasks,
}: {
  user: AdminUser;
  onLogout: () => void;
  pendingReclamations: number;
  pendingTasks: number;
}) {
  const pathname = usePathname();
  const visibleNav = NAV.filter(item => item.roles.includes(user.role as NavRole));
  const rb = ROLE_BADGE[user.role] || ROLE_BADGE.admin;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-brand-navy lg:flex">
      <div className="h-[3px] bg-warmeleads-gradient" />
      <div className="flex h-16 items-center px-5">
        <Image src="/logo-wit.png" alt="WarmeLeads" width={130} height={39} className="h-7 w-auto" />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-0.5">
          {visibleNav.map((item) => {
            const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active ? 'bg-brand-purple/20 text-white' : 'text-white/50 hover:bg-white/[0.06] hover:text-white/80'
                }`}
              >
                <item.icon className={`h-[18px] w-[18px] ${active ? 'text-brand-purple' : 'text-white/40'}`} />
                {item.label}
                {item.badge && pendingReclamations > 0 && (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                    {pendingReclamations}
                  </span>
                )}
                {item.href === '/admin/prospects/taken' && pendingTasks > 0 && (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white">
                    {pendingTasks > 99 ? '99+' : pendingTasks}
                  </span>
                )}
                {item.href === '/admin/live' && (
                  <span className="relative ml-auto flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="border-t border-white/[0.06] px-4 py-4">
        <div className="mb-3">
          <GlobalComposeButton />
        </div>
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-purple/20 text-xs font-bold text-brand-purple">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-xs font-medium text-white/80">{user.name}</p>
              {user.role === 'superadmin' && <ShieldCheckIcon className="h-3 w-3 shrink-0 text-brand-purple" />}
            </div>
            <span className={`mt-0.5 inline-block rounded-full px-1.5 py-px text-[9px] font-semibold ${rb.className}`}>{rb.label}</span>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/40 transition hover:bg-white/[0.06] hover:text-red-400"
        >
          <ArrowRightOnRectangleIcon className="h-4 w-4" />
          Uitloggen
        </button>
      </div>
    </aside>
  );
}

function MobileHeader({
  user,
  onLogout,
  pendingReclamations,
  pendingTasks,
}: {
  user: AdminUser;
  onLogout: () => void;
  pendingReclamations: number;
  pendingTasks: number;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <Image src="/warmeleads-logo-2026.png" alt="WarmeLeads" width={110} height={33} className="h-6 w-auto" />
        <button onClick={() => setOpen(true)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-50 active:bg-slate-100">
          <Bars3Icon className="h-5 w-5" />
        </button>
      </header>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm lg:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed inset-y-0 left-0 z-[60] w-[min(280px,80vw)] bg-brand-navy lg:hidden"
            >
              <div className="flex h-full flex-col">
                <div className="h-[3px] shrink-0 bg-warmeleads-gradient" />
                <div className="flex h-14 shrink-0 items-center justify-between px-4">
                  <Image src="/logo-wit.png" alt="WarmeLeads" width={110} height={33} className="h-6 w-auto" />
                  <button onClick={() => setOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-lg text-white/50 active:bg-white/10"><XMarkIcon className="h-5 w-5" /></button>
                </div>
                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                  {NAV.filter(item => item.roles.includes(user.role as NavRole)).map((item) => {
                    const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                          active ? 'bg-brand-purple/20 text-white' : 'text-white/50 hover:text-white/80'
                        }`}
                      >
                        <item.icon className={`h-5 w-5 ${active ? 'text-brand-purple' : 'text-white/40'}`} />
                        {item.label}
                        {item.badge && pendingReclamations > 0 && (
                          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                            {pendingReclamations}
                          </span>
                        )}
                        {item.href === '/admin/prospects/taken' && pendingTasks > 0 && (
                          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white">
                            {pendingTasks > 99 ? '99+' : pendingTasks}
                          </span>
                        )}
                        {item.href === '/admin/live' && (
                          <span className="relative ml-auto flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
                <div className="shrink-0 border-t border-white/[0.06] px-4 py-4">
                  <div className="mb-3 flex items-center gap-2">
                    <p className="truncate text-sm text-white/40">{user.name}</p>
                    <span className={`shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold ${(ROLE_BADGE[user.role] || ROLE_BADGE.admin).className}`}>
                      {(ROLE_BADGE[user.role] || ROLE_BADGE.admin).label}
                    </span>
                  </div>
                  <button onClick={onLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-white/40 transition hover:bg-white/[0.06] hover:text-red-400">
                    <ArrowRightOnRectangleIcon className="h-4 w-4" /> Uitloggen
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function RouteBlocked() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <ShieldCheckIcon className="mb-4 h-16 w-16 text-slate-300" />
      <h1 className="text-2xl font-bold text-slate-800">Geen toegang</h1>
      <p className="mt-2 text-slate-500">Je hebt geen rechten om deze pagina te bekijken.</p>
      <Link href="/admin" className="mt-6 rounded-lg bg-brand-purple px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-purple/90">
        Terug naar dashboard
      </Link>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingReclamations, setPendingReclamations] = useState(0);
  const [pendingTasks, setPendingTasks] = useState(0);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get('debugAuth') === '1') {
        sessionStorage.setItem('wl_admin_auth_debug', '1');
        console.info(
          '[WL Admin] Uitgebreide auth-debug staat aan voor deze tab (sessionStorage). Server: zet NEXT_PUBLIC_ADMIN_AUTH_DEBUG=1 in Vercel en redeploy.',
        );
      }
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        if (regs.length === 0) {
          console.info('[WL Admin] Geen service worker-registraties (chunks gaan direct naar netwerk).');
          return;
        }
        console.info('[WL Admin] Service worker(s) verwijderen voor stabiele admin-chunks…', { count: regs.length });
        return Promise.all(regs.map((r) => r.unregister()));
      })
      .then(() => {
        if ('caches' in window) {
          return caches.keys().then((names) => {
            const wl = names.filter((n) => n.startsWith('warmeleads-'));
            if (wl.length > 0) {
              console.info('[WL Admin] Verwijderen oude warmeleads browser-caches', { names: wl });
            }
            return Promise.all(wl.map((n) => caches.delete(n)));
          });
        }
        return undefined;
      })
      .catch((err) => {
        console.info('[WL Admin] Service worker unregister mislukt', {
          message: err instanceof Error ? err.message : String(err),
        });
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      console.info('[WL Admin] Sessiecheck: GET /api/admin/me start');
      try {
        const res = await fetch('/api/admin/me', { credentials: 'include' });
        const ms = typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : null;
        if (cancelled) return;
        console.info('[WL Admin] Sessiecheck: GET /api/admin/me klaar', {
          status: res.status,
          ok: res.ok,
          durationMs: ms,
        });
        if (res.ok) {
          const data = await res.json();
          const u = data.user;
          setUser({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            is_account_manager: !!u.is_account_manager,
            avatar_url: u.avatar_url ?? null,
          });
          if (adminAuthDebugClientEnabled()) {
            adminAuthDebugClient('Sessiecheck: gebruiker ingelogd', {
              id: u.id,
              role: u.role,
              email: redactEmail(u.email),
            });
          }
        } else {
          let preview = '';
          try {
            preview = (await res.clone().text()).slice(0, 180);
          } catch {
            /* noop */
          }
          if (adminAuthDebugClientEnabled()) {
            adminAuthDebugClient('Sessiecheck: niet ingelogd of fout', { status: res.status, bodyPreview: preview });
          }
          localStorage.removeItem('warmeleads-admin-auth');
        }
      } catch (err) {
        console.info('[WL Admin] Sessiecheck: netwerkfout', {
          message: err instanceof Error ? err.message : String(err),
        });
        if (adminAuthDebugClientEnabled()) {
          adminAuthDebugClient('Sessiecheck: exception', { error: err instanceof Error ? err.message : String(err) });
        }
        localStorage.removeItem('warmeleads-admin-auth');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchCount = async () => {
      try {
        const res = await adminFetch('/api/admin/reclamations?count_only=true');
        if (res.ok) {
          const data = await res.json();
          setPendingReclamations(data.pending_count || 0);
        }
      } catch { /* ignore */ }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const isAm = user.role === 'accountmanager';
    const params = new URLSearchParams({ count_only: '1', task_status: 'open' });
    if (isAm) params.set('portfolio', '1');
    const fetchTasks = async () => {
      try {
        const res = await adminFetch(`/api/admin/prospects/tasks?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const b = data.buckets || {};
          setPendingTasks((b.overdue || 0) + (b.today || 0));
        }
      } catch { /* ignore */ }
    };
    fetchTasks();
    const interval = setInterval(fetchTasks, 60_000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogin = useCallback((u: AdminUser) => {
    setUser(u);
    localStorage.setItem('warmeleads-admin-auth', JSON.stringify({ user: u, timestamp: Date.now() }));
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* noop */
    }
    setUser(null);
    localStorage.removeItem('warmeleads-admin-auth');
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-navy">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/10 border-t-brand-purple" />
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  const isLive = pathname === '/admin/live';
  const userRole = user.role as NavRole;
  const matchedNav = NAV.find(item =>
    item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href),
  );
  const routeAllowed = !matchedNav || matchedNav.roles.includes(userRole);

  if (isLive) {
    return (
      <AdminContext.Provider value={{ user, logout: handleLogout }}>
        {routeAllowed ? children : <RouteBlocked />}
      </AdminContext.Provider>
    );
  }

  return (
    <AdminContext.Provider value={{ user, logout: handleLogout }}>
      <div className="min-h-screen bg-slate-50">
        <Sidebar user={user} onLogout={handleLogout} pendingReclamations={pendingReclamations} pendingTasks={pendingTasks} />
        <MobileHeader user={user} onLogout={handleLogout} pendingReclamations={pendingReclamations} pendingTasks={pendingTasks} />
        <main className="lg:pl-60">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {routeAllowed ? children : <RouteBlocked />}
          </div>
        </main>
      </div>
    </AdminContext.Provider>
  );
}
