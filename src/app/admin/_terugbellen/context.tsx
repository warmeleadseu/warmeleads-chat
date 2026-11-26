'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { adminFetch } from '@/lib/adminAuth';
import { prospectPopupFase, type ProspectPopupFase, type ProspectTerugbelmoment } from '@/lib/prospectTerugbellen';
import { speelSeintje } from '@/app/portal/_terugbellen/geluid';
import { koppelBestaandeAanmelding } from './useAdminPush';
import ProspectTerugbelPopup, { type PopupWijziging } from './ProspectTerugbelPopup';
import TerugbelInplannen, { type GeplandeTaak, type TeplannenProspect } from './TerugbelInplannen';

/**
 * Terugbelafspraken met prospects in het hele admin-paneel (migratie 203):
 * haalt ze elke minuut op, toont de pop-up 5 of 15 minuten van tevoren en het
 * venster om in te plannen. Wijzigt er een taak, dan hoort de prospectlijst dat
 * via PROSPECT_TAAK_EVENT.
 */

export const PROSPECT_TAAK_EVENT = 'wl-prospect-taak';
export type ProspectTaakEvent = { prospect_id: string };

type Ctx = {
  /** Staat de functie aan (migratie 203 toegepast)? */
  aan: boolean;
  plan: (doel: TeplannenProspect, onGepland?: (taak: GeplandeTaak | null) => void) => void;
};
const TerugbelContext = createContext<Ctx>({ aan: false, plan: () => {} });
export const useProspectTerugbellen = () => useContext(TerugbelContext);

const VERVERS_MS = 60_000;
const TIK_MS = 5_000;
const MAX_POPUPS = 3;
const VERBORGEN_SLEUTEL = 'wl-admin-terugbel-verborgen';

const popupSleutel = (m: ProspectTerugbelmoment, fase: ProspectPopupFase) => `${m.id}|${m.due_at}|${fase}`;

function leesVerborgen(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(VERBORGEN_SLEUTEL) || '[]') as string[]);
  } catch {
    return new Set();
  }
}

