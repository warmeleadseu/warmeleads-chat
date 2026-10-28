import { Suspense } from 'react';
import StopClient from './StopClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Automatisch doorlopen stoppen · Warme Leads', robots: { index: false, follow: false } };

export default function DoorlopenStoppenPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">Laden...</div>}>
      <StopClient />
    </Suspense>
  );
}
