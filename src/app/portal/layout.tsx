'use client';

import { useState, useEffect, useCallback, ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRightOnRectangleIcon,
  ArrowLeftIcon,
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
          <Image src="/warmeleads-logo-2026.png" alt="WarmeLeads" width={180} height={54} className="mx-auto h-10 w-auto" />
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

function PortalHeader({ customer, onLogout }: { customer: PortalCustomer; onLogout: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="h-[3px] bg-warmeleads-gradient" />
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Image src="/warmeleads-logo-2026.png" alt="WarmeLeads" width={120} height={36} className="h-6 w-auto" />
          <div className="hidden h-5 w-px bg-slate-200 sm:block" />
          <span className="hidden text-sm font-medium text-slate-600 sm:block">{customer.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-purple/10 text-xs font-bold text-brand-purple">
              {customer.contact_person?.charAt(0)?.toUpperCase() || customer.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-slate-600">{customer.contact_person || customer.name}</span>
          </div>
          <button
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-red-500"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Uitloggen</span>
          </button>
        </div>
      </div>
    </header>
  );
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
      <div className="min-h-screen bg-slate-50">
        <PortalHeader customer={customer} onLogout={handleLogout} />
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </PortalContext.Provider>
  );
}
