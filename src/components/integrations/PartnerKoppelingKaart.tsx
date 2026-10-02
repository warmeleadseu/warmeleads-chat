'use client';

import { useEffect, useState } from 'react';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

/**
 * Kaart voor één partnerkoppeling (bijvoorbeeld Snelraak), gedeeld door het
 * klantportaal en de admin: wat de admin ziet is precies wat de klant ziet.
 * Alleen de admin krijgt de opties "nasturen" en "testen met eigen nummer".
 */

export type PartnerStatusData = {
  partner: { id: string; naam: string; tagline: string; urlUitleg: string };
  gekoppeld: boolean;
  aan: boolean;
  url_hint: string | null;
  branches: string[];
  beschikbare_branches: string[];
  leveren_vanaf: string | null;
  laatste_succes: string | null;
  laatste_fout: { at: string; melding: string; blijvend: boolean } | null;
  zeven_dagen: { gelukt: number; mislukt: number };
  wachtend: number;
  opgegeven: number;
  actie_nodig: boolean;
};

export type PartnerApi = {
  opslaan: (body: Record<string, unknown>) => Promise<{ ok: boolean; status?: PartnerStatusData; fout?: string; nagestuurd?: { gelukt: number; mislukt: number; resterend: number } | null }>;
  testen: (body: Record<string, unknown>) => Promise<{ ok: boolean; melding: string; ms: number }>;
  opnieuw: () => Promise<{ ok: boolean; gelukt?: number; mislukt?: number; resterend?: number; fout?: string }>;
  ontkoppelen: () => Promise<{ ok: boolean; fout?: string }>;
};

const BRANCHE: Record<string, string> = {
  thuisbatterij: 'Thuisbatterij', warmtepomp: 'Warmtepomp', zonnepanelen: 'Zonnepanelen',
  airco: 'Airco', isolatie: 'Isolatie', kozijnen: 'Kozijnen',
};
const brancheLabel = (s: string) => BRANCHE[s] ?? s.charAt(0).toUpperCase() + s.slice(1);

function wanneer(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const nu = new Date();
  const tijd = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === nu.toDateString()) return `vandaag ${tijd}`;
  const gisteren = new Date(nu); gisteren.setDate(nu.getDate() - 1);
  if (d.toDateString() === gisteren.toDateString()) return `gisteren ${tijd}`;
  return `${d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} ${tijd}`;
}

