'use client';

import { useState, useEffect, useCallback } from 'react';
import { portalFetch } from '@/lib/portalAuth';

/**
 * Een afspraak verzetten naar een nieuw slot.
 *
 * Kiest uit dezelfde beschikbare slots als het inplannen, inclusief reistijd en
 * bezetting van de adviseur. De server maakt er een opvolger van en sluit de
 * oude afspraak; zie de route voor waarom dat geen datumwijziging is.
 */

interface Slot { start: string; end: string }

function datumInvoer(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function VerzetPaneel({
  appointmentId,
  branch,
  portalUserId,
  huidigeStart,
  onKlaar,
  onAnnuleer,
}: {
  appointmentId: string;
  branch: string;
  portalUserId: string | null;
  huidigeStart: string;
  onKlaar: () => void;
  onAnnuleer: () => void;
}) {
  const [datum, setDatum] = useState(() => datumInvoer(new Date(huidigeStart)));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [laden, setLaden] = useState(false);
  const [gekozen, setGekozen] = useState<string | null>(null);
  const [reden, setReden] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const haalSlots = useCallback(async () => {
    setLaden(true);
    setGekozen(null);
    try {
      const van = new Date(`${datum}T00:00:00`);
      const tot = new Date(`${datum}T23:59:59`);
      const q = new URLSearchParams({
        from: van.toISOString(),
        to: tot.toISOString(),
        branch,
        /* De afspraak die we verzetten mag zijn eigen nieuwe plek niet
           blokkeren; hij verdwijnt zo toch uit de agenda. */
        exclude_id: appointmentId,
      });
      if (portalUserId) q.set('portal_user_id', portalUserId);
      const res = await portalFetch(`/api/portal/appointment-slots?${q.toString()}`);
      if (res.ok) {
        const d = await res.json();
        setSlots(d.slots || []);
      } else {
        setSlots([]);
      }
    } finally {
      setLaden(false);
    }
  }, [datum, branch, portalUserId, appointmentId]);

  useEffect(() => { haalSlots(); }, [haalSlots]);

  const verzet = async () => {
    if (!gekozen) return;
    setBezig(true);
    setFout(null);
    try {
      const res = await portalFetch(`/api/portal/appointments/${appointmentId}/verzetten`, {
        method: 'POST',
        body: JSON.stringify({ starts_at: gekozen, reden: reden.trim() || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setFout(d.error || 'Verzetten mislukt'); return; }
      onKlaar();
    } catch {
      setFout('Er ging iets mis');
    } finally {
      setBezig(false);
    }
  };

  return (
    <section className="mt-5 space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
      <p className="text-xs font-semibold text-amber-900">Verzetten naar een nieuw moment</p>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Nieuwe datum</label>
        <input
          type="date"
          value={datum}
          onChange={e => setDatum(e.target.value)}
          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none"
        />
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-slate-600">Beschikbare tijden</p>
        {laden ? (
          <div className="grid grid-cols-4 gap-1.5">
            {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <div key={i} className="h-9 animate-pulse rounded-lg bg-white/70" />)}
          </div>
        ) : slots.length === 0 ? (
          <p className="rounded-lg bg-white/70 px-3 py-3 text-xs text-slate-500">
            Geen vrije tijden op deze dag. Kies een andere datum.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {slots.map(s => {
              const t = new Date(s.start);
              const label = t.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
              return (
                <button
                  key={s.start}
                  onClick={() => setGekozen(s.start)}
                  className={`h-9 rounded-lg border text-xs font-semibold transition ${
                    gekozen === s.start
                      ? 'border-brand-purple bg-brand-purple text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-brand-purple/50'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Reden (optioneel)</label>
        <input
          value={reden}
          onChange={e => setReden(e.target.value)}
          placeholder="Bijvoorbeeld: klant was verhinderd"
          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none"
        />
      </div>

      {fout && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{fout}</p>}

      <div className="flex gap-2">
        <button onClick={onAnnuleer} disabled={bezig} className="h-10 flex-1 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          Terug
        </button>
        <button onClick={verzet} disabled={bezig || !gekozen} className="h-10 flex-1 rounded-lg bg-gradient-to-r from-brand-purple to-brand-pink text-sm font-bold text-white shadow-sm disabled:opacity-50">
          {bezig ? 'Verzetten...' : 'Verzetten'}
        </button>
      </div>
    </section>
  );
}
