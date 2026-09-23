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

/**
 * Leads die tussen wal en schip vielen.
 *
 * Twee lijsten uit dezelfde live berekening: "nog kansrijk" (laatste 7 dagen,
 * hier valt nog wat te redden) en "verlopen" (7 tot 90 dagen, voorraad om als
 * exclusieve bulk te verkopen). Een lead verdwijnt zodra hij twee keer is
 * uitgedeeld.
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
  kandidaten: Kandidaat[];
}

interface WachtrijRij {
  id: string;
  lead_id: string;
  gepland_voor: string;
  status: string;
  reden: string | null;
  leads: { naam_klant: string | null; plaatsnaam: string | null; postcode: string | null; branch: string } | null;
  customers: { name: string } | null;
}

const MAX_KLANTEN_PER_LEAD = 3;

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
  const [lijst, setLijst] = useState<'kansrijk' | 'verlopen' | 'ingepland'>('kansrijk');
  const [wachtrij, setWachtrij] = useState<WachtrijRij[]>([]);
  const [wachtrijLaden, setWachtrijLaden] = useState(false);
  const [massaBezig, setMassaBezig] = useState(false);

  const [marge, setMarge] = useState('5');
  const [ruimeMarge, setRuimeMarge] = useState('10');
  const [droogNa, setDroogNa] = useState('7');

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
      const q = new URLSearchParams({ marge, ruime_marge: ruimeMarge, droog_na: droogNa });
      const res = await adminFetch(`/api/admin/restleads?${q.toString()}`);
      if (!res.ok) { setFout('Restleads konden niet worden berekend.'); return; }
      const d = await res.json();
      setKansrijk(d.kansrijk || []);
      setVerlopen(d.verlopen || []);
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
      const res = await adminFetch('/api/admin/restleads/ingepland');
      if (res.ok) {
        const d = await res.json();
        setWachtrij(d.rijen || []);
      }
    } finally {
      setWachtrijLaden(false);
    }
  }, []);

  useEffect(() => { laad(); }, [laad]);
  useEffect(() => { laadWachtrij(); }, [laadWachtrij]);

  /* In de stand 'ingepland' tonen we de wachtrij, niet deze lijst. */
  const bron = lijst === 'kansrijk' ? kansrijk : verlopen;

  const branches = useMemo(
    () => [...new Set([...kansrijk, ...verlopen].map(l => l.branch))].sort(),
    [kansrijk, verlopen],
  );

  const zichtbaar = useMemo(() => {
    const term = zoek.trim().toLowerCase();
    return bron.filter(l => {
      if (branche !== 'all' && l.branch !== branche) return false;
      if (alleenMetKandidaat && l.kandidaten.length === 0) return false;
      if (!term) return true;
      return (
        (l.naam_klant || '').toLowerCase().includes(term) ||
        (l.plaatsnaam || '').toLowerCase().includes(term) ||
        (l.postcode || '').toLowerCase().includes(term) ||
        (l.provincie || '').toLowerCase().includes(term)
      );
    });
  }, [bron, branche, zoek, alleenMetKandidaat]);

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
          ? `${d.gelukt} keer uitgedeeld${d.verdwijnt_uit_lijst ? ', lead verdwijnt uit de lijst' : ''}`
          : `${d.gelukt} gelukt, ${mislukt.length} niet: ${mislukt.map((u: { klant?: string; reden?: string }) => `${u.klant ?? '?'} (${u.reden})`).join(', ')}`,
      );
      laad();
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
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={laad} disabled={laden} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <ArrowPathIcon className={`h-4 w-4 ${laden ? 'animate-spin' : ''}`} /> Vernieuwen
          </button>
          {lijst !== 'ingepland' && (
            <button onClick={exporteer} disabled={zichtbaar.length === 0} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              <ArrowDownTrayIcon className="h-4 w-4" /> Export
            </button>
          )}
          {lijst !== 'ingepland' && (
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
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{melding}</div>
      )}
      {fout && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{fout}</div>
      )}

      {/* Lijstkeuze */}
      <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
        {([
          ['kansrijk', 'Nog kansrijk', kansrijk.length, 'laatste 7 dagen'],
          ['verlopen', 'Verlopen', verlopen.length, '7 tot 90 dagen'],
          ['ingepland', 'Ingepland', wachtrij.length, 'staat in de wachtrij'],
        ] as const).map(([waarde, label, aantal, hint]) => (
          <button
            key={waarde}
            onClick={() => setLijst(waarde)}
            title={hint}
            className={`flex min-h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition ${
              lijst === waarde ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
            <span className="text-xs text-slate-400">{aantal}</span>
          </button>
        ))}
      </div>

      {/* Instellingen en filters */}
      <div className={`flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 ${lijst === 'ingepland' ? 'hidden' : 'flex'}`}>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Marge</label>
          <div className="flex h-9 w-20 items-center rounded-lg border border-slate-200 px-2">
            <input value={marge} onChange={e => setMarge(e.target.value)} inputMode="numeric" className="w-full min-w-0 bg-transparent text-sm outline-none" />
            <span className="text-xs text-slate-400">km</span>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Ruime marge</label>
          <div className="flex h-9 w-20 items-center rounded-lg border border-slate-200 px-2">
            <input value={ruimeMarge} onChange={e => setRuimeMarge(e.target.value)} inputMode="numeric" className="w-full min-w-0 bg-transparent text-sm outline-none" />
            <span className="text-xs text-slate-400">km</span>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Droog na</label>
          <div className="flex h-9 w-20 items-center rounded-lg border border-slate-200 px-2">
            <input value={droogNa} onChange={e => setDroogNa(e.target.value)} inputMode="numeric" className="w-full min-w-0 bg-transparent text-sm outline-none" />
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

        <label className="flex h-9 cursor-pointer items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={alleenMetKandidaat} onChange={e => setAlleenMetKandidaat(e.target.checked)} className="h-4 w-4 accent-[#7c3aed]" />
          Alleen met kandidaat
        </label>

        <span className="ml-auto text-xs text-slate-400">{zichtbaar.length} leads</span>
      </div>

      {lijst === 'ingepland' ? (
        wachtrijLaden ? (
          <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>
        ) : wachtrij.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <ClockIcon className="mx-auto mb-3 h-10 w-10 text-slate-200" />
            <p className="font-medium text-slate-600">Niets ingepland</p>
            <p className="mt-1 text-sm text-slate-400">
              Leveringen die je spreidt over de cooldown van 12 uur komen hier te staan tot ze zijn uitgevoerd.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {wachtrij.map(r => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="w-28 shrink-0 text-xs font-semibold tabular-nums text-brand-purple">
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
                <button
                  onClick={() => annuleerLevering(r.id)}
                  title="Deze levering annuleren"
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
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
            {lijst === 'kansrijk' ? 'Alle verse leads zijn minstens twee keer uitgedeeld.' : 'Geen oudere leads met minder dan twee uitdelingen.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {zichtbaar.map(l => {
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
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPinIcon className="h-3 w-3" />
                        {[l.postcode, l.plaatsnaam].filter(Boolean).join(' ') || '-'}
                      </span>
                      <span>{l.provincie}</span>
                      <span>{l.branch}</span>
                      <span className="text-slate-400">
                        {datum(l.wervingsdatum || l.created_at)} · {l.dagen_oud} {l.dagen_oud === 1 ? 'dag' : 'dagen'} oud
                      </span>
                    </p>
                  </div>
                </div>

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
        </div>
      )}
    </div>
  );
}