function Badge({ s }: { s: PartnerStatusData }) {
  const [kleur, tekst] = !s.gekoppeld
    ? ['border-slate-200 bg-slate-50 text-slate-600', 'Niet gekoppeld']
    : s.actie_nodig
      ? ['border-red-200 bg-red-50 text-red-700', 'Actie nodig']
      : s.aan
        ? ['border-emerald-200 bg-emerald-50 text-emerald-700', 'Actief']
        : ['border-amber-200 bg-amber-50 text-amber-700', 'Gepauzeerd'];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${kleur}`}>
      {s.gekoppeld && s.aan && !s.actie_nodig && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
      {tekst}
    </span>
  );
}

export default function PartnerKoppelingKaart({
  status,
  api,
  admin = false,
  onBijgewerkt,
}: {
  status: PartnerStatusData;
  api: PartnerApi;
  admin?: boolean;
  onBijgewerkt: (s: PartnerStatusData | null) => void;
}) {
  const s = status;
  const naam = s.partner.naam;
  const [bewerken, setBewerken] = useState(!s.gekoppeld);
  const [url, setUrl] = useState('');
  const [branches, setBranches] = useState<string[]>(s.branches);
  const [nasturen, setNasturen] = useState(0);
  const [testnummer, setTestnummer] = useState('');
  const [bezig, setBezig] = useState<string | null>(null);
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null);

  /* Status van buiten volgen (na ontkoppelen of verversen), zonder de kaart
     opnieuw op te bouwen: dan zou een net getoonde melding verdwijnen. */
  useEffect(() => { if (!s.gekoppeld) setBewerken(true); }, [s.gekoppeld]);
  useEffect(() => { setBranches(s.branches); }, [s.branches]);

  const doe = async (wat: string, fn: () => Promise<void>) => {
    setBezig(wat);
    setMelding(null);
    try { await fn(); } catch { setMelding({ ok: false, tekst: 'Er ging iets mis. Probeer het opnieuw.' }); }
    finally { setBezig(null); }
  };

  /** Koppelen: eerst testen met het nieuwe adres, pas bij succes opslaan en aanzetten. */
  const koppel = () => doe('koppel', async () => {
    const t = await api.testen({ url, telefoon: admin ? testnummer || undefined : undefined });
    if (!t.ok) { setMelding({ ok: false, tekst: t.melding }); return; }
    /* Alleen bij de eerste koppeling aanzetten: een nieuw adres op een
       gepauzeerde koppeling mag hem niet stilletjes hervatten. */
    const r = await api.opslaan({
      url,
      branches,
      ...(!s.gekoppeld ? { enabled: true } : {}),
      ...(admin && !s.gekoppeld ? { nasturen_dagen: nasturen } : {}),
    });
    if (!r.ok || !r.status) { setMelding({ ok: false, tekst: r.fout ?? 'Opslaan mislukt' }); return; }
    const na = r.nagestuurd;
    setMelding({
      ok: true,
      tekst: (s.gekoppeld
        ? `${t.melding} Nieuw adres opgeslagen.`
        : `${t.melding} Koppeling staat aan: nieuwe leads gaan vanaf nu automatisch naar ${naam}.`) +
        (na ? ` Nagestuurd: ${na.gelukt}${na.mislukt ? `, mislukt: ${na.mislukt}` : ''}${na.resterend ? `, nog ${na.resterend} volgen automatisch` : ''}.` : ''),
    });
    setUrl('');
    setBewerken(false);
    onBijgewerkt(r.status);
  });

  const test = () => doe('test', async () => {
    const t = await api.testen({ telefoon: admin ? testnummer || undefined : undefined });
    setMelding({ ok: t.ok, tekst: t.ok ? `${t.melding} (${t.ms} ms)` : t.melding });
  });

  const zetAan = (aan: boolean) => doe(aan ? 'aan' : 'uit', async () => {
    const r = await api.opslaan({ enabled: aan });
    if (!r.ok || !r.status) { setMelding({ ok: false, tekst: r.fout ?? 'Opslaan mislukt' }); return; }
    setMelding({ ok: true, tekst: aan ? `Hervat: nieuwe leads gaan weer naar ${naam}.` : `Gepauzeerd: nieuwe leads gaan niet naar ${naam}, ook niet later.` });
    onBijgewerkt(r.status);
  });

  const bewaarBranches = (nieuw: string[]) => doe('branches', async () => {
    setBranches(nieuw);
    if (!s.gekoppeld) return;
    const r = await api.opslaan({ branches: nieuw });
    if (r.ok && r.status) onBijgewerkt(r.status);
    else setMelding({ ok: false, tekst: r.fout ?? 'Opslaan mislukt' });
  });

  const opnieuw = () => doe('opnieuw', async () => {
    const r = await api.opnieuw();
    if (!r.ok) { setMelding({ ok: false, tekst: r.fout ?? 'Opnieuw proberen mislukt' }); return; }
    setMelding({
      ok: !r.mislukt,
      tekst: `Opnieuw geprobeerd: ${r.gelukt ?? 0} afgeleverd${r.mislukt ? `, ${r.mislukt} mislukt` : ''}${r.resterend ? `, nog ${r.resterend} volgen automatisch` : ''}.`,
    });
    onBijgewerkt(null);
  });

  const ontkoppel = () => {
    if (!confirm(`De koppeling met ${naam} verwijderen? Nieuwe leads gaan dan niet meer naar ${naam}.`)) return;
    void doe('ontkoppel', async () => {
      const r = await api.ontkoppelen();
      if (!r.ok) { setMelding({ ok: false, tekst: r.fout ?? 'Ontkoppelen mislukt' }); return; }
      onBijgewerkt(null);
    });
  };

  const knop = 'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition disabled:opacity-50';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-base font-bold text-white">
            {naam.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{naam}</p>
            <p className="text-xs text-slate-500">{s.partner.tagline}</p>
          </div>
        </div>
        <Badge s={s} />
      </div>

      {!s.gekoppeld && (
        <p className="mt-3 text-sm text-slate-600">
          Gebruik je {naam}? Plak het afleveradres dat je van {naam} kreeg. Elke nieuwe lead staat dan binnen
          seconden bij {naam}, zodat de opvolging direct start.
        </p>
      )}

      {s.actie_nodig && s.laatste_fout && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p>{s.laatste_fout.melding}</p>
            <p className="mt-0.5 text-xs text-red-600">Sinds {wanneer(s.laatste_fout.at)}. {s.opgegeven > 0 && `${s.opgegeven} lead${s.opgegeven === 1 ? '' : 's'} nog niet afgeleverd; die gaan alsnog mee na een nieuw adres of "Opnieuw proberen".`}</p>
          </div>
        </div>
      )}

      {s.gekoppeld && (
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Laatste lead afgeleverd</p>
            <p className="text-slate-800">{s.laatste_succes ? wanneer(s.laatste_succes) : 'Nog geen'}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Laatste 7 dagen</p>
            <p className="text-slate-800">
              {s.zeven_dagen.gelukt} afgeleverd
              {s.zeven_dagen.mislukt > 0 && <span className="text-red-600">, {s.zeven_dagen.mislukt} mislukt</span>}
              {s.wachtend > 0 && <span className="text-amber-700">, {s.wachtend} in de wachtrij</span>}
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {s.gekoppeld && !bewerken ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2">
            <code className="truncate text-xs text-slate-500">{s.url_hint}</code>
            <button onClick={() => setBewerken(true)} className="text-xs font-semibold text-brand-purple hover:underline">Adres wijzigen</button>
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Afleveradres van {naam}</label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://snelraak.nl/api/v1/ingest/…"
              autoComplete="off"
              spellCheck={false}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-xs outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30"
            />
            <p className="mt-1 text-[11px] text-slate-400">{s.partner.urlUitleg} Het adres is geheim; na opslaan tonen we alleen de laatste tekens.</p>
          </div>
        )}

        {s.beschikbare_branches.length > 1 && (
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-600">Welke leads</p>
            <div className="flex flex-wrap gap-2">
              {s.beschikbare_branches.map(b => {
                const aan = branches.length === 0 || branches.includes(b);
                return (
                  <label key={b} className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${aan ? 'border-brand-purple/40 bg-brand-purple/5 text-slate-800' : 'border-slate-200 text-slate-500'}`}>
                    <input
                      type="checkbox"
                      checked={aan}
                      disabled={bezig !== null}
                      onChange={() => {
                        const huidig = branches.length === 0 ? s.beschikbare_branches : branches;
                        const nieuw = huidig.includes(b) ? huidig.filter(x => x !== b) : [...huidig, b];
                        if (nieuw.length === 0) return;
                        void bewaarBranches(nieuw.length === s.beschikbare_branches.length ? [] : nieuw);
                      }}
                      className="h-3.5 w-3.5 accent-[#7c3aed]"
                    />
                    {brancheLabel(b)}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {admin && (
          <div className="grid gap-3 sm:grid-cols-2">
            {!s.gekoppeld && (
              <label className="block text-xs font-semibold text-slate-600">
                Bestaande leads nasturen
                <select value={nasturen} onChange={e => setNasturen(Number(e.target.value))} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm font-normal text-slate-700">
                  <option value={0}>Nee, alleen nieuwe leads</option>
                  <option value={1}>Ook van de afgelopen 24 uur</option>
                  <option value={2}>Ook van de afgelopen 2 dagen</option>
                  <option value={3}>Ook van de afgelopen 3 dagen</option>
                </select>
                {nasturen > 0 && <span className="mt-1 block font-normal text-amber-700">Deze mensen worden alsnog benaderd, dagen nadat ze iets invulden.</span>}
              </label>
            )}
            <label className="block text-xs font-semibold text-slate-600">
              Testen met eigen nummer (optioneel)
              <input value={testnummer} onChange={e => setTestnummer(e.target.value)} placeholder="06…" inputMode="tel" className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm font-normal" />
              <span className="mt-1 block font-normal text-slate-400">Dan zie je zelf wat de klant van {naam} ontvangt.</span>
            </label>
          </div>
        )}
      </div>

      {melding && (
        <div className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${melding.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
          {melding.ok ? <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" /> : <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />}
          <p>{melding.tekst}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        {bewerken ? (
          <>
            <button onClick={koppel} disabled={!url.trim() || bezig !== null} className={`${knop} bg-gradient-to-r from-brand-purple to-brand-pink text-white`}>
              <PaperAirplaneIcon className={`h-4 w-4 ${bezig === 'koppel' ? 'animate-pulse' : ''}`} />
              {bezig === 'koppel' ? 'Testen…' : s.gekoppeld ? 'Nieuw adres testen en opslaan' : 'Koppelen en testen'}
            </button>
            {s.gekoppeld && (
              <button onClick={() => { setBewerken(false); setUrl(''); }} className={`${knop} border border-slate-200 text-slate-600`}>Annuleren</button>
            )}
          </>
        ) : (
          <>
            <button onClick={test} disabled={bezig !== null} className={`${knop} border border-slate-200 text-slate-700 hover:bg-slate-50`}>
              <PaperAirplaneIcon className={`h-4 w-4 ${bezig === 'test' ? 'animate-pulse' : ''}`} /> Testlevering
            </button>
            {s.aan ? (
              <button onClick={() => zetAan(false)} disabled={bezig !== null} className={`${knop} border border-slate-200 text-slate-700 hover:bg-slate-50`}>
                <PauseIcon className="h-4 w-4" /> Pauzeren
              </button>
            ) : (
              <button onClick={() => zetAan(true)} disabled={bezig !== null} className={`${knop} border border-emerald-200 text-emerald-700 hover:bg-emerald-50`}>
                <PlayIcon className="h-4 w-4" /> Hervatten
              </button>
            )}
            {(s.opgegeven > 0 || s.zeven_dagen.mislukt > 0) && (
              <button onClick={opnieuw} disabled={bezig !== null} className={`${knop} border border-amber-200 text-amber-800 hover:bg-amber-50`}>
                <ArrowPathIcon className={`h-4 w-4 ${bezig === 'opnieuw' ? 'animate-spin' : ''}`} /> Opnieuw proberen{s.opgegeven + s.wachtend > 0 ? ` (${s.opgegeven + s.wachtend})` : ''}
              </button>
            )}
          </>
        )}
        {s.gekoppeld && (
          <button onClick={ontkoppel} disabled={bezig !== null} className={`${knop} ml-auto text-slate-400 hover:bg-red-50 hover:text-red-600`} title="Koppeling verwijderen">
            <TrashIcon className="h-4 w-4" /> Ontkoppelen
          </button>
        )}
      </div>
    </div>
  );
}
