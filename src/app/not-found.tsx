import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pagina niet gevonden | WarmeLeads',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-navy px-6 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-orange">404</p>
      <h1 className="mt-4 max-w-xl text-3xl font-bold text-white sm:text-4xl">
        Deze pagina bestaat niet
      </h1>
      <p className="mt-4 max-w-md text-base text-white/70">
        De link is verlopen of er staat een typefout in het adres. Vanaf de homepage vind je alles
        terug.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-brand-orange px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-brand-orange/90"
        >
          Naar de homepage
        </Link>
        <Link
          href="/plan-gesprek"
          className="rounded-lg border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          Plan een gesprek
        </Link>
      </div>
    </main>
  );
}
