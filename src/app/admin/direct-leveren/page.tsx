'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowPathIcon, BoltIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import {
  BIJWERK_TERMIJN_DAGEN, HERBESTEL_TERMIJN_DAGEN, MIN_BIJGEWERKT_BETROUWBAAR, MIN_LEADS_BETROUWBAAR, OPVOLG_STATUSSEN,
  type Groep, type Herbestelling, type Kengetallen, type OpvolgStatus,
} from '@/lib/directVergelijking';

/**
 * Direct leveren vergelijken: levert het direct aanbieden (en de
 * WhatsApp-opvolging van Snelraak) betere resultaten op? De opvolging komt
 * van statussen die klanten zelf bijwerken; daarom staat de datakwaliteit
 * overal bij en is een vergelijking met te weinig gegevens grijs.
 */

type PerKlant = {
  customer_id: string; klant: string; aan: boolean; sinds: string; dagen: number;
  voor: Kengetallen; na: Kengetallen; herbestelVoor: Herbestelling; herbestelNa: Herbestelling;
};
type Antwoord = { van: string; tot: string; branche: string | null; branches: string[]; groepen: Record<Groep, Kengetallen>; perKlant: PerKlant[]; error?: string };

const GROEPEN: { sleutel: Groep; titel: string; uitleg: string }[] = [
  { sleutel: 'direct_snelraak', titel: 'Direct + Snelraak', uitleg: 'Direct geleverd én via Snelraak opgevolgd' },
  { sleutel: 'direct', titel: 'Alleen direct', uitleg: 'Direct geleverd, zonder Snelraak' },
  { sleutel: 'snelraak', titel: 'Alleen Snelraak', uitleg: 'Gewone verdeling, via Snelraak opgevolgd' },
  { sleutel: 'geen', titel: 'Normaal', uitleg: 'Gewone verdeling, zonder Snelraak' },
];
const STATUS_LABEL: Record<OpvolgStatus, string> = {
  gecontacteerd: 'Gecontacteerd', geen_gehoor: 'Geen gehoor', afspraak: 'Afspraak', offerte: 'Offerte', verkocht: 'Verkocht', afgewezen: 'Afgewezen',
};

function isoDag(d: Date) { return d.toISOString().slice(0, 10); }
function dagenTerug(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return isoDag(d); }
const PERIODES = [
  { label: '7 dagen', dagen: 7 }, { label: '30 dagen', dagen: 30 }, { label: '90 dagen', dagen: 90 },
];

const NUM = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 });
const pct = (n: number | null | undefined) => (n == null ? '—' : `${NUM.format(n)}%`);
const aandeel = (deel: number, geheel: number) => (geheel > 0 ? `${NUM.format(Math.round((deel / geheel) * 1000) / 10)}%` : '—');
function duur(sec: number | null | undefined): string {
  if (sec == null) return '—';
  if (sec < 60) return `${NUM.format(Math.round(sec))} s`;
  if (sec < 3600) return `${NUM.format(Math.round(sec / 6) / 10)} min`;
  if (sec < 48 * 3600) return `${NUM.format(Math.round(sec / 360) / 10)} uur`;
  return `${NUM.format(Math.round(sec / 8640) / 10)} dagen`;
}
const datum = (iso: string) => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });

type Regel = { label: string; waarde: (k: Kengetallen) => string; sub?: (k: Kengetallen) => string; kop?: boolean };
const REGELS: Regel[] = [
  { label: 'Leveringen', waarde: k => String(k.leveringen) },
  { label: 'Snelheid', kop: true, waarde: () => '' },
  { label: 'Tijd tot eerste klant (mediaan)', waarde: k => duur(k.snelheid.mediaanSec), sub: k => `${k.snelheid.aantal} leads` },
  { label: 'Binnen een minuut', waarde: k => pct(k.snelheid.binnenMinuutPct) },
  { label: 'Datakwaliteit', kop: true, waarde: () => '' },
  { label: `Bijgewerkt (na ${BIJWERK_TERMIJN_DAGEN} dagen)`, waarde: k => pct(k.bijgewerktPct), sub: k => `van ${k.bijgewerktBasis} leads` },
  { label: 'Tijd tot eerste status (mediaan)', waarde: k => (k.urenTotEersteStatus == null ? '—' : duur(k.urenTotEersteStatus * 3600)) },
  { label: 'Opvolging (van bijgewerkte leads)', kop: true, waarde: () => '' },
  ...OPVOLG_STATUSSEN.map((s): Regel => ({ label: STATUS_LABEL[s], waarde: k => aandeel(k.opvolging[s], k.opvolgingBasis) })),
  { label: 'Reclamaties', kop: true, waarde: () => '' },
  { label: 'Goedgekeurde reclamaties', waarde: k => pct(k.reclamatiePct) },
];