export function ProspectTerugbelProvider({ adminId, children }: { adminId: string; children: React.ReactNode }) {
  const router = useRouter();
  const [aan, setAan] = useState(false);
  const [momenten, setMomenten] = useState<ProspectTerugbelmoment[]>([]);
  const [nu, setNu] = useState(() => Date.now());
  const [verborgen, setVerborgen] = useState<Set<string>>(new Set());
  const [inGesprek, setInGesprek] = useState<Set<string>>(new Set());
  const [planDoel, setPlanDoel] = useState<{ doel: TeplannenProspect; onGepland?: (t: GeplandeTaak | null) => void } | null>(null);
  const klokVerschil = useRef(0);
  const gehoord = useRef(new Set<string>());
  const kanaal = useRef<BroadcastChannel | null>(null);

  const ververs = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    try {
      const res = await adminFetch('/api/admin/terugbellen', { cache: 'no-store' });
      if (!res.ok) return;
      const d = (await res.json()) as { aan?: boolean; nu?: string; momenten?: ProspectTerugbelmoment[] };
      setAan(d.aan !== false);
      if (d.nu) klokVerschil.current = Date.parse(d.nu) - Date.now();
      setMomenten(d.momenten ?? []);
      setNu(Date.now() + klokVerschil.current);
    } catch {
      /* geen verbinding: volgende ronde opnieuw */
    }
  }, []);

  useEffect(() => {
    setVerborgen(leesVerborgen());
    void ververs();
    void koppelBestaandeAanmelding();
    const ophalen = setInterval(() => void ververs(), VERVERS_MS);
    const tik = setInterval(() => setNu(Date.now() + klokVerschil.current), TIK_MS);
    const zichtbaar = () => { if (document.visibilityState === 'visible') void ververs(); };
    document.addEventListener('visibilitychange', zichtbaar);
    window.addEventListener('online', zichtbaar);
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel('wl-admin-terugbellen');
      bc.onmessage = () => void ververs();
      kanaal.current = bc;
    }
    return () => {
      clearInterval(ophalen);
      clearInterval(tik);
      document.removeEventListener('visibilitychange', zichtbaar);
      window.removeEventListener('online', zichtbaar);
      bc?.close();
      kanaal.current = null;
    };
  }, [adminId, ververs]);

  const meld = useCallback((prospectId: string) => {
    window.dispatchEvent(new CustomEvent<ProspectTaakEvent>(PROSPECT_TAAK_EVENT, { detail: { prospect_id: prospectId } }));
    kanaal.current?.postMessage('gewijzigd');
  }, []);

  const verberg = useCallback((sleutel: string) => {
    setVerborgen(prev => {
      const n = new Set(prev).add(sleutel);
      try { sessionStorage.setItem(VERBORGEN_SLEUTEL, JSON.stringify([...n].slice(-200))); } catch { /* vol of geblokkeerd */ }
      return n;
    });
  }, []);

  const wijzig = useCallback(async (m: ProspectTerugbelmoment, w: PopupWijziging): Promise<string | null> => {
    try {
      const res = await adminFetch(`/api/admin/prospects/tasks/${m.id}`, { method: 'PATCH', body: JSON.stringify(w) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { void ververs(); return d.error || 'Opslaan mislukt'; }
      setInGesprek(s => { const n = new Set(s); n.delete(m.id); return n; });
      if ('completed' in w) setMomenten(prev => prev.filter(x => x.id !== m.id));
      else setMomenten(prev => prev.map(x => (x.id === m.id ? { ...x, due_at: w.due_at } : x)));
      meld(m.prospect_id);
      void ververs();
      return null;
    } catch {
      return 'Geen verbinding, probeer het opnieuw';
    }
  }, [meld, ververs]);

  const plan = useCallback<Ctx['plan']>((doel, onGepland) => setPlanDoel({ doel, onGepland }), []);

  const popups = useMemo(() => {
    const uit: { m: ProspectTerugbelmoment; fase: ProspectPopupFase; sleutel: string }[] = [];
    for (const m of momenten) {
      const bezig = inGesprek.has(m.id);
      const fase = prospectPopupFase(m, nu) ?? (bezig ? 'nu' : null);
      if (!fase) continue;
      const sleutel = popupSleutel(m, fase);
      if (!bezig && verborgen.has(sleutel)) continue;
      uit.push({ m, fase, sleutel });
    }
    return uit.sort((a, b) => Date.parse(a.m.due_at) - Date.parse(b.m.due_at)).slice(0, MAX_POPUPS);
  }, [momenten, nu, verborgen, inGesprek]);

  useEffect(() => {
    const nieuw = popups.filter(p => !gehoord.current.has(p.sleutel));
    if (nieuw.length === 0) return;
    nieuw.forEach(p => gehoord.current.add(p.sleutel));
    speelSeintje();
  }, [popups]);

  const waarde = useMemo<Ctx>(() => ({ aan, plan }), [aan, plan]);

  return (
    <TerugbelContext.Provider value={waarde}>
      {children}
      <AnimatePresence>
        {planDoel && (
          <TerugbelInplannen
            key={planDoel.doel.taak?.id ?? planDoel.doel.prospect_id}
            doel={planDoel.doel}
            adminId={adminId}
            onSluit={() => setPlanDoel(null)}
            onGepland={taak => {
              const d = planDoel.doel;
              /* Net gepland of verzet binnen het seintje: niet meteen een pop-up van jezelf. */
              if (d.taak) setInGesprek(s => { const n = new Set(s); n.delete(d.taak!.id); return n; });
              if (taak && typeof taak.due_at === 'string') verberg(`${taak.id}|${taak.due_at}|vooraf`);
              planDoel.onGepland?.(taak);
              meld(d.prospect_id);
              void ververs();
            }}
          />
        )}
      </AnimatePresence>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-stretch gap-2 p-3 sm:left-auto sm:right-4 sm:w-[380px] sm:p-0 sm:pb-4" aria-live="assertive">
        <AnimatePresence>
          {popups.map(p => (
            <ProspectTerugbelPopup
              key={p.m.id}
              moment={p.m}
              fase={p.fase}
              nu={nu}
              inGesprek={inGesprek.has(p.m.id)}
              onBel={() => setInGesprek(s => new Set(s).add(p.m.id))}
              onWijzig={w => wijzig(p.m, w)}
              onOpen={() => router.push(`/admin/prospects?id=${p.m.prospect_id}`)}
              onAnderMoment={() => setPlanDoel({
                doel: { prospect_id: p.m.prospect_id, bedrijf: p.m.bedrijf, taak: { id: p.m.id, due_at: p.m.due_at, seintje_min: p.m.seintje_min, description: p.m.description } },
              })}
              onSluit={() => {
                setInGesprek(s => { const n = new Set(s); n.delete(p.m.id); return n; });
                verberg(p.sleutel);
              }}
            />
          ))}
        </AnimatePresence>
      </div>
    </TerugbelContext.Provider>
  );
}
