'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowPathIcon, EnvelopeIcon, PaperAirplaneIcon, PlayIcon, StopIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

/**
 * Extra leads-mails: de eenmalige introductie en het overzicht van elke
 * maandag. Hier zie je het voorbeeld, stuur je een testmail naar info@ en zet
 * je de maandagmail aan of uit. Alleen superadmin.
 */

type Soort = 'intro' | 'maandag';
type Ontvanger = { id: string; naam: string; email: string; branches: string[]; regios: string[]; maandag_aantal: number };
type Stand = {
  aan: boolean;
  test_adres: string;
  week: string;
  aanbod: number;
  intro_verstuurd: number;
  maandag_deze_week: number;
  ontvangers: Ontvanger[];
  voorbeeld: { onderwerp: string; html: string } | null;
};
type Uitslag = { verstuurd: number; alGehad: number; geenAanbod: number; mislukt: { email: string; fout: string }[]; onderbroken: boolean };

export default function ExtraLeadsMailPage() {
  const [soort, setSoort] = useState<Soort>('intro');
  const [klant, setKlant] = useState('');
  const [stand, setStand] = useState<Stand | null>(null);
  const [laden, setLaden] = useState(true);
  const [bezig, setBezig] = useState<string | null>(null);
  const [melding, setMelding] = useState<{ soort: 'ok' | 'fout'; tekst: string } | null>(null);

  const laad = useCallback(async () => {
    setLaden(true);
    try {
      const r = await adminFetch(`/api/admin/extra-leads-mail?soort=${soort}${klant ? `&klant=${klant}` : ''}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setMelding({ soort: 'fout', tekst: d.error || 'Laden mislukt' });
      else setStand(d);
    } finally {
      setLaden(false);
    }
  }, [soort, klant]);

  useEffect(() => { void laad(); }, [laad]);

  const post = async (naam: string, body: Record<string, unknown>) => {
    setBezig(naam);
    setMelding(null);
    try {
      const r = await adminFetch('/api/admin/extra-leads-mail', { method: 'POST', body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMelding({ soort: 'fout', tekst: d.error || 'Er ging iets mis' }); return null; }
      return d;
    } catch {
      setMelding({ soort: 'fout', tekst: 'Er ging iets mis' });
      return null;
    } finally {
      setBezig(null);
    }
  };

  const test = async () => {
    const d = await post('test', { actie: 'test', soort, klant: soort === 'maandag' && klant ? klant : null });
    if (d) setMelding({ soort: 'ok', tekst: `Testmail verstuurd naar ${d.naar}: "${d.onderwerp}"` });
  };

  const intro = async () => {
    if (!stand) return;
    const nog = stand.ontvangers.length - stand.intro_verstuurd;
    if (!confirm(`De introductiemail naar ${stand.ontvangers.length} klanten versturen?${stand.intro_verstuurd ? ` (${stand.intro_verstuurd} kregen hem al en worden overgeslagen; nog ${Math.max(0, nog)}.)` : ''}\n\nDit kan niet ongedaan worden gemaakt.`)) return;
    const d = (await post('intro', { actie: 'intro', aantal: stand.ontvangers.length })) as Uitslag | null;
    if (d) {
      setMelding({
        soort: d.mislukt.length ? 'fout' : 'ok',
        tekst: `${d.verstuurd} verstuurd, ${d.alGehad} hadden hem al${d.geenAanbod ? `, ${d.geenAanbod} zonder aanbod` : ''}${d.mislukt.length ? `, ${d.mislukt.length} mislukt` : ''}.${d.onderbroken ? ' Nog niet klaar: druk nog een keer op versturen om verder te gaan.' : ''}`,
      });
      void laad();
    }
  };

  const schakel = async () => {
    if (!stand) return;
    const aan = !stand.aan;
    if (aan && !confirm('De maandagmail aanzetten? Vanaf komende maandag 08:00 krijgen alle klanten met aanbod in hun branches elke week het overzicht.')) return;
    const d = await post('schakelaar', { actie: 'schakelaar', aan });
    if (d) setStand(s => (s ? { ...s, aan: d.aan } : s));
  };

  const metAanbod = stand?.ontvangers.filter(o => o.maandag_aantal > 0).length ?? 0;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Extra leads-mail</h1>
          <p className="mt-0.5 text-sm text-slate-500">De introductie van Extra leads en het overzicht dat klanten elke maandag krijgen.</p>
        </div>
        <button
          onClick={schakel}
          disabled={!stand || bezig !== null}
          className={`inline-flex items-center gap-1.5 self-start rounded-lg px-3.5 py-2 text-sm font-bold shadow-sm transition sm:self-auto ${
            stand?.aan ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
          }`}
        >
          {stand?.aan ? <PlayIcon className="h-4 w-4" /> : <StopIcon className="h-4 w-4" />}
          Maandagmail {stand?.aan ? 'AAN' : 'UIT'}
        </button>
      </div>

      {stand && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Nu te koop', `${stand.aanbod} leads`],
            ['Ontvangers', `${stand.ontvangers.length} klanten`],
            ['Introductie verstuurd', `${stand.intro_verstuurd}`],
            [`Maandagmail week ${stand.week.slice(5).split('-').reverse().join('-')}`, `${stand.maandag_deze_week} verstuurd`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-500">{k}</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{v}</p>
            </div>
          ))}
        </div>
      )}

      {melding && (
        <p className={`mb-4 rounded-lg border px-3 py-2 text-sm ${melding.soort === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{melding.tekst}</p>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm font-medium">
          {(['intro', 'maandag'] as Soort[]).map(s => (
            <button
              key={s}
              onClick={() => setSoort(s)}
              className={`flex-1 rounded-lg px-3 py-2 transition sm:flex-none ${soort === s ? 'bg-white text-brand-purple shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {s === 'intro' ? 'Introductiemail' : 'Maandagmail'}
            </button>
          ))}
        </div>
        {soort === 'maandag' && stand && (
          <select value={klant} onChange={e => setKlant(e.target.value)} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm sm:max-w-xs">
            <option value="">Voorbeeld: alle branches</option>
            {stand.ontvangers.map(o => <option key={o.id} value={o.id}>{o.naam} ({o.maandag_aantal})</option>)}
          </select>
        )}
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <button onClick={() => void laad()} disabled={laden} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <ArrowPathIcon className={`h-4 w-4 ${laden ? 'animate-spin' : ''}`} /> Verversen
          </button>
          <button onClick={test} disabled={!stand?.voorbeeld || bezig !== null} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-brand-purple/30 bg-white px-3 text-sm font-semibold text-brand-purple hover:bg-brand-purple/5 disabled:opacity-50">
            <EnvelopeIcon className="h-4 w-4" /> {bezig === 'test' ? 'Versturen…' : `Testmail naar ${stand?.test_adres ?? 'info@'}`}
          </button>
          {soort === 'intro' && (
            <button onClick={intro} disabled={!stand?.voorbeeld || bezig !== null} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand-purple px-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
              <PaperAirplaneIcon className="h-4 w-4" /> {bezig === 'intro' ? 'Bezig met versturen…' : `Versturen naar ${stand?.ontvangers.length ?? '…'} klanten`}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,640px)_1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3 text-sm">
            <span className="text-slate-500">Onderwerp: </span>
            <span className="font-semibold text-slate-900">{stand?.voorbeeld?.onderwerp ?? (laden ? '…' : 'Geen aanbod, dus geen mail')}</span>
          </div>
          {stand?.voorbeeld ? (
            <iframe title="Voorbeeld" srcDoc={stand.voorbeeld.html} className="h-[900px] w-full" sandbox="" />
          ) : (
            <p className="p-6 text-sm text-slate-500">{laden ? 'Laden…' : 'Er staat voor deze klant nu niets te koop. Hij krijgt deze week geen maandagmail.'}</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Ontvangers</p>
            <p className="text-xs text-slate-500">
              Klanten die ooit in het portaal inlogden, zonder demo-accounts, interne klanten en afmeldingen.
              {stand && ` ${metAanbod} van de ${stand.ontvangers.length} hebben nu aanbod in hun branches voor de maandagmail.`}
            </p>
          </div>
          <div className="max-h-[900px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                <tr><th className="px-4 py-2">Klant</th><th className="px-4 py-2">Branches</th><th className="px-4 py-2">Regio&apos;s</th><th className="px-4 py-2 text-right">Maandag</th></tr>
              </thead>
              <tbody>
                {(stand?.ontvangers ?? []).map(o => (
                  <tr key={o.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-2"><p className="font-medium text-slate-900">{o.naam}</p><p className="text-xs text-slate-500">{o.email}</p></td>
                    <td className="px-4 py-2 text-xs text-slate-600">{o.branches.join(', ') || '-'}</td>
                    <td className="px-4 py-2 text-xs text-slate-600">{o.regios.join(', ') || '-'}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-900">{o.maandag_aantal || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
