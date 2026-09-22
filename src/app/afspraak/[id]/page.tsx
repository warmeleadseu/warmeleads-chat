import { Suspense } from 'react';
import AfspraakClient from './AfspraakClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Je afspraak · Warme Leads', robots: { index: false, follow: false } };

export default async function AfspraakPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">Laden...</div>}>
      <AfspraakClient id={id} />
    </Suspense>
  );
}
