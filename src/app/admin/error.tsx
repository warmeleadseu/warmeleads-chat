'use client';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-bold text-slate-900">Er ging iets mis</h2>
      <p className="max-w-md text-sm text-slate-600">{error.message || 'Onbekende fout in admin'}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white"
      >
        Opnieuw proberen
      </button>
    </div>
  );
}
