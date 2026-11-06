'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowPathIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import type { Bestemming, CampagneRij, Signaal } from '@/lib/campagneEffectiviteit';

/**
 * Effectiviteit van de Meta-campagnes: hoeveel leads Meta telt, hoeveel er
 * binnenkomen en waar ze heen gaan (naar de gekoppelde klant, andere klanten,
 * Extra leads of nergens). Alleen superadmin.
 */

type Rij = CampagneRij & { signalen: Signaal[] };
type Antwoord = { van: string; tot: string; geschiedenis_sinds: string; campagnes: Rij[] };

const EURO = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const EURO2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PERIODES = [7, 30, 90] as const;

const KOLOMMEN: { b: Bestemming; label: string; uitleg: string }[] = [
  { b: 'gekoppeld', label: 'Gekoppelde klant', uitleg: 'Naar een batch waaraan deze campagne gekoppeld was toen de lead binnenkwam' },
  { b: 'andere_klant', label: 'Andere klanten', uitleg: 'Alleen naar andere betalende klanten' },
  { b: 'extra_leads', label: 'Extra leads', uitleg: 'Door een klant gekocht via Extra leads' },
  { b: 'intern', label: 'Intern / afspraken', uitleg: 'Alleen naar een interne klant of afspraakpartner' },
  { b: 'wacht', label: 'In wachtrij', uitleg: 'Staat ingepland voor een klant' },
  { b: 'te_koop', label: 'Nu te koop', uitleg: 'Zonder klant, staat in Extra leads' },
  { b: 'verloren', label: 'Verloren', uitleg: 'Zonder klant en te oud of een ongeldig nummer' },
];

type Sorteer = 'uitgaven' | 'binnen' | 'gekoppeld_pct' | 'kosten_per_gekoppelde_lead' | 'verloren';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const datum = (s: string) => new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });

