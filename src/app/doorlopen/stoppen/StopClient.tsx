'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

/** Bevestigen dat de klant wil stoppen met automatisch doorlopen. */
export default function StopClient() {
  const params = useSearchParams();
  const [stand, setStand] = useState<'vraag' | 'bezig' | 'klaar'>('vraag');
  const [fout, setFout] = useState<string | null>(null);

  const stop = async () => {
    setStand('bezig');
    setFout(null);
    try {
      const res = await fetch('/api/doorlopen/stoppen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ k: params.get('k'), v: params.get('v'), t: params.get('t') }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setFout(d.error || 'Uitzetten lukte niet. Probeer het opnieuw.');
        setStand('vraag');
        return;
      }
      setStand('klaar');
    } catch {
      setFout('Geen verbinding. Probeer het opnieuw.');
      setStand('vraag');
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {stand === 'klaar' ? (
          <div className="text-center">
            <CheckCircleIcon className="mx-auto h-12 w-12 text-emerald-500" />
            <h1 className="mt-3 text-lg font-bold text-slate-900">Automatisch doorlopen staat uit</h1>
            <p className="mt-2 text-sm text-slate-600">
              Er start geen nieuwe batch meer vanzelf. Een batch die al loopt, wordt gewoon afgemaakt. Wil je later weer leads, dan bestel je zelf in je portaal.
            </p>
            <Link href="/portal" className="mt-5 inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Naar het portaal
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-lg font-bold text-slate-900">Automatisch doorlopen stoppen?</h1>
            <p className="mt-2 text-sm text-slate-600">
              Nu start bij een volle batch direct een nieuwe, op factuur. Zet je dit uit, dan bestel je voortaan zelf. Een batch die al loopt, wordt afgemaakt. Je kunt het later altijd weer aanzetten in je portaal.
            </p>
            {fout && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{fout}</p>}
            <button
              onClick={stop}
              disabled={stand === 'bezig'}
              className="mt-5 h-12 w-full rounded-xl bg-slate-900 text-sm font-bold text-white shadow-sm transition disabled:opacity-50"
            >
              {stand === 'bezig' ? 'Even geduld...' : 'Ja, zet automatisch doorlopen uit'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
