'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  InboxStackIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  CheckIcon,
  BoltIcon,
  ClockIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { beschrijfMoment } from '@/lib/restleadPlanning';
import { TERUGDRAAI_VENSTER_MINUTEN } from '@/lib/restleads';

/**
 * Leads die tussen wal en schip vielen.
 *
 * Lijsten uit dezelfde live berekening: de verse leads (laatste 7 dagen) in
 * "uit te delen" en "geen klant (nog)", en "verlopen" (7 tot 90 dagen, voorraad
 * om als exclusieve bulk te verkopen). Een lead verdwijnt zodra hij twee keer
 * is uitgedeeld.
 */

interface Kandidaat {
  customer_id: string;
  batch_id: string;
  klant: string;
  prijs_per_lead: number;
  km_buiten: number;
  reden: string;
  distribution_priority: boolean;
}

interface Restlead {
  id: string;
  naam_klant: string | null;
  plaatsnaam: string | null;
  provincie: string | null;
  postcode: string | null;
  branch: string;
  wervingsdatum: string | null;
  created_at: string;
  dagen_oud: number;
  uitgedeeld: number;
  phone_valid: boolean | null;
  wachtrij: { klant: string; wanneer: string | null; status: string } | null;
  kandidaten: Kandidaat[];
}

interface WachtrijRij {
  id: string;
  lead_id: string;
  gepland_voor: string;
  status: string;
  reden: string | null;
  laatste_reden?: string | null;
  leads: { naam_klant: string | null; plaatsnaam: string | null; postcode: string | null; branch: string } | null;
  customers: { name: string } | null;
}

const MAX_KLANTEN_PER_LEAD = 3;
/** Aantal regels per stap; zie de opmerking bij `toon`. */
const PER_STAP = 50;


/* De instellingen hergebruiken dezelfde opslag als de weergavekeuze elders in
   de admin: die vangt een geblokkeerde localStorage al netjes af. */
function leesGetal(sleutel: string, standaard: string): string {
  if (typeof window === 'undefined') return standaard;
  try {
    return window.localStorage.getItem(`wl-restleads-${sleutel}`) ?? standaard;
  } catch {
    return standaard;
  }
}

function bewaarGetal(sleutel: string, waarde: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`wl-restleads-${sleutel}`, waarde);
  } catch {
    /* Privémodus. De waarde geldt dan alleen deze sessie. */
  }
}

