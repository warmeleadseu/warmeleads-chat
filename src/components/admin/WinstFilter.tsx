'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

/**
 * Filter voor de winst- en verliespagina: klanten uitsluiten (bijvoorbeeld een
 * partij die afspraken voor ons belt) en de afsprakenbatches wel of niet
 * meetellen. De keuze wordt per browser onthouden.
 */

export type WinstFilterStand = { uitsluiten: string[]; afspraken: boolean };

const SLEUTEL = 'warmeleads-winst-filter';
export const LEEG_FILTER: WinstFilterStand = { uitsluiten: [], afspraken: false };

export function leesBewaardFilter(): WinstFilterStand {
  try {
    const ruw = JSON.parse(localStorage.getItem(SLEUTEL) ?? 'null') as Partial<WinstFilterStand> | null;
    if (!ruw) return LEEG_FILTER;
    return {
      uitsluiten: Array.isArray(ruw.uitsluiten) ? ruw.uitsluiten.filter(x => typeof x === 'string').slice(0, 50) : [],
      afspraken: ruw.afspraken === true,
    };
  } catch {
    return LEEG_FILTER;
  }
}

export function bewaarFilter(f: WinstFilterStand) {
  try { localStorage.setItem(SLEUTEL, JSON.stringify(f)); } catch { /* privévenster: niet onthouden */ }
}

type Klant = { id: string; name: string | null; is_active?: boolean | null };

export default function WinstFilter({ waarde, onChange }: { waarde: WinstFilterStand; onChange: (f: WinstFilterStand) => void }) {
  const [klanten, setKlanten] = useState<Klant[]>([]);
  const [open, setOpen] = useState(false);
  const [zoek, setZoek] = useState('');
  const kader = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void adminFetch('/api/admin/customers/options', { cache: 'no-store' })
      .then(r => r.json())
      .then((d: { customers?: Klant[] }) => setKlanten(d.customers ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const weg = (e: MouseEvent) => { if (kader.current && !kader.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', weg);
    return () => document.removeEventListener('mousedown', weg);
  }, [open]);

  const naam = useMemo(() => new Map(klanten.map(k => [k.id, k.name ?? 'Onbekende klant'])), [klanten]);
  const zichtbaar = useMemo(() => {
    const z = zoek.trim().toLowerCase();
    return klanten.filter(k => !z || (k.name ?? '').toLowerCase().includes(z)).slice(0, 80);
  }, [klanten, zoek]);

  const wissel = (id: string) => {
    const uitsluiten = waarde.uitsluiten.includes(id) ? waarde.uitsluiten.filter(x => x !== id) : [...waarde.uitsluiten, id];
    onChange({ ...waarde, uitsluiten });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <FunnelIcon className="h-4 w-4 text-slate-400" /> Berekening
      </span>

      <div ref={kader} className="relative">
        <button onClick={() => setOpen(o => !o)}
          className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
          Klanten uitsluiten{waarde.uitsluiten.length > 0 ? ` (${waarde.uitsluiten.length})` : ''}
        </button>
        {open && (
          <div className="absolute left-0 z-20 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <input autoFocus value={zoek} onChange={e => setZoek(e.target.value)} placeholder="Zoek klant…"
              className="mb-1.5 h-8 w-full rounded-lg border border-slate-200 px-2 text-sm" />
            <div className="max-h-64 overflow-y-auto">
              {zichtbaar.length === 0 && <p className="px-2 py-3 text-center text-xs text-slate-400">Geen klanten gevonden</p>}
              {zichtbaar.map(k => (
                <label key={k.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={waarde.uitsluiten.includes(k.id)} onChange={() => wissel(k.id)} className="accent-slate-900" />
                  <span className="truncate text-slate-700">{k.name ?? 'Onbekende klant'}</span>
                  {k.is_active === false && <span className="ml-auto text-[10px] text-slate-400">inactief</span>}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {waarde.uitsluiten.map(id => (
        <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          {naam.get(id) ?? 'Klant'}
          <button onClick={() => wissel(id)} aria-label="Weer meetellen" className="rounded-full text-slate-400 hover:text-slate-700">
            <XMarkIcon className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}

      <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
        <span>Afsprakenbatches meetellen</span>
        <button type="button" role="switch" aria-checked={waarde.afspraken} onClick={() => onChange({ ...waarde, afspraken: !waarde.afspraken })}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${waarde.afspraken ? 'bg-emerald-500' : 'bg-slate-300'}`}>
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${waarde.afspraken ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        </button>
      </label>

      {(waarde.uitsluiten.length > 0 || waarde.afspraken) && (
        <p className="w-full text-[11px] text-slate-500">
          {waarde.uitsluiten.length > 0 && 'Uitgesloten klanten: hun omzet, leveringen en hun deel van de advertentiekosten tellen niet mee. '}
          {waarde.afspraken && 'Afsprakenbatches tellen mee in het resultaat per periode, per geleverde afspraak.'}
        </p>
      )}
    </div>
  );
}
