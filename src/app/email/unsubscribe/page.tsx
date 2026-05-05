'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface ResolveResp {
  email: string;
  template_key: string | null;
  scope: string;
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeInner />
    </Suspense>
  );
}

function UnsubscribeInner() {
  const params = useSearchParams();
  const token = params.get('token') || '';

  const [info, setInfo] = useState<ResolveResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ email: string; scope: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Geen geldige link.');
      setLoading(false);
      return;
    }
    let active = true;
    fetch(`/api/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async r => {
        if (!active) return;
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || 'Ongeldige link');
        }
        const j: ResolveResp = await r.json();
        setInfo(j);
      })
      .catch(err => {
        if (active) setError(err.message || 'Ongeldige link');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function submit(scope: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, scope }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Uitschrijven mislukt');
      }
      const j = await res.json();
      setDone({ email: j.email, scope: j.scope });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onbekende fout');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div
          className="h-1.5"
          style={{ background: 'linear-gradient(135deg,#3B2F75 0%,#E74C8C 35%,#FF6B35 70%,#FF4757 100%)' }}
        />
        <div className="p-8">
          <h1 className="text-xl font-bold text-slate-900">Uitschrijven van WarmeLeads</h1>

          {loading && <p className="mt-4 text-sm text-slate-500">Even geduld…</p>}

          {error && !loading && !done && (
            <div className="mt-6 rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700">
              {error}
            </div>
          )}

          {!loading && !error && info && !done && (
            <>
              <p className="mt-3 text-sm text-slate-600">
                Je staat op het punt <span className="font-semibold text-slate-900">{info.email}</span>{' '}
                uit te schrijven. Wat wil je niet meer ontvangen?
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => submit(info.scope)}
                  disabled={submitting}
                  className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-3 text-sm font-medium text-slate-800 text-left disabled:opacity-50"
                >
                  Alleen mails van dit type{' '}
                  <span className="text-slate-500">
                    ({scopeLabel(info.scope)})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => submit('all')}
                  disabled={submitting}
                  className="rounded-lg bg-slate-900 hover:bg-slate-800 px-4 py-3 text-sm font-semibold text-white text-left disabled:opacity-50"
                >
                  Alle commerciële mails van WarmeLeads
                </button>
              </div>
              <p className="mt-6 text-xs text-slate-500">
                Belangrijke transactionele mails (zoals bestelbevestigingen of klantenportaal-meldingen)
                blijven we sturen.
              </p>
            </>
          )}

          {done && (
            <div className="mt-6 rounded-lg bg-emerald-50 border border-emerald-200 p-5 text-sm text-emerald-800">
              <p className="font-semibold">Je bent uitgeschreven.</p>
              <p className="mt-1">
                {done.email} ontvangt geen{' '}
                {done.scope === 'all' ? 'commerciële mails' : scopeLabel(done.scope)} meer van WarmeLeads.
              </p>
              <p className="mt-3 text-xs text-emerald-700">
                Bedacht je je? Stuur een mail naar{' '}
                <a className="underline" href="mailto:info@warmeleads.eu">
                  info@warmeleads.eu
                </a>{' '}
                en we draaien het terug.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function scopeLabel(scope: string): string {
  switch (scope) {
    case 'marketing':
      return 'commerciële introducties';
    case 'pricing':
      return 'prijsinformatie';
    case 'nurture':
      return 'opvolg- en update-mails';
    case 'all':
    default:
      return 'alle mails';
  }
}
