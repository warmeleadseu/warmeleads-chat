'use client';

import { useState } from 'react';
import { adminFetch } from '@/lib/adminAuth';
import { herinnerOverzicht, stapOmschrijving } from '@/lib/betaalHerinnering';

type OpvolgBatch = {
  id: string;
  status: string;
  is_paid: boolean;
  created_at: string;
  herinnering_vanaf?: string | null;
  betaalherinnering_stap?: number | null;
  betaalherinnering_op?: string | null;
  betaalherinneringen?: boolean | null;
  expired_at?: string | null;
};

const datum = (d: Date | string) =>
  new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Onbetaalde batch in het batchdetail: waar de automatische herinneringen
 * staan, ze aan- of uitzetten, en de batch laten verlopen of terugzetten.
 */
export default function BetaalOpvolging({ batch, onGewijzigd }: { batch: OpvolgBatch; onGewijzigd: () => void }) {
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  if (batch.is_paid) return null;

  const verlopen = batch.status === 'expired';
  const aan = batch.betaalherinneringen !== false;
  const { gedaan, volgende } = herinnerOverzicht(batch);

  const doe = async (pad: string, init: RequestInit) => {
    setBezig(true);
    setFout(null);
    try {
      const res = await adminFetch(pad, init);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setFout(d.error || 'Wijzigen mislukt');
      } else {
        onGewijzigd();
      }
    } catch {
      setFout('Wijzigen mislukt');
    }
    setBezig(false);
  };

  const wisselHerinneringen = () =>
    doe('/api/admin/batches', { method: 'PUT', body: JSON.stringify({ id: batch.id, betaalherinneringen: !aan }) });

  const verloop = (actie: 'verlopen' | 'terugzetten') => {
    const vraag = actie === 'verlopen'
      ? 'Deze batch laten verlopen? De open factuur vervalt mee en is niet meer te betalen. Terugzetten kan altijd.'
      : 'Deze batch weer op "wacht op betaling" zetten? De factuur gaat weer open en de herinneringen beginnen opnieuw.';
    if (!confirm(vraag)) return;
    void doe(`/api/admin/batches/${batch.id}/verlopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actie }),
    });
  };

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
      {verlopen ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-slate-600">
            <span className="font-semibold text-slate-800">Verlopen</span>
            {batch.expired_at ? ` op ${datum(batch.expired_at)}` : ''}. Niet meer te betalen.
          </p>
          <button type="button" disabled={bezig} onClick={() => verloop('terugzetten')}
            className="min-h-9 rounded-lg border border-brand-purple/30 bg-white px-3 py-1.5 font-semibold text-brand-purple transition hover:bg-brand-purple/5 disabled:opacity-50">
            Terugzetten
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-slate-800">Automatische herinneringen</p>
            <label className="inline-flex cursor-pointer items-center gap-2 text-slate-600">
              <input type="checkbox" checked={aan} disabled={bezig} onChange={wisselHerinneringen}
                className="h-4 w-4 rounded border-slate-300 text-brand-purple focus:ring-brand-purple" />
              {aan ? 'Aan' : 'Uit'}
            </label>
          </div>
          <p className="mt-1.5 text-slate-500">
            {gedaan
              ? `Laatst: ${stapOmschrijving(gedaan)}${batch.betaalherinnering_op ? ` op ${datum(batch.betaalherinnering_op)}` : ''}.`
              : 'Nog geen herinnering verstuurd.'}
            {aan && volgende ? ` Volgende: ${stapOmschrijving(volgende)}, rond ${datum(volgende.op)}.` : ''}
            {!aan ? ' Er gaat niets automatisch.' : ''}
          </p>
          <div className="mt-2 flex justify-end">
            <button type="button" disabled={bezig} onClick={() => verloop('verlopen')}
              className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50">
              Nu laten verlopen
            </button>
          </div>
        </>
      )}
      {fout && <p className="mt-2 text-red-600">{fout}</p>}
    </div>
  );
}
