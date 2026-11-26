'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { BellAlertIcon, ClockIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { amsterdamYmd } from '@/lib/appointmentSlots';
import { leesMoment, momentLabel, nlNaarIso, nlTijd, snelkeuzes } from '@/lib/terugbellen';
import { SEINTJE_KEUZES, STANDAARD_SEINTJE, TERUGBEL_TITEL, type SeintjeMin } from '@/lib/prospectTerugbellen';
import { useAdminPush } from './useAdminPush';

export type TeplannenProspect = {
  prospect_id: string;
  bedrijf: string;
  /** Bestaande afspraak verzetten in plaats van een nieuwe te maken. */
  taak?: { id: string; due_at: string; seintje_min: SeintjeMin; description: string | null } | null;
};
export type GeplandeTaak = { id: string; prospect_id: string; [k: string]: unknown };

const MAX_NOTITIE = 500;
const GEVRAAGD = 'wl-admin-terugbel-push-gevraagd';

function PushVraag({ seintje, onKlaar }: { seintje: number; onKlaar: () => void }) {
  const { state, bezig, fout, zetAan } = useAdminPush();
  useEffect(() => {
    if (state === 'enabled' || state === 'unsupported' || state === 'denied') onKlaar();
  }, [state, onKlaar]);
  if (state === 'loading') return <p className="px-5 py-8 text-center text-sm text-slate-500">Een moment…</p>;
  return (
    <div className="space-y-3 px-5 py-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><BellAlertIcon className="h-5 w-5" /></span>
        <div>
          <p className="text-sm font-semibold text-slate-900">Ook een melding als het admin-paneel dicht is?</p>
          <p className="mt-0.5 text-sm text-slate-500">
            {state === 'ios-not-installed'
              ? 'Zet de site op je beginscherm (deelknop, "Zet op beginscherm") en open hem daar. Daarna kun je meldingen aanzetten.'
              : `Zet meldingen aan in deze browser. Je krijgt ze ${seintje} minuten voor het terugbellen.`}
          </p>
        </div>
      </div>
      {fout && <p className="text-xs text-rose-600">{fout}</p>}
      {state !== 'ios-not-installed' && (
        <button type="button" disabled={bezig} onClick={() => void zetAan()} className="min-h-[44px] w-full rounded-lg bg-brand-purple px-4 text-sm font-semibold text-white hover:bg-brand-purple/90 disabled:opacity-50">
          {bezig ? 'Aanzetten…' : 'Meldingen aanzetten'}
        </button>
      )}
      <button type="button" onClick={onKlaar} className="min-h-[44px] w-full rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50">Niet nu</button>
    </div>
  );
}