function datum(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function RestleadsPage() {
  const [kansrijk, setKansrijk] = useState<Restlead[]>([]);
  const [verlopen, setVerlopen] = useState<Restlead[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [lijst, setLijst] = useState<'kansrijk' | 'geenklant' | 'verlopen' | 'ingepland' | 'geschiedenis'>('kansrijk');
  const [berekendOp, setBerekendOp] = useState<string | null>(null);
  const [klantenMee, setKlantenMee] = useState<string[]>([]);
  const [wachtrij, setWachtrij] = useState<WachtrijRij[]>([]);
  const [wachtrijLaden, setWachtrijLaden] = useState(false);
  const [massaBezig, setMassaBezig] = useState(false);
  const [historie, setHistorie] = useState<WachtrijRij[]>([]);
  /* Hoeveel regels er getoond worden. De lijst "verlopen" telt 1.300 leads en
     die allemaal tekenen maakt het scherm stroperig. */
  const [toon, setToon] = useState(PER_STAP);
  /* Wat er zojuist is uitgedeeld, om het binnen vijf minuten te kunnen
     terugdraaien. */
  const [laatsteActie, setLaatsteActie] = useState<{ lead_id: string; doelen: { customer_id: string; klant: string }[]; tijd: number } | null>(null);

  const [marge, setMarge] = useState('5');
  const [ruimeMarge, setRuimeMarge] = useState('10');
  const [droogNa, setDroogNa] = useState('7');

  /* Pas na de eerste render lezen, anders lopen server- en clientrender uiteen. */
  useEffect(() => {
    setMarge(leesGetal('marge', '5'));
    setRuimeMarge(leesGetal('ruime-marge', '10'));
    setDroogNa(leesGetal('droog-na', '7'));
  }, []);

  const [zoek, setZoek] = useState('');
  const [branche, setBranche] = useState('all');
  const [alleenMetKandidaat, setAlleenMetKandidaat] = useState(false);

  /* Per lead de aangevinkte klanten. */
  const [selectie, setSelectie] = useState<Record<string, Set<string>>>({});
  const [bezig, setBezig] = useState<string | null>(null);
  const [melding, setMelding] = useState<string | null>(null);

  const laad = useCallback(async () => {
    setLaden(true);
    setFout(null);
    try {
      /* Het tijdstip in de URL maakt elk verzoek uniek. Een `no-store`-header
         helpt niet tegen een service worker die de aanvraag onderschept, en
         precies zo'n bewaard antwoord liet hier een klant zien die allang geen
         actieve batch meer had. Een uniek adres kan niemand bewaren. */
      const q = new URLSearchParams({
        marge, ruime_marge: ruimeMarge, droog_na: droogNa, _t: String(Date.now()),
      });
      /* Nooit uit de browsercache. Deze lijst verandert bij elke uitdeling, en
         een bewaard antwoord laat een lead staan die allang weg is. */
      const res = await adminFetch(`/api/admin/restleads?${q.toString()}`, { cache: 'no-store' });
      if (!res.ok) { setFout('Restleads konden niet worden berekend.'); return; }
      const d = await res.json();
      setKansrijk(d.kansrijk || []);
      setVerlopen(d.verlopen || []);
      setBerekendOp(d.berekend_op || null);
      setKlantenMee(d.klanten_meegenomen || []);
      setSelectie({});
    } catch {
      setFout('Netwerkfout bij het berekenen.');
    } finally {
      setLaden(false);
    }
  }, [marge, ruimeMarge, droogNa]);

  const laadWachtrij = useCallback(async () => {
    setWachtrijLaden(true);
    try {
      const [openRes, histRes] = await Promise.all([
        adminFetch('/api/admin/restleads/ingepland'),
        adminFetch('/api/admin/restleads/ingepland?historie=1'),
      ]);
      if (openRes.ok) setWachtrij((await openRes.json()).rijen || []);
      if (histRes.ok) {
        const d = await histRes.json();
        /* De geschiedenis bevat ook wat nog gepland staat; dat heeft zijn eigen
           tabblad en hoort hier niet nog eens. */
        setHistorie((d.rijen || []).filter((r: WachtrijRij) => r.status !== 'gepland'));
      }
    } finally {
      setWachtrijLaden(false);
    }
  }, []);

  useEffect(() => { laad(); }, [laad]);
  useEffect(() => { laadWachtrij(); }, [laadWachtrij]);

  /* In de stand 'ingepland' tonen we de wachtrij, niet deze lijst. */
  /* Terug naar de eerste vijftig zodra je van lijst wisselt of anders filtert. */
  useEffect(() => { setToon(PER_STAP); }, [lijst, zoek, branche, alleenMetKandidaat]);

  /* "Nog kansrijk" in tweeën: wat nu naar een klant kan, en wat (nog) nergens
     past. De lijst wordt bij elke verversing opnieuw berekend, dus komt er een
     klant bij of wordt een gebied ruimer, dan schuift een lead vanzelf over. */
  const kansrijkUit = useMemo(() => kansrijk.filter(l => l.kandidaten.length > 0), [kansrijk]);
  const kansrijkGeen = useMemo(() => kansrijk.filter(l => l.kandidaten.length === 0), [kansrijk]);

  /* In de stand 'ingepland' en 'geschiedenis' tonen we de wachtrij. */
  const bron = lijst === 'kansrijk' ? kansrijkUit : lijst === 'geenklant' ? kansrijkGeen : verlopen;
  const isLeadLijst = lijst === 'kansrijk' || lijst === 'geenklant' || lijst === 'verlopen';

  const branches = useMemo(
    () => [...new Set([...kansrijk, ...verlopen].map(l => l.branch))].sort(),
    [kansrijk, verlopen],
  );

  const zichtbaar = useMemo(() => {
    const term = zoek.trim().toLowerCase();
    return bron.filter(l => {
      if (branche !== 'all' && l.branch !== branche) return false;
      if (lijst === 'verlopen' && alleenMetKandidaat && l.kandidaten.length === 0) return false;
      if (!term) return true;
      return (
        (l.naam_klant || '').toLowerCase().includes(term) ||
        (l.plaatsnaam || '').toLowerCase().includes(term) ||
        (l.postcode || '').toLowerCase().includes(term) ||
        (l.provincie || '').toLowerCase().includes(term)
      );
    });
  }, [bron, branche, zoek, alleenMetKandidaat, lijst]);

  const wissel = (leadId: string, customerId: string, max: number) => {
    setSelectie(vorig => {
      const huidig = new Set(vorig[leadId] ?? []);
      if (huidig.has(customerId)) huidig.delete(customerId);
      else if (huidig.size < max) huidig.add(customerId);
      return { ...vorig, [leadId]: huidig };
    });
  };

  const deelUit = async (lead: Restlead) => {
    const gekozen = selectie[lead.id];
    if (!gekozen || gekozen.size === 0) return;
    setBezig(lead.id);
    setMelding(null);
    try {
      const doelen = lead.kandidaten
        .filter(k => gekozen.has(k.customer_id))
        .map(k => ({ customer_id: k.customer_id, batch_id: k.batch_id }));

      const res = await adminFetch('/api/admin/restleads/uitdelen', {
        method: 'POST',
        body: JSON.stringify({ lead_id: lead.id, doelen }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMelding(d.error || 'Uitdelen mislukt'); return; }

      const mislukt = (d.uitkomsten || []).filter((u: { ok: boolean }) => !u.ok);
      setMelding(
        mislukt.length === 0
          ? `${d.gelukt} keer uitgedeeld`
          : `${d.gelukt} gelukt, ${mislukt.length} niet: ${mislukt.map((u: { klant?: string; reden?: string }) => `${u.klant ?? '?'} (${u.reden})`).join(', ')}`,
      );

      /* De lead meteen uit de lijst halen in plaats van te wachten op de
         verversing. Die haalt 2.500 leads op en duurt ruim twee seconden; tot
         die tijd zag je de regel gewoon staan en leek er niets te gebeuren. */
      if (d.gelukt > 0) {
        setKansrijk(v => v.filter(x => x.id !== lead.id));
        setVerlopen(v => v.filter(x => x.id !== lead.id));

        const direct = (d.uitkomsten || []).filter((u: { ok: boolean; wanneer?: string }) => u.ok && u.wanneer === 'nu');
        if (direct.length > 0) {
          setLaatsteActie({
            lead_id: lead.id,
            doelen: direct.map((u: { customer_id: string; klant?: string }) => ({ customer_id: u.customer_id, klant: u.klant ?? 'klant' })),
            tijd: Date.now(),
          });
        }
      }

      /* Daarna op de achtergrond bijtrekken, puur om te corrigeren. */
      laad();
      laadWachtrij();
    } finally {
      setBezig(null);
      setTimeout(() => setMelding(null), 8000);
    }
  };

  /* Alles in één keer, met de regels die alleen hier gelden: niets uit de
     ruime marge (daar beslis jij over), geen gratis klanten, en bij meer
     kandidaten dan plekken de goedkoopste eerst. */
  const deelAllesUit = async () => {
    const kandidaten = zichtbaar.filter(l =>
      l.kandidaten.some(k => k.km_buiten <= Number(marge) && k.prijs_per_lead > 0),
    );
    if (kandidaten.length === 0) return;
    if (!confirm(
      `${kandidaten.length} leads uitdelen aan de goedkoopste beschikbare klanten, ` +
      `gespreid over 12 uur? Leads die alleen dankzij de ruime marge een klant hebben, blijven liggen.`,
    )) return;

    setMassaBezig(true);
    setMelding(null);
    try {
      const res = await adminFetch('/api/admin/restleads/alles-uitdelen', {
        method: 'POST',
        body: JSON.stringify({
          marge_grens: Number(marge),
          leads: kandidaten.map(l => ({
            lead_id: l.id,
            uitgedeeld: l.uitgedeeld,
            kandidaten: l.kandidaten,
          })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMelding(d.error || 'Massaal uitdelen mislukt'); return; }
      const ids = new Set(kandidaten.map(l => l.id));
      setKansrijk(v => v.filter(x => !ids.has(x.id)));
      setMelding(
        `${d.leads} leads ingepland, ${d.leveringen} leveringen. ` +
        `${d.overgeslagen_ruime_marge} overgeslagen omdat ze alleen via de ruime marge matchten.`,
      );
      laad();
      laadWachtrij();
    } finally {
      setMassaBezig(false);
      setTimeout(() => setMelding(null), 10000);
    }
  };

  const maakOngedaan = async () => {
    if (!laatsteActie) return;
    setMelding(null);
    let terug = 0;
    for (const doel of laatsteActie.doelen) {
      const res = await adminFetch('/api/admin/restleads/ongedaan', {
        method: 'POST',
        body: JSON.stringify({ lead_id: laatsteActie.lead_id, customer_id: doel.customer_id }),
      });
      if (res.ok) terug++;
      else {
        const d = await res.json().catch(() => ({}));
        setMelding(d.error || 'Terugdraaien mislukt');
      }
    }
    if (terug > 0) setMelding(`${terug} toewijzing${terug === 1 ? '' : 'en'} teruggedraaid`);
    setLaatsteActie(null);
    laad();
    laadWachtrij();
  };

  const annuleerLevering = async (id: string) => {
    const res = await adminFetch(`/api/admin/restleads/ingepland?id=${id}`, { method: 'DELETE' });
    if (res.ok) laadWachtrij();
    else setMelding('Annuleren mislukt');
  };

  const exporteer = () => {
    const kop = ['Naam', 'Plaats', 'Postcode', 'Provincie', 'Branche', 'Wervingsdatum', 'Dagen oud', 'Uitgedeeld', 'Kandidaten'];
    const cel = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const regels = [
      kop.join(';'),
      ...zichtbaar.map(l => [
        l.naam_klant, l.plaatsnaam, l.postcode, l.provincie, l.branch,
        datum(l.wervingsdatum || l.created_at), l.dagen_oud, `${l.uitgedeeld}x`,
        l.kandidaten.map(k => k.klant).join(' | '),
      ].map(cel).join(';')),
    ];
    const blob = new Blob(['﻿' + regels.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `restleads-${lijst}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
            <InboxStackIcon className="h-6 w-6 text-brand-purple" />
            Restleads
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Leads die nul of één keer zijn uitgedeeld, met de klanten die ze alsnog kunnen krijgen.
            Live berekend, dus een nieuwe klant of een verruimd gebied telt meteen mee.
            {berekendOp && (
              <>
                {' '}Berekend om{' '}
                <strong>
                  {new Date(berekendOp).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </strong>
                {klantenMee.length > 0 && ` met ${klantenMee.length} actieve batches: ${klantenMee.join(', ')}.`}
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={laad} disabled={laden} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <ArrowPathIcon className={`h-4 w-4 ${laden ? 'animate-spin' : ''}`} /> Vernieuwen
          </button>
          {isLeadLijst && (
            <button onClick={exporteer} disabled={zichtbaar.length === 0} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              <ArrowDownTrayIcon className="h-4 w-4" /> Export
            </button>
          )}
          {lijst === 'kansrijk' && (
            <button
              onClick={deelAllesUit}
              disabled={massaBezig || zichtbaar.length === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-purple to-brand-pink px-3.5 text-sm font-bold text-white disabled:opacity-40"
            >
              <BoltIcon className="h-4 w-4" />
              {massaBezig ? 'Bezig...' : 'Deel alles uit'}
            </button>
          )}
        </div>
      </div>

      {melding && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          <span className="min-w-0 flex-1">{melding}</span>
          {/* Terugdraaien kan alleen zolang de klant de lead nog niet heeft
              opgehaald; de server bewaakt dezelfde termijn. */}
          {laatsteActie && Date.now() - laatsteActie.tijd < TERUGDRAAI_VENSTER_MINUTEN * 60_000 && (
            <button
              onClick={maakOngedaan}
              className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              Ongedaan maken
            </button>
          )}
        </div>
      )}
      {fout && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{fout}</div>
      )}

      {/* Lijstkeuze */}
      <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
        {([
          ['kansrijk', 'Uit te delen', kansrijkUit.length, 'laatste 7 dagen, er is een klant voor'],
          ['geenklant', 'Geen klant (nog)', kansrijkGeen.length, 'laatste 7 dagen, er komt nu geen klant voor in aanmerking'],
          ['verlopen', 'Verlopen', verlopen.length, '7 tot 90 dagen'],
          ['ingepland', 'Ingepland', wachtrij.length, 'staat in de wachtrij'],
          ['geschiedenis', 'Geschiedenis', historie.length, 'geleverd en overgeslagen'],
        ] as const).map(([waarde, label, aantal, hint]) => (
          <button
            key={waarde}
            onClick={() => setLijst(waarde)}
            title={hint}
            className={`flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition ${
              lijst === waarde ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
            <span className="text-xs text-slate-400">{aantal}</span>
          </button>
        ))}
      </div>

      {/* Instellingen en filters */}
      <div className={`flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 ${isLeadLijst ? 'flex' : 'hidden'}`}>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Marge</label>
          <div className="flex h-9 w-20 items-center rounded-lg border border-slate-200 px-2">
            <input value={marge} onChange={e => { setMarge(e.target.value); bewaarGetal('marge', e.target.value); }} inputMode="numeric" className="w-full min-w-0 bg-transparent text-sm outline-none" />
            <span className="text-xs text-slate-400">km</span>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Ruime marge</label>
          <div className="flex h-9 w-20 items-center rounded-lg border border-slate-200 px-2">
            <input value={ruimeMarge} onChange={e => { setRuimeMarge(e.target.value); bewaarGetal('ruime-marge', e.target.value); }} inputMode="numeric" className="w-full min-w-0 bg-transparent text-sm outline-none" />
            <span className="text-xs text-slate-400">km</span>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Droog na</label>
          <div className="flex h-9 w-20 items-center rounded-lg border border-slate-200 px-2">
            <input value={droogNa} onChange={e => { setDroogNa(e.target.value); bewaarGetal('droog-na', e.target.value); }} inputMode="numeric" className="w-full min-w-0 bg-transparent text-sm outline-none" />
            <span className="text-xs text-slate-400">d</span>
          </div>
        </div>

        <div className="relative min-w-[180px] flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={zoek} onChange={e => setZoek(e.target.value)} placeholder="Zoek op naam, plaats of postcode..." className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-brand-purple/50" />
        </div>

        <select value={branche} onChange={e => setBranche(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm text-slate-700">
          <option value="all">Alle branches</option>
          {branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        {/* Bij de verse leads zit deze splitsing al in de tabbladen. */}
        {lijst === 'verlopen' && (
          <label className="flex h-9 cursor-pointer items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={alleenMetKandidaat} onChange={e => setAlleenMetKandidaat(e.target.checked)} className="h-4 w-4 accent-[#7c3aed]" />
            Alleen met kandidaat
          </label>
        )}

        <span className="ml-auto text-xs text-slate-400">
          {zichtbaar.length > toon ? `${toon} van ${zichtbaar.length}` : `${zichtbaar.length}`} leads
        </span>
      </div>

      {lijst === 'ingepland' || lijst === 'geschiedenis' ? (
        wachtrijLaden ? (
          <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>
        ) : (lijst === 'ingepland' ? wachtrij : historie).length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <ClockIcon className="mx-auto mb-3 h-10 w-10 text-slate-200" />
            <p className="font-medium text-slate-600">
              {lijst === 'ingepland' ? 'Niets ingepland' : 'Nog geen geschiedenis'}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {lijst === 'ingepland'
                ? 'Leveringen die je spreidt over de cooldown van 12 uur komen hier te staan tot ze zijn uitgevoerd.'
                : 'Hier komt te staan wat er geleverd is en wat is overgeslagen, met de reden erbij.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {(lijst === 'ingepland' ? wachtrij : historie).map(r => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className={`w-28 shrink-0 text-xs font-semibold tabular-nums ${
                  r.status === 'overgeslagen' ? 'text-slate-400' : r.status === 'geleverd' ? 'text-emerald-600' : 'text-brand-purple'
                }`}>
                  {beschrijfMoment(new Date(r.gepland_voor))}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                  {r.leads?.naam_klant || 'Naamloos'}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {[r.leads?.postcode, r.leads?.plaatsnaam].filter(Boolean).join(' ')}
                  </span>
                </span>
                <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">{r.leads?.branch}</span>
                <span className="shrink-0 text-sm text-slate-600">&rarr; {r.customers?.name || '?'}</span>
                {lijst === 'geschiedenis' ? (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    r.status === 'geleverd' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`} title={r.laatste_reden || undefined}>
                    {r.status === 'geleverd' ? 'geleverd' : `overgeslagen: ${r.laatste_reden || 'onbekend'}`}
                  </span>
                ) : (
                  <button
                    onClick={() => annuleerLevering(r.id)}
                    title="Deze levering annuleren"
                    className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      ) : laden ? (
        <div className="space-y-2">{[0, 1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div>
      ) : zichtbaar.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <InboxStackIcon className="mx-auto mb-3 h-10 w-10 text-slate-200" />
          <p className="font-medium text-slate-600">Niets in deze lijst</p>
          <p className="mt-1 text-sm text-slate-400">
            {lijst === 'kansrijk'
              ? 'Geen verse leads die nu naar een klant kunnen.'
              : lijst === 'geenklant'
                ? 'Voor elke verse lead met minder dan twee klanten is er een klant beschikbaar.'
                : 'Geen oudere leads met minder dan twee uitdelingen.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {zichtbaar.slice(0, toon).map(l => {
            const ruimte = MAX_KLANTEN_PER_LEAD - l.uitgedeeld;
            const gekozen = selectie[l.id] ?? new Set<string>();
            return (
              <div key={l.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-slate-900">{l.naam_klant || 'Naamloos'}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        l.uitgedeeld === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {l.uitgedeeld}x uitgedeeld
                      </span>
                      {wachtrij.filter(w => w.lead_id === l.id).length > 0 && (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                          {wachtrij.filter(w => w.lead_id === l.id).length} gepland
                        </span>
                      )}
                      {l.phone_valid === false && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500" title="Leads met een ongeldig nummer worden niet uitgedeeld">
                          ongeldig nummer
                        </span>
                      )}
                    </div>
                    {/* Postcode en datum met hetzelfde gewicht als de plaats: er
                        staan meerdere leads uit dezelfde plaats in de lijst en
                        die waren anders niet uit elkaar te houden. */}
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <span className="flex items-center gap-1 font-medium text-slate-600">
                        <MapPinIcon className="h-3 w-3 shrink-0" />
                        {[l.postcode, l.plaatsnaam].filter(Boolean).join(' ') || 'geen adres'}
                      </span>
                      <span className="text-slate-400">{l.provincie}</span>
                      <span className="text-slate-400">{l.branch}</span>
                      <span className="font-medium text-slate-600">
                        {datum(l.wervingsdatum || l.created_at)}
                      </span>
                      <span className="text-slate-400">
                        {l.dagen_oud} {l.dagen_oud === 1 ? 'dag' : 'dagen'} oud
                      </span>
                    </p>
                  </div>
                </div>

                {l.wachtrij && (
                  /* Hoort hier eigenlijk niet te staan: een lead die al
                     klaarstaat wordt uitgefilterd. Zie je dit tóch, dan is er
                     iets mis en dan wil je dat lezen in plaats van je af te
                     vragen of je hem al hebt uitgedeeld. */
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Staat al klaar voor <strong>{l.wachtrij.klant}</strong>
                    {l.wachtrij.wanneer && ` op ${datum(l.wachtrij.wanneer)}`} ({l.wachtrij.status}).
                    Meld dit even; hij hoort hier niet meer te staan.
                  </p>
                )}

                {l.kandidaten.length === 0 ? (
                  <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    Geen enkele klant komt op dit moment in aanmerking.
                  </p>
                ) : (
                  <div className="mt-3">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Kan alsnog naar ({ruimte} {ruimte === 1 ? 'plek' : 'plekken'} vrij)
                    </p>
                    <div className="space-y-1">
                      {l.kandidaten.map(k => {
                        const aan = gekozen.has(k.customer_id);
                        const vol = !aan && gekozen.size >= ruimte;
                        return (
                          <label
                            key={k.customer_id}
                            className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 transition ${
                              aan ? 'border-brand-purple bg-brand-purple/5' : vol ? 'border-slate-100 opacity-40' : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={aan}
                              disabled={vol}
                              onChange={() => wissel(l.id, k.customer_id, ruimte)}
                              className="h-4 w-4 shrink-0 accent-[#7c3aed]"
                            />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                              {k.klant}
                              {k.distribution_priority && (
                                <span className="ml-1.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700">voorrang</span>
                              )}
                            </span>
                            <span className="shrink-0 text-xs text-slate-400">{k.reden}</span>
                            <span className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-500">
                              € {k.prijs_per_lead.toFixed(2)}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => deelUit(l)}
                        disabled={gekozen.size === 0 || bezig === l.id}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-purple to-brand-pink px-4 text-sm font-bold text-white disabled:opacity-40"
                      >
                        <CheckIcon className="h-4 w-4" />
                        {bezig === l.id ? 'Uitdelen...' : `Deel uit${gekozen.size > 0 ? ` (${gekozen.size})` : ''}`}
                      </button>
                      {gekozen.size >= ruimte && ruimte > 0 && (
                        <span className="text-[11px] text-slate-400">Maximum bereikt voor deze lead</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {zichtbaar.length > toon && (
            <button
              onClick={() => setToon(t => t + PER_STAP)}
              className="w-full rounded-xl border border-dashed border-slate-300 bg-white py-3 text-sm font-semibold text-slate-600 transition hover:border-brand-purple/50 hover:text-brand-purple"
            >
              Meer laden ({zichtbaar.length - toon} resterend)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
