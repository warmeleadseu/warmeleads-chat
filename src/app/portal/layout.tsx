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
  BeakerIcon,
  SparklesIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { PortalContext, type PortalCustomer, type ClientPortalUser, isDemoPortalExperience } from './portalContext';
import { portalFetch, PORTAL_IMPERSONATION_KEY } from '@/lib/portalAuth';
import { IMPERSONATION_HANDOFF_PREFIX, IMPERSONATION_HANDOFF_TTL_MS } from '@/lib/adminOpenPortal';
import { PERMISSIONS } from '@/lib/portalPermissions';
import { UsersIcon } from '@heroicons/react/24/outline';
import { ToastProvider, AnnouncementBar } from './_ui';

/**
 * Self-healing loading-screen voor het portal.
 *
 * Probleem: op iOS Safari kon deze loading-state in zeldzame gevallen blijven
 * draaien — bv. wanneer een oude Service Worker (pre-v5) chunks of HTML uit
 * een cache leverde die niet meer bestonden, of wanneer Safari de pagina uit
 * BFCache restored zonder dat de useEffect opnieuw afvuurde. Gebruikers
 * konden er niet uitkomen omdat ze nooit voorbij dit scherm raakten.
 *
 * Deze component:
 * - Toont na 5 sec een "Pagina herladen"-knop zodat de gebruiker zelf kan
 *   ingrijpen.
 * - Probeert na 12 sec automatisch te herstellen door alle Service Workers en
 *   Cache Storage te wissen en daarna een hard reload te doen.
 *
 * Een sessionStorage-vlag in dezelfde flow als het kill-switch-script in
 * <head> voorkomt reload-loops.
 */
