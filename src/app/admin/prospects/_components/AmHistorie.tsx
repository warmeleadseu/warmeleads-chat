'use client';

import { useState } from 'react';
import type { AmPeriodeMetNaam } from '@/lib/prospectAmHistorie';

/**
 * Historie van accountmanagers in de prospectkaart en een kleine regel
 * "eerder: …" in de lijst. Zie src/lib/prospectAmHistorie.ts.
 */

const datum = (iso: string) =>
  new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Amsterdam' });

export type EerdereAm = { id: string; naam: string };

/** In de lijst onder de huidige AM: "eerder: Bart-Willem". */
export function EerdereAmsRegel({ eerdere }: { eerdere?: EerdereAm[] | null }) {
  if (!eerdere?.length) return null;
  const voornamen = eerdere.map(e => e.naam.split(' ')[0] || e.naam);
  return (
    <div className="mt-0.5 max-w-[160px] truncate text-[10px] text-slate-400" title={`Eerder: ${eerdere.map(e => e.naam).join(', ')}`}>
      eerder: {voornamen.join(', ')}
    </div>
  );
}

/** In de prospectkaart: tijdlijn, nieuwste boven. Alleen zichtbaar als er een wissel is geweest. */
export function AmHistorieBlok({ historie }: { historie?: AmPeriodeMetNaam[] | null }) {
  const [open, setOpen] = useState(true);
  if (!historie || historie.length < 2) return null;
  const rijen = [...historie].reverse();
  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        <span>Historie ({historie.length})</span>
        <span className="text-slate-400">{open ? 'verberg' : 'toon'}</span>
      </button>
      {open && (
        <ol className="mt-2 space-y-2">
          {rijen.map((p, i) => {
            const huidig = i === 0;
            const naam = p.onbekend ? 'Niet vastgelegd' : p.naam || (p.am_id ? 'Onbekend account' : 'Niet toegewezen');
            return (
              <li key={`${p.vanaf}-${i}`} className="flex gap-2">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${huidig ? 'bg-brand-purple' : 'bg-slate-300'}`} />
                <div className="min-w-0 text-xs">
                  <div className={huidig ? 'font-semibold text-slate-800' : p.onbekend ? 'italic text-slate-400' : 'text-slate-700'}>
                    {naam}
                    {huidig && <span className="ml-1.5 rounded bg-brand-purple/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-purple">nu</span>}
                    {!p.zeker && !p.onbekend && !huidig && (
                      <span className="ml-1.5 text-[10px] font-normal text-slate-400" title="Niet als toewijzing vastgelegd; afgeleid uit wie er toen contact had met de prospect.">(afgeleid)</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {p.tot ? `${datum(p.vanaf)} – ${datum(p.tot)}` : `sinds ${datum(p.vanaf)}`}
                    {p.door_naam && p.zeker && !p.onbekend ? ` · toegewezen door ${p.door_naam}${p.bulk ? ' (bulk)' : ''}` : ''}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
