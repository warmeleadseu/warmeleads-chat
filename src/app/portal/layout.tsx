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

        <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-xl">
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>
          )}
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50">E-mail</label>
              <input
                type="email"
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
    <header className="sticky top-0 z-40 bg-white shadow-sm">
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
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="mx-auto mb-4 max-w-7xl px-4 sm:px-6 lg:px-8"
      >
        <div className="relative flex items-center gap-3 rounded-xl border border-brand-purple/20 bg-brand-purple/[0.04] px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-purple/10">
            <DevicePhoneMobileIcon className="h-5 w-5 text-brand-purple" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800">Installeer de WarmeLeads app</p>
            {iosHint ? (
              <p className="text-xs text-slate-500">
                Tik op <ArrowUpOnSquareIcon className="inline h-3.5 w-3.5 -mt-0.5 text-brand-purple" /> en kies &quot;Zet op beginscherm&quot;
              </p>
            ) : (
              <p className="text-xs text-slate-500">Voeg toe aan uw startscherm voor snelle toegang en notificaties</p>
            )}
          </div>
          {!iosHint && (
            <button
              onClick={handleInstall}
              className="shrink-0 rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-purple/90"
            >
              Installeer
            </button>
          )}
          <button onClick={dismiss} className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PortalLayout({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<PortalCustomer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('warmeleads-portal-auth');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.token && parsed.customer && Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000) {
          setCustomer(parsed.customer);
        } else {
          localStorage.removeItem('warmeleads-portal-auth');
        }
      }
    } catch { /* noop */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!customer) return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('SW registration failed:', err);
      });
    }
  }, [customer]);

  const handleLogin = useCallback((c: PortalCustomer, token: string) => {
    setCustomer(c);
    localStorage.setItem('warmeleads-portal-auth', JSON.stringify({ customer: c, token, timestamp: Date.now() }));
  }, []);

  const handleLogout = useCallback(() => {
    setCustomer(null);
    localStorage.removeItem('warmeleads-portal-auth');
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
        <PortalHeader customer={customer} onLogout={handleLogout} />
        <InstallBanner />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
        <PortalFooter />
      </div>
    </PortalContext.Provider>
  );
}
