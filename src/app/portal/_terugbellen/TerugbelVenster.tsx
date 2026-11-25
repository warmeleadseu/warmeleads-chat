'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { BellAlertIcon, ClockIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { portalFetch } from '@/lib/portalAuth';
import { PERMISSIONS } from '@/lib/portalPermissions';
import { amsterdamYmd } from '@/lib/appointmentSlots';
import { MAX_NOTITIE, momentLabel, nlNaarIso, nlTijd, snelkeuzes, type Terugbelmoment } from '@/lib/terugbellen';
import { usePortal } from '../portalContext';
import { usePushNotifications } from '../usePushNotifications';
import { MOTION, T } from '../_ui/tokens';
import { apparaatKenmerk } from './apparaat';
import type { PlanLead } from './context';

/** Vraagt één keer, na het plannen, of pushmeldingen aan mogen. */
function PushVraag({ onKlaar }: { onKlaar: () => void }) {
  const { state, toggling, enable, lastError } = usePushNotifications();
  useEffect(() => {
    /* Al aan of niet mogelijk: niets te vragen. */
    if (state === 'enabled' || state === 'unsupported' || state === 'denied') onKlaar();
  }, [state, onKlaar]);
  if (state === 'loading') return <p className="px-5 py-8 text-center text-sm text-slate-500">Een moment…</p>;
  return (
    <div className="space-y-3 px-5 py-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><BellAlertIcon className="h-5 w-5" /></span>
        <div>
          <p className="text-sm font-semibold text-slate-900">Ook een seintje als het portaal dicht is?</p>
          <p className="mt-0.5 text-sm text-slate-500">
            {state === 'ios-not-installed'
              ? 'Zet het portaal op je beginscherm (deelknop, "Zet op beginscherm") en open het daar. Daarna kun je meldingen aanzetten.'
              : 'Zet meldingen aan op dit apparaat. Je krijgt ze 5 minuten voor het terugbellen.'}
          </p>
        </div>
      </div>
      {lastError && <p className="text-xs text-red-600">{lastError}</p>}
      {state !== 'ios-not-installed' && (
        <button type="button" disabled={toggling} onClick={() => void enable()} className={`${T.btnPrimaryLg} w-full`}>{toggling ? 'Aanzetten…' : 'Meldingen aanzetten'}</button>
      )}
      <button type="button" onClick={onKlaar} className={`${T.btnSecondary} w-full`}>Niet nu</button>
    </div>
  );
}

const GEVRAAGD = 'wl-terugbel-push-gevraagd';

