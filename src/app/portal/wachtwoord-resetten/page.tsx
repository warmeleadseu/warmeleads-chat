'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeftIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) setError('Geen geldige reset-link gevonden.');
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Wachtwoord moet minimaal 8 tekens bevatten');
      return;
    }

    if (password !== confirmPassword) {
      setError('Wachtwoorden komen niet overeen');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/portal/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Er ging iets mis');
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis');
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
          <p className="mt-3 text-sm text-white/40">Wachtwoord resetten</p>
        </div>

        {success ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 text-center backdrop-blur-xl">
            <CheckCircleIcon className="mx-auto mb-4 h-12 w-12 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Wachtwoord gewijzigd</h2>
            <p className="mt-2 text-sm text-white/60">Je kunt nu inloggen met je nieuwe wachtwoord.</p>
            <Link
              href="/portal"
              className="mt-6 inline-block w-full rounded-lg bg-button-gradient py-2.5 text-center text-sm font-bold text-white shadow-lg shadow-brand-orange/20 transition hover:shadow-brand-orange/30"
            >
              Naar inloggen
            </Link>
          </div>
        ) : !token ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 text-center backdrop-blur-xl">
            <ExclamationTriangleIcon className="mx-auto mb-4 h-12 w-12 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Ongeldige link</h2>
            <p className="mt-2 text-sm text-white/60">Deze reset-link is ongeldig of verlopen.</p>
            <Link
              href="/portal"
              className="mt-6 inline-block w-full rounded-lg bg-button-gradient py-2.5 text-center text-sm font-bold text-white shadow-lg shadow-brand-orange/20 transition hover:shadow-brand-orange/30"
            >
              Terug naar inloggen
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-xl">
            {error && (
              <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>
            )}
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">Nieuw wachtwoord</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30"
                  placeholder="Minimaal 8 tekens"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">Bevestig wachtwoord</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30"
                  placeholder="Herhaal wachtwoord"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-lg bg-button-gradient py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/20 transition hover:shadow-brand-orange/30 disabled:opacity-60"
            >
              {loading ? 'Bezig...' : 'Wachtwoord opslaan'}
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-xs text-white/25">
          <Link href="/portal" className="hover:text-white/40 transition">
            <ArrowLeftIcon className="mr-1 inline h-3 w-3" />
            Terug naar inloggen
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
