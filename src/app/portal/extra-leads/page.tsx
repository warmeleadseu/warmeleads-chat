'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircleIcon, MapPinIcon, SparklesIcon, ArrowPathIcon, CreditCardIcon } from '@heroicons/react/24/outline';
import { portalFetch } from '@/lib/portalAuth';
import { formatCurrency } from '@/lib/portalFormat';
import { EmptyState, PageHeader, Skeleton, StickyCheckoutBar, T } from '../_ui';

/**
 * Extra leads: leads die buiten de regio's van onze klanten vielen en nog
 * nooit zijn geleverd, voor een vaste prijs per stuk. De klant ziet waar de
 * lead woont en wat hij invulde, maar geen naam of contactgegevens; die komen
 * na betaling in het portaal.
 */

type Lead = {
  id: string;
  branch: string;
  plaats: string | null;
  provincie: string | null;
  land: string | null;
  binnen: string;
  leeftijd: string;
  antwoorden: { label: string; waarde: string }[];
};
type Aanbod = {
  uitleg: string;
  prijs_excl: number;
  prijs_incl: number;
  verlegd: boolean;
  max_per_aankoop: number;
  mag_kopen: boolean;
  branches: { slug: string; naam: string }[];
  leads: Lead[];
};
type AankoopStand = { status: string; gekocht: number; geleverd: number; terugbetaald: number };

