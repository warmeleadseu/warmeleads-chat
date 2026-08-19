'use client';

import { useEffect } from 'react';

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[portal] onverwachte fout:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-bold text-slate-900">Dit scherm kon niet geladen worden</h2>
      <p className="max-w-md text-sm text-slate-600">
        Je gegevens zijn veilig — er ging alleen iets mis bij het opbouwen van deze pagina. Probeer
        het opnieuw, of ververs je browser.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-slate-400">Foutcode: {error.digest}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple/90"
        >
          Opnieuw proberen
        </button>
        <a
          href="/portal"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Terug naar overzicht
        </a>
      </div>
    </div>
  );
}
