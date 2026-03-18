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
} from '@heroicons/react/24/outline';
import { AdminContext, type AdminUser } from './adminContext';

const NAV = [
  { label: 'Dashboard', href: '/admin', icon: HomeIcon },
  { label: 'Leads CRM', href: '/admin/leads', icon: ChartBarSquareIcon },
  { label: 'Importeren', href: '/admin/import', icon: DocumentArrowUpIcon },
  { label: 'Klanten', href: '/admin/customers', icon: BuildingOfficeIcon },
  { label: 'Koppelingen', href: '/admin/koppelingen', icon: Cog6ToothIcon },
];

function LoginScreen({ onLogin }: { onLogin: (u: AdminUser, t: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login mislukt');
      onLogin(data.user, data.token);
    } catch (err: any) {
      setError(err.message);
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
        <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-xl">
          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-300">{error}</div>
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
                placeholder="admin@warmeleads.eu"
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
        </form>
      </motion.div>
    </div>
  );
}

function Sidebar({ user, onLogout }: { user: AdminUser; onLogout: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-brand-navy lg:flex">
      <div className="h-[3px] bg-warmeleads-gradient" />
      <div className="flex h-16 items-center px-5">
        <Image src="/logo-wit.png" alt="WarmeLeads" width={130} height={39} className="h-7 w-auto" />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-0.5">
          {NAV.map((item) => {
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
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="border-t border-white/[0.06] px-4 py-4">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-purple/20 text-xs font-bold text-brand-purple">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white/80">{user.name}</p>
            <p className="truncate text-[11px] text-white/30">{user.email}</p>
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

function MobileHeader({ user, onLogout }: { user: AdminUser; onLogout: () => void }) {
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
        <button onClick={() => setOpen(true)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600">
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
              <div className="h-[3px] bg-warmeleads-gradient" />
              <div className="flex h-14 items-center justify-between px-4">
                <Image src="/logo-wit.png" alt="WarmeLeads" width={110} height={33} className="h-6 w-auto" />
                <button onClick={() => setOpen(false)} className="text-white/50"><XMarkIcon className="h-5 w-5" /></button>
              </div>
              <nav className="px-3 py-4 space-y-0.5">
                {NAV.map((item) => {
                  const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                        active ? 'bg-brand-purple/20 text-white' : 'text-white/50 hover:text-white/80'
                      }`}
                    >
                      <item.icon className={`h-[18px] w-[18px] ${active ? 'text-brand-purple' : 'text-white/40'}`} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="absolute bottom-0 left-0 right-0 border-t border-white/[0.06] px-4 py-4">
                <p className="mb-2 truncate text-xs text-white/40">{user.name}</p>
                <button onClick={onLogout} className="flex items-center gap-2 text-xs text-white/40 hover:text-red-400">
                  <ArrowRightOnRectangleIcon className="h-4 w-4" /> Uitloggen
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('warmeleads-admin-auth');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.token && parsed.user && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          setUser(parsed.user);
        } else {
          localStorage.removeItem('warmeleads-admin-auth');
        }
      }
    } catch { /* noop */ }
    setLoading(false);
  }, []);

  const handleLogin = useCallback((u: AdminUser, token: string) => {
    setUser(u);
    localStorage.setItem('warmeleads-admin-auth', JSON.stringify({ user: u, token, timestamp: Date.now() }));
  }, []);

  const handleLogout = useCallback(() => {
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

  return (
    <AdminContext.Provider value={{ user, logout: handleLogout }}>
      <div className="min-h-screen bg-slate-50">
        <Sidebar user={user} onLogout={handleLogout} />
        <MobileHeader user={user} onLogout={handleLogout} />
        <main className="lg:pl-60">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </AdminContext.Provider>
  );
}
