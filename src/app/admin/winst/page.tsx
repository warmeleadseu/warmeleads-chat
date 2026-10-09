'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowPathIcon, ChevronDownIcon, CurrencyEuroIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

/**
 * Winst per batch: wat een batch opbracht (naar rato geleverd) min de
 * advertentiekosten van zijn leads. Een lead die naar meerdere klanten ging,
 * telt per batch naar rato. Onderaan waar het advertentiegeld van de periode
 * verder heen ging, zodat het totaal klopt met de echte uitgaven.
 */

type Betaalwijze = 'open' | 'mollie' | 'factuur' | 'extern';

type Rij = {
  id: string; customer_id: string; klant: string; branch: string; batch_kind: string; status: string;
  created_at: string; completed_at: string | null; extern_factuurnummer: string | null; extern_bedrag_excl: number | null;
  batchprijs: number; betaalwijze: Betaalwijze; omzetBron: 'extern' | 'factuur' | 'batchprijs';
  omzet: number; geleverd: number; geleverdExtern: number; grootte: number; voortgang: number; gerealiseerd: number;
  kosten: number; winst: number; marge: number | null; kostenPerLead: number | null; opbrengstPerLead: number | null;
  prognoseWinst: number | null; leadsZonderKosten: number; gedeeldGemiddeld: number | null;
};
type Totaal = { omzet: number; gerealiseerd: number; kosten: number; winst: number; marge: number | null; prognoseWinst: number };
type Lekkage = { uitgaven: number; acquisitie: number; aan_batches: number; buiten_batch: number; onverkocht: number; rest: number };
type Antwoord = { van: string; tot: string; rijen: Rij[]; totaal: Totaal; totaalOnbetaald: Totaal; lekkage: Lekkage | null; error?: string };
type DetailLead = {
  lead_id: string; naam: string; plaats: string; binnengekomen: string | null; geleverd_op: string;
  campagne: string | null; kosten_lead: number | null; kosten_bron: string; klanten: number; aandeel: number;
};

const EURO = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const EURO2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur = (n: number | null | undefined) => (n == null ? '—' : EURO.format(n));
const eur2 = (n: number | null | undefined) => (n == null ? '—' : EURO2.format(n));
const datum = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: '2-digit' }) : '—');

const BETAAL: Record<Betaalwijze, [string, string]> = {
  mollie: ['Mollie', 'bg-emerald-50 text-emerald-700'],
  factuur: ['Factuur', 'bg-sky-50 text-sky-700'],
  extern: ['Extern', 'bg-violet-50 text-violet-700'],
  open: ['Nog niet betaald', 'bg-amber-50 text-amber-700'],
};
const STATUS: Record<string, string> = { active: 'Actief', completed: 'Afgerond', paused: 'Gepauzeerd', pending_payment: 'Wacht op betaling' };
const SOORT: Record<string, string> = { leads: '', bulk_leads: 'Bulk', niche_research: 'Niche-onderzoek' };

function isoDag(d: Date) { return d.toISOString().slice(0, 10); }
function dagenTerug(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return isoDag(d); }
const PERIODES: { label: string; van: () => string }[] = [
  { label: '30 dagen', van: () => dagenTerug(30) },
  { label: '90 dagen', van: () => dagenTerug(90) },
  { label: 'Dit jaar', van: () => `${new Date().getFullYear()}-01-01` },
  { label: 'Sinds 1 mei', van: () => '2026-05-01' },
];

type Sleutel = 'klant' | 'created_at' | 'gerealiseerd' | 'kosten' | 'winst' | 'marge' | 'kostenPerLead' | 'prognoseWinst' | 'voortgang';

