'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowPathRoundedSquareIcon } from '@heroicons/react/24/outline';
import { portalFetch } from '@/lib/portalAuth';

/**
 * Doorlopend op factuur in het portaal. Altijd een eigen keuze van de klant:
 * standaard uit, zelf aan te zetten vanaf een betaalde batch, en altijd weer
 * uit te zetten. Een kaart voor de accountpagina en een vinkje bij bestellen.
 */

export type DoorloopStand = {
  aan: boolean;
  sinds: string | null;
  zelf: 'ok' | 'geen_betaalde_batch' | 'achterstallig' | 'niet_beschikbaar';
  uitleg: string | null;
  openFactuur: { nummer: string; bedrag: number; uiterlijk: string | null } | null;
  magWijzigen: boolean;
};

export const DOORLOPEN_UITLEG =
  'Is je batch volledig geleverd, dan start direct een nieuwe met dezelfde voorwaarden, zodat je leads blijven doorkomen. ' +
  'Bij 90% krijg je bericht, met een knop om het die keer te voorkomen. De nieuwe batch gaat op factuur met 7 dagen betaaltermijn, ' +
  'tot €2.500 excl. btw per keer. Stoppen kan altijd; een batch die al loopt, wordt afgemaakt.';

const datum = (iso: string) => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
const euro = (n: number) => `€${n.toFixed(2).replace('.', ',')}`;

export function useDoorloopStand() {
  const [stand, setStand] = useState<DoorloopStand | null>(null);
  const laad = useCallback(async () => {
    try {
      const res = await portalFetch('/api/portal/doorlopend', { cache: 'no-store' });
      if (res.ok) setStand((await res.json()) as DoorloopStand);
    } catch {
      /* zonder stand tonen we niets */
    }
  }, []);
  useEffect(() => { void laad(); }, [laad]);

  const zet = useCallback(async (aan: boolean): Promise<string | null> => {
    try {
      const res = await portalFetch('/api/portal/doorlopend', { method: 'POST', body: JSON.stringify({ aan }) });
      const d = (await res.json().catch(() => ({}))) as DoorloopStand & { error?: string };
      if (!res.ok) return d.error || 'Opslaan mislukt';
      setStand(d);
      return null;
    } catch {
      return 'Netwerkfout, probeer het opnieuw';
    }
  }, []);
  return { stand, zet };
}

/** Kaart met uitleg en schakelaar (Account › Bestellingen). */
export function DoorlopendKaart() {
  const { stand, zet } = useDoorloopStand();
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  if (!stand || stand.zelf === 'niet_beschikbaar') return null;

  const kanAan = stand.zelf === 'ok' && stand.magWijzigen;
  const kanSchakelen = stand.magWijzigen && (stand.aan || kanAan);
  const wissel = async () => {
    if (bezig || !kanSchakelen) return;
    setBezig(true);
    setFout(null);
    setFout(await zet(!stand.aan));
    setBezig(false);
  };

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${stand.aan ? 'border-brand-purple/25 bg-brand-purple/[0.03]' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${stand.aan ? 'bg-brand-purple text-white' : 'bg-slate-100 text-slate-500'}`}>
            <ArrowPathRoundedSquareIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Automatisch doorlopen op factuur</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {stand.aan ? `Aan${stand.sinds ? ` sinds ${datum(stand.sinds)}` : ''}` : 'Uit: je bestelt zelf een nieuwe batch'}
            </p>
          </div>
        </div>
        {stand.magWijzigen && (
          <button
            type="button"
            role="switch"
            aria-checked={stand.aan}
            aria-label={stand.aan ? 'Automatisch doorlopen uitzetten' : 'Automatisch doorlopen aanzetten'}
            onClick={() => void wissel()}
            disabled={bezig || !kanSchakelen}
            className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${stand.aan ? 'bg-brand-purple' : 'bg-slate-300'}`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${stand.aan ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </button>
        )}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{DOORLOPEN_UITLEG}</p>
      {!stand.aan && stand.uitleg && <p className="mt-2 text-xs text-amber-700">{stand.uitleg}</p>}
      {stand.openFactuur && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Factuur {stand.openFactuur.nummer} ({euro(stand.openFactuur.bedrag)}) staat open
          {stand.openFactuur.uiterlijk ? `, graag betalen voor ${datum(stand.openFactuur.uiterlijk)}` : ''}. Betalen kan onder Facturen.
        </p>
      )}
      {fout && <p className="mt-2 text-xs text-red-600">{fout}</p>}
    </div>
  );
}

/**
 * Vinkje bij het bestellen. Alleen zichtbaar voor wie het zelf mag aanzetten
 * en het nog niet aan heeft; standaard niet aangevinkt.
 */
export function DoorlopendVinkje({ stand, gekozen, onChange }: { stand: DoorloopStand | null; gekozen: boolean; onChange: (v: boolean) => void }) {
  if (!stand || !stand.magWijzigen) return null;
  if (stand.aan) {
    return (
      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
        <ArrowPathRoundedSquareIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-purple" />
        Automatisch doorlopen op factuur staat aan. Uitzetten kan onder Account › Bestellingen.
      </p>
    );
  }
  if (stand.zelf !== 'ok') return null;
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <input
        type="checkbox"
        checked={gekozen}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-purple focus:ring-brand-purple"
      />
      <span className="text-xs leading-relaxed text-slate-600">
        <span className="font-semibold text-slate-800">Laat mijn leads automatisch doorlopen op factuur</span>
        <span className="mt-0.5 block text-slate-500">{DOORLOPEN_UITLEG}</span>
      </span>
    </label>
  );
}
