import { Suspense } from 'react';
import HerbestelClient from './HerbestelClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Opnieuw bestellen · Warme Leads', robots: { index: false, follow: false } };

export default async function HerbestelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">Laden...</div>}>
      <HerbestelClient id={id} />
    </Suspense>
  );
}
