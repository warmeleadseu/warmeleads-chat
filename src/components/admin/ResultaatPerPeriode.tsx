'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDownIcon, PlusIcon, TrashIcon, UsersIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { useAdminConfirm } from '@/components/admin/ui/AdminConfirmProvider';
import type { PeriodeResultaat, PeriodeSoort } from '@/lib/resultaatPerPeriode';

/**
 * Resultaat per periode op de winstpagina (alleen superadmin): verdiende
 * omzet, advertentiekosten, personeelskosten en het nettoresultaat.
 */

type Personeel = { id: string; omschrijving: string; bedrag_per_maand: number | string; ingang: string; einde: string | null };
type Antwoord = { soort: PeriodeSoort; start: string; vandaag: string; perioden: PeriodeResultaat[]; personeel: Personeel[]; error?: string };

const EURO = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const EURO2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur = (n: number | null | undefined) => (n == null ? '—' : EURO.format(n));
const eur2 = (n: number | null | undefined) => (n == null ? '—' : EURO2.format(n));
const pct = (n: number | null | undefined) => (n == null ? '—' : `${String(n).replace('.', ',')}%`);
const kleur = (n: number) => (n > 0 ? 'text-emerald-600' : n < 0 ? 'text-red-600' : 'text-slate-600');
const datumKort = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
function label(p: PeriodeResultaat, soort: PeriodeSoort): string {
  if (soort === 'maand') { const [j, m] = p.sleutel.split('-').map(Number); return `${MAANDEN[m - 1]} ${j}`; }
  if (soort === 'kwartaal') return p.sleutel.replace('-K', ' K');
  if (soort === 'jaar') return p.sleutel;
  const v = new Date(`${p.van}T12:00:00Z`);
  return `wk ${weekNummer(v)} (${v.getUTCDate()} ${MAANDEN[v.getUTCMonth()]})`;
}
function weekNummer(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const jan1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7);
}