/** Venster om een prospect terug te bellen: tijdstip, seintje vooraf en een notitie. */
export default function TerugbelInplannen({ doel, adminId, onSluit, onGepland }: {
  doel: TeplannenProspect;
  adminId: string;
  onSluit: () => void;
  onGepland: (taak: GeplandeTaak | null) => void;
}) {
  const bestaand = doel.taak ?? null;
  const [dag, setDag] = useState(() => amsterdamYmd(bestaand ? new Date(bestaand.due_at) : new Date()));
  const [tijd, setTijd] = useState(() => (bestaand ? nlTijd(bestaand.due_at) : ''));
  const [seintje, setSeintje] = useState<SeintjeMin>(bestaand?.seintje_min ?? STANDAARD_SEINTJE);
  const [notitie, setNotitie] = useState(bestaand?.description ?? '');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [stap, setStap] = useState<'plan' | 'push'>('plan');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onSluit(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onSluit]);

  const gekozen = nlNaarIso(dag, tijd);

  const bewaar = async () => {
    if (bezig) return;
    const check = leesMoment(gekozen ?? undefined);
    if (!check.ok) { setFout(gekozen ? check.fout : 'Kies een datum en tijd'); return; }
    setBezig(true);
    setFout(null);
    try {
      const res = bestaand
        ? await adminFetch(`/api/admin/prospects/tasks/${bestaand.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ due_at: check.iso, seintje_min: seintje, description: notitie.trim() || null }),
        })
        : await adminFetch(`/api/admin/prospects/${doel.prospect_id}/tasks`, {
          method: 'POST',
          body: JSON.stringify({ type: 'call', title: TERUGBEL_TITEL, description: notitie.trim() || null, due_at: check.iso, seintje_min: seintje, assigned_to_admin_id: adminId }),
        });
      const d = (await res.json().catch(() => ({}))) as { error?: string; task?: GeplandeTaak };
      if (!res.ok) { setFout(d.error || 'Opslaan mislukt'); return; }
      onGepland(d.task ?? null);
      let vraag = false;
      try {
        vraag = typeof Notification !== 'undefined' && Notification.permission === 'default' && !localStorage.getItem(GEVRAAGD);
        localStorage.setItem(GEVRAAGD, '1');
      } catch { /* geblokkeerd */ }
      if (vraag) setStap('push');
      else onSluit();
    } catch {
      setFout('Geen verbinding, probeer het opnieuw');
    } finally {
      setBezig(false);
    }
  };

  if (typeof window === 'undefined') return null;
  const invoer = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-purple/50';
  return createPortal(
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] bg-black/40" onClick={onSluit} aria-hidden />
      <div className="pointer-events-none fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-4">
        <motion.div
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'tween', duration: 0.2 }}
          role="dialog" aria-modal="true" aria-labelledby="prospect-terugbel-titel"
          className="pointer-events-auto flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
          onClick={e => e.stopPropagation()}
        >
          <header className="flex items-start gap-3 px-5 pb-2 pt-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><ClockIcon className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h2 id="prospect-terugbel-titel" className="text-base font-semibold text-slate-900">{bestaand ? 'Terugbellen verzetten' : 'Terugbellen inplannen'}</h2>
              <p className="truncate text-sm text-slate-500">{doel.bedrijf}{bestaand ? ` · nu ${momentLabel(bestaand.due_at)}` : ''}</p>
            </div>
            <button type="button" onClick={onSluit} aria-label="Sluiten" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><XMarkIcon className="h-5 w-5" /></button>
          </header>

          {stap === 'push' ? <PushVraag seintje={seintje} onKlaar={onSluit} /> : (
            <form className="flex min-h-0 flex-col" onSubmit={e => { e.preventDefault(); void bewaar(); }}>
              <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {snelkeuzes().map(k => (
                    <button key={k.label} type="button" disabled={bezig} onClick={() => { setDag(amsterdamYmd(new Date(k.iso))); setTijd(nlTijd(k.iso)); setFout(null); }}
                      className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition ${gekozen === k.iso ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                      {k.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-medium text-slate-500">Datum
                    <input type="date" required value={dag} min={amsterdamYmd(new Date())} onChange={e => setDag(e.target.value)} className={invoer} />
                  </label>
                  <label className="text-xs font-medium text-slate-500">Tijd
                    <input type="time" required value={tijd} onChange={e => setTijd(e.target.value)} className={invoer} />
                  </label>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Seintje vooraf</p>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {SEINTJE_KEUZES.map(m => (
                      <button key={m} type="button" onClick={() => setSeintje(m)} aria-pressed={seintje === m}
                        className={`min-h-10 rounded-lg border text-sm font-semibold transition ${seintje === m ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                        {m} minuten
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block text-xs font-medium text-slate-500">Notitie (optioneel)
                  <textarea value={notitie} onChange={e => setNotitie(e.target.value)} maxLength={MAX_NOTITIE} rows={2} placeholder="Bijvoorbeeld: eigenaar is dan terug van vakantie" className={invoer} />
                </label>
                {fout && <p className="text-sm text-rose-600">{fout}</p>}
              </div>
              <footer className="flex gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={onSluit} className="min-h-[44px] flex-1 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50">Annuleren</button>
                <button type="submit" disabled={bezig || !gekozen} className="min-h-[44px] flex-1 rounded-lg bg-brand-purple px-3 text-sm font-semibold text-white hover:bg-brand-purple/90 disabled:opacity-50">
                  {bezig ? 'Opslaan…' : gekozen ? `Bel terug ${momentLabel(gekozen)}` : 'Kies een tijd'}
                </button>
              </footer>
            </form>
          )}
        </motion.div>
      </div>
    </>,
    document.body,
  );
}
