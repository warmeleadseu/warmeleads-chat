'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[public] onverwachte fout:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-navy px-6 py-16 text-center">
      <h1 className="max-w-xl text-3xl font-bold text-white sm:text-4xl">
        Deze pagina kon niet geladen worden
      </h1>
      <p className="mt-4 max-w-md text-base text-white/70">
        Er ging iets mis aan onze kant. Probeer het opnieuw — blijft het misgaan, dan kun je ons
        direct bereiken.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-xs text-white/40">Foutcode: {error.digest}</p>
      )}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-brand-orange px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-brand-orange/90"
        >
          Opnieuw proberen
        </button>
        <Link
          href="/"
          className="rounded-lg border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          Naar de homepage
        </Link>
      </div>
    </main>
  );
}
