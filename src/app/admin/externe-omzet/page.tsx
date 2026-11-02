'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowPathIcon, ArrowUpTrayIcon, DocumentTextIcon, ExclamationTriangleIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { herkenKolommen, type Beoordeling, type ExterneInvoer, type Kolommen } from '@/lib/externeOmzet';

/**
 * Externe omzet: facturen die buiten WarmeLeads om zijn verstuurd (vooral
 * bulkfacturen uit Rompslomp). Ze tellen mee in de maandomzet van het
 * live-dashboard en in Winst en verlies. Invoer per factuur of in één keer
 * via een Excel- of CSV-export.
 */

type Rij = {
  id: string; datum: string; customer_id: string | null; klant_naam: string | null; soort: 'bulk' | 'overig';
  factuurnummer: string | null; bedrag_excl: number | string; omschrijving: string | null; bron: string;
  aangemaakt_door: string | null; created_at: string;
};
type Klant = { id: string; name: string };

const EURO2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur2 = (n: number) => EURO2.format(n);
const datumNl = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
const maandNl = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
const vandaag = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });

const LEEG = { id: '', datum: vandaag(), klant: '', factuurnummer: '', bedrag: '', soort: 'bulk' as 'bulk' | 'overig', omschrijving: '' };
const VELDEN: { sleutel: keyof Kolommen; label: string; verplicht?: boolean }[] = [
  { sleutel: 'datum', label: 'Factuurdatum', verplicht: true },
  { sleutel: 'factuurnummer', label: 'Factuurnummer' },
  { sleutel: 'klant', label: 'Klant', verplicht: true },
  { sleutel: 'bedrag_excl', label: 'Bedrag excl. btw', verplicht: true },
  { sleutel: 'soort', label: 'Soort (bulk/overig)' },
  { sleutel: 'omschrijving', label: 'Omschrijving' },
];

