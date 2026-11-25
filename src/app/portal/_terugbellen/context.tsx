'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { portalFetch } from '@/lib/portalAuth';
import { popupFase, type PopupFase, type Terugbelmoment } from '@/lib/terugbellen';
import { apparaatKenmerk } from './apparaat';
import { speelSeintje } from './geluid';
import TerugbelPopup from './TerugbelPopup';
import TerugbelVenster from './TerugbelVenster';

/**
 * Terugbelmomenten in het hele portaal: laadt ze elke minuut, toont de pop-up
 * vijf minuten van tevoren en het venster om te plannen. Staat de functie uit
 * voor deze klant, dan blijft het bij één verzoek.
 */

export type PlanLead = { lead_id: string; naam: string };
export type TeOpenenLead = { lead_id: string; naam: string; telefoon: string | null };
export type LeadStatusEvent = { lead_id: string; status: string };
export const LEAD_STATUS_EVENT = 'wl-lead-status';
export const OPEN_LEAD_EVENT = 'wl-open-lead';

type Ctx = {
  aan: boolean;
  momenten: Terugbelmoment[];
  plan: (lead: PlanLead) => void;
  ververs: () => Promise<void>;
  /** Uitstellen of afhandelen; geeft een foutmelding terug of null. */
  wijzig: (m: Terugbelmoment, wijziging: { terug_op: string } | { uitkomst: string }) => Promise<string | null>;
  openLead: (lead: TeOpenenLead) => void;
  /** De lead die geopend moest worden vanaf een andere pagina (eenmalig). */
  neemTeOpenen: () => TeOpenenLead | null;
};

const LEEG: Ctx = {
  aan: false, momenten: [], plan: () => {}, ververs: async () => {}, wijzig: async () => null, openLead: () => {}, neemTeOpenen: () => null,
};
const TerugbelContext = createContext<Ctx>(LEEG);
export const useTerugbellen = () => useContext(TerugbelContext);

const VERVERS_MS = 60_000;
const TIK_MS = 5_000;
const MAX_POPUPS = 3;
const VERBORGEN_SLEUTEL = 'wl-terugbel-verborgen';

const popupSleutel = (m: Terugbelmoment, fase: PopupFase) => `${m.id}|${m.terug_op}|${fase}`;

function leesVerborgen(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(VERBORGEN_SLEUTEL) || '[]') as string[]);
  } catch {
    return new Set();
  }
}

