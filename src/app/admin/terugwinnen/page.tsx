'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowPathIcon, ArrowUturnLeftIcon, EnvelopeIcon, ExclamationTriangleIcon, PhoneIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

/**
 * Klanten terugwinnen: wie ooit betaalde en nu niets meer lopen heeft. Met
 * alles om gericht te bellen, en per klant de opvolging (wie belde wanneer,
 * wat is afgesproken, wanneer terugbellen).
 */

type Opvolging = { status: Status; notitie: string | null; terugbellen_op: string | null; admin_naam: string | null; created_at: string };
type Status = 'gebeld' | 'terugbellen' | 'offerte' | 'niet_bereikbaar' | 'geen_interesse';
type Segment = 'net_klaar' | 'stil' | 'slapend';
type Rij = {
  customer_id: string; klant: string; actief_account: boolean; plaats: string | null;
  contactpersoon: string | null; email: string | null; telefoon: string | null; accountmanager: string | null;
  segment: Segment; dagen_stil: number; laatste_activiteit: string;
  laatste_batch: { id: string; soort: 'leads' | 'afspraken'; branche: string; grootte: number; geleverd: number; prijs_per_stuk: number | null; totaal: number | null; status: string };
  branches: string[]; betaalde_batches: number; omzet: number; geleverd_totaal: number;
  reclamaties: number; reclamatie_pct: number | null; laatste_login: string | null;
  openstaande_bestelling: boolean; mails: { type: string; op: string }[]; aantal_mails: number;
  opvolging: Opvolging | null; aantal_contactmomenten: number;
};

const STATUS: Record<Status, [string, string]> = {
  gebeld: ['Gebeld', 'bg-sky-50 text-sky-700'],
  terugbellen: ['Terugbellen', 'bg-amber-50 text-amber-700'],
  offerte: ['Offerte gestuurd', 'bg-violet-50 text-violet-700'],
  niet_bereikbaar: ['Niet bereikbaar', 'bg-slate-100 text-slate-600'],
  geen_interesse: ['Geen interesse', 'bg-red-50 text-red-700'],
};
const SEGMENT: Record<Segment, string> = { net_klaar: 'Net klaar (< 14 dagen)', stil: '14 – 60 dagen', slapend: 'Langer dan 60 dagen' };
const MAIL: Record<string, string> = { batch_80pct: '80% vol', batch_completed: 'batch vol', batch_reminder: 'herinnering' };

const EURO = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const EURO2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const datum = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: '2-digit' }) : '—');
const vandaagIso = () => new Date().toISOString().slice(0, 10);

type Weergave = 'alle' | Segment | 'terugbellen';
type Sortering = 'omzet' | 'stil' | 'kort_stil';

