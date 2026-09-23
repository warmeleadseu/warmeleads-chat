'use client';

import { useState } from 'react';
import { MapPinIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { portalFetch } from '@/lib/portalAuth';
import { isGeldigGebied, type AgentGebied } from '@/lib/agentGebied';

/**
 * Werkgebied van een agent als plaats met een zelf gekozen straal.
 *
 * Naast de provincievinkjes, niet in plaats daarvan: een agent kan Limburg
 * hebben én een cirkel rond Zwolle. De plaats wordt bij toevoegen meteen
 * opgezocht en met de gevonden naam bevestigd, zodat je ziet dat hij Roermond
 * in Limburg heeft gevonden en niet iets anders.
 */
export function GebiedenKiezer({
  gebieden,
  onChange,
}: {
  gebieden: AgentGebied[];
  onChange: (g: AgentGebied[]) => void;
}) {
  const [plaats, setPlaats] = useState('');
  const [straal, setStraal] = useState('25');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const voegToe = async () => {
    const naam = plaats.trim();
    const km = Number(straal.replace(',', '.'));

    if (naam.length < 2) { setFout('Vul een plaatsnaam in'); return; }
    if (!Number.isFinite(km) || km <= 0 || km > 500) { setFout('Vul een straal in tussen 1 en 500 km'); return; }

    setBezig(true);
    setFout(null);
    try {
      const res = await portalFetch(`/api/portal/plaats-zoeken?q=${encodeURIComponent(naam)}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setFout(d.error || 'Plaats niet gevonden'); return; }

      const nieuw: AgentGebied = {
        label: d.label,
        lat: d.lat,
        lng: d.lng,
        radius_km: Math.round(km),
        land: d.land ?? null,
      };
      if (!isGeldigGebied(nieuw)) { setFout('De plaats kon niet worden vastgelegd'); return; }

      /* Dezelfde plaats twee keer heeft geen zin; de ruimste straal wint. */
      const zonderDubbele = gebieden.filter(
        g => g.label.toLowerCase() !== nieuw.label.toLowerCase(),
      );
      const bestaande = gebieden.find(g => g.label.toLowerCase() === nieuw.label.toLowerCase());
      if (bestaande) nieuw.radius_km = Math.max(bestaande.radius_km, nieuw.radius_km);

      onChange([...zonderDubbele, nieuw]);
      setPlaats('');
    } catch {
      setFout('Opzoeken mislukt');
    } finally {
      setBezig(false);
    }
  };

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Regio&apos;s (plaats en straal)
      </p>

      {gebieden.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {gebieden.map(g => (
            <span
              key={g.label}
              className="inline-flex items-center gap-1 rounded-lg border border-brand-purple bg-brand-purple/10 px-2.5 py-1 text-xs font-medium text-brand-purple"
            >
              <MapPinIcon className="h-3.5 w-3.5" />
              {g.label}{g.land ? ` (${g.land})` : ''} · {g.radius_km} km
              <button
                type="button"
                onClick={() => onChange(gebieden.filter(x => x.label !== g.label))}
                className="ml-0.5 rounded p-0.5 hover:bg-brand-purple/20"
                aria-label={`${g.label} verwijderen`}
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={plaats}
          onChange={e => { setPlaats(e.target.value); setFout(null); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); voegToe(); } }}
          placeholder="Plaatsnaam, bijvoorbeeld Roermond"
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-purple/50"
        />
        <div className="flex h-9 w-24 shrink-0 items-center rounded-lg border border-slate-200 px-2">
          <input
            value={straal}
            onChange={e => { setStraal(e.target.value); setFout(null); }}
            inputMode="numeric"
            className="w-full min-w-0 bg-transparent text-sm outline-none"
          />
          <span className="shrink-0 text-xs text-slate-400">km</span>
        </div>
        <button
          type="button"
          onClick={voegToe}
          disabled={bezig}
          className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-brand-purple/50 hover:text-brand-purple disabled:opacity-50"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          {bezig ? 'Zoeken...' : 'Toevoegen'}
        </button>
      </div>

      {fout && <p className="mt-1 text-[11px] text-rose-600">{fout}</p>}
      {!fout && gebieden.length === 0 && (
        <p className="mt-1 text-[10px] text-slate-400">
          Optioneel, naast of in plaats van provincies. Controleer na het toevoegen het land:
          sommige plaatsnamen bestaan in Nederland én België.
        </p>
      )}
    </div>
  );
}