function Waarschuwing({ k }: { k: Kengetallen }) {
  if (k.betrouwbaar || !k.waarschuwing) return null;
  return (
    <p className="mt-1 flex items-start gap-1 text-[11px] font-normal leading-snug text-amber-700">
      <ExclamationTriangleIcon className="mt-px h-3.5 w-3.5 shrink-0" /> {k.waarschuwing}
    </p>
  );
}

function Vergelijking({ kolommen }: { kolommen: { titel: string; uitleg?: string; k: Kengetallen }[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/70 text-xs text-slate-500">
            <th className="px-3 py-2.5 text-left font-medium" />
            {kolommen.map(c => (
              <th key={c.titel} className={`px-3 py-2.5 text-right align-top font-semibold ${c.k.betrouwbaar ? 'text-slate-700' : 'text-slate-400'}`}>
                {c.titel}
                {c.uitleg && <span className="block text-[11px] font-normal text-slate-400">{c.uitleg}</span>}
                <Waarschuwing k={c.k} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {REGELS.map(r => r.kop ? (
            <tr key={r.label} className="bg-slate-50/40">
              <td colSpan={kolommen.length + 1} className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{r.label}</td>
            </tr>
          ) : (
            <tr key={r.label} className="border-t border-slate-50">
              <td className="px-3 py-2 text-slate-600">{r.label}</td>
              {kolommen.map(c => (
                <td key={c.titel} className={`px-3 py-2 text-right tabular-nums ${c.k.betrouwbaar ? 'text-slate-900' : 'text-slate-400'}`}>
                  {r.waarde(c.k)}
                  {r.sub && <span className="block text-[11px] text-slate-400">{r.sub(c.k)}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HerbestelRegel({ label, h }: { label: string; h: Herbestelling }) {
  return (
    <p className="text-xs text-slate-600">
      <span className="font-medium text-slate-700">{label}:</span>{' '}
      {h.afgerond === 0 ? 'geen afgeronde batches' : (
        <>
          {h.afgerond} afgerond, {h.herbesteld} herbesteld
          {h.binnenTermijnPct != null && <>, {pct(h.binnenTermijnPct)} binnen {HERBESTEL_TERMIJN_DAGEN} dagen</>}
          {h.mediaanDagen != null && <> (mediaan {NUM.format(h.mediaanDagen)} dagen)</>}
        </>
      )}
    </p>
  );
}

export default function DirectLeverenPagina() {
  const [van, setVan] = useState(() => dagenTerug(30));
  const [tot, setTot] = useState(() => isoDag(new Date()));
  const [branche, setBranche] = useState('');
  const [data, setData] = useState<Antwoord | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  const laad = useCallback(async () => {
    setLaden(true);
    setFout(null);
    try {
      const qs = new URLSearchParams({ van, tot });
      if (branche) qs.set('branche', branche);
      const res = await adminFetch(`/api/admin/direct-leveren?${qs}`, { cache: 'no-store' });
      const d = (await res.json().catch(() => ({}))) as Antwoord;
      if (!res.ok) { setFout(res.status === 403 ? 'Alleen admins en superadmins kunnen deze vergelijking bekijken.' : d.error ?? 'Laden mislukt'); return; }
      setData(d);
    } catch {
      setFout('Netwerkfout bij laden');
    } finally {
      setLaden(false);
    }
  }, [van, tot, branche]);

  useEffect(() => { void laad(); }, [laad]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
            <BoltIcon className="h-6 w-6 text-emerald-600" /> Direct leveren
          </h1>
          <p className="mt-0.5 max-w-3xl text-sm text-slate-500">
            Geeft direct leveren, eventueel met de WhatsApp-opvolging van Snelraak, betere resultaten dan de gewone verdeling?
            Per levering staat vast of hij direct ging, dus de cijfers kloppen ook als de instelling later verandert. Interne klanten tellen niet mee.
          </p>
        </div>
        <button onClick={() => void laad()} disabled={laden}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <ArrowPathIcon className={`h-4 w-4 ${laden ? 'animate-spin' : ''}`} /> Vernieuwen
        </button>
      </div>

      <div className="flex gap-2 rounded-xl border border-sky-100 bg-sky-50/60 p-3 text-xs leading-relaxed text-sky-900">
        <InformationCircleIcon className="h-4 w-4 shrink-0 text-sky-600" />
        <p>
          De opvolging (gecontacteerd, afspraak, verkocht…) komt van de statussen die klanten zelf in hun portaal zetten, en niet elke klant doet dat.
          Daarom rekenen we de opvolging alleen over leads die echt zijn bijgewerkt, en staat erbij hoeveel procent dat is.
          Een kolom is grijs bij minder dan {MIN_LEADS_BETROUWBAAR} leads of als minder dan {MIN_BIJGEWERKT_BETROUWBAAR * 100}% is bijgewerkt: dan zegt het verschil nog weinig.
          De tijd tot de eerste status wordt bijgehouden vanaf de livegang van deze functie.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap gap-1">
          {PERIODES.map(p => (
            <button key={p.label} onClick={() => { setVan(dagenTerug(p.dagen)); setTot(isoDag(new Date())); }}
              className={`h-9 rounded-lg px-3 text-xs font-semibold ${van === dagenTerug(p.dagen) && tot === isoDag(new Date()) ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <label className="text-xs text-slate-500">Geleverd van
          <input type="date" value={van} max={tot} onChange={e => e.target.value && setVan(e.target.value)} className="mt-0.5 block h-9 rounded-lg border border-slate-200 px-2 text-sm text-slate-800" />
        </label>
        <label className="text-xs text-slate-500">tot en met
          <input type="date" value={tot} min={van} onChange={e => e.target.value && setTot(e.target.value)} className="mt-0.5 block h-9 rounded-lg border border-slate-200 px-2 text-sm text-slate-800" />
        </label>
        <select value={branche} onChange={e => setBranche(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm">
          <option value="">Alle branches</option>
          {(data?.branches ?? []).map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {fout && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{fout}</p>}
      {laden && !data && <p className="py-10 text-center text-sm text-slate-400">Laden…</p>}

      {data && (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-800">Vier groepen in deze periode{data.branche ? ` (${data.branche})` : ''}</h2>
            <Vergelijking kolommen={GROEPEN.map(g => ({ titel: g.titel, uitleg: g.uitleg, k: data.groepen[g.sleutel] }))} />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-800">Per klant: vóór en na direct leveren</h2>
            <p className="text-xs text-slate-500">
              Een even lange periode vóór het aanzetten tegenover de periode erna (maximaal 90 dagen). Los van het periodefilter hierboven.
            </p>
            {data.perKlant.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
                Nog geen klant op direct leveren. Zet het aan in de klantkaart of per batch.
              </p>
            ) : data.perKlant.map(k => (
              <div key={k.customer_id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-800">{k.klant}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${k.aan ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {k.aan ? 'Klantkaart: aan' : 'Klantkaart: uit (via batch of eerder)'}
                  </span>
                  <span className="text-xs text-slate-500">sinds {datum(k.sinds)}, {k.dagen} {k.dagen === 1 ? 'dag' : 'dagen'} vergeleken</span>
                </div>
                <Vergelijking kolommen={[{ titel: 'Vóór', k: k.voor }, { titel: 'Na', k: k.na }]} />
                <div className="space-y-0.5 px-1">
                  <HerbestelRegel label="Herbestellen vóór" h={k.herbestelVoor} />
                  <HerbestelRegel label="Herbestellen na" h={k.herbestelNa} />
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
