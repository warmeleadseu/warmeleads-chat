'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowPathRoundedSquareIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { useAdminConfirm } from '@/components/admin/ui/AdminConfirmProvider';

/**
 * Doorlopend op factuur in de klantkaart. Een keuze, nooit een standaard:
 * staat het aan, dan start bij een volle batch direct een nieuwe met dezelfde
 * voorwaarden, op factuur. Accountmanagers mogen het ook schakelen; de klant
 * krijgt bij aanzetten altijd een bevestiging met een stopknop.
 */

type Status = {
  aan: boolean;
  sinds: string | null;
  door: 'beheer' | 'klant' | null;
  zelf: 'ok' | 'geen_betaalde_batch' | 'achterstallig' | 'niet_beschikbaar';
  uitleg: string | null;
  openFactuur: { nummer: string; bedrag: number; uiterlijk: string | null } | null;
};

function datum(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

const euro = (n: number) => `€${n.toFixed(2).replace('.', ',')}`;

export default function DoorlopendBlok({ customerId, klantNaam }: { customerId: string; klantNaam: string }) {
  const { confirm } = useAdminConfirm();
  const [status, setStatus] = useState<Status | null>(null);
  const [laadFout, setLaadFout] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const laad = useCallback(async () => {
    setLaadFout(false);
    try {
      const res = await adminFetch(`/api/admin/customers/${customerId}/doorlopend`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setStatus((await res.json()) as Status);
    } catch {
      setLaadFout(true);
    }
  }, [customerId]);
  useEffect(() => { setStatus(null); void laad(); }, [laad]);

  const wissel = async () => {
    if (!status || bezig) return;
    const nieuw = !status.aan;
    const zeker = await confirm({
      title: nieuw ? `Doorlopend op factuur voor ${klantNaam}?` : 'Doorlopend op factuur uitzetten?',
      message: nieuw
        ? 'Alleen aanzetten als de klant dit wil. Bij 90% krijgt de klant een aankondiging met een stopknop; bij 100% start direct een nieuwe batch met dezelfde voorwaarden (maximaal €2.500 excl. btw), op factuur met 7 dagen betaaltermijn. De klant krijgt nu een bevestiging per mail.'
        : 'Volle batches lopen dan niet meer vanzelf door. Een batch die al loopt, wordt gewoon afgemaakt.',
      confirmLabel: nieuw ? 'Aanzetten' : 'Uitzetten',
      destructive: !nieuw,
    });
    if (!zeker) return;
    setBezig(true);
    setFout(null);
    try {
      const res = await adminFetch(`/api/admin/customers/${customerId}/doorlopend`, { method: 'POST', body: JSON.stringify({ aan: nieuw }) });
      const d = (await res.json().catch(() => ({}))) as Status & { error?: string };
      if (!res.ok) {
        setFout(d.error || 'Opslaan mislukt');
        return;
      }
      setStatus(d);
    } catch {
      setFout('Netwerkfout bij opslaan');
    } finally {
      setBezig(false);
    }
  };

  const aan = status?.aan === true;
  return (
    <div className={`rounded-lg border p-4 ${aan ? 'border-violet-200 bg-violet-50/40' : 'border-slate-100 bg-slate-50/70'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${aan ? 'bg-violet-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
            <ArrowPathRoundedSquareIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-700">Doorlopend op factuur</p>
            <p className="text-[11px] text-slate-400">
              {!status
                ? (laadFout ? 'Laden mislukt' : 'Laden…')
                : aan
                  ? `Aan${status.sinds ? ` sinds ${datum(status.sinds)}` : ''}${status.door === 'klant' ? ', door de klant' : status.door === 'beheer' ? ', door beheer' : ''}: volle batch loopt vanzelf door`
                  : 'Uit: klant bestelt zelf opnieuw (standaard)'}
            </p>
          </div>
        </div>
        {status ? (
          <button
            type="button"
            role="switch"
            aria-checked={aan}
            aria-label={aan ? 'Doorlopend op factuur uitzetten' : 'Doorlopend op factuur aanzetten'}
            onClick={() => void wissel()}
            disabled={bezig || (!aan && status.zelf === 'niet_beschikbaar')}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${aan ? 'bg-violet-500' : 'bg-slate-300'}`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${aan ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </button>
        ) : laadFout ? (
          <button type="button" onClick={() => void laad()} className="text-[11px] font-medium text-slate-500 underline">Opnieuw</button>
        ) : null}
      </div>

      {status?.openFactuur && (
        <p className="mt-3 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
          Open doorloopfactuur {status.openFactuur.nummer} ({euro(status.openFactuur.bedrag)})
          {status.openFactuur.uiterlijk ? `, uiterlijk ${datum(status.openFactuur.uiterlijk)}` : ''}. Een volgende doorloop start pas na betaling.
        </p>
      )}
      {status && !aan && status.zelf === 'achterstallig' && (
        <p className="mt-2 text-[11px] text-amber-700">Let op: deze klant heeft een factuur waarvan de betaaltermijn voorbij is.</p>
      )}
      {fout && <p className="mt-2 text-xs text-red-600">{fout}</p>}
    </div>
  );
}