export function TerugbelProvider({ alleenKijken, children }: { alleenKijken: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [aan, setAan] = useState(false);
  const [momenten, setMomenten] = useState<Terugbelmoment[]>([]);
  const [planLead, setPlanLead] = useState<PlanLead | null>(null);
  const [nu, setNu] = useState(() => Date.now());
  const [verborgen, setVerborgen] = useState<Set<string>>(new Set());
  const [geforceerd, setGeforceerd] = useState<string | null>(null);
  /* Wie al op "Bel nu" klikte, houdt de pop-up tot de uitkomst is gekozen. */
  const [inGesprek, setInGesprek] = useState<Set<string>>(new Set());
  const klokVerschil = useRef(0);
  const teOpenen = useRef<TeOpenenLead | null>(null);
  const gehoord = useRef(new Set<string>());
  const kanaal = useRef<BroadcastChannel | null>(null);

  const ververs = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    try {
      const apparaat = apparaatKenmerk();
      const res = await portalFetch(`/api/portal/terugbellen${apparaat ? `?apparaat=${encodeURIComponent(apparaat)}` : ''}`, { cache: 'no-store' });
      if (!res.ok) return;
      const d = (await res.json()) as { aan: boolean; nu?: string; momenten: Terugbelmoment[] };
      if (d.nu) klokVerschil.current = Date.parse(d.nu) - Date.now();
      setAan(d.aan);
      setMomenten(d.momenten ?? []);
      setNu(Date.now() + klokVerschil.current);
    } catch {
      /* geen verbinding: de volgende ronde probeert het opnieuw */
    }
  }, []);

  useEffect(() => {
    setVerborgen(leesVerborgen());
    const id = new URLSearchParams(window.location.search).get('terugbel');
    if (id) setGeforceerd(id);
    void ververs();
  }, [ververs]);

  /* Alleen blijven ophalen als de functie aanstaat. */
  useEffect(() => {
    if (!aan || alleenKijken) return;
    const ophalen = setInterval(() => void ververs(), VERVERS_MS);
    const tik = setInterval(() => setNu(Date.now() + klokVerschil.current), TIK_MS);
    const zichtbaar = () => { if (document.visibilityState === 'visible') void ververs(); };
    document.addEventListener('visibilitychange', zichtbaar);
    window.addEventListener('online', zichtbaar);
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel('wl-terugbellen');
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
  }, [aan, alleenKijken, ververs]);

  /* Een bestaande pushaanmelding aan deze gebruiker en browser koppelen; er wordt niets nieuws aangevraagd. */
  useEffect(() => {
    if (!aan || alleenKijken || !('serviceWorker' in navigator)) return;
    void (async () => {
      try {
        const sub = await (await navigator.serviceWorker.getRegistration('/'))?.pushManager?.getSubscription();
        if (sub) await portalFetch('/api/portal/push-subscribe', { method: 'POST', body: JSON.stringify({ subscription: sub.toJSON(), apparaat: apparaatKenmerk() }) });
      } catch { /* geen push beschikbaar */ }
    })();
  }, [aan, alleenKijken]);

  const meld = useCallback((detail: LeadStatusEvent) => {
    window.dispatchEvent(new CustomEvent(LEAD_STATUS_EVENT, { detail }));
    kanaal.current?.postMessage('gewijzigd');
  }, []);

  const wijzig = useCallback<Ctx['wijzig']>(async (m, wijziging) => {
    try {
      const res = await portalFetch(`/api/portal/terugbellen/${m.id}`, { method: 'PATCH', body: JSON.stringify(wijziging) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { void ververs(); return d.error || 'Opslaan mislukt'; }
      setInGesprek(s => { const n = new Set(s); n.delete(m.id); return n; });
      setGeforceerd(g => (g === m.id ? null : g));
      if ('uitkomst' in wijziging) {
        setMomenten(prev => prev.filter(x => x.id !== m.id));
        meld({ lead_id: m.lead_id, status: wijziging.uitkomst });
      } else {
        setMomenten(prev => prev.map(x => (x.id === m.id ? { ...x, terug_op: wijziging.terug_op } : x)));
        kanaal.current?.postMessage('gewijzigd');
      }
      void ververs();
      return null;
    } catch {
      return 'Geen verbinding, probeer het opnieuw';
    }
  }, [meld, ververs]);

  const openLead = useCallback((lead: TeOpenenLead) => {
    if (pathname === '/portal') window.dispatchEvent(new CustomEvent(OPEN_LEAD_EVENT, { detail: lead }));
    else { teOpenen.current = lead; router.push('/portal'); }
  }, [pathname, router]);
  const neemTeOpenen = useCallback(() => {
    const l = teOpenen.current;
    teOpenen.current = null;
    return l;
  }, []);

  const verberg = useCallback((sleutel: string) => {
    setVerborgen(prev => {
      const n = new Set(prev).add(sleutel);
      try { sessionStorage.setItem(VERBORGEN_SLEUTEL, JSON.stringify([...n].slice(-200))); } catch { /* vol of geblokkeerd */ }
      return n;
    });
  }, []);

  const popups = useMemo(() => {
    if (!aan || alleenKijken) return [];
    const uit: { m: Terugbelmoment; fase: PopupFase; sleutel: string }[] = [];
    for (const m of momenten) {
      const dwing = geforceerd === m.id || inGesprek.has(m.id);
      const fase = popupFase(m, nu) ?? (dwing ? (Date.parse(m.terug_op) > nu ? 'vooraf' : 'nu') : null);
      if (!fase) continue;
      const sleutel = popupSleutel(m, fase);
      if (!dwing && verborgen.has(sleutel)) continue;
      uit.push({ m, fase, sleutel });
    }
    return uit.sort((a, b) => Date.parse(a.m.terug_op) - Date.parse(b.m.terug_op)).slice(0, MAX_POPUPS);
  }, [aan, alleenKijken, momenten, nu, verborgen, geforceerd, inGesprek]);

  /* Geluid bij een nieuwe pop-up, één keer per moment en fase. */
  useEffect(() => {
    const nieuw = popups.filter(p => !gehoord.current.has(p.sleutel));
    if (nieuw.length === 0) return;
    nieuw.forEach(p => gehoord.current.add(p.sleutel));
    speelSeintje();
  }, [popups]);

  const plan = useCallback((lead: PlanLead) => setPlanLead(lead), []);
  const waarde = useMemo<Ctx>(
    () => ({ aan, momenten, plan, ververs, wijzig, openLead, neemTeOpenen }),
    [aan, momenten, plan, ververs, wijzig, openLead, neemTeOpenen],
  );

  return (
    <TerugbelContext.Provider value={waarde}>
      {children}
      <AnimatePresence>
        {aan && planLead && (
          <TerugbelVenster
            key={planLead.lead_id}
            lead={planLead}
            bestaand={momenten.find(m => m.lead_id === planLead.lead_id) ?? null}
            voorIedereenStandaard={alleenKijken}
            onSluit={() => setPlanLead(null)}
            onGepland={(leadId, iso) => {
              /* Net gepland binnen vijf minuten: niet meteen een pop-up van jezelf. */
              const bestaand = momenten.find(m => m.lead_id === leadId);
              if (bestaand) verberg(popupSleutel({ ...bestaand, terug_op: iso }, 'vooraf'));
              meld({ lead_id: leadId, status: 'terugbellen' });
              void ververs();
            }}
          />
        )}
      </AnimatePresence>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-stretch gap-2 p-3 sm:left-auto sm:right-4 sm:w-[380px] sm:p-0 sm:pb-4" aria-live="assertive">
        <AnimatePresence>
          {popups.map(p => (
            <TerugbelPopup
              key={p.m.id}
              moment={p.m}
              fase={p.fase}
              nu={nu}
              inGesprek={inGesprek.has(p.m.id)}
              onBel={() => setInGesprek(s => new Set(s).add(p.m.id))}
              onWijzig={w => wijzig(p.m, w)}
              onOpen={() => openLead(p.m)}
              onAnderMoment={() => setPlanLead({ lead_id: p.m.lead_id, naam: p.m.naam })}
              onSluit={() => {
                setGeforceerd(g => (g === p.m.id ? null : g));
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