export default function ExtraLeadsPage() {
  const [aanbod, setAanbod] = useState<Aanbod | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [branche, setBranche] = useState<string>('');
  const [provincie, setProvincie] = useState<string>('');
  const [gekozen, setGekozen] = useState<Set<string>>(new Set());
  const [bezig, setBezig] = useState(false);
  const [aankoopId, setAankoopId] = useState<string | null>(null);
  const [stand, setStand] = useState<AankoopStand | null>(null);

  useEffect(() => {
    setAankoopId(new URLSearchParams(window.location.search).get('aankoop'));
  }, []);

  const laad = useCallback(async () => {
    setLaden(true);
    setFout(null);
    try {
      const r = await portalFetch('/api/portal/losse-leads');
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setFout(d.error || 'Het aanbod kon niet worden geladen.'); return; }
      setAanbod(d);
      setGekozen(prev => new Set([...prev].filter(id => (d.leads as Lead[]).some(l => l.id === id))));
    } catch {
      setFout('Het aanbod kon niet worden geladen.');
    } finally {
      setLaden(false);
    }
  }, []);

  useEffect(() => { void laad(); }, [laad]);

  /* Terug van Mollie: de stand van de aankoop volgen tot hij binnen is. */
  useEffect(() => {
    if (!aankoopId) return;
    let stop = false;
    const kijk = async () => {
      const r = await portalFetch(`/api/portal/losse-leads?aankoop=${aankoopId}`).catch(() => null);
      const d = r && r.ok ? await r.json().catch(() => null) : null;
      if (stop || !d?.aankoop) return;
      setStand(d.aankoop);
      if (d.aankoop.status === 'open') setTimeout(kijk, 3000);
      else void laad();
    };
    void kijk();
    return () => { stop = true; };
  }, [aankoopId, laad]);

  const brancheNaam = useCallback(
    (slug: string) => aanbod?.branches.find(b => b.slug === slug)?.naam ?? slug,
    [aanbod],
  );

  const perBranche = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of aanbod?.leads ?? []) m.set(l.branch, (m.get(l.branch) ?? 0) + 1);
    return m;
  }, [aanbod]);

  /* Standaard de branche met het meeste aanbod. */
  useEffect(() => {
    if (branche || perBranche.size === 0) return;
    setBranche([...perBranche.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  }, [perBranche, branche]);

  const inBranche = useMemo(() => (aanbod?.leads ?? []).filter(l => l.branch === branche), [aanbod, branche]);
  const provincies = useMemo(
    () => [...new Set(inBranche.map(l => l.provincie).filter((p): p is string => !!p))].sort(),
    [inBranche],
  );
  const zichtbaar = useMemo(() => inBranche.filter(l => !provincie || l.provincie === provincie), [inBranche, provincie]);

  const kiesBranche = (slug: string) => {
    setBranche(slug);
    setProvincie('');
    /* Per keer één branche: andere keuzes vervallen. */
    setGekozen(new Set());
  };

  const wissel = (id: string) => {
    setGekozen(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else if (n.size < (aanbod?.max_per_aankoop ?? 25)) n.add(id);
      return n;
    });
  };

  const totaal = (aanbod?.prijs_incl ?? 0) * gekozen.size;

  const afrekenen = async () => {
    if (gekozen.size === 0) return;
    setBezig(true);
    setFout(null);
    try {
      const r = await portalFetch('/api/portal/losse-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_ids: [...gekozen] }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.checkoutUrl) {
        setFout(d.error || 'Betaling starten mislukt.');
        setBezig(false);
        if (r.status === 409) void laad();
        return;
      }
      window.location.href = d.checkoutUrl;
    } catch {
      setFout('Betaling starten mislukt.');
      setBezig(false);
    }
  };

  return (
    <div className={`space-y-5 ${T.pagePaddingForSticky}`}>
      <PageHeader
        title="Extra leads"
        subtitle={aanbod ? `${formatCurrency(aanbod.prijs_excl)} per lead (excl. btw)` : undefined}
        action={
          <button type="button" onClick={() => void laad()} className={T.btnGhost} disabled={laden}>
            <ArrowPathIcon className={`h-4 w-4 ${laden ? 'animate-spin' : ''}`} /> Verversen
          </button>
        }
      />

      {stand && (
        <div className={`${T.card} ${T.cardPadding} ${stand.status === 'betaald' ? 'border-emerald-200 bg-emerald-50/50' : ''}`}>
          {stand.status === 'open' && <p className="text-sm text-slate-600">Je betaling wordt verwerkt…</p>}
          {stand.status === 'mislukt' && <p className="text-sm text-slate-600">De betaling is niet gelukt. Er is niets afgeschreven.</p>}
          {stand.status === 'betaald' && (
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="h-6 w-6 shrink-0 text-emerald-600" />
              <div className="text-sm text-slate-700">
                <p className="font-semibold text-slate-900">
                  {stand.geleverd > 0 ? `${stand.geleverd} lead${stand.geleverd === 1 ? '' : 's'} staan in je portaal` : 'De gekozen leads waren niet meer beschikbaar'}
                </p>
                {stand.terugbetaald > 0 && (
                  <p className="mt-0.5">{stand.gekocht - stand.geleverd} lead{stand.gekocht - stand.geleverd === 1 ? ' was' : 's waren'} intussen niet meer vrij; je krijgt {formatCurrency(stand.terugbetaald)} terug via Mollie.</p>
                )}
                {stand.geleverd > 0 && <a href="/portal" className="mt-1 inline-block font-semibold text-brand-purple hover:underline">Naar je leads →</a>}
              </div>
            </div>
          )}
        </div>
      )}

      {aanbod && (
        <div className="flex items-start gap-3 rounded-2xl border border-brand-purple/15 bg-brand-purple/5 p-4">
          <SparklesIcon className="h-5 w-5 shrink-0 text-brand-purple" />
          <p className="text-sm text-slate-700">{aanbod.uitleg} Na betaling staan naam en contactgegevens direct in je portaal.</p>
        </div>
      )}

      {laden && !aanbod ? (
        <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton.Bar key={i} className="h-24" />)}</div>
      ) : fout && !aanbod ? (
        <EmptyState title="Er ging iets mis" body={fout} cta={<button className={T.btnSecondary} onClick={() => void laad()}>Opnieuw proberen</button>} />
      ) : aanbod && aanbod.leads.length === 0 ? (
        <EmptyState icon={SparklesIcon} title="Op dit moment geen extra leads" body="Zodra er een lead buiten de regio's valt, verschijnt hij hier. Kijk later nog eens." />
      ) : aanbod ? (
        <>
          <div className="flex flex-wrap gap-2">
            {aanbod.branches.filter(b => perBranche.has(b.slug)).map(b => (
              <button
                key={b.slug}
                type="button"
                onClick={() => kiesBranche(b.slug)}
                className={`min-h-10 rounded-xl border px-3.5 text-sm font-semibold transition ${
                  branche === b.slug ? 'border-brand-purple bg-brand-purple text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-purple/40'
                }`}
              >
                {b.naam} <span className="opacity-70">({perBranche.get(b.slug)})</span>
              </button>
            ))}
          </div>

          {provincies.length > 1 && (
            <select value={provincie} onChange={e => setProvincie(e.target.value)} className={`${T.input} sm:max-w-xs`}>
              <option value="">Alle provincies</option>
              {provincies.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}

          <div className="space-y-2.5">
            {zichtbaar.map(l => {
              const aan = gekozen.has(l.id);
              const vol = !aan && gekozen.size >= aanbod.max_per_aankoop;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => aanbod.mag_kopen && wissel(l.id)}
                  disabled={!aanbod.mag_kopen || vol}
                  className={`${T.tileBase} w-full ${aan ? T.tileActive : T.tileIdle} disabled:cursor-default disabled:opacity-70`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        <MapPinIcon className="h-4 w-4 shrink-0 text-slate-400" />
                        {[l.plaats, l.provincie].filter(Boolean).join(', ') || 'Onbekende plaats'}
                        {l.land && l.land !== 'NL' && <span className="text-xs font-normal text-slate-400">({l.land})</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{brancheNaam(l.branch)} · {l.leeftijd}</p>
                      {l.antwoorden.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {l.antwoorden.map(a => (
                            <span key={a.label} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                              {a.label}: <span className="font-medium text-slate-800">{a.waarde}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {aanbod.mag_kopen && (
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${aan ? 'border-brand-purple bg-brand-purple text-white' : 'border-slate-300'}`}>
                        {aan && <CheckCircleIcon className="h-4 w-4" />}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {!aanbod.mag_kopen && (
            <p className="text-xs text-slate-500">Je hebt geen rechten om te bestellen. Vraag de eigenaar van het account om deze leads te kopen.</p>
          )}
          {fout && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{fout}</p>}

          {aanbod.mag_kopen && (
            <div className={`${T.card} ${T.cardPadding} hidden items-center justify-between gap-4 sm:flex`}>
              <div>
                <p className="text-sm font-semibold text-slate-900">{gekozen.size} lead{gekozen.size === 1 ? '' : 's'} gekozen</p>
                <p className={T.helper}>
                  {aanbod.verlegd ? 'BTW verlegd' : 'Incl. 21% btw'} · maximaal {aanbod.max_per_aankoop} per keer
                </p>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-lg font-bold text-brand-purple">{formatCurrency(totaal)}</p>
                <button type="button" onClick={afrekenen} disabled={bezig || gekozen.size === 0} className={T.btnPrimary}>
                  {bezig ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <CreditCardIcon className="h-5 w-5" />}
                  Afrekenen
                </button>
              </div>
            </div>
          )}
          {aanbod.mag_kopen && gekozen.size > 0 && (
            <StickyCheckoutBar
              total={totaal}
              onCheckout={afrekenen}
              submitting={bezig}
              label={`${gekozen.size} lead${gekozen.size === 1 ? '' : 's'} afrekenen`}
              totalLabel={aanbod.verlegd ? 'Totaal (btw verlegd)' : 'Totaal incl. btw'}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
