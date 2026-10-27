'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Wat de klant ziet als hij in een mail op "opnieuw bestellen" klikt: zijn
 * vorige batch, een aantal kiezen en betalen. Geen inlog en geen portaal
 * eromheen; na betaling start de levering vanzelf.
 */

type Keuze = { grootte: number; totaal_excl: number; totaal_incl: number; korting: number; btw: string };
type Gegevens = {
  bedrijf: string;
  contactpersoon: string | null;
  branche: string;
  prijs_per_lead: number;
  vorige_grootte: number;
  leads_per_dag: number | null;
  leads_per_week: number | null;
  met_filters: boolean;
  al_nabesteld: boolean;
  keuzes: Keuze[];
};
type OrderStand = { status: string; batch_size: number; actief: boolean };

const euro = (n: number) => n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });

export default function HerbestelClient({ id }: { id: string }) {
  const params = useSearchParams();
  const v = params.get('v') || '';
  const t = params.get('t') || '';
  const b = params.get('b') || '';
  const orderId = params.get('order');

  const [data, setData] = useState<Gegevens | null>(null);
  const [order, setOrder] = useState<OrderStand | null>(null);
  const [gekozen, setGekozen] = useState<number | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  const laad = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ v, t });
      if (orderId) qs.set('order', orderId);
      const r = await fetch(`/api/herbestellen/${id}?${qs}`, { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setFout(d.error || 'Deze link is niet (meer) geldig.'); return; }
      if (orderId) { setOrder(d.order); return; }
      setData(d);
      setGekozen(g => g ?? d.vorige_grootte);
    } catch {
      setFout('Er ging iets mis bij het laden.');
    } finally {
      setLaden(false);
    }
  }, [id, v, t, orderId]);

  useEffect(() => { void laad(); }, [laad]);

  /* Terug van Mollie: even blijven kijken tot de betaling binnen is. */
  useEffect(() => {
    if (!orderId || !order || order.status !== 'pending') return;
    const timer = setInterval(() => { void laad(); }, 3000);
    return () => clearInterval(timer);
  }, [orderId, order, laad]);

  const bestel = async () => {
    if (!gekozen) return;
    setBezig(true);
    setFout(null);
    try {
      const r = await fetch(`/api/herbestellen/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ v, t, b, grootte: gekozen }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.checkoutUrl) { setFout(d.error || 'Betaling starten mislukt.'); setBezig(false); return; }
      window.location.href = d.checkoutUrl;
    } catch {
      setFout('Betaling starten mislukt.');
      setBezig(false);
    }
  };

  if (laden) return <Omhulsel><div className="h-48 animate-pulse rounded-xl bg-slate-100" /></Omhulsel>;

  if (orderId && order) {
    const betaald = order.status === 'paid';
    const mislukt = order.status === 'failed' || order.status === 'expired' || order.status === 'cancelled';
    return (
      <Omhulsel>
        <div className="py-6 text-center">
          <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-2xl ${betaald ? 'bg-emerald-100' : mislukt ? 'bg-rose-100' : 'bg-slate-100'}`}>
            {betaald ? '✓' : mislukt ? '!' : '…'}
          </div>
          <h1 className="text-lg font-bold text-slate-900">
            {betaald ? 'Bedankt, je batch is besteld' : mislukt ? 'De betaling is niet gelukt' : 'Je betaling wordt verwerkt'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {betaald
              ? `De levering van ${order.batch_size} leads start direct. Je ontvangt de leads in je portaal en per mail.`
              : mislukt
                ? 'Er is niets afgeschreven. Je kunt het opnieuw proberen via de link in je mail.'
                : 'Dit duurt meestal een paar seconden.'}
          </p>
        </div>
      </Omhulsel>
    );
  }

  if (fout && !data) {
    return (
      <Omhulsel>
        <p className="text-center text-sm text-slate-600">{fout}</p>
        <p className="mt-2 text-center text-xs text-slate-400">Neem gerust contact op via 085 047 7067.</p>
      </Omhulsel>
    );
  }
  if (!data) return null;

  const keuze = data.keuzes.find(k => k.grootte === gekozen) ?? null;
  const tempo = data.leads_per_dag ? `maximaal ${data.leads_per_dag} per dag` : data.leads_per_week ? `maximaal ${data.leads_per_week} per week` : null;

  return (
    <Omhulsel>
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-purple">Opnieuw bestellen</p>
      <h1 className="mt-1 text-xl font-bold text-slate-900">{data.branche}-leads</h1>
      <p className="text-sm text-slate-500">{data.bedrijf}</p>

      <div className="mt-4 space-y-1 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
        <p>Zelfde voorwaarden als je vorige batch: <strong className="text-slate-900">{euro(data.prijs_per_lead)}</strong> per lead (excl. btw), zelfde regio{data.met_filters ? ' en filters' : ''}{tempo ? `, ${tempo}` : ''}.</p>
      </div>

      {data.al_nabesteld && (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Je hebt al een nieuwere batch in {data.branche} lopen of klaarstaan. Een extra batch komt daar gewoon bij.
        </p>
      )}

      <p className="mt-5 text-sm font-semibold text-slate-800">Hoeveel leads?</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {data.keuzes.map(k => (
          <button
            key={k.grootte}
            onClick={() => setGekozen(k.grootte)}
            className={`h-12 rounded-xl border text-sm font-semibold transition ${
              gekozen === k.grootte ? 'border-brand-purple bg-brand-purple text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-purple/40'
            }`}
          >
            {k.grootte}
            {k.grootte === data.vorige_grootte && <span className="block text-[10px] font-normal opacity-80">als vorige keer</span>}
          </button>
        ))}
      </div>

      {keuze && (
        <div className="mt-4 space-y-1 border-t border-slate-100 pt-4 text-sm">
          {keuze.korting > 0 && (
            <div className="flex justify-between text-emerald-700"><span>Welkomstkorting</span><span>-{euro(keuze.korting)}</span></div>
          )}
          <div className="flex justify-between text-slate-600"><span>Totaal excl. btw</span><span>{euro(keuze.totaal_excl)}</span></div>
          <div className="flex justify-between text-base font-bold text-slate-900"><span>Te betalen</span><span>{euro(keuze.totaal_incl)}</span></div>
          <p className="text-[11px] text-slate-400">{keuze.btw}</p>
        </div>
      )}

      {fout && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{fout}</p>}

      <button
        onClick={bestel}
        disabled={!keuze || bezig}
        className="mt-5 h-12 w-full rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink text-sm font-bold text-white shadow-sm transition disabled:opacity-50"
      >
        {bezig ? 'Even geduld...' : 'Bestellen en betalen'}
      </button>
      <p className="mt-2 text-center text-[11px] text-slate-400">Betalen via iDEAL, Bancontact of creditcard (Mollie). De levering start direct na betaling.</p>
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
