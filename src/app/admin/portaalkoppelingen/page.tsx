'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { LinkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

/**
 * Beheer van koppelingen tussen klantportalen.
 *
 * Een koppeling geeft het ene portaal het recht afspraken in te boeken in de
 * agenda van het andere. Gericht: dat Infinite Scale voor installateur X mag
 * boeken, betekent niet dat X ook in hun agenda mag.
 */

interface Koppeling {
  id: string;
  bron_customer_id: string;
  doel_customer_id: string;
  branches: string[] | null;
  verbruikt_batch: boolean;
  deelt_leadgegevens: boolean;
  mag_wijzigen_tot_bevestiging: boolean;
  actief: boolean;
  notities: string | null;
  bron: { name: string } | null;
  doel: { name: string } | null;
}

interface Klant { id: string; name: string; branches: string[] | null }

export default function PortaalkoppelingenPage() {
  const [koppelingen, setKoppelingen] = useState<Koppeling[]>([]);
  const [klanten, setKlanten] = useState<Klant[]>([]);
  const [laden, setLaden] = useState(true);
  const [nieuw, setNieuw] = useState(false);
  const [bron, setBron] = useState('');
  const [doel, setDoel] = useState('');
  const [verbruiktBatch, setVerbruiktBatch] = useState(true);
  const [deeltLeads, setDeeltLeads] = useState(false);
  const [magWijzigen, setMagWijzigen] = useState(true);
  const [notities, setNotities] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  const laad = useCallback(async () => {
    setLaden(true);
    try {
      const [kRes, cRes] = await Promise.all([
        adminFetch('/api/admin/portaalkoppelingen'),
        /* De lichte keuzelijst-route, niet /api/admin/customers. Die laatste
           kapt af op 100 klanten gesorteerd op naam, waardoor de lijst bij 213
           klanten ergens rond de K ophield. */
        adminFetch('/api/admin/customers/options?active=1'),
      ]);
      if (kRes.ok) setKoppelingen(await kRes.json());
      if (cRes.ok) {
        const d = await cRes.json();
        const lijst: Klant[] = Array.isArray(d) ? d : (d.customers ?? []);
        setKlanten(lijst.map(c => ({ id: c.id, name: c.name, branches: c.branches ?? null })));
      }
    } finally {
      setLaden(false);
    }
  }, []);

  useEffect(() => { laad(); }, [laad]);

  const gesorteerdeKlanten = useMemo(
    () => [...klanten].sort((a, b) => a.name.localeCompare(b.name, 'nl')),
    [klanten],
  );

  const maak = async () => {
    if (!bron || !doel) { setFout('Kies een bron en een doel'); return; }
    setBezig(true);
    setFout(null);
    try {
      const res = await adminFetch('/api/admin/portaalkoppelingen', {
        method: 'POST',
        body: JSON.stringify({
          bron_customer_id: bron,
          doel_customer_id: doel,
          verbruikt_batch: verbruiktBatch,
          deelt_leadgegevens: deeltLeads,
          mag_wijzigen_tot_bevestiging: magWijzigen,
          notities: notities.trim() || null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setFout(d.error || 'Aanmaken mislukt'); return; }
      setNieuw(false);
      setBron(''); setDoel(''); setNotities('');
      laad();
    } finally {
      setBezig(false);
    }
  };

  const wissel = async (k: Koppeling, veld: keyof Koppeling) => {
    await adminFetch('/api/admin/portaalkoppelingen', {
      method: 'PATCH',
      body: JSON.stringify({ id: k.id, [veld]: !k[veld] }),
    });
    laad();
  };

  const deactiveer = async (k: Koppeling) => {
    if (!confirm(`Koppeling van ${k.bron?.name} naar ${k.doel?.name} uitzetten?`)) return;
    await adminFetch(`/api/admin/portaalkoppelingen?id=${k.id}`, { method: 'DELETE' });
    laad();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <LinkIcon className="h-5 w-5 text-brand-purple" />
            Portaalkoppelingen
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Geeft een klantportaal het recht afspraken in te boeken in de agenda van een ander portaal.
          </p>
        </div>
        <button
          onClick={() => setNieuw(v => !v)}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink px-4 text-sm font-bold text-white"
        >
          <PlusIcon className="h-4 w-4" /> Nieuwe koppeling
        </button>
      </div>

      {nieuw && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Wie mag boeken (bron)</label>
              <select value={bron} onChange={e => setBron(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-2 text-sm">
                <option value="">Kies een klant</option>
                {gesorteerdeKlanten.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">In wiens agenda (doel)</label>
              <select value={doel} onChange={e => setDoel(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-2 text-sm">
                <option value="">Kies een klant</option>
                {gesorteerdeKlanten.filter(c => c.id !== bron).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <Schakelaar
            aan={verbruiktBatch}
            zet={setVerbruiktBatch}
            titel="Verbruikt een afsprakenplek bij de ontvanger"
            uitleg="Staat dit aan, dan telt de afspraak mee in hun afsprakenbatch en wordt hij dus gefactureerd. Meestal is dat precies de bedoeling."
          />
          <Schakelaar
            aan={deeltLeads}
            zet={setDeeltLeads}
            titel="Deelt de lead achter de afspraak"
            uitleg="Staat dit aan, dan kan de ontvanger de volledige lead in zijn portaal openen. Dat is feitelijk een leadlevering. Staat het uit, dan krijgt hij alleen de contactgegevens die bij de afspraak zelf horen."
          />
          <Schakelaar
            aan={magWijzigen}
            zet={setMagWijzigen}
            titel="Boeker mag wijzigen tot bevestiging"
            uitleg="De boekende partij kan verzetten of annuleren zolang de ontvanger de afspraak niet heeft bevestigd. Daarna niet meer."
          />

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Notitie (optioneel)</label>
            <input value={notities} onChange={e => setNotities(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />
          </div>

          {fout && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{fout}</p>}

          <div className="flex gap-2">
            <button onClick={() => setNieuw(false)} className="h-10 flex-1 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600">Annuleren</button>
            <button onClick={maak} disabled={bezig} className="h-10 flex-1 rounded-lg bg-gradient-to-r from-brand-purple to-brand-pink text-sm font-bold text-white disabled:opacity-50">
              {bezig ? 'Aanmaken...' : 'Koppeling aanmaken'}
            </button>
          </div>
        </div>
      )}

      {laden ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div>
      ) : koppelingen.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-14 text-center">
          <LinkIcon className="mx-auto mb-3 h-10 w-10 text-slate-200" />
          <p className="text-sm font-medium text-slate-400">Nog geen koppelingen</p>
          <p className="mt-1 text-xs text-slate-400">Koppel bijvoorbeeld een callcenter aan de installateurs waarvoor het belt.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {koppelingen.map(k => (
            <div key={k.id} className={`rounded-2xl border bg-white p-4 ${k.actief ? 'border-slate-200' : 'border-slate-200 opacity-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">
                    {k.bron?.name} <span className="font-normal text-slate-400">boekt in de agenda van</span> {k.doel?.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {k.branches && k.branches.length > 0 ? `Alleen: ${k.branches.join(', ')}` : 'Alle branches'}
                    {!k.actief && ' · uitgezet'}
                  </p>
                  {k.notities && <p className="mt-1 text-xs text-slate-400">{k.notities}</p>}
                </div>
                {k.actief && (
                  <button onClick={() => deactiveer(k)} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Uitzetten">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>

              {k.actief && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Vinkje aan={k.verbruikt_batch} label="Verbruikt batchplek" onClick={() => wissel(k, 'verbruikt_batch')} />
                  <Vinkje aan={k.deelt_leadgegevens} label="Deelt lead" onClick={() => wissel(k, 'deelt_leadgegevens')} />
                  <Vinkje aan={k.mag_wijzigen_tot_bevestiging} label="Wijzigen tot bevestiging" onClick={() => wissel(k, 'mag_wijzigen_tot_bevestiging')} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Schakelaar({ aan, zet, titel, uitleg }: { aan: boolean; zet: (v: boolean) => void; titel: string; uitleg: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <input type="checkbox" checked={aan} onChange={e => zet(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#7c3aed]" />
      <div>
        <p className="text-sm font-semibold text-slate-800">{titel}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{uitleg}</p>
      </div>
    </label>
  );
}

function Vinkje({ aan, label, onClick }: { aan: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
        aan ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
      }`}
    >
      {aan ? '✓ ' : '✕ '}{label}
    </button>
  );
}
