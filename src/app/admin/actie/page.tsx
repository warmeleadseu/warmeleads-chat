'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, TicketIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

/**
 * Najaarsactie: wie doet mee met hoeveel loten, welke batches leverden
 * loten op en of de mail is verstuurd, en na afloop de trekking.
 */

type Deelnemer = {
  customer_id: string; klant: string; email: string | null;
  batchLoten: number; batches: number; bulkLeads: number; bulkLoten: number; totaal: number;
};
type Lot = {
  id: string; customer_id: string; batch_id: string; batch_size: number; loten: number; betaald_op: string;
  mail_verstuurd_op: string | null; mail_pogingen: number; mail_fout: string | null;
  vervallen_op: string | null; vervallen_reden: string | null; klant: string; branch: string;
};
type Trekking = {
  lotnummer: number; totaal_loten: number; getrokken_op: string; getrokken_door_naam: string | null;
  deelnemers: { customer_id: string; klant: string; loten: number }[];
  winnaar: { klant: string; email: string | null } | null;
};
type Antwoord = {
  actie: { naam: string; startLabel: string; eindLabel: string; prijsLeads: number; leadsPerLot: number; bulkPerLot: number; fase: 'voor' | 'loopt' | 'afgelopen' };
  deelnemers: Deelnemer[];
  loten: Lot[];
  trekking: Trekking | null;
  error?: string;
};

const NUM = new Intl.NumberFormat('nl-NL');
const PCT = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 });
const moment = (iso: string) =>
  new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });

function Kpi({ label, waarde, sub }: { label: string; waarde: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{waarde}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function MailStatus({ l }: { l: Lot }) {
  if (l.vervallen_op) return <span className="text-slate-400">vervallen{l.vervallen_reden ? ` (${l.vervallen_reden})` : ''}</span>;
  if (l.mail_verstuurd_op) return <span className="text-emerald-700">verstuurd {moment(l.mail_verstuurd_op)}</span>;
  if (l.mail_fout) return <span className="text-red-600">{l.mail_fout}{l.mail_pogingen >= 3 ? ' (gestopt)' : ''}</span>;
  return <span className="text-amber-700">volgt binnen 10 minuten</span>;
}

export default function ActiePagina() {
  const [data, setData] = useState<Antwoord | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [trekken, setTrekken] = useState(false);

  const laad = useCallback(async () => {
    setLaden(true);
    setFout(null);
    try {
      const res = await adminFetch('/api/admin/actie');
      const json = (await res.json()) as Antwoord;
      if (!res.ok) throw new Error(json.error || 'Laden mislukt');
      setData(json);
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Laden mislukt');
    } finally {
      setLaden(false);
    }
  }, []);

  useEffect(() => { void laad(); }, [laad]);

  const trek = async () => {
    if (!data) return;
    const totaal = data.deelnemers.reduce((s, d) => s + d.totaal, 0);
    if (!window.confirm(`De winnaar trekken uit ${NUM.format(totaal)} loten van ${data.deelnemers.length} deelnemers? Dit kan maar één keer en is niet terug te draaien.`)) return;
    setTrekken(true);
    setFout(null);
    try {
      const res = await adminFetch('/api/admin/actie', { method: 'POST', body: JSON.stringify({ actie: 'trek' }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Trekking mislukt');
      await laad();
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Trekking mislukt');
    } finally {
      setTrekken(false);
    }
  };

  const a = data?.actie;
  const deelnemers = data?.deelnemers ?? [];
  const totaal = deelnemers.reduce((s, d) => s + d.totaal, 0);
  const geldig = (data?.loten ?? []).filter(l => !l.vervallen_op);
  const verstuurd = geldig.filter(l => l.mail_verstuurd_op).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
            <TicketIcon className="h-6 w-6 text-orange-500" /> {a?.naam ?? 'Actie'}
          </h1>
          {a && (
            <p className="mt-0.5 max-w-3xl text-sm text-slate-500">
              {a.startLabel} tot en met {a.eindLabel}. Per {a.leadsPerLot} leads in een betaalde batch 1 lot, per {a.bulkPerLot} bulkleads 1 lot.
              Na afloop wint één klant {a.prijsLeads} gratis leads.
            </p>
          )}
        </div>
        <button
          onClick={() => void laad()}
          disabled={laden}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${laden ? 'animate-spin' : ''}`} /> Vernieuwen
        </button>
      </div>

      <div className="flex gap-2 rounded-xl border border-sky-100 bg-sky-50/60 p-3 text-xs leading-relaxed text-sky-900">
        <InformationCircleIcon className="h-4 w-4 shrink-0 text-sky-600" />
        <p>
          Elke 10 minuten zoekt het systeem nieuw betaalde leadbatches op en stuurt de klant een mail met zijn loten. Bulkleads tellen mee in de pot,
          maar daarvoor gaat geen mail uit. Afsprakenbatches, gratis batches en interne of demo-klanten doen niet mee. Wordt een batch gecrediteerd,
          dan vervallen de loten.
        </p>
      </div>

      {fout && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0" /> {fout}
        </div>
      )}

      {laden && !data ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Laden…</div>
      ) : data && a ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Deelnemers" waarde={NUM.format(deelnemers.filter(d => d.totaal > 0).length)} />
            <Kpi label="Loten in de pot" waarde={NUM.format(totaal)} sub={`${NUM.format(deelnemers.reduce((s, d) => s + d.bulkLoten, 0))} uit bulk`} />
            <Kpi label="Batches met loten" waarde={NUM.format(geldig.length)} />
            <Kpi label="Mails verstuurd" waarde={`${NUM.format(verstuurd)} / ${NUM.format(geldig.length)}`} />
          </div>

          {/* Trekking */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <TrophyIcon className="h-5 w-5 text-amber-500" /> Trekking
            </h2>
            {data.trekking ? (
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                <p className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600" /> Winnaar: {data.trekking.winnaar?.klant}
                </p>
                <p>
                  Getrokken op {moment(data.trekking.getrokken_op)}{data.trekking.getrokken_door_naam ? ` door ${data.trekking.getrokken_door_naam}` : ''}:
                  lot {NUM.format(data.trekking.lotnummer + 1)} van {NUM.format(data.trekking.totaal_loten)}, uit {data.trekking.deelnemers.length} deelnemers.
                </p>
                <p className="text-xs text-slate-500">
                  Bel de winnaar en zet de {a.prijsLeads} gratis leads klaar als gratis batch in de eigen branche en het eigen gebied.
                  {data.trekking.winnaar?.email ? ` E-mail: ${data.trekking.winnaar.email}.` : ''}
                </p>
              </div>
            ) : a.fase === 'afgelopen' ? (
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-700">
                  De actie is afgelopen. Elk lot heeft evenveel kans; de trekking gebeurt met cryptografisch toeval en wordt met de volledige deelnemerslijst vastgelegd.
                </p>
                <button
                  onClick={() => void trek()}
                  disabled={trekken || totaal === 0}
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  <TrophyIcon className="h-4 w-4" /> {trekken ? 'Bezig…' : 'Trek de winnaar'}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">De trekking kan na {a.eindLabel}. Tot die tijd komen er loten bij.</p>
            )}
          </div>

          {/* Deelnemers */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-xs text-slate-500">
                  <th className="px-3 py-2.5 text-left font-medium">Klant</th>
                  <th className="px-3 py-2.5 text-right font-medium">Batches</th>
                  <th className="px-3 py-2.5 text-right font-medium">Loten uit batches</th>
                  <th className="px-3 py-2.5 text-right font-medium">Bulkleads</th>
                  <th className="px-3 py-2.5 text-right font-medium">Loten uit bulk</th>
                  <th className="px-3 py-2.5 text-right font-medium">Totaal</th>
                  <th className="px-3 py-2.5 text-right font-medium">Kans</th>
                </tr>
              </thead>
              <tbody>
                {deelnemers.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Nog geen deelnemers</td></tr>
                ) : deelnemers.map(d => (
                  <tr key={d.customer_id} className="border-t border-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">{d.klant}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{d.batches || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{d.batchLoten || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{d.bulkLeads ? NUM.format(d.bulkLeads) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{d.bulkLoten || '—'}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-900">{d.totaal}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{totaal > 0 ? `${PCT.format((d.totaal / totaal) * 100)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Loten per batch */}
          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Loten per batch</h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-xs text-slate-500">
                    <th className="px-3 py-2.5 text-left font-medium">Betaald</th>
                    <th className="px-3 py-2.5 text-left font-medium">Klant</th>
                    <th className="px-3 py-2.5 text-left font-medium">Branche</th>
                    <th className="px-3 py-2.5 text-right font-medium">Leads</th>
                    <th className="px-3 py-2.5 text-right font-medium">Loten</th>
                    <th className="px-3 py-2.5 text-left font-medium">Mail</th>
                  </tr>
                </thead>
                <tbody>
                  {data.loten.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">Nog geen betaalde batches in de actie</td></tr>
                  ) : [...data.loten].reverse().map(l => (
                    <tr key={l.id} className={`border-t border-slate-50 ${l.vervallen_op ? 'opacity-60' : ''}`}>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">{moment(l.betaald_op)}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{l.klant}</td>
                      <td className="px-3 py-2 text-slate-600">{l.branch}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">{l.batch_size}</td>
                      <td className={`px-3 py-2 text-right font-bold tabular-nums ${l.vervallen_op ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{l.loten}</td>
                      <td className="px-3 py-2 text-xs"><MailStatus l={l} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