function Kpi({ label, waarde, sub, toon }: { label: string; waarde: string; sub?: string; toon?: 'goed' | 'slecht' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${toon === 'goed' ? 'text-emerald-600' : toon === 'slecht' ? 'text-red-600' : 'text-slate-900'}`}>{waarde}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function ExternBlok({ rij, onOpgeslagen }: { rij: Rij; onOpgeslagen: () => void }) {
  const [nr, setNr] = useState(rij.extern_factuurnummer ?? '');
  const [bedrag, setBedrag] = useState(rij.extern_bedrag_excl == null ? '' : String(rij.extern_bedrag_excl));
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null);

  const opslaan = async () => {
    setBezig(true);
    setMelding(null);
    try {
      const res = await adminFetch(`/api/admin/winst/${rij.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ extern_factuurnummer: nr, extern_bedrag_excl: bedrag.trim() === '' ? null : bedrag }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setMelding({ ok: false, tekst: d.error ?? 'Opslaan mislukt' }); return; }
      setMelding({ ok: true, tekst: 'Opgeslagen.' });
      onOpgeslagen();
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
      <p className="text-xs font-semibold text-violet-800">Extern gefactureerd</p>
      <p className="mt-0.5 text-xs text-violet-700/80">
        Deze batch staat op betaald zonder factuur in het systeem. Laat het bedrag leeg om de batchprijs ({eur2(rij.batchprijs)}) te gebruiken.
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-600">
          Factuurnummer
          <input value={nr} onChange={e => setNr(e.target.value)} maxLength={100}
            className="mt-0.5 block h-9 w-44 rounded-lg border border-slate-200 bg-white px-2 text-sm" />
        </label>
        <label className="text-xs text-slate-600">
          Bedrag excl. btw
          <input value={bedrag} onChange={e => setBedrag(e.target.value)} inputMode="decimal" placeholder={String(rij.batchprijs)}
            className="mt-0.5 block h-9 w-32 rounded-lg border border-slate-200 bg-white px-2 text-sm" />
        </label>
        <button onClick={() => void opslaan()} disabled={bezig}
          className="h-9 rounded-lg bg-violet-600 px-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
          {bezig ? 'Opslaan...' : 'Opslaan'}
        </button>
        {melding && <span className={`text-xs ${melding.ok ? 'text-emerald-700' : 'text-red-600'}`}>{melding.tekst}</span>}
      </div>
    </div>
  );
}