function PortalLoadingScreen() {
  const [showRetry, setShowRetry] = useState(false);
  const [recovering, setRecovering] = useState(false);

  const performRecovery = useCallback(async () => {
    setRecovering(true);
    try {
      try {
        sessionStorage.removeItem('wl-sw-checked-v5');
        sessionStorage.removeItem('wl-sw-reloaded-v5');
      } catch {
        /* ignore */
      }
      if ('serviceWorker' in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
        } catch {
          /* ignore */
        }
      }
      if (typeof caches !== 'undefined') {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
        } catch {
          /* ignore */
        }
      }
    } finally {
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    const retryTimer = window.setTimeout(() => setShowRetry(true), 5000);
    const autoTimer = window.setTimeout(() => {
      void performRecovery();
    }, 12000);
    return () => {
      window.clearTimeout(retryTimer);
      window.clearTimeout(autoTimer);
    };
  }, [performRecovery]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-navy px-6 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/10 border-t-brand-purple" />
      {showRetry && (
        <div className="mt-8 max-w-xs space-y-3">
          <p className="text-sm text-white/70">
            Duurt het te lang? Tik hieronder om de pagina opnieuw te laden.
          </p>
          <button
            type="button"
            onClick={() => void performRecovery()}
            disabled={recovering}
            className="w-full rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-60"
          >
            {recovering ? 'Bezig met herladen…' : 'Pagina herladen'}
          </button>
        </div>
      )}
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (c: PortalCustomer, pu: ClientPortalUser | null) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/portal/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Inloggen mislukt');
      onLogin(data.customer, data.portal_user || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Inloggen mislukt');
    } finally {
      setLoading(false);
    }
  };

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError('');
    try {
      const res = await fetch('/api/portal/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Er ging iets mis');
      setForgotSent(true);
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : 'Er ging iets mis');
    } finally {
      setForgotLoading(false);
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

        <AnimatePresence mode="wait">
          {forgotMode ? (
            <motion.div
              key="forgot"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {forgotSent ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 text-center backdrop-blur-xl">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
                    <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-white">E-mail verstuurd</h2>
                  <p className="mt-2 text-sm text-white/60">
                    Als dit e-mailadres bij ons bekend is, ontvang je binnen enkele minuten een e-mail met een link om je wachtwoord te resetten.
                  </p>
                  <button
                    onClick={() => { setForgotMode(false); setForgotSent(false); setForgotEmail(''); }}
                    className="mt-6 w-full rounded-lg border border-white/10 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.06]"
                  >
                    Terug naar inloggen
                  </button>
                </div>
              ) : (
                <form onSubmit={submitForgot} className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-xl">
                  <h2 className="mb-1 text-base font-semibold text-white">Wachtwoord vergeten?</h2>
                  <p className="mb-5 text-sm text-white/40">Vul je e-mailadres in en we sturen je een link om je wachtwoord te resetten.</p>
                  {forgotError && (
                    <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{forgotError}</div>
                  )}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/50">E-mail</label>
                    <input
                      type="email"
                      required
                      autoFocus
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30"
                      placeholder="je@bedrijf.nl"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="mt-5 w-full rounded-lg bg-button-gradient py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/20 transition hover:shadow-brand-orange/30 disabled:opacity-60"
                  >
                    {forgotLoading ? 'Versturen...' : 'Verstuur reset-link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setForgotMode(false); setForgotError(''); }}
                    className="mt-3 w-full rounded-lg py-2 text-sm text-white/40 transition hover:text-white/60"
                  >
                    Terug naar inloggen
                  </button>
                </form>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
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
                      placeholder="je@bedrijf.nl"
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
                <p className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setForgotMode(true)}
                    className="text-[12px] text-white/40 transition hover:text-white/60"
                  >
                    Wachtwoord vergeten?
                  </button>
                </p>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-5 text-center text-sm text-white/40">
          Nog geen account?{' '}
          <Link href="/gratis-account" className="font-semibold text-brand-purple hover:text-brand-purple/80 transition">
            Gratis aanmaken
          </Link>
        </p>

        <p className="mt-3 text-center text-xs text-white/25">
          <Link href="/" className="hover:text-white/40 transition">
            <ArrowLeftIcon className="mr-1 inline h-3 w-3" />
            Terug naar warmeleads.eu
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  permission?: string;
}

const ALL_PORTAL_NAV: (NavItem & { shortLabel?: string })[] = [
  { label: 'Leads', href: '/portal', icon: InboxStackIcon, permission: PERMISSIONS.LEADS_VIEW },
  { label: 'Agenda', href: '/portal/agenda', icon: CalendarDaysIcon, permission: PERMISSIONS.APPOINTMENTS_VIEW },
  { label: 'Bestellen', href: '/portal/bestellen', icon: ShoppingCartIcon, permission: PERMISSIONS.ORDERS_CREATE },
  { label: 'Team', href: '/portal/team', icon: UsersIcon, permission: PERMISSIONS.TEAM_MANAGE },
  { label: 'Account & Insights', shortLabel: 'Account', href: '/portal/account', icon: UserCircleIcon },
];

function PortalHeader({
  customer,
  portalUser,
  hasPermFn,
  onLogout,
}: {
  customer: PortalCustomer;
  portalUser: ClientPortalUser | null;
  hasPermFn: (p: string) => boolean;
  onLogout: () => void;
}) {
  const pathname = usePathname();

  const navItems = ALL_PORTAL_NAV.filter(item => {
    if (!item.permission) return true;
    return hasPermFn(item.permission);
  });

  const displayName = portalUser ? portalUser.name : (customer.contact_person || customer.name);
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="bg-white shadow-sm">
      <div className="h-[3px] bg-warmeleads-gradient" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Image src="/warmeleads-logo-2026.png" alt="WarmeLeads" width={120} height={36} className="h-6 w-auto" />
            <div className="hidden h-5 w-px bg-slate-200 sm:block" />
            <span className="hidden max-w-[160px] truncate text-sm font-medium text-slate-600 sm:inline">
              {portalUser && portalUser.role !== 'owner'
                ? `${customer.name}`
                : customer.name}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {portalUser && portalUser.role !== 'owner' && (
              <span className="hidden rounded-md bg-brand-purple/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-purple sm:inline">
                {portalUser.role === 'manager' ? 'Manager' : 'Agent'}
              </span>
            )}
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-purple/10 text-xs font-bold text-brand-purple">
              {initial}
            </div>
            <span className="hidden text-sm text-slate-600 sm:inline">{displayName}</span>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-red-500 sm:px-2.5"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Uitloggen</span>
            </button>
          </div>
        </div>
        <nav className="-mb-px flex overflow-x-auto border-t border-slate-100 hide-scrollbar">
          {navItems.map((item) => {
            const active = item.href === '/portal' ? pathname === '/portal' : pathname.startsWith(item.href);
            const short = (item as typeof ALL_PORTAL_NAV[number]).shortLabel;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-2.5 text-[13px] font-medium transition sm:gap-2 sm:px-3 sm:text-sm ${
                  active
                    ? 'border-brand-purple text-brand-purple'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {short ? (
                  <>
                    <span className="sm:hidden">{short}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                  </>
                ) : (
                  item.label
                )}
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
                    Tik op <ArrowUpOnSquareIcon className="inline h-4 w-4 -mt-0.5 text-brand-purple" /> in je browser en kies <span className="font-medium text-slate-700">&quot;Zet op beginscherm&quot;</span>
                  </p>
                ) : (
                  <p className="mt-0.5 text-[13px] leading-snug text-slate-500">
                    Snelle toegang vanaf je startscherm met push notificaties
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

function DemoBanner() {
  return (
    <AnnouncementBar
      variant="demo"
      icon={<BeakerIcon className="h-4 w-4" />}
      action={
        <Link
          href="/portal/bestellen"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/30"
        >
          <SparklesIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Bestel je eerste batch</span>
          <span className="sm:hidden">Bestellen</span>
        </Link>
      }
    >
      <span className="font-medium">
        <span className="hidden sm:inline">Demo Modus</span>
        <span className="sm:hidden">Demo</span>
        {' · '}
      </span>
      <span className="text-white/90">
        <span className="hidden sm:inline">Je bekijkt voorbeeldleads om het portaal te ervaren</span>
        <span className="sm:hidden">Voorbeeldleads</span>
      </span>
    </AnnouncementBar>
  );
}

function AdminViewBanner({ customerName, adminName, onStop }: { customerName: string; adminName: string; onStop: () => void }) {
  return (
    <AnnouncementBar
      variant="admin"
      icon={<EyeIcon className="h-4 w-4" />}
      action={
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
      }
    >
      <span className="font-medium">
        <span className="hidden sm:inline">Admin-weergave</span>
        <span className="sm:hidden">Admin</span>
        {' · '}
      </span>
      <span className="font-bold">{customerName}</span>
      <span className="hidden text-white/70 sm:inline"> · bekeken door {adminName}</span>
    </AnnouncementBar>
  );
}

function RoleSubBar({ role, customerName }: { role: string; customerName: string }) {
  return (
    <AnnouncementBar variant="info" icon={<UsersIcon className="h-3.5 w-3.5 text-brand-purple/60" />}>
      <span className="text-xs text-brand-purple/70">
        Ingelogd als <span className="font-semibold">{role === 'manager' ? 'manager' : 'agent'}</span> bij {customerName}
      </span>
    </AnnouncementBar>
  );
}

export default function PortalLayout({ children }: { children: ReactNode }) {
  const layoutPathname = usePathname();
  const [customer, setCustomer] = useState<PortalCustomer | null>(null);
  const [portalUser, setPortalUser] = useState<ClientPortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminView, setIsAdminView] = useState(false);
  const [adminName, setAdminName] = useState('');

  // Publieke portaalpagina's die zonder ingelogde sessie bereikbaar moeten zijn.
  // De wachtwoord-reset-pagina wordt juist geopend door uitgelogde gebruikers
  // (vanuit de reset-mail), dus die mag nooit achter het login-scherm vallen.
  const isPublicPortalPage = layoutPathname === '/portal/wachtwoord-resetten';

  const isOwner = !portalUser || portalUser.role === 'owner';

  const hasPermFn = useCallback((perm: string): boolean => {
    if (isOwner) return true;
    if (!portalUser) return true;
    return portalUser.permissions.includes(perm);
  }, [isOwner, portalUser]);

  useEffect(() => {
    let cancelled = false;

    async function restoreFromCookieOrLegacy() {
      try {
        // Fetch met harde timeout zodat de loading-state nooit eindeloos
        // blijft hangen wanneer een (oude) Service Worker of netwerk-issue
        // het request niet afhandelt.
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 8000);
        let res: Response;
        try {
          res = await fetch('/api/portal/auth/session', {
            credentials: 'include',
            cache: 'no-store',
            signal: controller.signal,
          });
        } finally {
          window.clearTimeout(timeoutId);
        }
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setCustomer(data.customer);
          setPortalUser(data.portal_user ?? null);
          return;
        }
      } catch {
        /* noop */
      }

      try {
        const raw = localStorage.getItem('warmeleads-portal-auth');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed.customer) {
          localStorage.removeItem('warmeleads-portal-auth');
          return;
        }
        const maxAge = parsed.is_admin_view ? 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - parsed.timestamp > maxAge) {
          localStorage.removeItem('warmeleads-portal-auth');
          return;
        }
        setCustomer(parsed.customer);
        if (parsed.portal_user) setPortalUser(parsed.portal_user);
        if (parsed.is_admin_view) {
          setIsAdminView(true);
          setAdminName(parsed.admin_name || 'Admin');
        }
      } catch {
        localStorage.removeItem('warmeleads-portal-auth');
      }
    }

    // Per-tab impersonatie herstellen (voorrang op de browserbrede cookie), zodat
    // een reload van deze tab dezelfde klant houdt als een andere tab intussen
    // een andere klant impersoneert.
    function restoreImpersonationFromSession(): boolean {
      try {
        const impRaw = sessionStorage.getItem(PORTAL_IMPERSONATION_KEY);
        if (!impRaw) return false;
        const imp = JSON.parse(impRaw);
        const fresh = imp.timestamp && Date.now() - imp.timestamp < 60 * 60 * 1000;
        if (imp.customer && imp.token && fresh) {
          setCustomer(imp.customer);
          setPortalUser(null);
          setIsAdminView(true);
          setAdminName(imp.admin_name || 'Admin');
          return true;
        }
        sessionStorage.removeItem(PORTAL_IMPERSONATION_KEY);
      } catch { /* noop */ }
      return false;
    }

    const params = new URLSearchParams(window.location.search);
    // Impersonatie-token komt via een eenmalige, same-origin localStorage-overdracht
    // (imp_ref) i.p.v. in de URL. We lezen de entry en wissen hem meteen (one-time).
    let impersonateToken: string | null = null;
    const impRef = params.get('imp_ref');
    if (impRef) {
      try {
        const key = `${IMPERSONATION_HANDOFF_PREFIX}${impRef}`;
        const raw = localStorage.getItem(key);
        localStorage.removeItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as { token?: string; ts?: number };
          if (parsed.token && parsed.ts && Date.now() - parsed.ts < IMPERSONATION_HANDOFF_TTL_MS) {
            impersonateToken = parsed.token;
          }
        }
      } catch { /* noop */ }
    }

    if (impersonateToken) {
      (async () => {
        try {
          const res = await fetch('/api/portal/auth/impersonate', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: impersonateToken }),
          });
          if (!res.ok) throw new Error('Impersonation mislukt');
          const data = await res.json();

          if (cancelled) return;
          setCustomer(data.customer);
          setPortalUser(null);
          setIsAdminView(true);
          setAdminName(data.impersonation?.admin_name || 'Admin');

          // Per-tab bewaren (sessionStorage): zo krijgt elke "bekijk als klant"-tab
          // zijn eigen sessie/token en overschrijven twee tabs elkaar niet.
          try {
            sessionStorage.setItem(
              PORTAL_IMPERSONATION_KEY,
              JSON.stringify({
                customer: data.customer,
                token: data.portal_token,
                timestamp: Date.now(),
                admin_name: data.impersonation?.admin_name || 'Admin',
              }),
            );
          } catch { /* sessionStorage niet beschikbaar: sessie blijft in geheugen tot reload */ }

          window.history.replaceState({}, '', '/portal');
        } catch {
          await restoreFromCookieOrLegacy();
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    if (restoreImpersonationFromSession()) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      await restoreFromCookieOrLegacy();
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Service Worker wordt NIET preëmptief geregistreerd — alleen wanneer een
  // gebruiker push-notificaties activeert (zie usePushNotifications.ts). Een
  // SW met scope '/' onderschept anders alle navigaties op het hele domein,
  // wat in eerdere versies stale chunks/HTML opleverde en op iOS Safari een
  // hard-vastlopende loading-state veroorzaakte.
  useEffect(() => {
    if (!customer || isAdminView) return;
    if (!('serviceWorker' in navigator)) return;
    // Bestaande registratie alleen updaten, nooit nieuw aanmaken.
    navigator.serviceWorker
      .getRegistration('/')
      .then((reg) => {
        if (reg) reg.update().catch(() => {});
      })
      .catch(() => {});
  }, [customer, isAdminView]);

  // Sync account (o.a. show_demo_portal) from server: na betaling, tab refresh, of periodiek
  useEffect(() => {
    if (!customer || isAdminView) return;

    const syncAccount = () => {
      portalFetch('/api/portal/account')
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          if (!data?.customer) return;
          const c = data.customer as import('./portalContext').PortalCustomer;
          setCustomer(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              demo_mode: c.demo_mode,
              signup_source: c.signup_source ?? prev.signup_source,
              show_demo_portal: c.show_demo_portal,
              has_paid_customer_batch: c.has_paid_customer_batch,
              country: c.country ?? prev.country,
              vat_id: c.vat_id ?? prev.vat_id,
              reverse_charge: c.reverse_charge ?? prev.reverse_charge,
            };
          });
          try {
            const raw = localStorage.getItem('warmeleads-portal-auth');
            if (raw) {
              const parsed = JSON.parse(raw);
              parsed.customer = {
                ...parsed.customer,
                demo_mode: c.demo_mode,
                signup_source: c.signup_source ?? parsed.customer?.signup_source,
                show_demo_portal: c.show_demo_portal,
                has_paid_customer_batch: c.has_paid_customer_batch,
                country: c.country ?? parsed.customer?.country,
                vat_id: c.vat_id ?? parsed.customer?.vat_id,
                reverse_charge: c.reverse_charge ?? parsed.customer?.reverse_charge,
              };
              localStorage.setItem('warmeleads-portal-auth', JSON.stringify(parsed));
            }
          } catch { /* ignore */ }
        })
        .catch(() => {});
    };

    syncAccount();
    const interval = setInterval(syncAccount, 90_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- alleen klant-id; volledige customer wijzigt via deze sync
  }, [customer?.id, isAdminView]);

  // Heartbeat: update last_seen_at (lager frequent = minder DB-load op Nano)
  useEffect(() => {
    if (!customer || isAdminView) return;

    const sendHeartbeat = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      try {
        await portalFetch('/api/portal/heartbeat', { method: 'POST' });
      } catch {
        // Offline, DNS, tab sleep, etc. — avoid noisy unhandled rejections
      }
    };

    void sendHeartbeat();
    const interval = setInterval(() => {
      void sendHeartbeat();
    }, 5 * 60 * 1000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void sendHeartbeat();
    };
    const handleOnline = () => {
      void sendHeartbeat();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [customer, isAdminView]);

  const handleLogin = useCallback((c: PortalCustomer, pu: ClientPortalUser | null) => {
    setCustomer(c);
    setPortalUser(pu);
    setIsAdminView(false);
    setAdminName('');
    const authData: Record<string, unknown> = { customer: c, timestamp: Date.now() };
    if (pu) authData.portal_user = pu;
    localStorage.setItem('warmeleads-portal-auth', JSON.stringify(authData));
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/portal/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* noop */
    }
    setCustomer(null);
    setPortalUser(null);
    setIsAdminView(false);
    setAdminName('');
    localStorage.removeItem('warmeleads-portal-auth');
    try { sessionStorage.removeItem(PORTAL_IMPERSONATION_KEY); } catch { /* noop */ }
  }, []);

  const stopAdminView = useCallback(async () => {
    try {
      await fetch('/api/portal/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* noop */
    }
    setCustomer(null);
    setPortalUser(null);
    setIsAdminView(false);
    setAdminName('');
    localStorage.removeItem('warmeleads-portal-auth');
    try { sessionStorage.removeItem(PORTAL_IMPERSONATION_KEY); } catch { /* noop */ }
    window.location.href = '/admin/customers';
  }, []);

  if (isPublicPortalPage) {
    return <>{children}</>;
  }

  if (loading) {
    return <PortalLoadingScreen />;
  }

  if (!customer) return <LoginScreen onLogin={handleLogin} />;

  return (
    <PortalContext.Provider value={{ customer, portalUser, isOwner, hasPermission: hasPermFn, logout: handleLogout }}>
      <ToastProvider>
        <div className="flex min-h-screen flex-col bg-slate-50">
          <div className="sticky top-0 z-40">
            {isDemoPortalExperience(customer) && !isAdminView && <DemoBanner />}
            {isAdminView && (
              <AdminViewBanner
                customerName={customer.name}
                adminName={adminName}
                onStop={stopAdminView}
              />
            )}
            {portalUser && portalUser.role !== 'owner' && !isAdminView && (
              <RoleSubBar role={portalUser.role} customerName={customer.name} />
            )}
            <PortalHeader customer={customer} portalUser={portalUser} hasPermFn={hasPermFn} onLogout={handleLogout} />
          </div>
          {!isAdminView && <InstallBanner />}
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
          <PortalFooter />
        </div>
      </ToastProvider>
    </PortalContext.Provider>
  );
}
