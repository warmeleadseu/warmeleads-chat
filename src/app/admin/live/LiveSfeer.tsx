'use client';

import { useEffect, useState } from 'react';
import type { SlideId } from '@/lib/liveSlides';

/**
 * Sfeer voor het live-dashboard (12 nov 2026): een levende lucht achter alles,
 * vrolijke icoontjes en een paar speelse onderdelen. Het scherm hangt op
 * kantoor, ook voor klanten die binnenlopen. Alles hier is decoratie of een
 * extra beeld bij een cijfer dat er al staat: de cijfers zelf blijven groot,
 * wit en goed leesbaar.
 *
 * Beweging alleen met CSS-animaties op transform en opacity: licht genoeg
 * voor een tv-stick. Bij "minder beweging" zet globals.css alle animaties
 * stil, en laat de lucht de zwevende lichtjes weg.
 */

/* ─── Tijd van de dag ─────────────────────────────────────────────── */

export type Dagdeel = 'ochtend' | 'middag' | 'avond' | 'nacht';

export function dagdeelVan(d: Date): Dagdeel {
  const u = Number(d.toLocaleString('nl-NL', { hour: 'numeric', hour12: false, timeZone: 'Europe/Amsterdam' }));
  if (u >= 6 && u < 12) return 'ochtend';
  if (u >= 12 && u < 18) return 'middag';
  if (u >= 18 && u < 23) return 'avond';
  return 'nacht';
}

export const GROET: Record<Dagdeel, { tekst: string; emoji: string }> = {
  ochtend: { tekst: 'Goedemorgen', emoji: '🌅' },
  middag: { tekst: 'Goedemiddag', emoji: '☀️' },
  avond: { tekst: 'Goedenavond', emoji: '🌇' },
  nacht: { tekst: 'Goedenacht', emoji: '🌙' },
};

/** Kleuren van de lucht per dagdeel: twee grote zachte vlekken en een gloed onderaan. */
const LUCHT: Record<Dagdeel, [string, string, string]> = {
  ochtend: ['rgba(251,146,60,0.22)', 'rgba(244,114,182,0.18)', 'rgba(52,211,153,0.16)'],
  middag: ['rgba(56,189,248,0.20)', 'rgba(167,139,250,0.20)', 'rgba(52,211,153,0.18)'],
  avond: ['rgba(249,115,22,0.22)', 'rgba(219,39,119,0.22)', 'rgba(139,92,246,0.18)'],
  nacht: ['rgba(99,102,241,0.22)', 'rgba(14,165,233,0.14)', 'rgba(168,85,247,0.16)'],
};

/* Vaste posities (geen Math.random bij renderen: anders verschilt server en client). */
const STERREN = [
  [6, 8, 2], [14, 22, 1.5], [23, 6, 2.5], [31, 15, 1.5], [42, 9, 2], [51, 19, 1.5], [58, 5, 2], [66, 13, 2.5],
  [73, 24, 1.5], [81, 8, 2], [88, 18, 1.5], [95, 6, 2], [9, 31, 1.5], [37, 28, 1.5], [62, 30, 1.5], [91, 29, 1.5],
] as const;
const LICHTJES = [
  [8, 0, 14, 7], [17, 6, 18, 9], [26, 3, 16, 6], [35, 9, 20, 10], [47, 1, 15, 8], [55, 7, 19, 6],
  [64, 4, 17, 9], [72, 10, 21, 7], [83, 2, 16, 8], [92, 8, 18, 10], [41, 12, 22, 6], [77, 14, 20, 8],
] as const;
const LICHTJE_KLEUR = ['#fde68a', '#6ee7b7', '#f9a8d4', '#a5b4fc', '#7dd3fc'];

function Wolk({ top, schaal, duur, vertraging, dekking }: { top: number; schaal: number; duur: number; vertraging: number; dekking: number }) {
  return (
    <div
      className="absolute left-0"
      style={{ top: `${top}%`, opacity: dekking, animation: `lvWolk ${duur}s linear ${vertraging}s infinite`, willChange: 'transform' }}
    >
      <svg width={260 * schaal} height={90 * schaal} viewBox="0 0 260 90">
        <g fill="#e0e7ff">
          <ellipse cx="70" cy="58" rx="62" ry="28" />
          <ellipse cx="128" cy="40" rx="58" ry="38" />
          <ellipse cx="190" cy="58" rx="58" ry="26" />
          <rect x="20" y="58" width="220" height="28" rx="14" />
        </g>
      </svg>
    </div>
  );
}

function Vogels({ top, duur, vertraging }: { top: number; duur: number; vertraging: number }) {
  return (
    <div className="absolute left-0" style={{ top: `${top}%`, animation: `lvVogels ${duur}s linear ${vertraging}s infinite`, opacity: 0 }}>
      <svg width="120" height="50" viewBox="0 0 120 50" fill="none" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" opacity="0.5">
        <path d="M8 22 q8 -10 16 0 q8 -10 16 0" />
        <path d="M58 10 q6 -8 12 0 q6 -8 12 0" />
        <path d="M78 34 q5 -7 10 0 q5 -7 10 0" />
      </svg>
    </div>
  );
}

