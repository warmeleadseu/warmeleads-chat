'use client';

import { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRightOnRectangleIcon,
  ArrowLeftIcon,
  InboxStackIcon,
  UserCircleIcon,
  ShoppingCartIcon,
  DevicePhoneMobileIcon,
  XMarkIcon,
  ArrowUpOnSquareIcon,
  EyeIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { PortalContext, type PortalCustomer } from './portalContext';

function LoginScreen({ onLogin }: { onLogin: (c: PortalCustomer, t: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/portal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Inloggen mislukt');
      onLogin(data.customer, data.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Inloggen mislukt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-navy px-4">
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
          <Image src="/logo-wit.png" alt="WarmeLeads" width={180} height={54} className="mx-auto h-10 w-auto" />
          <p className="mt-3 text-sm text-white/40">Klantportaal</p>
        </div>

        <form onSubmit={submit} autoComplete="off" className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-xl">
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>
          )}
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50">E-mail</label>
              <input
                type="email"
                name="wl-portal-email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30"
                placeholder="uw@bedrijf.nl"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50">Wachtwoord</label>
              <input
                type="password"
                name="wl-portal-password"
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
          <p className="mt-4 text-center text-[11px] text-white/30">
            Wachtwoord vergeten? Neem contact op via{' '}
            <a href="mailto:info@warmeleads.eu" className="text-white/50 underline decoration-white/20 hover:text-white/70">
              info@warmeleads.eu
            </a>
          </p>
        </form>

        <p className="mt-6 text-center text-xs text-white/25">
          <Link href="/" className="hover:text-white/40 transition">
            <ArrowLeftIcon className="mr-1 inline h-3 w-3" />
            Terug naar warmeleads.eu
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

const PORTAL_NAV = [
  { label: 'Leads', href: '/portal', icon: InboxStackIcon },
  { label: 'Bestellen', href: '/portal/bestellen', icon: ShoppingCartIcon },
  { label: 'Account & Insights', href: '/portal/account', icon: UserCircleIcon },
];

function PortalHeader({ customer, onLogout }: { customer: PortalCustomer; onLogout: () => void }) {
  const pathname = usePathname();

  return (
    <header className="bg-white shadow-sm">
      <div className="h-[3px] bg-warmeleads-gradient" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Image src="/warmeleads-logo-2026.png" alt="WarmeLeads" width={120} height={36} className="h-6 w-auto" />
            <div className="hidden h-5 w-px bg-slate-200 sm:block" />
            <span className="hidden max-w-[160px] truncate text-sm font-medium text-slate-600 sm:inline">{customer.name}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-purple/10 text-xs font-bold text-brand-purple">
              {customer.contact_person?.charAt(0)?.toUpperCase() || customer.name.charAt(0).toUpperCase()}
            </div>
            <span className="hidden text-sm text-slate-600 sm:inline">{customer.contact_person || customer.name}</span>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-red-500 sm:px-2.5"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Uitloggen</span>
            </button>
          </div>
        </div>
        <nav className="-mb-px flex gap-1 border-t border-slate-100" style={{ scrollbarWidth: 'none' }}>
          {PORTAL_NAV.map((item) => {
            const active = item.href === '/portal' ? pathname === '/portal' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition sm:gap-2 sm:text-sm ${
                  active
                    ? 'border-brand-purple text-brand-purple'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

function PortalFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs text-slate-400">
          Vragen? Neem contact op met WarmeLeads:{' '}
          <a href="mailto:info@warmeleads.eu" className="text-brand-purple hover:underline">info@warmeleads.eu</a>
          {' · '}
          <a href="tel:0850477067" className="text-brand-purple hover:underline">085 047 7067</a>
        </p>
      </div>
    </footer>
  );
}

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

function InstallBanner() {
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem('wl-install-dismissed')) return;

    if (isIOS()) {
      setIosHint(true);
      setShow(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt();
      const result = await deferredPrompt.current.userChoice;
      if (result.outcome === 'accepted') setShow(false);
      deferredPrompt.current = null;
    }
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem('wl-install-dismissed', '1');
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 p-4 sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm sm:p-0"
      >
        <div className="relative overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/[0.08]">
          {/* Gradient accent */}
          <div className="h-1 bg-gradient-to-r from-brand-purple via-brand-pink to-brand-purple" />

          <div className="p-4 sm:p-5">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-pink shadow-md shadow-brand-purple/20">
                <DevicePhoneMobileIcon className="h-[22px] w-[22px] text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-slate-900">WarmeLeads installeren</p>
                {iosHint ? (
                  <p className="mt-0.5 text-[13px] leading-snug text-slate-500">
                    Tik op <ArrowUpOnSquareIcon className="inline h-4 w-4 -mt-0.5 text-brand-purple" /> in uw browser en kies <span className="font-medium text-slate-700">&quot;Zet op beginscherm&quot;</span>
                  </p>
                ) : (
                  <p className="mt-0.5 text-[13px] leading-snug text-slate-500">
                    Snelle toegang vanaf uw startscherm met push notificaties
                  </p>
                )}
              </div>
              <button
                onClick={dismiss}
                className="shrink-0 rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
                aria-label="Sluiten"
              >
                <XMarkIcon className="h-[18px] w-[18px]" />
              </button>
            </div>

            {!iosHint && (
              <div className="mt-4 flex gap-2.5">
                <button
                  onClick={handleInstall}
                  className="flex-1 rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:shadow-md active:scale-[0.98]"
                >
                  Installeer app
                </button>
                <button
                  onClick={dismiss}
                  className="rounded-xl px-4 py-2.5 text-[13px] font-medium text-slate-500 transition hover:bg-slate-50"
                >
                  Niet nu
                </button>
              </div>
            )}

            {iosHint && (
              <button
                onClick={dismiss}
                className="mt-3 w-full rounded-xl bg-slate-50 px-4 py-2 text-center text-[13px] font-medium text-slate-500 transition hover:bg-slate-100"
              >
                Begrepen
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function AdminViewBanner({ customerName, adminName, onStop }: { customerName: string; adminName: string; onStop: () => void }) {
  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-sm">
          <EyeIcon className="h-4 w-4 shrink-0" />
          <span className="font-medium">
            <span className="hidden sm:inline">Admin-weergave</span>
            <span className="sm:hidden">Admin</span>
            {' · '}
          </span>
          <span className="truncate font-bold">{customerName}</span>
          <span className="hidden text-white/70 sm:inline">— bekeken door {adminName}</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/admin/customers"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/30"
          >
            <ShieldCheckIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Terug naar admin</span>
            <span className="sm:hidden">Admin</span>
          </a>
          <button
            onClick={onStop}
            className="rounded-lg bg-white/20 p-1.5 text-white transition hover:bg-white/30"
            title="Admin-weergave stoppen"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PortalLayout({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<PortalCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminView, setIsAdminView] = useState(false);
  const [adminName, setAdminName] = useState('');

  useEffect(() => {
    const restoreSession = () => {
      try {
        const raw = localStorage.getItem('warmeleads-portal-auth');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed.token || !parsed.customer) { localStorage.removeItem('warmeleads-portal-auth'); return; }
        const maxAge = parsed.is_admin_view ? 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - parsed.timestamp > maxAge) { localStorage.removeItem('warmeleads-portal-auth'); return; }
        setCustomer(parsed.customer);
        if (parsed.is_admin_view) {
          setIsAdminView(true);
          setAdminName(parsed.admin_name || 'Admin');
        }
      } catch { localStorage.removeItem('warmeleads-portal-auth'); }
    };

    const params = new URLSearchParams(window.location.search);
    const impersonateToken = params.get('impersonate');

    if (impersonateToken) {
      (async () => {
        try {
          const res = await fetch('/api/portal/auth/impersonate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: impersonateToken }),
          });
          if (!res.ok) throw new Error('Impersonation mislukt');
          const data = await res.json();

          setCustomer(data.customer);
          setIsAdminView(true);
          setAdminName(data.impersonation?.admin_name || 'Admin');

          localStorage.setItem('warmeleads-portal-auth', JSON.stringify({
            customer: data.customer,
            token: data.token,
            timestamp: Date.now(),
            is_admin_view: true,
            admin_name: data.impersonation?.admin_name || 'Admin',
          }));

          window.history.replaceState({}, '', '/portal');
        } catch {
          restoreSession();
        }
        setLoading(false);
      })();
      return;
    }

    restoreSession();
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!customer || isAdminView) return;
    if ('serviceWorker' in navigator) {
      (async () => {
        try {
          const existing = await navigator.serviceWorker.getRegistration('/');
          if (existing) {
            existing.update().catch(() => {});
            return;
          }
          await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        } catch (err) {
          console.error('SW registration failed:', err);
        }
      })();
    }
  }, [customer, isAdminView]);

  const handleLogin = useCallback((c: PortalCustomer, token: string) => {
    setCustomer(c);
    setIsAdminView(false);
    setAdminName('');
    localStorage.setItem('warmeleads-portal-auth', JSON.stringify({ customer: c, token, timestamp: Date.now() }));
  }, []);

  const handleLogout = useCallback(() => {
    setCustomer(null);
    setIsAdminView(false);
    setAdminName('');
    localStorage.removeItem('warmeleads-portal-auth');
  }, []);

  const stopAdminView = useCallback(() => {
    setCustomer(null);
    setIsAdminView(false);
    setAdminName('');
    localStorage.removeItem('warmeleads-portal-auth');
    window.location.href = '/admin/customers';
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-navy">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/10 border-t-brand-purple" />
      </div>
    );
  }

  if (!customer) return <LoginScreen onLogin={handleLogin} />;

  return (
    <PortalContext.Provider value={{ customer, logout: handleLogout }}>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <div className="sticky top-0 z-40">
          {isAdminView && (
            <AdminViewBanner
              customerName={customer.name}
              adminName={adminName}
              onStop={stopAdminView}
            />
          )}
          <PortalHeader customer={customer} onLogout={handleLogout} />
        </div>
        {!isAdminView && <InstallBanner />}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
        <PortalFooter />
      </div>
    </PortalContext.Provider>
  );
}