function Grafiek({ perioden, soort }: { perioden: PeriodeResultaat[]; soort: PeriodeSoort }) {
  const max = Math.max(1, ...perioden.map(p => Math.abs(p.netto)), ...perioden.map(p => Math.abs(p.prognose?.netto ?? 0)));
  const h = 140;
  const midden = h / 2;
  const breedte = Math.max(28, Math.min(64, 640 / Math.max(1, perioden.length)));
  return (
    <div className="overflow-x-auto">
      <svg width={perioden.length * breedte + 8} height={h + 28} role="img" aria-label="Nettoresultaat per periode" className="block">
        <line x1={0} x2={perioden.length * breedte + 8} y1={midden} y2={midden} stroke="#cbd5e1" strokeDasharray="3 3" />
        {perioden.map((p, i) => {
          const x = i * breedte + 6;
          const w = breedte - 10;
          const hoogte = (Math.abs(p.netto) / max) * (midden - 6);
          const y = p.netto >= 0 ? midden - hoogte : midden;
          const prog = p.prognose ? (Math.abs(p.prognose.netto) / max) * (midden - 6) : 0;
          return (
            <g key={p.sleutel}>
              <title>{`${label(p, soort)}: ${eur(p.netto)}${p.prognose ? ` (prognose ${eur(p.prognose.netto)})` : ''}`}</title>
              {p.prognose && (
                <rect x={x} y={p.prognose.netto >= 0 ? midden - prog : midden} width={w} height={Math.max(1, prog)} rx={3}
                  fill="none" stroke={p.prognose.netto >= 0 ? '#10b981' : '#ef4444'} strokeDasharray="3 2" />
              )}
              <rect x={x} y={y} width={w} height={Math.max(1, hoogte)} rx={3} fill={p.netto >= 0 ? '#10b981' : '#ef4444'} opacity={p.lopend ? 0.65 : 1} />
              <text x={x + w / 2} y={h + 18} textAnchor="middle" fontSize={10} fill="#64748b">
                {soort === 'week' ? `wk ${weekNummer(new Date(`${p.van}T12:00:00Z`))}` : label(p, soort).split(' ')[0]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function PersoneelBeheer({ regels, onGewijzigd }: { regels: Personeel[]; onGewijzigd: () => void }) {
  const { confirm } = useAdminConfirm();
  const [open, setOpen] = useState(false);
  const [bedrag, setBedrag] = useState('');
  const [ingang, setIngang] = useState('');
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null);
  const huidig = regels.find(r => !r.einde) ?? regels[regels.length - 1];

  const opslaan = async () => {
    setBezig(true);
    setMelding(null);
    try {
      const res = await adminFetch('/api/admin/winst/personeel', { method: 'POST', body: JSON.stringify({ bedrag_per_maand: bedrag, ingang }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setMelding({ ok: false, tekst: d.error ?? 'Opslaan mislukt' }); return; }
      setBedrag('');
      setIngang('');
      setMelding({ ok: true, tekst: 'Opgeslagen.' });
      onGewijzigd();
    } catch {
      setMelding({ ok: false, tekst: 'Netwerkfout bij opslaan' });
    } finally {
      setBezig(false);
    }
  };

  const verwijder = async (r: Personeel) => {
    const zeker = await confirm({
      title: 'Regel verwijderen?',
      message: `${eur2(Number(r.bedrag_per_maand))} per maand vanaf ${datumKort(r.ingang)}. De vorige regel loopt dan weer door.`,
      confirmLabel: 'Verwijderen',
      destructive: true,
    });
    if (!zeker) return;
    const res = await adminFetch(`/api/admin/winst/personeel?id=${r.id}`, { method: 'DELETE' });
    if (res.ok) onGewijzigd();
    else setMelding({ ok: false, tekst: 'Verwijderen mislukt' });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <UsersIcon className="h-4 w-4 text-slate-400" /> Personeelskosten
          <span className="font-normal text-slate-500">{huidig ? `${eur2(Number(huidig.bedrag_per_maand))} per maand` : 'niet ingevuld'}</span>
        </span>
        <ChevronDownIcon className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-500">
            Alle loonkosten plus extra&apos;s, per maand. Verandert het bedrag, voeg dan een nieuw bedrag toe met de ingangsdatum: eerdere maanden houden hun oude bedrag.
          </p>
          <ul className="divide-y divide-slate-100 text-sm">
            {regels.map(r => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-1.5">
                <span>
                  <span className="font-semibold text-slate-800">{eur2(Number(r.bedrag_per_maand))}</span>
                  <span className="text-slate-500"> per maand, {r.einde ? `${datumKort(r.ingang)} t/m ${datumKort(r.einde)}` : `vanaf ${datumKort(r.ingang)}`}</span>
                </span>
                <button onClick={() => void verwijder(r)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Regel verwijderen">
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-600">Nieuw bedrag per maand
              <input value={bedrag} onChange={e => setBedrag(e.target.value)} inputMode="decimal" placeholder="8500"
                className="mt-0.5 block h-9 w-36 rounded-lg border border-slate-200 px-2 text-sm" />
            </label>
            <label className="text-xs text-slate-600">Vanaf
              <input type="date" value={ingang} onChange={e => setIngang(e.target.value)} className="mt-0.5 block h-9 rounded-lg border border-slate-200 px-2 text-sm" />
            </label>
            <button onClick={() => void opslaan()} disabled={bezig || !bedrag || !ingang}
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40">
              <PlusIcon className="h-4 w-4" /> {bezig ? 'Opslaan...' : 'Toevoegen'}
            </button>
            {melding && <span className={`text-xs ${melding.ok ? 'text-emerald-700' : 'text-red-600'}`}>{melding.tekst}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

const SOORTEN: { waarde: PeriodeSoort; label: string }[] = [
  { waarde: 'week', label: 'Week' }, { waarde: 'maand', label: 'Maand' }, { waarde: 'kwartaal', label: 'Kwartaal' }, { waarde: 'jaar', label: 'Jaar' },
];

export default function ResultaatPerPeriode() {
  const [soort, setSoort] = useState<PeriodeSoort>('maand');
  const [data, setData] = useState<Antwoord | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const volgnummer = useRef(0);

  const laad = useCallback(async () => {
    const mijn = ++volgnummer.current;
    setLaden(true);
    setFout(null);
    try {
      const res = await adminFetch(`/api/admin/winst/resultaat?soort=${soort}`, { cache: 'no-store' });
      const d = (await res.json().catch(() => ({}))) as Antwoord;
      if (mijn !== volgnummer.current) return;
      if (!res.ok) { setFout(d.error ?? 'Laden mislukt'); return; }
      setData(d);
    } catch {
      if (mijn === volgnummer.current) setFout('Netwerkfout bij laden');
    } finally {
      if (mijn === volgnummer.current) setLaden(false);
    }
  }, [soort]);
  useEffect(() => { void laad(); }, [laad]);

  const perioden = data?.perioden ?? [];
  const nieuwsteEerst = [...perioden].reverse();
  const huidig = perioden[perioden.length - 1];
  const totaal = perioden.reduce((s, p) => ({
    verdiend: s.verdiend + p.verdiend, gefactureerd: s.gefactureerd + p.gefactureerd, advertentie: s.advertentie + p.advertentie,
    brutowinst: s.brutowinst + p.brutowinst, personeel: s.personeel + p.personeel, netto: s.netto + p.netto, leveringen: s.leveringen + p.leveringen,
  }), { verdiend: 0, gefactureerd: 0, advertentie: 0, brutowinst: 0, personeel: 0, netto: 0, leveringen: 0 });

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Resultaat per periode</h2>
          <p className="max-w-3xl text-xs text-slate-500">
            Verdiende omzet (geleverde leads naar rato, op de leverdag) min de advertentiekosten en de personeelskosten. Vanaf 1 mei 2026, excl. btw;
            interne klanten tellen niet mee. De lopende periode telt tot vandaag, met een prognose voor de hele periode.
          </p>
        </div>
        <div className="flex gap-1">
          {SOORTEN.map(s => (
            <button key={s.waarde} onClick={() => setSoort(s.waarde)}
              className={`h-8 rounded-lg px-3 text-xs font-semibold ${soort === s.waarde ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {fout && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{fout}</p>}
      {laden && !data && <p className="py-6 text-center text-sm text-slate-400">Laden…</p>}

      {data && huidig && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-500">Netto {label(huidig, soort)}{huidig.lopend ? ' (tot nu)' : ''}</p>
              <p className={`mt-1 text-xl font-bold tabular-nums ${kleur(huidig.netto)}`}>{eur(huidig.netto)}</p>
              <p className="mt-0.5 text-xs text-slate-400">marge {pct(huidig.marge)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-500">Prognose hele {soort === 'week' ? 'week' : soort === 'maand' ? 'maand' : soort === 'kwartaal' ? 'kwartaal' : 'jaar'}</p>
              <p className={`mt-1 text-xl font-bold tabular-nums ${kleur(huidig.prognose?.netto ?? huidig.netto)}`}>{eur(huidig.prognose?.netto ?? huidig.netto)}</p>
              <p className="mt-0.5 text-xs text-slate-400">bij het huidige tempo</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-500">Break-even {label(huidig, soort)}</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{eur(huidig.prognose ? huidig.prognose.advertentie + huidig.prognose.personeel : huidig.breakEven)}</p>
              <p className="mt-0.5 text-xs text-slate-400">omzet nodig om quitte te spelen</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-500">Echte kosten per lead</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{eur2(huidig.kostenPerLead)}</p>
              <p className="mt-0.5 text-xs text-slate-400">waarvan personeel {eur2(huidig.personeelPerLead)}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-xs font-medium text-slate-500">Nettoresultaat per {soort}{huidig.prognose ? ' (gestippeld: prognose lopende periode)' : ''}</p>
            <Grafiek perioden={perioden} soort={soort} />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-xs text-slate-500">
                  <th className="px-3 py-2.5 text-left font-medium">Periode</th>
                  <th className="px-3 py-2.5 text-right font-medium" title="Geleverde leads naar rato, op de leverdag">Omzet (verdiend)</th>
                  <th className="px-3 py-2.5 text-right font-medium" title="Betaalde facturen op de betaaldag, ter vergelijking">Gefactureerd</th>
                  <th className="px-3 py-2.5 text-right font-medium">Advertentie</th>
                  <th className="px-3 py-2.5 text-right font-medium">Brutowinst</th>
                  <th className="px-3 py-2.5 text-right font-medium">Personeel</th>
                  <th className="px-3 py-2.5 text-right font-medium">Netto</th>
                  <th className="px-3 py-2.5 text-right font-medium">Marge</th>
                  <th className="px-3 py-2.5 text-right font-medium" title="Advertentie + personeel">Break-even</th>
                  <th className="px-3 py-2.5 text-right font-medium">Leads</th>
                  <th className="px-3 py-2.5 text-right font-medium" title="(Advertentie + personeel) / geleverde leads">Kosten/lead</th>
                </tr>
              </thead>
              <tbody>
                {nieuwsteEerst.map(p => (
                  <tr key={p.sleutel} className="border-t border-slate-50 align-top">
                    <td className="px-3 py-2 font-medium text-slate-700">
                      {label(p, soort)}
                      {p.lopend && <span className="ml-1.5 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">loopt</span>}
                      {p.prognose && <span className="block text-[11px] font-normal text-slate-400">prognose</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{eur(p.verdiend)}{p.prognose && <span className="block text-[11px] text-slate-400">{eur(p.prognose.verdiend)}</span>}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{eur(p.gefactureerd)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{eur(p.advertentie)}{p.prognose && <span className="block text-[11px] text-slate-400">{eur(p.prognose.advertentie)}</span>}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${kleur(p.brutowinst)}`}>{eur(p.brutowinst)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{eur(p.personeel)}{p.prognose && <span className="block text-[11px] text-slate-400">{eur(p.prognose.personeel)}</span>}</td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${kleur(p.netto)}`}>
                      {eur(p.netto)}
                      {p.prognose && <span className={`block text-[11px] font-normal ${kleur(p.prognose.netto)}`}>{eur(p.prognose.netto)}</span>}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${kleur(p.netto)}`}>{pct(p.marge)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{eur(p.breakEven)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{p.leveringen}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{eur2(p.kostenPerLead)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 bg-slate-50/60 font-semibold">
                  <td className="px-3 py-2 text-slate-700">Totaal sinds 1 mei</td>
                  <td className="px-3 py-2 text-right tabular-nums">{eur(totaal.verdiend)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{eur(totaal.gefactureerd)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{eur(totaal.advertentie)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${kleur(totaal.brutowinst)}`}>{eur(totaal.brutowinst)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{eur(totaal.personeel)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${kleur(totaal.netto)}`}>{eur(totaal.netto)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${kleur(totaal.netto)}`}>{pct(totaal.verdiend > 0 ? Math.round((totaal.netto / totaal.verdiend) * 1000) / 10 : null)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{eur(totaal.advertentie + totaal.personeel)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{totaal.leveringen}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{eur2(totaal.leveringen > 0 ? (totaal.advertentie + totaal.personeel) / totaal.leveringen : null)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <PersoneelBeheer regels={data.personeel} onGewijzigd={() => void laad()} />
        </>
      )}
    </section>
  );
}
