'use client';

import { useState } from 'react';
import { ChevronDownIcon, ClockIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { groepeerMomenten, momentLabel, telLink, type Terugbelmoment } from '@/lib/terugbellen';
import { useTerugbellen } from './context';

/** Boven de leads: gemiste terugbelmomenten, die van vandaag en die van later. */
export default function TerugbelLijst({ onOpen }: { onOpen: (m: Terugbelmoment) => void }) {
  const { aan, momenten, plan } = useTerugbellen();
  const [open, setOpen] = useState(true);
  const [metLater, setMetLater] = useState(false);
  if (!aan || momenten.length === 0) return null;
  const { gemist, vandaag, later } = groepeerMomenten(momenten);
  const rijen = [...gemist, ...vandaag, ...(metLater ? later : [])];
  const isGemist = new Set(gemist.map(m => m.id));

  return (
    <section className="overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-sm">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-sky-50/50">
        <ClockIcon className="h-5 w-5 text-sky-600" />
        <span className="text-sm font-semibold text-slate-900">Vandaag terugbellen ({gemist.length + vandaag.length})</span>
        {gemist.length > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">{gemist.length} gemist</span>}
        <ChevronDownIcon className={`ml-auto h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-slate-100">
          {rijen.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">Vandaag hoef je niemand meer terug te bellen.</p>}
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {rijen.map(m => {
              const tel = telLink(m.telefoon);
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`w-32 shrink-0 text-xs font-semibold tabular-nums ${isGemist.has(m.id) ? 'text-red-600' : 'text-slate-600'}`}>{momentLabel(m.terug_op)}</span>
                  <button type="button" onClick={() => onOpen(m)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium text-slate-900 hover:text-brand-purple">{m.naam}{m.plaats ? <span className="font-normal text-slate-400"> · {m.plaats}</span> : null}</span>
                    {m.notitie && <span className="block truncate text-xs text-slate-500">{m.notitie}</span>}
                  </button>
                  <button type="button" onClick={() => plan({ lead_id: m.lead_id, naam: m.naam })} className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-800 hover:underline">Verzetten</button>
                  {tel && (
                    <a href={tel} aria-label={`Bel ${m.naam}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"><PhoneIcon className="h-4 w-4" /></a>
                  )}
                </li>
              );
            })}
          </ul>
          {later.length > 0 && (
            <button type="button" onClick={() => setMetLater(v => !v)} className="w-full border-t border-slate-100 px-4 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50">
              {metLater ? 'Alleen vandaag tonen' : `Later (${later.length}) tonen`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
