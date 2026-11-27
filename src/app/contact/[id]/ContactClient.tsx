'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { WARMELEADS_TEL_LINK, WARMELEADS_TELEFOON } from '@/lib/contactverzoek';

/**
 * Wat een prospect ziet na een klik in de mail na 3× voicemail: kies een
 * terugbelmoment, plan zelf een gesprek, bel ons, of laat weten dat je geen
 * interesse hebt. Geen inlog; de link is persoonlijk.
 */

type Gegevens = {
  bedrijf: string | null;
  voornaam: string;
  accountmanager: string | null;
  telefoon: string | null;
  afgesloten: boolean;
  keuzes: { key: string; label: string }[];
};

type Klaar = { soort: 'terugbellen'; moment: string } | { soort: 'geen_interesse' };

export default function ContactClient({ id }: { id: string }) {
  const params = useSearchParams();
  const t = params.get('t') || '';
  const [data, setData] = useState<Gegevens | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [laden, setLaden] = useState(true);
  const [moment, setMoment] = useState<string>('zsm');
  const [anderNummer, setAnderNummer] = useState(false);
  const [telefoon, setTelefoon] = useState('');
  const [notitie, setNotitie] = useState('');
  const [bezig, setBezig] = useState(false);
  const [klaar, setKlaar] = useState<Klaar | null>(null);
  const [geenInteresseVragen, setGeenInteresseVragen] = useState(params.get('keuze') === 'geen_interesse');

  const laad = useCallback(async () => {
    try {
      const r = await fetch(`/api/contact/${id}?t=${encodeURIComponent(t)}`, { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setFout(d.error || 'Deze link is niet (meer) geldig.'); return; }
      setData(d);
      if (!d.telefoon) setAnderNummer(true);
    } catch {
      setFout('Er ging iets mis bij het laden.');
    } finally {
      setLaden(false);
    }
  }, [id, t]);
  useEffect(() => { void laad(); }, [laad]);

  const verstuur = async (keuze: 'terugbellen' | 'geen_interesse') => {
    setBezig(true);
    setFout(null);
    try {
      const r = await fetch(`/api/contact/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t, keuze, moment, telefoon: anderNummer ? telefoon : '', notitie }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setFout(d.error || 'Versturen mislukt. Probeer het opnieuw of bel ons.'); return; }
      setKlaar(keuze === 'terugbellen' ? { soort: 'terugbellen', moment: d.moment } : { soort: 'geen_interesse' });
    } catch {
      setFout('Versturen mislukt. Probeer het opnieuw of bel ons.');
    } finally {
      setBezig(false);
    }
  };

  if (laden) return <Omhulsel><div className="h-48 animate-pulse rounded-xl bg-slate-100" /></Omhulsel>;
  if (fout && !data) {
    return (
      <Omhulsel>
        <p className="text-center text-sm text-slate-600">{fout}</p>
        <p className="mt-2 text-center text-xs text-slate-400">Bel ons gerust op <a href={WARMELEADS_TEL_LINK} className="font-semibold text-brand-purple">{WARMELEADS_TELEFOON}</a>.</p>
      </Omhulsel>
    );
  }
  if (!data) return null;

  const wie = data.accountmanager ? `${data.accountmanager} van WarmeLeads` : 'WarmeLeads';

  if (klaar) {
    return (
      <Omhulsel>
        <div className="py-4 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">✓</div>
          {klaar.soort === 'terugbellen' ? (
            <>
              <h1 className="text-lg font-bold text-slate-900">Dank u, we bellen u terug</h1>
              <p className="mt-1 text-sm text-slate-600">U wordt gebeld door {wie}, rond <strong>{klaar.moment}</strong>.</p>
              <p className="mt-3 text-xs text-slate-400">Toch eerder iets kwijt? Bel ons op <a href={WARMELEADS_TEL_LINK} className="font-semibold text-brand-purple">{WARMELEADS_TELEFOON}</a>.</p>
            </>
          ) : (
            <>
              <h1 className="text-lg font-bold text-slate-900">Helder, dank voor het laten weten</h1>
              <p className="mt-1 text-sm text-slate-600">We bellen u hierover niet meer. Verandert u van gedachten? U bent altijd welkom.</p>
            </>
          )}
        </div>
      </Omhulsel>
    );
  }

  if (geenInteresseVragen) {
    return (
      <Omhulsel>
        <h1 className="text-lg font-bold text-slate-900">Geen interesse meer?</h1>
        <p className="mt-1 text-sm text-slate-600">Bevestig het hieronder, dan bellen we u hierover niet meer{data.bedrijf ? ` (${data.bedrijf})` : ''}.</p>
        {fout && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{fout}</p>}
        <button type="button" disabled={bezig} onClick={() => void verstuur('geen_interesse')} className="mt-5 h-12 w-full rounded-xl bg-slate-800 text-sm font-bold text-white disabled:opacity-50">
          {bezig ? 'Even geduld...' : 'Ja, ik heb geen interesse'}
        </button>
        <button type="button" onClick={() => setGeenInteresseVragen(false)} className="mt-2 h-11 w-full rounded-xl text-sm font-semibold text-brand-purple">
          Toch wel, bel mij terug
        </button>
      </Omhulsel>
    );
  }

  return (
    <Omhulsel>
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-purple">Even contact</p>
      <h1 className="mt-1 text-xl font-bold text-slate-900">{data.voornaam ? `Hoi ${data.voornaam}, ` : ''}wanneer komt het u uit?</h1>
      <p className="mt-1 text-sm text-slate-600">We probeerden u een paar keer te bellen{data.bedrijf ? ` voor ${data.bedrijf}` : ''}. Kies wat voor u het handigst is.</p>

      {data.afgesloten && (
        <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">We hadden uw aanvraag al afgesloten, maar we bellen u graag alsnog als u dat wilt.</p>
      )}

      <div className="mt-5 rounded-2xl border border-brand-purple/20 bg-brand-purple/[0.03] p-4">
        <p className="text-sm font-bold text-slate-900">1. Bel mij terug</p>
        <div className="mt-3 grid gap-2">
          {data.keuzes.map(k => (
            <button
              key={k.key}
              type="button"
              onClick={() => setMoment(k.key)}
              className={`min-h-11 rounded-xl border px-3 text-left text-sm font-semibold transition ${moment === k.key ? 'border-brand-purple bg-brand-purple text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-purple/40'}`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="mt-3 text-sm">
          {data.telefoon && !anderNummer ? (
            <p className="text-slate-600">We bellen u op <strong>{data.telefoon}</strong>. <button type="button" onClick={() => setAnderNummer(true)} className="font-semibold text-brand-purple underline">Ander nummer?</button></p>
          ) : (
            <label className="block text-xs font-semibold text-slate-700">Op welk nummer kunnen we u bellen?
              <input type="tel" inputMode="tel" value={telefoon} onChange={e => setTelefoon(e.target.value)} placeholder="06 12345678"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-brand-purple/50" />
            </label>
          )}
        </div>
        <label className="mt-3 block text-xs font-semibold text-slate-700">Waar wilt u het over hebben? (optioneel)
          <textarea value={notitie} onChange={e => setNotitie(e.target.value)} rows={2} maxLength={500} placeholder="Bijvoorbeeld: thuisbatterijleads in Noord-Brabant"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-brand-purple/50" />
        </label>
        {fout && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{fout}</p>}
        <button
          type="button"
          disabled={bezig || (anderNummer && telefoon.replace(/\D/g, '').length < 9)}
          onClick={() => void verstuur('terugbellen')}
          className="mt-4 h-12 w-full rounded-xl bg-gradient-to-r from-brand-orange to-brand-pink text-sm font-bold text-white shadow-sm transition disabled:opacity-50"
        >
          {bezig ? 'Even geduld...' : 'Bel mij terug'}
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Link href="/plan-gesprek" className="flex min-h-12 flex-col justify-center rounded-xl border border-slate-200 px-4 py-2 hover:border-brand-purple/40">
          <span className="text-sm font-bold text-slate-900">2. Plan zelf een gesprek</span>
          <span className="text-xs text-slate-500">Kies een dag en tijd</span>
        </Link>
        <a href={WARMELEADS_TEL_LINK} className="flex min-h-12 flex-col justify-center rounded-xl border border-slate-200 px-4 py-2 hover:border-brand-purple/40">
          <span className="text-sm font-bold text-slate-900">3. Bel ons direct</span>
          <span className="text-xs text-slate-500">{WARMELEADS_TELEFOON} · werkdagen 9–17</span>
        </a>
      </div>

      <button type="button" onClick={() => setGeenInteresseVragen(true)} className="mt-4 w-full text-center text-xs text-slate-400 underline">
        Geen interesse meer
      </button>
    </Omhulsel>
  );
}

function Omhulsel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="mb-4 text-center text-sm font-extrabold tracking-tight text-brand-navy">WarmeLeads</p>
        {children}
      </div>
    </div>
  );
}