/** De lucht achter alles: kleurvlekken die traag bewegen, sterren, wolken, vogels en zwevende lichtjes. */
export function LevendeLucht({ dagdeel, reducedMotion }: { dagdeel: Dagdeel; reducedMotion: boolean }) {
  const [a, b, c] = LUCHT[dagdeel];
  const donker = dagdeel === 'nacht' || dagdeel === 'avond';
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute -left-[10%] -top-[30%] h-[80%] w-[60%] rounded-full" style={{ background: `radial-gradient(closest-side, ${a}, transparent)`, animation: 'lvVlek1 38s ease-in-out infinite alternate' }} />
      <div className="absolute -right-[10%] -top-[20%] h-[75%] w-[55%] rounded-full" style={{ background: `radial-gradient(closest-side, ${b}, transparent)`, animation: 'lvVlek2 46s ease-in-out infinite alternate' }} />
      <div className="absolute -bottom-[35%] left-[15%] h-[70%] w-[70%] rounded-full" style={{ background: `radial-gradient(closest-side, ${c}, transparent)`, animation: 'lvVlek1 52s ease-in-out infinite alternate-reverse' }} />

      {donker &&
        STERREN.map(([x, y, r], i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{ left: `${x}%`, top: `${y}%`, width: r * 2, height: r * 2, opacity: 0.5, animation: `lvTwinkel ${3 + (i % 4)}s ease-in-out ${i * 0.37}s infinite` }}
          />
        ))}

      {!reducedMotion && (
        <>
          <Wolk top={7} schaal={1.1} duur={150} vertraging={-40} dekking={dagdeel === 'nacht' ? 0.04 : 0.07} />
          <Wolk top={18} schaal={0.7} duur={190} vertraging={-120} dekking={dagdeel === 'nacht' ? 0.03 : 0.06} />
          <Wolk top={12} schaal={0.85} duur={170} vertraging={-75} dekking={dagdeel === 'nacht' ? 0.03 : 0.05} />
          {!donker && <Vogels top={14} duur={60} vertraging={5} />}
          {LICHTJES.map(([x, v, duur, maat], i) => (
            <span
              key={i}
              className="absolute bottom-0 rounded-full"
              style={{
                left: `${x}%`,
                width: maat,
                height: maat,
                background: LICHTJE_KLEUR[i % LICHTJE_KLEUR.length],
                boxShadow: `0 0 ${maat * 2}px ${LICHTJE_KLEUR[i % LICHTJE_KLEUR.length]}`,
                opacity: 0,
                animation: `lvOpstijgen ${duur}s linear ${-v * 1.7}s infinite`,
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

/* ─── Icoontjes ───────────────────────────────────────────────────── */

export type ChipKleur = 'oranje' | 'groen' | 'blauw' | 'paars' | 'roze' | 'geel';

const CHIP: Record<ChipKleur, string> = {
  oranje: 'from-orange-400 to-rose-500 shadow-orange-500/30',
  groen: 'from-emerald-400 to-teal-500 shadow-emerald-500/30',
  blauw: 'from-sky-400 to-indigo-500 shadow-sky-500/30',
  paars: 'from-violet-400 to-fuchsia-500 shadow-violet-500/30',
  roze: 'from-pink-400 to-rose-500 shadow-pink-500/30',
  geel: 'from-amber-300 to-orange-400 shadow-amber-500/30',
};

/** Rond, kleurig bolletje met een emoji: het icoontje van een tegel. */
export function IcoonChip({ emoji, kleur, maat = 64, zweef = false }: { emoji: string; kleur: ChipKleur; maat?: number; zweef?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg ${CHIP[kleur]}`}
      style={{ width: maat, height: maat, fontSize: maat * 0.52, animation: zweef ? 'lvZweef 5s ease-in-out infinite' : undefined }}
    >
      <span className="leading-none drop-shadow-sm">{emoji}</span>
    </span>
  );
}

export const ONDERWERP_EMOJI: Record<SlideId, string> = {
  vandaag: '⚡',
  batches: '🔋',
  geld: '💶',
  team: '🏆',
  actie: '🎁',
};

const BRANCHE_EMOJI: Record<string, string> = {
  thuisbatterij: '🔋',
  airco: '❄️',
  zonnepanelen: '☀️',
  warmtepomp: '🔥',
  laadpaal: '🔌',
  isolatie: '🏠',
};
export const brancheEmoji = (branche: string) => BRANCHE_EMOJI[branche] ?? '⚡';

/* ─── Energiemeter ────────────────────────────────────────────────── */

/**
 * Ring die vol loopt met de omzet van de laatste 24 uur, vergeleken met de
 * 24 uur daarvoor. Vol = even goed als gisteren; daarboven gloeit hij goud
 * en loopt een tweede ronde. Een extra beeld bij het getal ernaast.
 */
export function EnergieMeter({ nu, vorige, reducedMotion }: { nu: number; vorige: number; reducedMotion: boolean }) {
  const verhouding = vorige > 0 ? nu / vorige : nu > 0 ? 1 : 0;
  const [getoond, setGetoond] = useState(reducedMotion ? verhouding : 0);
  useEffect(() => {
    if (reducedMotion) { setGetoond(verhouding); return; }
    const t = setTimeout(() => setGetoond(verhouding), 250);
    return () => clearTimeout(t);
  }, [verhouding, reducedMotion]);

  const r = 150;
  const omtrek = 2 * Math.PI * r;
  const eerste = Math.min(1, getoond);
  const tweede = Math.min(1, Math.max(0, getoond - 1));
  const boven = verhouding >= 1;
  const pct = Math.round(verhouding * 100);

  return (
    <div className="relative flex h-[380px] w-[380px] shrink-0 items-center justify-center">
      <div
        className="absolute inset-6 rounded-full"
        style={{ background: boven ? 'radial-gradient(closest-side, rgba(252,211,77,0.28), transparent)' : 'radial-gradient(closest-side, rgba(52,211,153,0.2), transparent)', animation: 'lvPuls 3.5s ease-in-out infinite' }}
      />
      <svg viewBox="0 0 380 380" className="absolute inset-0 -rotate-90">
        <defs>
          <linearGradient id="lvMeterGroen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
          <linearGradient id="lvMeterGoud" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
        <circle cx="190" cy="190" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="26" />
        <circle
          cx="190" cy="190" r={r} fill="none" stroke="url(#lvMeterGroen)" strokeWidth="26" strokeLinecap="round"
          strokeDasharray={`${eerste * omtrek} ${omtrek}`}
          style={{ transition: reducedMotion ? undefined : 'stroke-dasharray 1.8s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
        {tweede > 0 && (
          <circle
            cx="190" cy="190" r={r} fill="none" stroke="url(#lvMeterGoud)" strokeWidth="26" strokeLinecap="round"
            strokeDasharray={`${tweede * omtrek} ${omtrek}`}
            style={{ transition: reducedMotion ? undefined : 'stroke-dasharray 1.8s cubic-bezier(0.22, 1, 0.36, 1) 1.2s', filter: 'drop-shadow(0 0 10px rgba(251,191,36,0.6))' }}
          />
        )}
      </svg>
      <div className="relative text-center">
        <p className="text-[34px] leading-none">{boven ? '🚀' : '⚡'}</p>
        <p className={`mt-2 text-[76px] font-black leading-none tabular-nums ${boven ? 'text-amber-300' : 'text-white'}`}>{pct}%</p>
        <p className="mt-2 text-[22px] font-semibold text-white/55">van de vorige 24 uur</p>
      </div>
    </div>
  );
}

/* ─── Animaties ───────────────────────────────────────────────────── */

export const SFEER_CSS = `
@keyframes lvVlek1 { from { transform: translate3d(0,0,0) scale(1); } to { transform: translate3d(8%,6%,0) scale(1.12); } }
@keyframes lvVlek2 { from { transform: translate3d(0,0,0) scale(1.05); } to { transform: translate3d(-7%,8%,0) scale(0.95); } }
@keyframes lvTwinkel { 0%,100% { opacity: 0.15; transform: scale(0.8); } 50% { opacity: 0.8; transform: scale(1.15); } }
@keyframes lvWolk { from { transform: translate3d(-320px,0,0); } to { transform: translate3d(2100px,0,0); } }
@keyframes lvVogels { 0% { transform: translate3d(-160px,0,0); opacity: 0; } 4% { opacity: 1; } 40% { transform: translate3d(2080px,-60px,0); opacity: 1; } 41%,100% { opacity: 0; transform: translate3d(2080px,-60px,0); } }
@keyframes lvOpstijgen { 0% { transform: translate3d(0,0,0); opacity: 0; } 10% { opacity: 0.55; } 80% { opacity: 0.35; } 100% { transform: translate3d(30px,-1080px,0); opacity: 0; } }
@keyframes lvZweef { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-6px) rotate(-4deg); } }
@keyframes lvPuls { 0%,100% { transform: scale(0.94); opacity: 0.7; } 50% { transform: scale(1.04); opacity: 1; } }
@keyframes lvGlans { 0% { transform: translateX(-120%); } 60%,100% { transform: translateX(320%); } }
@keyframes lvStreep { from { background-position: 0 0; } to { background-position: 56px 0; } }
@keyframes lvSchitter { 0%,100% { opacity: 0; transform: scale(0.4) rotate(0deg); } 50% { opacity: 1; transform: scale(1) rotate(90deg); } }
`;
