'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Wat de lead ziet als hij op de link in zijn bevestigingsmail klikt.
 *
 * Bewust zonder inlog en zonder portaalnavigatie: dit is een consument die één
 * ding wil doen. Drie knoppen, verder niets.
 */

interface Afspraak {
  id: string;
  starts_at: string;
  duration_minutes: number;
  status: string;
  contact_name: string;
  adres: string;
  bedrijf: string;
  branche: string;
  lead_bevestigd_at: string | null;
  lead_reactie: string | null;
}

function datumTekst(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function tijdTekst(iso: string, minuten: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const eind = new Date(d.getTime() + minuten * 60_000);
  const f = (x: Date) => x.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  return `${f(d)} tot ${f(eind)}`;
}

export default function AfspraakClient({ id }: { id: string }) {
  const params = useSearchParams();
  const token = params.get('t') || '';

  const [afspraak, setAfspraak] = useState<Afspraak | null>(null);
  const [magReageren, setMagReageren] = useState(false);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [klaar, setKlaar] = useState<string | null>(null);

  const [verzetten, setVerzetten] = useState(false);
  const [datum, setDatum] = useState('');
  const [slots, setSlots] = useState<{ start: string }[]>([]);
  const [slotsLaden, setSlotsLaden] = useState(false);
  const [gekozen, setGekozen] = useState<string | null>(null);

  const [afzeggen, setAfzeggen] = useState(false);
  const [reden, setReden] = useState('');

  const laad = useCallback(async () => {
    setLaden(true);
    try {
      const r = await fetch(`/api/afspraak/${id}?t=${encodeURIComponent(token)}`);
      if (!r.ok) { setFout('Deze link is niet (meer) geldig.'); return; }
      const d = await r.json();
      setAfspraak(d.afspraak);
      setMagReageren(d.mag_reageren);
    } catch {
      setFout('Er ging iets mis bij het laden.');
    } finally {
      setLaden(false);
    }
  }, [id, token]);

  useEffect(() => { laad(); }, [laad]);

  const stuur = async (body: Record<string, unknown>) => {
    setBezig(true);
    setFout(null);
    try {
      const r = await fetch(`/api/afspraak/${id}?t=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setFout(d.error || 'Dat lukte niet.'); return null; }
      return d;
    } catch {
      setFout('Er ging iets mis.');
      return null;
    } finally {
      setBezig(false);
    }
  };

  const haalSlots = async (nieuweDatum: string) => {
    setDatum(nieuweDatum);
    setGekozen(null);
    if (!nieuweDatum) return;
    setSlotsLaden(true);
    const d = await stuur({ actie: 'slots', datum: nieuweDatum });
    setSlots(Array.isArray(d?.slots) ? d.slots : []);
    setSlotsLaden(false);
  };

  if (laden) {
    return <Omhulsel><div className="h-40 animate-pulse rounded-xl bg-slate-100" /></Omhulsel>;
  }

  if (fout && !afspraak) {
    return (
      <Omhulsel>
        <p className="text-center text-sm text-slate-600">{fout}</p>
        <p className="mt-2 text-center text-xs text-slate-400">
          Neem gerust contact op via 085 047 7067.
        </p>
      </Omhulsel>
    );
  }

  if (!afspraak) return null;

  if (klaar) {
    return (
      <Omhulsel>
        <div className="py-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">✓</div>
          <h1 className="text-lg font-bold text-slate-900">
            {klaar === 'bevestigd' && 'Bedankt, je afspraak staat'}
            {klaar === 'afgezegd' && 'Je afspraak is afgezegd'}
            {klaar === 'verzet' && 'Je afspraak is verzet'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {klaar === 'afgezegd'
              ? 'We hebben het doorgegeven. Wil je later alsnog een afspraak? Bel ons gerust.'
              : `${datumTekst(afspraak.starts_at)}, ${tijdTekst(afspraak.starts_at, afspraak.duration_minutes)}.`}
          </p>
        </div>
      </Omhulsel>
    );
  }

  return (
    <Omhulsel>
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-purple">Je afspraak</p>
      <h1 className="mt-1 text-xl font-bold text-slate-900">{afspraak.bedrijf}</h1>
      <p className="text-sm text-slate-500">{afspraak.branche}</p>

      <div className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-4">
        <p className="text-base font-bold text-slate-900">{datumTekst(afspraak.starts_at)}</p>
        <p className="text-sm text-slate-600">{tijdTekst(afspraak.starts_at, afspraak.duration_minutes)}</p>
        {afspraak.adres && <p className="text-sm text-slate-500">{afspraak.adres}</p>}
      </div>

      {!magReageren ? (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {afspraak.status === 'cancelled'
            ? 'Deze afspraak is afgezegd.'
            : 'Deze afspraak kan niet meer online worden gewijzigd. Bel ons op 085 047 7067 als er iets moet veranderen.'}
        </p>
      ) : afspraak.lead_bevestigd_at && !verzetten && !afzeggen ? (
        <>
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Je hebt deze afspraak bevestigd. Tot dan!
          </p>
          <div className="mt-3 flex gap-2">
            <Knop soort="grijs" onClick={() => setVerzetten(true)}>Toch verzetten</Knop>
            <Knop soort="grijs" onClick={() => setAfzeggen(true)}>Afzeggen</Knop>
          </div>
        </>
      ) : verzetten ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold text-slate-800">Kies een nieuw moment</p>
          <input
            type="date"
            value={datum}
            onChange={e => haalSlots(e.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
          />
          {slotsLaden ? (
            <div className="grid grid-cols-3 gap-1.5">
              {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}
            </div>
          ) : datum && slots.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-500">
              Geen vrije tijden op deze dag. Probeer een andere datum.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {slots.map(s => (
                <button
                  key={s.start}
                  onClick={() => setGekozen(s.start)}
                  className={`h-10 rounded-lg border text-sm font-semibold transition ${
                    gekozen === s.start ? 'border-brand-purple bg-brand-purple text-white' : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {new Date(s.start).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                </button>
              ))}
            </div>
          )}
          {fout && <Foutmelding tekst={fout} />}
          <div className="flex gap-2">
            <Knop soort="grijs" onClick={() => { setVerzetten(false); setFout(null); }}>Terug</Knop>
            <Knop
              soort="paars"
              uit={!gekozen || bezig}
              onClick={async () => {
                const d = await stuur({ actie: 'verzetten', starts_at: gekozen });
                if (d?.ok) { setAfspraak({ ...afspraak, starts_at: d.starts_at }); setKlaar('verzet'); }
              }}
            >
              {bezig ? 'Bezig...' : 'Verzetten'}
            </Knop>
          </div>
        </div>
      ) : afzeggen ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold text-slate-800">Afspraak afzeggen</p>
          <input
            value={reden}
            onChange={e => setReden(e.target.value)}
            placeholder="Reden (optioneel)"
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
          />
          {fout && <Foutmelding tekst={fout} />}
          <div className="flex gap-2">
            <Knop soort="grijs" onClick={() => { setAfzeggen(false); setFout(null); }}>Terug</Knop>
            <Knop
              soort="rood"
              uit={bezig}
              onClick={async () => {
                const d = await stuur({ actie: 'afzeggen', reden });
                if (d?.ok) setKlaar('afgezegd');
              }}
            >
              {bezig ? 'Bezig...' : 'Definitief afzeggen'}
            </Knop>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {fout && <Foutmelding tekst={fout} />}
          <Knop
            soort="paars"
            uit={bezig}
            breed
            onClick={async () => {
              const d = await stuur({ actie: 'bevestigen' });
              if (d?.ok) setKlaar('bevestigd');
            }}
          >
            {bezig ? 'Bezig...' : 'Ja, ik ben er'}
          </Knop>
          <div className="flex gap-2">
            <Knop soort="grijs" onClick={() => setVerzetten(true)}>Verzetten</Knop>
            <Knop soort="grijs" onClick={() => setAfzeggen(true)}>Afzeggen</Knop>
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-slate-400">
        Vragen? Bel <a href="tel:0850477067" className="text-brand-purple">085 047 7067</a>
      </p>
    </Omhulsel>
  );
}

function Omhulsel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
    </div>
  );
}

function Foutmelding({ tekst }: { tekst: string }) {
  return <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{tekst}</p>;
}

function Knop({
  children, onClick, soort, uit = false, breed = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  soort: 'paars' | 'grijs' | 'rood';
  uit?: boolean;
  breed?: boolean;
}) {
  const stijl = {
    paars: 'bg-gradient-to-r from-brand-purple to-brand-pink text-white',
    grijs: 'border border-slate-200 bg-white text-slate-700',
    rood: 'bg-rose-600 text-white',
  }[soort];
  return (
    <button
      onClick={onClick}
      disabled={uit}
      className={`h-12 ${breed ? 'w-full' : 'flex-1'} rounded-xl text-sm font-bold shadow-sm transition disabled:opacity-50 ${stijl}`}
    >
      {children}
    </button>
  );
}