export default function TerugbelVenster({ lead, bestaand, voorIedereenStandaard, onSluit, onGepland }: {
  lead: PlanLead;
  bestaand: Terugbelmoment | null;
  voorIedereenStandaard: boolean;
  onSluit: () => void;
  onGepland: (leadId: string, iso: string) => void;
}) {
  const { portalUser, hasPermission } = usePortal();
  const [dag, setDag] = useState(() => amsterdamYmd(bestaand ? new Date(bestaand.terug_op) : new Date()));
  const [tijd, setTijd] = useState(() => (bestaand ? nlTijd(bestaand.terug_op) : ''));
  const [notitie, setNotitie] = useState(bestaand?.notitie ?? '');
  const [wie, setWie] = useState<string>(bestaand?.portal_user_id ?? portalUser?.id ?? '');
  const [iedereen, setIedereen] = useState(bestaand?.voor_iedereen ?? voorIedereenStandaard);
  const [team, setTeam] = useState<{ id: string; name: string }[]>([]);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [stap, setStap] = useState<'plan' | 'push'>('plan');
  const magToewijzen = !!portalUser && hasPermission(PERMISSIONS.LEADS_ASSIGN);

  useEffect(() => {
    const oud = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = oud; };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onSluit(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onSluit]);
  useEffect(() => {
    if (!magToewijzen) return;
    let weg = false;
    void portalFetch('/api/portal/team-list')
      .then(r => (r.ok ? r.json() : null))
      .then((d: { members?: { id: string; name: string }[] } | null) => { if (!weg && d?.members) setTeam(d.members); })
      .catch(() => {});
    return () => { weg = true; };
  }, [magToewijzen]);

  const gekozen = nlNaarIso(dag, tijd);

  const bewaar = async (iso: string | null) => {
    if (bezig) return;
    if (!iso) { setFout('Kies een datum en tijd'); return; }
    setBezig(true);
    setFout(null);
    try {
      const res = await portalFetch('/api/portal/terugbellen', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: lead.lead_id, terug_op: iso, notitie, voor_iedereen: iedereen,
          ...(wie ? { portal_user_id: wie } : {}), apparaat: apparaatKenmerk(),
        }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setFout(d.error || 'Opslaan mislukt'); return; }
      onGepland(lead.lead_id, iso);
      let vraag = false;
      try { vraag = !voorIedereenStandaard && !localStorage.getItem(GEVRAAGD); localStorage.setItem(GEVRAAGD, '1'); } catch { /* geblokkeerd */ }
      if (vraag) setStap('push');
      else onSluit();
    } catch {
      setFout('Geen verbinding, probeer het opnieuw');
    } finally {
      setBezig(false);
    }
  };

  if (typeof window === 'undefined') return null;
  return createPortal(
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm" onClick={onSluit} aria-hidden />
      <div className="pointer-events-none fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-4">
        <motion.div
          initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }} transition={MOTION.springSheet}
          role="dialog" aria-modal="true" aria-labelledby="terugbel-titel"
          className="pointer-events-auto flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="h-1 bg-warmeleads-gradient" />
          <header className="flex items-start gap-3 px-5 pb-2 pt-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><ClockIcon className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h2 id="terugbel-titel" className="text-base font-semibold text-slate-900">{bestaand ? 'Terugbellen verzetten' : 'Terugbellen inplannen'}</h2>
              <p className="truncate text-sm text-slate-500">{lead.naam}{bestaand ? ` · nu ${momentLabel(bestaand.terug_op)}` : ''}</p>
            </div>
            <button type="button" onClick={onSluit} aria-label="Sluiten" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><XMarkIcon className="h-5 w-5" /></button>
          </header>

          {stap === 'push' ? <PushVraag onKlaar={onSluit} /> : (
            <form className="flex min-h-0 flex-col" onSubmit={e => { e.preventDefault(); void bewaar(gekozen); }}>
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
                    <input type="date" required value={dag} min={amsterdamYmd(new Date())} onChange={e => setDag(e.target.value)} className={`${T.input} mt-1`} />
                  </label>
                  <label className="text-xs font-medium text-slate-500">Tijd
                    <input type="time" required value={tijd} onChange={e => setTijd(e.target.value)} className={`${T.input} mt-1`} />
                  </label>
                </div>
                <label className="block text-xs font-medium text-slate-500">Notitie (optioneel)
                  <textarea value={notitie} onChange={e => setNotitie(e.target.value)} maxLength={MAX_NOTITIE} rows={2} placeholder="Bijvoorbeeld: partner is dan thuis" className={`${T.textarea} mt-1`} />
                </label>
                {magToewijzen && team.length > 1 && !iedereen && (
                  <label className="block text-xs font-medium text-slate-500">Wie krijgt het seintje?
                    <select value={wie} onChange={e => setWie(e.target.value)} className={`${T.input} mt-1`}>
                      {team.map(t => <option key={t.id} value={t.id}>{t.name}{t.id === portalUser?.id ? ' (ik)' : ''}</option>)}
                    </select>
                  </label>
                )}
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={iedereen} onChange={e => setIedereen(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
                  <span>Iedereen een seintje geven<span className="block text-xs text-slate-400">{portalUser ? 'Anders alleen degene die hierboven staat.' : 'Anders alleen in deze browser.'} Pakt niemand het op, dan ziet iedereen het 2 minuten later.</span></span>
                </label>
                {fout && <p className="text-sm text-red-600">{fout}</p>}
              </div>
              <footer className="flex gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={onSluit} className={`${T.btnSecondary} flex-1`}>Annuleren</button>
                <button type="submit" disabled={bezig || !gekozen} className={`${T.btnPrimary} flex-1 disabled:opacity-50`}>{bezig ? 'Opslaan…' : gekozen ? `Bel terug ${momentLabel(gekozen)}` : 'Kies een tijd'}</button>
              </footer>
            </form>
          )}
        </motion.div>
      </div>
    </>,
    document.body,
  );
}
