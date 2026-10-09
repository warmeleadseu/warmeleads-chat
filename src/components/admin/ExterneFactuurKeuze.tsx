'use client';

/**
 * Hoe een betaalde batch is gefactureerd: met een factuur uit WarmeLeads, of
 * buiten het systeem om (bijvoorbeeld Rompslomp). Bij extern komen
 * factuurnummer en bedrag excl. btw erbij; die tellen mee voor de winst per
 * batch. Bij het aanmaken betekent extern ook: geen eigen factuur maken, zodat
 * de batch niet twee keer in de boekhouding staat.
 */

export type ExterneFactuurStand = { extern: boolean; nummer: string; bedrag: string };

export function beginStand(batch?: { extern_factuurnummer?: string | null; extern_bedrag_excl?: number | string | null } | null): ExterneFactuurStand {
  const nummer = batch?.extern_factuurnummer ?? '';
  const bedrag = batch?.extern_bedrag_excl == null ? '' : String(batch.extern_bedrag_excl);
  return { extern: Boolean(nummer || bedrag), nummer, bedrag };
}

/** Velden voor de API; bij "uit WarmeLeads" worden ze leeggemaakt. */
export function naarVelden(stand: ExterneFactuurStand): { extern_factuurnummer: string | null; extern_bedrag_excl: string | null } {
  return stand.extern
    ? { extern_factuurnummer: stand.nummer.trim() || null, extern_bedrag_excl: stand.bedrag.trim() || null }
    : { extern_factuurnummer: null, extern_bedrag_excl: null };
}

export default function ExterneFactuurKeuze({
  stand,
  onChange,
  batchprijs,
  modus,
}: {
  stand: ExterneFactuurStand;
  onChange: (s: ExterneFactuurStand) => void;
  batchprijs?: number | null;
  modus: 'aanmaken' | 'bewerken';
}) {
  const optie = (extern: boolean, titel: string, uitleg: string) => (
    <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition ${stand.extern === extern ? 'border-brand-purple/40 bg-brand-purple/[0.04]' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
      <input type="radio" checked={stand.extern === extern} onChange={() => onChange({ ...stand, extern })} className="mt-0.5 accent-[#7c3aed]" />
      <span>
        <span className="block text-sm font-medium text-slate-700">{titel}</span>
        <span className="block text-[11px] text-slate-500">{uitleg}</span>
      </span>
    </label>
  );

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-500">Hoe is deze batch gefactureerd?</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {optie(false, 'Factuur uit WarmeLeads', modus === 'aanmaken'
          ? 'Er wordt een factuur aangemaakt en op betaald gezet.'
          : 'De factuur in het systeem geldt.')}
        {optie(true, 'Extern gefactureerd', modus === 'aanmaken'
          ? 'Bijv. Rompslomp. Er komt geen factuur in WarmeLeads, dus niets dubbel in de boekhouding.'
          : 'Bijv. Rompslomp. Telt mee voor de winst met het bedrag hieronder.')}
      </div>
      {stand.extern && (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-slate-500">
            Factuurnummer
            <input value={stand.nummer} onChange={e => onChange({ ...stand, nummer: e.target.value })} maxLength={100} placeholder="Bijv. 2026-0412"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
          </label>
          <label className="text-xs text-slate-500">
            Bedrag excl. btw
            <input value={stand.bedrag} onChange={e => onChange({ ...stand, bedrag: e.target.value })} inputMode="decimal"
              placeholder={batchprijs ? `Leeg = batchprijs (${batchprijs.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })})` : 'Leeg = batchprijs'}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
          </label>
        </div>
      )}
    </div>
  );
}