function Formulier({ klanten, bewerk, onKlaar }: { klanten: Klant[]; bewerk: Rij | null; onKlaar: () => void }) {
  const [v, setV] = useState(LEEG);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null);
  const eerste = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!bewerk) { setV({ ...LEEG, datum: vandaag() }); return; }
    setV({
      id: bewerk.id, datum: bewerk.datum, klant: bewerk.klant_naam ?? '', factuurnummer: bewerk.factuurnummer ?? '',
      bedrag: String(bewerk.bedrag_excl).replace('.', ','), soort: bewerk.soort, omschrijving: bewerk.omschrijving ?? '',
    });
    setMelding(null);
    eerste.current?.focus();
  }, [bewerk]);

  const opslaan = async () => {
    setBezig(true);
    setMelding(null);
    try {
      const klant = klanten.find(k => k.name === v.klant);
      const regel: ExterneInvoer = {
        datum: v.datum, factuurnummer: v.factuurnummer, klant: v.klant, customer_id: klant?.id ?? null,
        bedrag_excl: v.bedrag, soort: v.soort, omschrijving: v.omschrijving,
      };
      const res = v.id
        ? await adminFetch('/api/admin/externe-omzet', { method: 'PUT', body: JSON.stringify({ id: v.id, ...regel }) })
        : await adminFetch('/api/admin/externe-omzet', { method: 'POST', body: JSON.stringify({ rijen: [regel], bron: 'handmatig' }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setMelding({ ok: false, tekst: d.error ?? 'Opslaan mislukt' }); return; }
      setMelding({ ok: true, tekst: v.id ? 'Gewijzigd.' : 'Opgeslagen.' });
      setV(x => ({ ...LEEG, datum: x.datum, soort: x.soort }));
      onKlaar();
      eerste.current?.focus();
    } finally {
      setBezig(false);
    }
  };

  const veld = 'mt-0.5 block h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm';
  return (
    <form
      onSubmit={e => { e.preventDefault(); void opslaan(); }}
      className="rounded-xl border border-slate-200 bg-white p-4"
    >
      <p className="text-sm font-semibold text-slate-900">{v.id ? 'Factuur wijzigen' : 'Factuur toevoegen'}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className="text-xs text-slate-600">
          Factuurdatum
          <input ref={eerste} type="date" required value={v.datum} onChange={e => setV({ ...v, datum: e.target.value })} className={veld} />
        </label>
        <label className="text-xs text-slate-600 lg:col-span-2">
          Klant
          <input list="externe-omzet-klanten" required value={v.klant} onChange={e => setV({ ...v, klant: e.target.value })} maxLength={160} placeholder="Kies of typ een naam" className={veld} />
          <datalist id="externe-omzet-klanten">{klanten.map(k => <option key={k.id} value={k.name} />)}</datalist>
        </label>
        <label className="text-xs text-slate-600">
          Factuurnummer
          <input value={v.factuurnummer} onChange={e => setV({ ...v, factuurnummer: e.target.value })} maxLength={60} className={veld} />
        </label>
        <label className="text-xs text-slate-600">
          Bedrag excl. btw
          <input required inputMode="decimal" value={v.bedrag} onChange={e => setV({ ...v, bedrag: e.target.value })} placeholder="2.500,00" className={veld} />
        </label>
        <label className="text-xs text-slate-600">
          Soort
          <select value={v.soort} onChange={e => setV({ ...v, soort: e.target.value as 'bulk' | 'overig' })} className={veld}>
            <option value="bulk">Bulk</option>
            <option value="overig">Overig</option>
          </select>
        </label>
        <label className="text-xs text-slate-600 sm:col-span-2 lg:col-span-4">
          Omschrijving (optioneel)
          <input value={v.omschrijving} onChange={e => setV({ ...v, omschrijving: e.target.value })} maxLength={300} placeholder="Bijv. 1.500 bulkleads zonnepanelen" className={veld} />
        </label>
        <div className="flex items-end gap-2 sm:col-span-2">
          <button type="submit" disabled={bezig} className="h-9 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
            {bezig ? 'Opslaan...' : v.id ? 'Wijziging opslaan' : 'Toevoegen'}
          </button>
          {v.id && (
            <button type="button" onClick={() => { setV({ ...LEEG, datum: vandaag() }); setMelding(null); onKlaar(); }} className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-600 hover:bg-slate-50">
              Annuleren
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">Een creditfactuur vul je in als negatief bedrag. Een klant die niet in WarmeLeads staat mag; dan blijft alleen de naam bewaard.</p>
      {melding && <p className={`mt-2 text-sm ${melding.ok ? 'text-emerald-700' : 'text-red-600'}`}>{melding.tekst}</p>}
    </form>
  );
}

type Blad = { koppen: string[]; rijen: Record<string, unknown>[] };

function Importeren({ onKlaar }: { onKlaar: () => void }) {
  const [bestand, setBestand] = useState<string | null>(null);
  const [blad, setBlad] = useState<Blad | null>(null);
  const [kolommen, setKolommen] = useState<Kolommen>({});
  const [standaardSoort, setStandaardSoort] = useState<'bulk' | 'overig'>('bulk');
  const [beoordeling, setBeoordeling] = useState<Beoordeling[] | null>(null);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null);
  const invoer = useRef<HTMLInputElement>(null);

  const lees = async (f: File) => {
    setMelding(null);
    setBeoordeling(null);
    try {
      const XLSX = await import('xlsx');
      const buf = await f.arrayBuffer();
      /* CSV als tekst lezen: anders maakt de parser van 05-10-2026 5 mei of 10 mei. */
      const csv = /\.(csv|txt)$/i.test(f.name);
      const wb = XLSX.read(buf, csv ? { type: 'array', raw: true } : { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rijen = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true });
      const koppen = rijen.length > 0 ? Object.keys(rijen[0]) : [];
      if (rijen.length === 0) { setMelding({ ok: false, tekst: 'Het bestand bevat geen regels' }); return; }
      setBestand(f.name);
      setBlad({ koppen, rijen });
      setKolommen(herkenKolommen(koppen));
    } catch {
      setMelding({ ok: false, tekst: 'Dit bestand kon niet worden gelezen; kies een Excel- of CSV-bestand' });
    }
  };

  const regels = useMemo<ExterneInvoer[]>(() => (blad?.rijen ?? [])
    .map(r => ({
      datum: kolommen.datum ? r[kolommen.datum] : '',
      factuurnummer: kolommen.factuurnummer ? r[kolommen.factuurnummer] : '',
      klant: kolommen.klant ? r[kolommen.klant] : '',
      bedrag_excl: kolommen.bedrag_excl ? r[kolommen.bedrag_excl] : '',
      soort: kolommen.soort ? r[kolommen.soort] : '',
      omschrijving: kolommen.omschrijving ? r[kolommen.omschrijving] : '',
    }))
    /* Lege regels en een totaalregel onderaan overslaan. */
    .filter(r => String(r.datum ?? '').trim() !== '' || String(r.klant ?? '').trim() !== ''), [blad, kolommen]);

  const stuur = async (proef: boolean) => {
    setBezig(true);
    setMelding(null);
    try {
      const res = await adminFetch('/api/admin/externe-omzet', { method: 'POST', body: JSON.stringify({ rijen: regels, proef, bron: 'import', standaardSoort }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string; beoordeling?: Beoordeling[]; opgeslagen?: number; bedrag?: number };
      if (d.beoordeling) setBeoordeling(d.beoordeling);
      if (!res.ok) { setMelding({ ok: false, tekst: d.error ?? 'Controleren mislukt' }); return; }
      if (!proef) {
        setMelding({ ok: true, tekst: `${d.opgeslagen} facturen opgeslagen (${eur2(d.bedrag ?? 0)}).` });
        setBlad(null);
        setBestand(null);
        setBeoordeling(null);
        onKlaar();
      }
    } finally {
      setBezig(false);
    }
  };

  const telling = beoordeling && {
    goed: beoordeling.filter(b => b.status === 'goed'),
    dubbel: beoordeling.filter(b => b.status === 'dubbel').length,
    fout: beoordeling.filter(b => b.status === 'fout').length,
    onbekend: beoordeling.filter(b => b.status === 'goed' && b.klantOnbekend).length,
  };
  const kanControleren = Boolean(kolommen.datum && kolommen.klant && kolommen.bedrag_excl) && regels.length > 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">Importeren uit Excel of CSV</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Bijvoorbeeld een export van alle verkoopfacturen uit Rompslomp sinds 1 mei. Je ziet eerst wat er gebeurt; een factuurnummer dat er al staat, slaat de import over.
          </p>
        </div>
        <button type="button" onClick={() => invoer.current?.click()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <ArrowUpTrayIcon className="h-4 w-4" /> Kies bestand
        </button>
        <input ref={invoer} type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void lees(f); e.target.value = ''; }} />
      </div>

      {blad && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-slate-600"><strong>{bestand}</strong>: {regels.length} regels. Controleer welke kolom wat is:</p>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {VELDEN.map(veld => (
              <label key={veld.sleutel} className="text-xs text-slate-600">
                {veld.label}{veld.verplicht ? ' *' : ''}
                <select
                  value={kolommen[veld.sleutel] ?? ''}
                  onChange={e => { setKolommen({ ...kolommen, [veld.sleutel]: e.target.value || undefined }); setBeoordeling(null); }}
                  className="mt-0.5 block h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                >
                  <option value="">—</option>
                  {blad.koppen.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </label>
            ))}
          </div>
          {!kolommen.soort && (
            <label className="flex items-center gap-2 text-xs text-slate-600">
              Alle regels zijn
              <select value={standaardSoort} onChange={e => { setStandaardSoort(e.target.value as 'bulk' | 'overig'); setBeoordeling(null); }} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm">
                <option value="bulk">bulk</option>
                <option value="overig">overig</option>
              </select>
            </label>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={!kanControleren || bezig} onClick={() => void stuur(true)} className="h-9 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50">
              {bezig && !telling ? 'Controleren...' : 'Controleren'}
            </button>
            {telling && telling.goed.length > 0 && (
              <button type="button" disabled={bezig} onClick={() => void stuur(false)} className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {bezig ? 'Opslaan...' : `${telling.goed.length} facturen opslaan (${eur2(telling.goed.reduce((s, b) => s + (b.rij?.bedrag_excl ?? 0), 0))})`}
              </button>
            )}
            <button type="button" onClick={() => { setBlad(null); setBestand(null); setBeoordeling(null); }} className="h-9 rounded-lg px-3 text-sm text-slate-500 hover:text-slate-700">Stoppen</button>
          </div>
          {telling && (
            <>
              <p className="text-xs text-slate-600">
                {telling.goed.length} goed{telling.onbekend > 0 ? ` (waarvan ${telling.onbekend} met een klantnaam die niet in WarmeLeads staat)` : ''}
                {telling.dubbel > 0 ? ` · ${telling.dubbel} staan er al in` : ''}{telling.fout > 0 ? ` · ${telling.fout} met een fout` : ''}.
              </p>
              <div className="max-h-96 overflow-auto rounded-lg border border-slate-100">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                    <tr><th className="px-2 py-1.5">#</th><th className="px-2 py-1.5">Datum</th><th className="px-2 py-1.5">Nummer</th><th className="px-2 py-1.5">Klant</th><th className="px-2 py-1.5">Soort</th><th className="px-2 py-1.5 text-right">Bedrag</th><th className="px-2 py-1.5">Status</th></tr>
                  </thead>
                  <tbody>
                    {beoordeling!.map(b => (
                      <tr key={b.regel} className="border-t border-slate-100">
                        <td className="px-2 py-1 text-slate-400">{b.regel}</td>
                        <td className="px-2 py-1">{b.rij ? datumNl(b.rij.datum) : String(regels[b.regel - 1]?.datum ?? '')}</td>
                        <td className="px-2 py-1">{b.rij?.factuurnummer ?? String(regels[b.regel - 1]?.factuurnummer ?? '')}</td>
                        <td className="px-2 py-1">{b.rij?.klant_naam ?? String(regels[b.regel - 1]?.klant ?? '')}{b.klantOnbekend ? <span className="ml-1 text-amber-600">(niet in WarmeLeads)</span> : null}</td>
                        <td className="px-2 py-1">{b.rij?.soort ?? ''}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{b.rij ? eur2(b.rij.bedrag_excl) : String(regels[b.regel - 1]?.bedrag_excl ?? '')}</td>
                        <td className={`px-2 py-1 ${b.status === 'goed' ? 'text-emerald-700' : b.status === 'dubbel' ? 'text-slate-400' : 'text-red-600'}`}>
                          {b.status === 'goed' ? 'goed' : b.reden}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
      {melding && <p className={`mt-3 text-sm ${melding.ok ? 'text-emerald-700' : 'text-red-600'}`}>{melding.tekst}</p>}
    </div>
  );
}

export default function ExterneOmzetPagina() {
  const [rijen, setRijen] = useState<Rij[]>([]);
  const [klanten, setKlanten] = useState<Klant[]>([]);
  const [ontbreekt, setOntbreekt] = useState(false);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [maand, setMaand] = useState<string>('alle');
  const [bewerk, setBewerk] = useState<Rij | null>(null);

  const laad = useCallback(async () => {
    setLaden(true);
    setFout(null);
    try {
      const res = await adminFetch('/api/admin/externe-omzet', { cache: 'no-store' });
      const d = (await res.json().catch(() => ({}))) as { rijen?: Rij[]; klanten?: Klant[]; ontbreekt?: boolean; error?: string };
      if (!res.ok) { setFout(d.error ?? 'Laden mislukt'); return; }
      setRijen(d.rijen ?? []);
      setKlanten(d.klanten ?? []);
      setOntbreekt(Boolean(d.ontbreekt));
    } catch {
      setFout('Laden mislukt');
    } finally {
      setLaden(false);
    }
  }, []);
  useEffect(() => { void laad(); }, [laad]);

  const perMaand = useMemo(() => {
    const m = new Map<string, { aantal: number; bulk: number; overig: number }>();
    for (const r of rijen) {
      const k = r.datum.slice(0, 7);
      const x = m.get(k) ?? { aantal: 0, bulk: 0, overig: 0 };
      x.aantal += 1;
      x[r.soort === 'bulk' ? 'bulk' : 'overig'] += Number(r.bedrag_excl) || 0;
      m.set(k, x);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rijen]);
  const zichtbaar = maand === 'alle' ? rijen : rijen.filter(r => r.datum.startsWith(maand));

  const verwijder = async (r: Rij) => {
    if (!window.confirm(`Factuur ${r.factuurnummer ?? ''} van ${r.klant_naam ?? 'onbekend'} (${eur2(Number(r.bedrag_excl))}) verwijderen?`)) return;
    const res = await adminFetch(`/api/admin/externe-omzet?id=${r.id}`, { method: 'DELETE' });
    if (!res.ok) { const d = (await res.json().catch(() => ({}))) as { error?: string }; window.alert(d.error ?? 'Verwijderen mislukt'); return; }
    if (bewerk?.id === r.id) setBewerk(null);
    void laad();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><DocumentTextIcon className="h-6 w-6 text-slate-400" /> Externe omzet</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Facturen die buiten WarmeLeads om zijn verstuurd, zoals bulkfacturen uit Rompslomp. Ze tellen mee in de omzet en winst van de maand op
            het <Link href="/admin/live" className="underline hover:text-slate-700">live-dashboard</Link> en
            in <Link href="/admin/winst" className="underline hover:text-slate-700">Winst en verlies</Link>, op de factuurdatum. Alle bedragen excl. btw.
          </p>
        </div>
        <button onClick={() => void laad()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50">
          <ArrowPathIcon className={`h-4 w-4 ${laden ? 'animate-spin' : ''}`} /> Vernieuwen
        </button>
      </div>

      {ontbreekt && (
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
          De database is nog niet klaar voor externe omzet (migratie 191 is nog niet toegepast). Invoeren kan zodra dat gebeurd is.
        </div>
      )}
      {fout && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{fout}</p>}

      {!ontbreekt && !fout && (
        <>
          <Formulier klanten={klanten} bewerk={bewerk} onKlaar={() => { setBewerk(null); void laad(); }} />
          <Importeren onKlaar={() => void laad()} />

          <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
            <div className="h-fit rounded-xl border border-slate-200 bg-white">
              <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Per maand</p>
              {perMaand.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">{laden ? 'Laden...' : 'Nog niets ingevoerd.'}</p>}
              <button onClick={() => setMaand('alle')} className={`flex w-full justify-between px-4 py-2 text-left text-sm ${maand === 'alle' ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'}`}>
                <span>Alles</span><span className="tabular-nums">{eur2(rijen.reduce((s, r) => s + (Number(r.bedrag_excl) || 0), 0))}</span>
              </button>
              {perMaand.map(([m, x]) => (
                <button key={m} onClick={() => setMaand(m)} className={`w-full px-4 py-2 text-left text-sm ${maand === m ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'}`}>
                  <span className="flex justify-between"><span className="capitalize">{maandNl(m)}</span><span className="tabular-nums">{eur2(x.bulk + x.overig)}</span></span>
                  <span className="block text-xs font-normal text-slate-400">{x.aantal} facturen{x.overig !== 0 ? ` · ${eur2(x.bulk)} bulk · ${eur2(x.overig)} overig` : ''}</span>
                </button>
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Datum</th><th className="px-3 py-2">Nummer</th><th className="px-3 py-2">Klant</th>
                      <th className="px-3 py-2">Soort</th><th className="px-3 py-2 text-right">Excl. btw</th><th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {zichtbaar.length === 0 && (
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">{laden ? 'Laden...' : 'Geen facturen in deze selectie.'}</td></tr>
                    )}
                    {zichtbaar.map(r => (
                      <tr key={r.id} className={`border-t border-slate-100 ${bewerk?.id === r.id ? 'bg-amber-50' : ''}`}>
                        <td className="whitespace-nowrap px-3 py-2">{datumNl(r.datum)}</td>
                        <td className="px-3 py-2">{r.factuurnummer ?? <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2">
                          {r.customer_id ? <Link href={`/admin/customers?id=${r.customer_id}`} className="hover:underline">{r.klant_naam}</Link> : <span>{r.klant_naam}</span>}
                          {r.omschrijving && <span className="block text-xs text-slate-400">{r.omschrijving}</span>}
                        </td>
                        <td className="px-3 py-2 text-xs">{r.soort === 'bulk' ? 'Bulk' : 'Overig'}</td>
                        <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${Number(r.bedrag_excl) < 0 ? 'text-red-600' : ''}`}>{eur2(Number(r.bedrag_excl))}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <button onClick={() => { setBewerk(r); window.scrollTo({ top: 0, behavior: 'smooth' }); }} title="Wijzigen" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><PencilSquareIcon className="h-4 w-4" /></button>
                          <button onClick={() => void verwijder(r)} title="Verwijderen" className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