function Detail({ rij, onOpgeslagen }: { rij: Rij; onOpgeslagen: () => void }) {
  const [leads, setLeads] = useState<DetailLead[] | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    let weg = false;
    void adminFetch(`/api/admin/winst/${rij.id}`, { cache: 'no-store' }).then(async res => {
      const d = (await res.json().catch(() => ({}))) as { leads?: DetailLead[]; error?: string };
      if (weg) return;
      if (!res.ok) setFout(d.error ?? 'Leads konden niet worden geladen');
      else setLeads(d.leads ?? []);
    });
    return () => { weg = true; };
  }, [rij.id]);

  return (
    <div className="space-y-3 bg-slate-50/70 px-4 py-4">
      <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-4">
        <p>Omzet: <strong>{eur2(rij.omzet)}</strong> <span className="text-slate-400">({rij.omzetBron === 'factuur' ? 'factuur' : rij.omzetBron === 'extern' ? 'extern bedrag' : 'batchprijs'})</span></p>
        <p>Opbrengst per lead: <strong>{eur2(rij.opbrengstPerLead)}</strong></p>
        <p>Kosten per lead: <strong>{eur2(rij.kostenPerLead)}</strong></p>
        <p>Gem. gedeeld met: <strong>{rij.gedeeldGemiddeld ? `${rij.gedeeldGemiddeld.toLocaleString('nl-NL')} klanten` : '—'}</strong></p>
      </div>
      {rij.geleverdExtern > 0 && (
        <p className="text-xs text-amber-700">{rij.geleverdExtern} leads zijn buiten het platform om geleverd; die tellen mee voor de omzet, maar hun kosten zijn onbekend.</p>
      )}
      {rij.betaalwijze === 'extern' && <ExternBlok rij={rij} onOpgeslagen={onOpgeslagen} />}

      {fout ? (
        <p className="text-sm text-red-600">{fout}</p>
      ) : !leads ? (
        <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
      ) : leads.length === 0 ? (
        <p className="text-sm text-slate-500">Nog geen leads geleverd.</p>
      ) : (
        <div className="max-h-96 overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Lead</th>
                <th className="px-3 py-2 font-medium">Geleverd</th>
                <th className="px-3 py-2 font-medium">Campagne</th>
                <th className="px-3 py-2 text-right font-medium">Kosten lead</th>
                <th className="px-3 py-2 text-right font-medium">Klanten</th>
                <th className="px-3 py-2 text-right font-medium">Aandeel batch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map(l => (
                <tr key={l.lead_id}>
                  <td className="px-3 py-1.5 text-slate-700">{l.naam || 'Naamloos'} <span className="text-slate-400">{l.plaats}</span></td>
                  <td className="px-3 py-1.5 text-slate-500">{datum(l.geleverd_op)}</td>
                  <td className="max-w-[220px] truncate px-3 py-1.5 text-slate-500" title={l.campagne ?? ''}>
                    {l.campagne ?? <span className="text-amber-600">{l.kosten_bron === 'geen_campagne' ? 'geen campagne' : 'onbekend'}</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{eur2(l.kosten_lead)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{l.klanten}</td>
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums text-slate-800">{eur2(l.aandeel)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function WinstPage() {
  const [van, setVan] = useState(() => dagenTerug(90));
  const [tot, setTot] = useState(() => isoDag(new Date()));
  const [data, setData] = useState<Antwoord | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [zoek, setZoek] = useState('');
  const [branche, setBranche] = useState('');
  const [betaal, setBetaal] = useState<'' | 'betaald' | Betaalwijze>('betaald');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<{ op: Sleutel; af: boolean }>({ op: 'created_at', af: true });
  const [open, setOpen] = useState<string | null>(null);

  const laad = useCallback(async () => {
    setLaden(true);
    setFout(null);
    try {
      const res = await adminFetch(`/api/admin/winst?van=${van}&tot=${tot}`, { cache: 'no-store' });
      const d = (await res.json().catch(() => ({}))) as Antwoord;
      if (!res.ok) { setFout(res.status === 403 ? 'Alleen superadmins kunnen de winst bekijken.' : d.error ?? 'Laden mislukt'); return; }
      setData(d);
    } finally {
      setLaden(false);
    }
  }, [van, tot]);

  useEffect(() => { void laad(); }, [laad]);

  const branches = useMemo(() => [...new Set((data?.rijen ?? []).map(r => r.branch))].sort(), [data]);

  const zichtbaar = useMemo(() => {
    const z = zoek.trim().toLowerCase();
    const lijst = (data?.rijen ?? []).filter(r =>
      (!z || r.klant.toLowerCase().includes(z)) &&
      (!branche || r.branch === branche) &&
      (!status || r.status === status) &&
      (!betaal || (betaal === 'betaald' ? r.betaalwijze !== 'open' : r.betaalwijze === betaal)),
    );
    const w = (r: Rij): number | string => {
      const v = r[sort.op];
      return v == null ? -Infinity : v;
    };
    return [...lijst].sort((a, b) => {
      const x = w(a), y = w(b);
      const c = typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y) : Number(x) - Number(y);
      return sort.af ? -c : c;
    });
  }, [data, zoek, branche, status, betaal, sort]);

  const totaal = useMemo(() => {
    const t = zichtbaar.reduce((s, r) => ({
      gerealiseerd: s.gerealiseerd + r.gerealiseerd, kosten: s.kosten + r.kosten, winst: s.winst + r.winst,
      prognose: s.prognose + (r.prognoseWinst ?? r.winst), omzet: s.omzet + r.omzet,
    }), { gerealiseerd: 0, kosten: 0, winst: 0, prognose: 0, omzet: 0 });
    return { ...t, marge: t.gerealiseerd > 0 ? Math.round((t.winst / t.gerealiseerd) * 1000) / 10 : null };
  }, [zichtbaar]);

  const kop = (op: Sleutel, label: string, rechts = true) => (
    <th className={`whitespace-nowrap px-3 py-2.5 font-medium ${rechts ? 'text-right' : 'text-left'}`}>
      <button onClick={() => setSort(s => ({ op, af: s.op === op ? !s.af : true }))} className="hover:text-slate-800">
        {label}{sort.op === op ? (sort.af ? ' ↓' : ' ↑') : ''}
      </button>
    </th>
  );

  const lek = data?.lekkage;
  const lekRegels: [string, number, string][] = lek ? [
    ['Leads in batches', lek.aan_batches, 'naar rato verdeeld over de batches hierboven (alle batches, niet alleen deze selectie)'],
    ['Leads buiten een batch', lek.buiten_batch, 'bulktoewijzingen en -exports; opbrengst onbekend in het systeem'],
    ['Onverkochte leads', lek.onverkocht, 'leads die naar geen enkele klant gingen'],
    ['Acquisitie', lek.acquisitie, 'campagnes zonder leads, zoals de partnercampagnes die nieuwe klanten werven'],
    ['Overig', lek.rest, 'uitgaven zonder lead, en verschil door de weekverdeling aan de randen van de periode'],
  ] : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
            <CurrencyEuroIcon className="h-6 w-6 text-brand-purple" /> Winst per batch
          </h1>
          <p className="mt-0.5 max-w-3xl text-sm text-slate-500">
            Omzet naar rato van wat er geleverd is, min de advertentiekosten van de geleverde leads. Een lead die naar drie klanten ging,
            telt per batch voor een derde. Alle bedragen excl. btw; advertentiekosten vanaf 1 mei 2026.
          </p>
        </div>
        <button onClick={() => void laad()} disabled={laden}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <ArrowPathIcon className={`h-4 w-4 ${laden ? 'animate-spin' : ''}`} /> Vernieuwen
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap gap-1">
          {PERIODES.map(p => (
            <button key={p.label} onClick={() => { setVan(p.van()); setTot(isoDag(new Date())); }}
              className={`h-9 rounded-lg px-3 text-xs font-semibold ${van === p.van() && tot === isoDag(new Date()) ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <label className="text-xs text-slate-500">Batches aangemaakt van
          <input type="date" value={van} onChange={e => e.target.value && setVan(e.target.value)} className="mt-0.5 block h-9 rounded-lg border border-slate-200 px-2 text-sm text-slate-800" />
        </label>
        <label className="text-xs text-slate-500">tot en met
          <input type="date" value={tot} onChange={e => e.target.value && setTot(e.target.value)} className="mt-0.5 block h-9 rounded-lg border border-slate-200 px-2 text-sm text-slate-800" />
        </label>
        <input value={zoek} onChange={e => setZoek(e.target.value)} placeholder="Zoek klant…" className="h-9 w-40 rounded-lg border border-slate-200 px-2 text-sm" />
        <select value={branche} onChange={e => setBranche(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm">
          <option value="">Alle branches</option>
          {branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm">
          <option value="">Alle statussen</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={betaal} onChange={e => setBetaal(e.target.value as typeof betaal)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm">
          <option value="betaald">Alleen betaald</option>
          <option value="">Alles, ook onbetaald</option>
          <option value="mollie">Mollie</option>
          <option value="factuur">Factuur</option>
          <option value="extern">Extern gefactureerd</option>
          <option value="open">Nog niet betaald</option>
        </select>
      </div>

      {fout && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{fout}</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Gerealiseerde omzet" waarde={eur(totaal.gerealiseerd)} sub={`van ${eur(totaal.omzet)} gefactureerd`} />
        <Kpi label="Leadkosten" waarde={eur(totaal.kosten)} />
        <Kpi label="Winst" waarde={eur(totaal.winst)} sub={totaal.marge == null ? undefined : `${totaal.marge.toLocaleString('nl-NL')}% marge`} toon={totaal.winst >= 0 ? 'goed' : 'slecht'} />
        <Kpi label="Prognose bij voltooiing" waarde={eur(totaal.prognose)} sub="lopende batches afgemaakt tegen hun huidige kosten per lead" />
      </div>

      {laden && !data ? (
        <div className="space-y-2">{[0, 1, 2, 3].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>
      ) : zichtbaar.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-14 text-center">
          <CurrencyEuroIcon className="mx-auto mb-3 h-10 w-10 text-slate-200" />
          <p className="font-medium text-slate-600">Geen batches in deze selectie</p>
          <p className="mt-1 text-sm text-slate-400">Kies een langere periode of zet een filter uit.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {kop('klant', 'Klant', false)}
                {kop('created_at', 'Aangemaakt', false)}
                <th className="px-3 py-2.5 text-left font-medium">Betaling</th>
                {kop('voortgang', 'Geleverd')}
                {kop('gerealiseerd', 'Omzet')}
                {kop('kosten', 'Kosten')}
                {kop('winst', 'Winst')}
                {kop('marge', 'Marge')}
                {kop('kostenPerLead', 'Kosten/lead')}
                {kop('prognoseWinst', 'Prognose')}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {zichtbaar.map(r => {
                const isOpen = open === r.id;
                const [bLabel, bKleur] = BETAAL[r.betaalwijze];
                return (
                  <Fragment key={r.id}>
                    <tr onClick={() => setOpen(isOpen ? null : r.id)} className="cursor-pointer hover:bg-slate-50">
                      <td className="px-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Link href={`/admin/customers?open=${r.customer_id}`} onClick={e => e.stopPropagation()} className="truncate font-medium text-slate-900 hover:text-brand-purple">{r.klant}</Link>
                          {r.leadsZonderKosten > 0 && (
                            <span title={`${r.leadsZonderKosten} leads zonder bekende kosten (geen campagne of vóór 1 mei)`}>
                              <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{r.branch}{SOORT[r.batch_kind] ? ` · ${SOORT[r.batch_kind]}` : ''} · {STATUS[r.status] ?? r.status}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">{datum(r.created_at)}</td>
                      <td className="px-3 py-2.5"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${bKleur}`}>{bLabel}</span></td>
                      <td className="px-3 py-2.5 text-right">
                        <p className="tabular-nums text-slate-700">{r.geleverd + r.geleverdExtern}/{r.grootte}</p>
                        <div className="ml-auto mt-1 h-1 w-16 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-brand-purple" style={{ width: `${Math.round(r.voortgang * 100)}%` }} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{eur(r.gerealiseerd)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{eur(r.kosten)}</td>
                      <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${r.winst >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{eur(r.winst)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{r.marge == null ? '—' : `${r.marge.toLocaleString('nl-NL')}%`}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{eur2(r.kostenPerLead)}</td>
                      <td className={`px-3 py-2.5 text-right tabular-nums ${r.prognoseWinst != null && r.prognoseWinst < 0 ? 'text-red-600' : 'text-slate-600'}`}>{eur(r.prognoseWinst)}</td>
                      <td className="px-2"><ChevronDownIcon className={`h-4 w-4 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} /></td>
                    </tr>
                    {isOpen && (
                      <tr><td colSpan={11} className="p-0"><Detail rij={r} onOpgeslagen={() => void laad()} /></td></tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {lek && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">Waar het advertentiegeld heen ging</h2>
            <p className="text-xs text-slate-400">uitgaven van {datum(data?.van ?? null)} t/m {datum(data?.tot ?? null)}: <strong className="text-slate-700">{eur(lek.uitgaven)}</strong></p>
          </div>
          <div className="mt-3 space-y-2">
            {lekRegels.map(([label, bedrag, uitleg]) => {
              const pct = lek.uitgaven > 0 ? Math.max(0, (bedrag / lek.uitgaven) * 100) : 0;
              return (
                <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[180px_minmax(0,1fr)_90px]">
                  <p className="text-sm text-slate-700">{label}</p>
                  <div className="order-3 col-span-2 h-2 overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1">
                    <div className="h-full rounded-full bg-brand-purple/70" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <p className="text-right text-sm tabular-nums text-slate-700">{eur(bedrag)}</p>
                  <p className="order-4 col-span-2 text-xs text-slate-400 sm:col-span-3 sm:-mt-1">{uitleg}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