function ContactForm({ rij, onOpgeslagen }: { rij: Rij; onOpgeslagen: () => void }) {
  const [status, setStatus] = useState<Status>('gebeld');
  const [notitie, setNotitie] = useState('');
  const [terugbellen, setTerugbellen] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const opslaan = async () => {
    setBezig(true);
    setFout(null);
    try {
      const res = await adminFetch('/api/admin/terugwinnen', {
        method: 'POST',
        body: JSON.stringify({ customer_id: rij.customer_id, status, notitie, terugbellen_op: terugbellen || null }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setFout(d.error ?? 'Opslaan mislukt'); return; }
      setNotitie('');
      setTerugbellen('');
      onOpgeslagen();
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="mb-2 text-xs font-semibold text-slate-600">Contactmoment vastleggen</p>
      <div className="grid gap-2 sm:grid-cols-[180px_160px_minmax(0,1fr)_auto] sm:items-end">
        <label className="text-xs text-slate-500">Uitkomst
          <select value={status} onChange={e => setStatus(e.target.value as Status)} className="mt-0.5 block h-9 w-full rounded-lg border border-slate-200 px-2 text-sm">
            {(Object.keys(STATUS) as Status[]).map(s => <option key={s} value={s}>{STATUS[s][0]}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500">Terugbellen op{status === 'terugbellen' ? ' *' : ''}
          <input type="date" min={vandaagIso()} value={terugbellen} onChange={e => setTerugbellen(e.target.value)} className="mt-0.5 block h-9 w-full rounded-lg border border-slate-200 px-2 text-sm" />
        </label>
        <label className="text-xs text-slate-500">Notitie
          <input value={notitie} onChange={e => setNotitie(e.target.value)} maxLength={2000} placeholder="Wat is er besproken?" className="mt-0.5 block h-9 w-full rounded-lg border border-slate-200 px-2 text-sm" />
        </label>
        <button onClick={() => void opslaan()} disabled={bezig} className="h-9 rounded-lg bg-brand-purple px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {bezig ? 'Opslaan...' : 'Opslaan'}
        </button>
      </div>
      {fout && <p className="mt-1.5 text-xs text-red-600">{fout}</p>}
    </div>
  );
}

export default function TerugwinnenPage() {
  const [rijen, setRijen] = useState<Rij[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [weergave, setWeergave] = useState<Weergave>('alle');
  const [zoek, setZoek] = useState('');
  const [branche, setBranche] = useState('');
  const [am, setAm] = useState('');
  const [opv, setOpv] = useState<'' | 'geen' | Status>('');
  const [sortering, setSortering] = useState<Sortering>('omzet');
  const [open, setOpen] = useState<string | null>(null);

  const laad = useCallback(async () => {
    setLaden(true);
    setFout(null);
    try {
      const res = await adminFetch('/api/admin/terugwinnen', { cache: 'no-store' });
      const d = (await res.json().catch(() => ({}))) as { rijen?: Rij[]; error?: string };
      if (!res.ok) { setFout(d.error ?? 'Laden mislukt'); return; }
      setRijen(d.rijen ?? []);
    } finally {
      setLaden(false);
    }
  }, []);
  useEffect(() => { void laad(); }, [laad]);

  const vandaag = vandaagIso();
  const teBellen = (r: Rij) => r.opvolging?.status === 'terugbellen' && !!r.opvolging.terugbellen_op && r.opvolging.terugbellen_op <= vandaag;

  const branches = useMemo(() => [...new Set(rijen.flatMap(r => r.branches))].sort(), [rijen]);
  const ams = useMemo(() => [...new Set(rijen.map(r => r.accountmanager).filter(Boolean) as string[])].sort(), [rijen]);

  const zichtbaar = useMemo(() => {
    const z = zoek.trim().toLowerCase();
    const lijst = rijen.filter(r =>
      (weergave === 'alle' || (weergave === 'terugbellen' ? teBellen(r) : r.segment === weergave)) &&
      (!z || r.klant.toLowerCase().includes(z) || (r.contactpersoon ?? '').toLowerCase().includes(z) || (r.plaats ?? '').toLowerCase().includes(z)) &&
      (!branche || r.branches.includes(branche)) &&
      (!am || r.accountmanager === am) &&
      (!opv || (opv === 'geen' ? !r.opvolging : r.opvolging?.status === opv)),
    );
    return lijst.sort((a, b) =>
      sortering === 'omzet' ? b.omzet - a.omzet : sortering === 'stil' ? b.dagen_stil - a.dagen_stil : a.dagen_stil - b.dagen_stil);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rijen, weergave, zoek, branche, am, opv, sortering, vandaag]);

  const telling = useMemo(() => ({
    alle: rijen.length,
    net_klaar: rijen.filter(r => r.segment === 'net_klaar').length,
    stil: rijen.filter(r => r.segment === 'stil').length,
    slapend: rijen.filter(r => r.segment === 'slapend').length,
    terugbellen: rijen.filter(teBellen).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [rijen, vandaag]);

  const omzetSelectie = zichtbaar.reduce((s, r) => s + r.omzet, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
            <ArrowUturnLeftIcon className="h-6 w-6 text-brand-purple" /> Klanten terugwinnen
          </h1>
          <p className="mt-0.5 max-w-3xl text-sm text-slate-500">
            Klanten die eerder betaalden en nu geen lopende batch hebben. Bel ze gericht, leg vast wat er besproken is en plan het terugbellen.
            Een klant verdwijnt vanzelf van de lijst zodra hij weer een batch heeft.
          </p>
        </div>
        <button onClick={() => void laad()} disabled={laden} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <ArrowPathIcon className={`h-4 w-4 ${laden ? 'animate-spin' : ''}`} /> Vernieuwen
        </button>
      </div>

      <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
        {([
          ['alle', 'Alle'], ['net_klaar', SEGMENT.net_klaar], ['stil', SEGMENT.stil], ['slapend', SEGMENT.slapend], ['terugbellen', 'Vandaag terugbellen'],
        ] as [Weergave, string][]).map(([w, label]) => (
          <button key={w} onClick={() => setWeergave(w)}
            className={`flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold transition ${weergave === w ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
            <span className={`text-xs ${w === 'terugbellen' && telling.terugbellen > 0 ? 'font-bold text-amber-600' : 'text-slate-400'}`}>{telling[w]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <input value={zoek} onChange={e => setZoek(e.target.value)} placeholder="Zoek klant, contactpersoon of plaats…" className="h-9 w-64 max-w-full rounded-lg border border-slate-200 px-2 text-sm" />
        <select value={branche} onChange={e => setBranche(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm">
          <option value="">Alle branches</option>
          {branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        {ams.length > 1 && (
          <select value={am} onChange={e => setAm(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm">
            <option value="">Alle accountmanagers</option>
            {ams.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        <select value={opv} onChange={e => setOpv(e.target.value as typeof opv)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm">
          <option value="">Elke opvolging</option>
          <option value="geen">Nog niet benaderd</option>
          {(Object.keys(STATUS) as Status[]).map(s => <option key={s} value={s}>{STATUS[s][0]}</option>)}
        </select>
        <select value={sortering} onChange={e => setSortering(e.target.value as Sortering)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm">
          <option value="omzet">Hoogste omzet eerst</option>
          <option value="kort_stil">Kortst stil eerst</option>
          <option value="stil">Langst stil eerst</option>
        </select>
        <span className="ml-auto text-xs text-slate-400">{zichtbaar.length} klanten · samen {EURO.format(omzetSelectie)} eerdere omzet</span>
      </div>

      {fout && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{fout}</div>}

      {laden && rijen.length === 0 ? (
        <div className="space-y-2">{[0, 1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}</div>
      ) : zichtbaar.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-14 text-center">
          <ArrowUturnLeftIcon className="mx-auto mb-3 h-10 w-10 text-slate-200" />
          <p className="font-medium text-slate-600">Niemand in deze selectie</p>
          <p className="mt-1 text-sm text-slate-400">{weergave === 'terugbellen' ? 'Er staat vandaag niemand op de terugbellijst.' : 'Kies een andere selectie of zet een filter uit.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {zichtbaar.map(r => {
            const isOpen = open === r.customer_id;
            const lb = r.laatste_batch;
            const o = r.opvolging;
            return (
              <div key={r.customer_id} className={`rounded-xl border bg-white shadow-sm ${teBellen(r) ? 'border-amber-300' : 'border-slate-200'}`}>
                <button onClick={() => setOpen(isOpen ? null : r.customer_id)} className="grid w-full gap-x-4 gap-y-2 p-4 text-left sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">
                      {r.klant}
                      {!r.actief_account && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">account inactief</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">{[r.contactpersoon, r.plaats].filter(Boolean).join(' · ') || '—'}</p>
                    <p className="text-xs text-slate-400">AM: {r.accountmanager ?? 'geen'}</p>
                  </div>
                  <div className="min-w-0 text-xs text-slate-600">
                    <p className="font-medium text-slate-700">{lb.branche}{lb.soort === 'afspraken' ? ' (afspraken)' : ''}</p>
                    <p>{lb.geleverd}/{lb.grootte} geleverd · {lb.prijs_per_stuk != null ? EURO2.format(lb.prijs_per_stuk) : '—'} per stuk</p>
                    <p className="text-slate-400">{r.betaalde_batches} betaalde batch{r.betaalde_batches === 1 ? '' : 'es'} · {EURO.format(r.omzet)} totaal</p>
                  </div>
                  <div className="text-xs">
                    <p className={`text-base font-bold tabular-nums ${r.segment === 'slapend' ? 'text-red-600' : r.segment === 'stil' ? 'text-amber-600' : 'text-emerald-600'}`}>{r.dagen_stil} dagen</p>
                    <p className="text-slate-400">stil sinds {datum(r.laatste_activiteit)}</p>
                  </div>
                  <div className="min-w-0 text-xs">
                    {o ? (
                      <>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[o.status][1]}`}>{STATUS[o.status][0]}</span>
                        {o.status === 'terugbellen' && o.terugbellen_op && (
                          <span className={`ml-1.5 ${teBellen(r) ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>op {datum(o.terugbellen_op)}</span>
                        )}
                        <p className="mt-1 truncate text-slate-500" title={o.notitie ?? ''}>{o.notitie ?? ''}</p>
                        <p className="text-slate-400">{o.admin_naam ?? '—'}, {datum(o.created_at)}</p>
                      </>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Nog niet benaderd</span>
                    )}
                    {r.openstaande_bestelling && <p className="mt-1 font-medium text-emerald-700">Heeft al nabesteld, nog niet betaald</p>}
                  </div>
                </button>

                {isOpen && (
                  <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 p-4">
                    <div className="flex flex-wrap gap-2">
                      {r.telefoon && (
                        <a href={`tel:${r.telefoon}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                          <PhoneIcon className="h-4 w-4" /> {r.telefoon}
                        </a>
                      )}
                      {r.email && (
                        <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                          <EnvelopeIcon className="h-4 w-4" /> {r.email}
                        </a>
                      )}
                      <Link href={`/admin/customers?open=${r.customer_id}`} className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        Klant openen
                      </Link>
                    </div>
                    <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                      <p>Branches: <strong>{r.branches.join(', ') || '—'}</strong></p>
                      <p>Laatste login portaal: <strong>{datum(r.laatste_login)}</strong></p>
                      <p>
                        Reclamaties: <strong>{r.reclamaties}</strong>
                        {r.reclamatie_pct != null && <span className={r.reclamatie_pct >= 10 ? 'font-semibold text-red-600' : ''}> ({r.reclamatie_pct.toLocaleString('nl-NL')}% van {r.geleverd_totaal})</span>}
                        {r.reclamatie_pct != null && r.reclamatie_pct >= 10 && <ExclamationTriangleIcon className="ml-1 inline h-3.5 w-3.5 text-red-500" />}
                      </p>
                      <p>
                        Herinneringsmails (180 dgn): <strong>{r.aantal_mails}</strong>
                        {r.mails[0] && <span className="text-slate-400"> · laatst {MAIL[r.mails[0].type] ?? r.mails[0].type} {datum(r.mails[0].op)}</span>}
                      </p>
                      <p>Laatste batch: <strong>{lb.totaal != null ? EURO.format(lb.totaal) : '—'}</strong> ({lb.status === 'completed' ? 'afgerond' : lb.status})</p>
                      <p>Contactmomenten: <strong>{r.aantal_contactmomenten}</strong></p>
                    </div>
                    <ContactForm rij={r} onOpgeslagen={() => void laad()} />
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
