'use client';

import { useState } from 'react';
import { UserGroupIcon, ArrowsRightLeftIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { portalFetch } from '@/lib/portalAuth';

interface TeamLid { id: string; name: string; role: string }

/**
 * De adviseur van een bestaande afspraak wijzigen.
 *
 * Voorheen kon dit alleen via de knop Bewerken, die het hele formulier opende
 * en alle contactvelden opnieuw meestuurde. Hier is het één regel met één knop.
 *
 * Botst de nieuwe adviseur met een andere afspraak, dan zegt de server dat en
 * krijg je de keuze om het toch door te zetten. Dat laatste is soms gewenst,
 * maar moet een bewuste keuze zijn: tot nu toe werd er bij het wijzigen van
 * alleen de adviseur helemaal niets gecontroleerd.
 */
export function AdviseurToewijzen({
  appointmentId,
  huidigeAdviseurId,
  team,
  mag,
  onGewijzigd,
}: {
  appointmentId: string;
  huidigeAdviseurId: string | null;
  team: TeamLid[];
  mag: boolean;
  onGewijzigd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [keuze, setKeuze] = useState<string>(huidigeAdviseurId || '');
  const [bezig, setBezig] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  const huidige = team.find(m => m.id === huidigeAdviseurId);

  const bewaar = async (forceer = false) => {
    setBezig(true);
    setFout(null);
    try {
      const res = await portalFetch(`/api/portal/appointments/${appointmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          portal_user_id: keuze || null,
          ...(forceer ? { forceer_toewijzing: true } : {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 409 && d.conflict) { setConflict(d.error); return; }
      if (!res.ok) { setFout(d.error || 'Wijzigen mislukt'); return; }
      setOpen(false);
      setConflict(null);
      onGewijzigd();
    } finally {
      setBezig(false);
    }
  };

  if (team.length === 0) return null;

  return (
    <section className="mt-5">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <UserGroupIcon className="h-3.5 w-3.5" /> Adviseur
      </h3>

      {!open ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <p className="min-w-0 truncate text-sm text-slate-700">
            {huidige ? huidige.name : <span className="text-slate-400">Niemand toegewezen</span>}
          </p>
          {mag && (
            <button
              onClick={() => { setOpen(true); setKeuze(huidigeAdviseurId || ''); setConflict(null); }}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand-purple/50 hover:text-brand-purple"
            >
              <ArrowsRightLeftIcon className="h-3.5 w-3.5" />
              Wijzigen
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <select
            value={keuze}
            onChange={e => { setKeuze(e.target.value); setConflict(null); }}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-brand-purple/50"
          >
            <option value="">Niemand toewijzen</option>
            {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          {conflict && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="flex items-start gap-1.5 text-xs text-amber-900">
                <ExclamationTriangleIcon className="mt-px h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span>{conflict}</span>
              </p>
              <button
                onClick={() => bewaar(true)}
                disabled={bezig}
                className="mt-2 h-8 rounded-lg bg-amber-600 px-3 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Toch toewijzen
              </button>
            </div>
          )}

          {fout && <p className="text-xs text-rose-700">{fout}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => { setOpen(false); setConflict(null); setFout(null); }}
              disabled={bezig}
              className="h-10 flex-1 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 disabled:opacity-50"
            >
              Annuleren
            </button>
            <button
              onClick={() => bewaar(false)}
              disabled={bezig || keuze === (huidigeAdviseurId || '')}
              className="h-10 flex-1 rounded-lg bg-gradient-to-r from-brand-purple to-brand-pink text-sm font-bold text-white disabled:opacity-50"
            >
              {bezig ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