export default function CampagnesPage() {
  const [dagen, setDagen] = useState<number>(30);
  const [data, setData] = useState<Antwoord | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [alleenGekoppeld, setAlleenGekoppeld] = useState(false);
  const [sorteer, setSorteer] = useState<Sorteer>('uitgaven');
  const [open, setOpen] = useState<string | null>(null);

  const laad = useCallback(async () => {
    setLaden(true);
    setFout(null);
    const tot = new Date();
    const van = new Date(tot);
    van.setUTCDate(van.getUTCDate() - (dagen - 1));
    try {
      const r = await adminFetch(`/api/admin/campagnes?van=${iso(van)}&tot=${iso(tot)}`, { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setFout(d.error || 'Laden mislukt');
      else setData(d);
    } catch {
      setFout('Laden mislukt');
    } finally {
      setLaden(false);
    }
  }, [dagen]);

  useEffect(() => { void laad(); }, [laad]);

  const rijen = useMemo(() => {
    const r = (data?.campagnes ?? []).filter(c => !alleenGekoppeld || c.gekoppeld_aan.length > 0);
    const waarde = (c: Rij): number => {
      if (sorteer === 'verloren') return c.binnen ? (c.per_bestemming.verloren + c.per_bestemming.te_koop) / c.binnen : -1;
      if (sorteer === 'binnen') return c.binnen;
      if (sorteer === 'gekoppeld_pct') return c.gekoppeld_pct ?? 999;
      if (sorteer === 'kosten_per_gekoppelde_lead') return c.kosten_per_gekoppelde_lead ?? -1;
      return c.uitgaven;
    };
    const oplopend = sorteer === 'gekoppeld_pct';
    return [...r].sort((a, b) => (oplopend ? waarde(a) - waarde(b) : waarde(b) - waarde(a)));
  }, [data, alleenGekoppeld, sorteer]);

  const totaal = useMemo(() => {
    const t = { uitgaven: 0, meta: 0, binnen: 0, per: Object.fromEntries(KOLOMMEN.map(k => [k.b, 0])) as Record<Bestemming, number> };
    for (const c of rijen) {
      t.uitgaven += c.uitgaven; t.meta += c.meta_leads; t.binnen += c.binnen;
      for (const k of KOLOMMEN) t.per[k.b] += c.per_bestemming[k.b];
    }
    return t;
  }, [rijen]);

  const kop = (label: string, s?: Sorteer, uitleg?: string) => (
    <th className="whitespace-nowrap px-3 py-2 text-right font-medium" title={uitleg}>
      {s ? (
        <button onClick={() => setSorteer(s)} className={`hover:text-brand-purple ${sorteer === s ? 'text-brand-purple' : ''}`}>{label}{sorteer === s ? ' ↓' : ''}</button>
      ) : label}
    </th>
  );

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Campagnes</h1>
          <p className="mt-0.5 text-sm text-slate-500">Hoeveel leads elke Meta-campagne oplevert en waar ze terechtkomen.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm font-medium">
            {PERIODES.map(p => (
              <button key={p} onClick={() => setDagen(p)} className={`rounded-lg px-3 py-1.5 ${dagen === p ? 'bg-white text-brand-purple shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {p} dagen
              </button>
            ))}
          </div>
          <label className="flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600">
            <input type="checkbox" checked={alleenGekoppeld} onChange={e => setAlleenGekoppeld(e.target.checked)} /> Alleen gekoppeld
          </label>
          <button onClick={() => void laad()} disabled={laden} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <ArrowPathIcon className={`h-4 w-4 ${laden ? 'animate-spin' : ''}`} /> Verversen
          </button>
        </div>
      </div>

      {data && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Uitgaven', EURO.format(totaal.uitgaven)],
            ['Leads volgens Meta', totaal.meta.toLocaleString('nl-NL')],
            ['Binnengekomen', `${totaal.binnen.toLocaleString('nl-NL')}${totaal.meta ? ` (${Math.round((totaal.binnen / totaal.meta) * 100)}%)` : ''}`],
            ['Naar de gekoppelde klant', `${totaal.per.gekoppeld.toLocaleString('nl-NL')}${totaal.binnen ? ` (${Math.round((totaal.per.gekoppeld / totaal.binnen) * 100)}%)` : ''}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-500">{k}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{v}</p>
            </div>
          ))}
        </div>
      )}

      <p className="mb-3 text-xs text-slate-500">
        Een lead telt als &ldquo;gekoppelde klant&rdquo; als de campagne aan die batch hing op het moment dat de lead binnenkwam.
        Koppelingen worden bijgehouden sinds {data ? new Date(data.geschiedenis_sinds).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : '6 november 2026'};
        daarvoor gaan we uit van de koppeling van toen en vanaf het aanmaken van de batch (aangegeven met &ldquo;geschat&rdquo;).
        Meta telt ook dubbele aanvragen; een verschil van 10 tot 15% tussen Meta en binnengekomen is normaal.
      </p>

      {fout && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{fout}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Campagne</th>
              {kop('Uitgaven', 'uitgaven')}
              {kop('Meta')}
              {kop('Binnen', 'binnen')}
              {KOLOMMEN.map(k => (
                <Fragment key={k.b}>{kop(k.label, k.b === 'gekoppeld' ? 'gekoppeld_pct' : k.b === 'verloren' ? 'verloren' : undefined, k.uitleg)}</Fragment>
              ))}
              {kop('€ per lead bij klant', 'kosten_per_gekoppelde_lead', 'Uitgaven gedeeld door de leads die naar de gekoppelde klant gingen')}
            </tr>
          </thead>
          <tbody>
            {laden && !data ? (
              <tr><td colSpan={12} className="p-6 text-center text-slate-400">Laden…</td></tr>
            ) : rijen.length === 0 ? (
              <tr><td colSpan={12} className="p-6 text-center text-slate-400">Geen campagnes in deze periode.</td></tr>
            ) : rijen.map(c => {
              const isOpen = open === c.campaign_id;
              return (
                <Fragment key={c.campaign_id}>
                  <tr className="cursor-pointer border-t border-slate-100 align-top hover:bg-slate-50/60" onClick={() => setOpen(isOpen ? null : c.campaign_id)}>
                    <td className="max-w-[320px] px-3 py-2.5">
                      <div className="flex items-start gap-1.5">
                        {isOpen ? <ChevronDownIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRightIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900" title={c.naam}>{c.naam}</p>
                          <p className="truncate text-xs text-slate-500">
                            {c.gekoppeld_aan.length > 0
                              ? [...new Set(c.gekoppeld_aan.map(g => g.klant))].join(', ')
                              : 'Niet gekoppeld'}
                            {c.geschat && <span className="ml-1 text-slate-400">(geschat)</span>}
                          </p>
                          {c.signalen.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {c.signalen.map(s => (
                                <span key={s.tekst} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${s.soort === 'rood' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{s.tekst}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{EURO.format(c.uitgaven)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{c.meta_leads}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{c.binnen}{c.binnen_pct !== null && <span className="block text-[11px] text-slate-400">{c.binnen_pct.toLocaleString('nl-NL')}%</span>}</td>
                    {KOLOMMEN.map(k => {
                      const n = c.per_bestemming[k.b];
                      return (
                        <td key={k.b} className={`px-3 py-2.5 text-right tabular-nums ${n === 0 ? 'text-slate-300' : k.b === 'gekoppeld' ? 'font-semibold text-slate-900' : ''}`}>
                          {k.b === 'gekoppeld' && c.gekoppeld_aan.length === 0 ? '–' : n}
                          {n > 0 && c.binnen > 0 && <span className="block text-[11px] font-normal text-slate-400">{Math.round((n / c.binnen) * 100)}%</span>}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-right tabular-nums">{c.kosten_per_gekoppelde_lead !== null ? EURO2.format(c.kosten_per_gekoppelde_lead) : '–'}
                      {c.kosten_per_lead !== null && <span className="block text-[11px] text-slate-400">{EURO2.format(c.kosten_per_lead)} per binnengekomen lead</span>}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-t border-slate-100 bg-slate-50/50">
                      <td colSpan={12} className="px-4 py-3">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <p className="mb-1.5 text-xs font-semibold text-slate-700">Gekoppeld aan</p>
                            {c.gekoppeld_aan.length === 0 ? <p className="text-xs text-slate-500">In deze periode aan geen enkele batch gekoppeld.</p> : (
                              <ul className="space-y-1 text-xs text-slate-600">
                                {c.gekoppeld_aan.map(g => (
                                  <li key={`${g.batch_id}-${g.van}`}>
                                    <span className="font-medium text-slate-800">{g.klant}</span>: {g.geschat ? 'sinds aanmaken batch (geschat)' : `vanaf ${datum(g.van)}`}{g.tot ? ` tot ${datum(g.tot)}` : ', nog gekoppeld'}
                                  </li>
                                ))}
                              </ul>
                            )}
                            <p className="mt-3 text-xs text-slate-500">
                              {c.leveringen} leveringen voor {c.binnen} leads{c.binnen ? ` (gemiddeld ${(c.leveringen / c.binnen).toLocaleString('nl-NL', { maximumFractionDigits: 2 })} klanten per lead)` : ''}.
                              {c.gekoppeld_ook_elders > 0 && ` ${c.gekoppeld_ook_elders} leads van de gekoppelde klant gingen ook naar een andere klant.`}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400">Campagne-id {c.campaign_id}</p>
                          </div>
                          <div>
                            <p className="mb-1.5 text-xs font-semibold text-slate-700">Leads per klant</p>
                            {c.per_klant.length === 0 ? <p className="text-xs text-slate-500">Nog geen leads geleverd.</p> : (
                              <ul className="space-y-0.5 text-xs text-slate-600">
                                {c.per_klant.slice(0, 15).map(k => (
                                  <li key={k.klant} className="flex justify-between gap-3">
                                    <span className={k.gekoppeld ? 'font-medium text-brand-purple' : ''}>{k.klant}{k.gekoppeld ? ' (gekoppeld)' : ''}</span>
                                    <span className="tabular-nums">{k.leads}</span>
                                  </li>
                                ))}
                                {c.per_klant.length > 15 && <li className="text-slate-400">en nog {c.per_klant.length - 15} klanten</li>}
                              </ul>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
