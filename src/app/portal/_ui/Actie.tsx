'use client';

import { useEffect, useState } from 'react';
import { TicketIcon } from '@heroicons/react/24/outline';
import { portalFetch } from '@/lib/portalAuth';

/**
 * Najaarsactie in het portaal: een kaart met de eigen loten (Account ›
 * Bestellingen) en een korte balk op de bestelpagina. Zonder lopende actie
 * tonen beide niets.
 */

type ActieStand =
  | { zichtbaar: false }
  | {
      zichtbaar: true; fase: 'voor' | 'loopt' | 'afgelopen'; getrokken: boolean;
      loten: number; batches: number; eindLabel: string; prijsLeads: number; leadsPerLot: number;
    };

function useActieStand() {
  const [stand, setStand] = useState<ActieStand | null>(null);
  useEffect(() => {
    let weg = false;
    portalFetch('/api/portal/actie', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!weg && d) setStand(d as ActieStand); })
      .catch(() => { /* zonder stand tonen we niets */ });
    return () => { weg = true; };
  }, []);
  return stand;
}

const lot = (n: number) => `${n} ${n === 1 ? 'lot' : 'loten'}`;

export function ActieKaart() {
  const stand = useActieStand();
  if (!stand || !stand.zichtbaar) return null;
  const loopt = stand.fase === 'loopt';

  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white">
            <TicketIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Actie: kans op {stand.prijsLeads} gratis leads</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {loopt ? `Loopt tot en met ${stand.eindLabel}` : stand.getrokken ? 'De trekking is geweest' : 'Afgelopen, de trekking volgt binnenkort'}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-bold tabular-nums text-slate-900">{stand.loten}</p>
          <p className="text-xs text-slate-500">{stand.loten === 1 ? 'lot' : 'loten'}</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-600">
        {stand.loten > 0
          ? `Je doet mee met ${lot(stand.loten)}. `
          : loopt ? 'Je doet nog niet mee. ' : 'Je deed niet mee aan deze actie. '}
        Per {stand.leadsPerLot} leads in een batch die je tot en met {stand.eindLabel} betaalt, krijg je 1 lot. Eén winnaar krijgt alle {stand.prijsLeads} leads gratis
        {stand.getrokken ? ' en is persoonlijk benaderd.' : '; wint jouw lot, dan nemen we persoonlijk contact met je op.'}
      </p>
    </div>
  );
}

/** Korte balk boven het bestelformulier, alleen zolang de actie loopt. */
export function ActieBalk() {
  const stand = useActieStand();
  if (!stand || !stand.zichtbaar || stand.fase !== 'loopt') return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50/60 px-4 py-3">
      <TicketIcon className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
      <p className="text-sm text-slate-700">
        <span className="font-semibold text-slate-900">Maak kans op {stand.prijsLeads} gratis leads.</span>{' '}
        Tot en met {stand.eindLabel} levert elke {stand.leadsPerLot} leads die je bestelt en betaalt 1 lot op.
        {stand.loten > 0 ? ` Je hebt er nu ${lot(stand.loten)}.` : ''}
      </p>
    </div>
  );
}
