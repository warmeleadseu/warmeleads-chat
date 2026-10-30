'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { SlideId } from '@/lib/liveSlides';

/**
 * Een zacht, "washed" duurzaamheidstafereel achter elke slide: windmolens,
 * daken met zonnepanelen, bomen en bladeren in lage dekking. Het maakt het
 * wallboard frisser zonder de cijfers te overstemmen; alles blijft
 * decoratie (pointer-events uit, aria-hidden).
 *
 * Getekend als SVG in plaats van foto's: geen licenties, niets extra te
 * laden en op elke tv scherp. Ontwerpmaat 1920 x 1080, net als de stage.
 */

const W = 1920;
const H = 1080;

/* Pastelkleuren; de lage dekking zit op de hele laag. */
const KLEUR = {
  blad: '#a7f3d0',
  bladDonker: '#6ee7b7',
  heuvel: '#34d399',
  wit: '#f8fafc',
  zon: '#fde68a',
  paneel: '#93c5fd',
  dak: '#c4b5fd',
  oranje: '#fdba74',
};

function Zon({ x, y, r, stralen = true }: { x: number; y: number; r: number; stralen?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r * 2.4} fill="url(#zonGloed)" />
      <circle cx={x} cy={y} r={r} fill={KLEUR.zon} opacity={0.9} />
      {stralen &&
        Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={x + Math.cos(a) * r * 1.3}
              y1={y + Math.sin(a) * r * 1.3}
              x2={x + Math.cos(a) * r * 1.75}
              y2={y + Math.sin(a) * r * 1.75}
              stroke={KLEUR.zon}
              strokeWidth={r * 0.08}
              strokeLinecap="round"
              opacity={0.7}
            />
          );
        })}
    </g>
  );
}

/** Windmolen met langzaam draaiende wieken; voet op (x, y), hoogte h. */
function Molen({ x, y, h, duur = 16, beweging }: { x: number; y: number; h: number; duur?: number; beweging: boolean }) {
  const top = y - h;
  const wiek = h * 0.48;
  return (
    <g>
      <path d={`M ${x - h * 0.022} ${y} L ${x - h * 0.008} ${top} L ${x + h * 0.008} ${top} L ${x + h * 0.022} ${y} Z`} fill={KLEUR.wit} />
      <g
        style={{
          transformBox: 'view-box',
          transformOrigin: `${x}px ${top}px`,
          animation: beweging ? `molenDraai ${duur}s linear infinite` : undefined,
        }}
      >
        {[0, 120, 240].map(hoek => (
          <path
            key={hoek}
            transform={`rotate(${hoek} ${x} ${top})`}
            d={`M ${x} ${top} C ${x + wiek * 0.08} ${top - wiek * 0.3}, ${x + wiek * 0.05} ${top - wiek * 0.8}, ${x} ${top - wiek} C ${x - wiek * 0.03} ${top - wiek * 0.7}, ${x - wiek * 0.04} ${top - wiek * 0.3}, ${x} ${top} Z`}
            fill={KLEUR.wit}
          />
        ))}
      </g>
      <circle cx={x} cy={top} r={h * 0.025} fill={KLEUR.wit} />
    </g>
  );
}

/** Huis met zonnepanelen op het dak, van voren gezien; linksonder op (x, y), breedte b. */
function Huis({ x, y, b, panelen = true }: { x: number; y: number; b: number; panelen?: boolean }) {
  const muur = b * 0.6;
  const nok = b * 0.42;
  const onder = y - muur;
  const boven = onder - nok;
  /* Dak als trapezium: breed aan de goot, smaller bij de nok. */
  const links = (t: number) => x - b * 0.06 + (b * 0.2) * (1 - t);
  const rechts = (t: number) => x + b * 1.06 - (b * 0.2) * (1 - t);
  const yOp = (t: number) => boven + nok * t;
  const rijen = 2;
  const kolommen = 4;
  const cellen: string[] = [];
  if (panelen) {
    for (let r = 0; r < rijen; r++) {
      const t0 = 0.18 + r * 0.38;
      const t1 = t0 + 0.32;
      for (let k = 0; k < kolommen; k++) {
        const punt = (t: number, f: number) => {
          const l = links(t) + b * 0.12;
          const rr = rechts(t) - b * 0.12;
          return `${l + (rr - l) * f},${yOp(t)}`;
        };
        const f0 = k / kolommen + 0.012;
        const f1 = (k + 1) / kolommen - 0.012;
        cellen.push([punt(t0, f0), punt(t0, f1), punt(t1, f1), punt(t1, f0)].join(' '));
      }
    }
  }
  return (
    <g>
      <rect x={x} y={onder} width={b} height={muur} fill={KLEUR.wit} opacity={0.85} rx={b * 0.02} />
      <path d={`M ${links(1)} ${onder} L ${links(0)} ${boven} L ${rechts(0)} ${boven} L ${rechts(1)} ${onder} Z`} fill={KLEUR.dak} />
      {cellen.map((p, i) => <polygon key={i} points={p} fill={KLEUR.paneel} />)}
      <rect x={x + b * 0.16} y={y - muur * 0.58} width={b * 0.2} height={muur * 0.58} fill={KLEUR.dak} opacity={0.8} />
      <rect x={x + b * 0.52} y={y - muur * 0.74} width={b * 0.28} height={muur * 0.3} fill={KLEUR.paneel} opacity={0.6} />
    </g>
  );
}

function Boom({ x, y, h }: { x: number; y: number; h: number }) {
  return (
    <g>
      <rect x={x - h * 0.035} y={y - h * 0.45} width={h * 0.07} height={h * 0.45} fill={KLEUR.wit} opacity={0.7} />
      <circle cx={x} cy={y - h * 0.62} r={h * 0.26} fill={KLEUR.bladDonker} />
      <circle cx={x - h * 0.17} cy={y - h * 0.5} r={h * 0.18} fill={KLEUR.blad} />
      <circle cx={x + h * 0.18} cy={y - h * 0.52} r={h * 0.19} fill={KLEUR.blad} />
    </g>
  );
}

function Blad({ x, y, l, hoek, kleur = KLEUR.blad }: { x: number; y: number; l: number; hoek: number; kleur?: string }) {
  return (
    <g transform={`rotate(${hoek} ${x} ${y})`}>
      <path d={`M ${x} ${y} C ${x + l * 0.35} ${y - l * 0.35}, ${x + l * 0.8} ${y - l * 0.25}, ${x + l} ${y} C ${x + l * 0.8} ${y + l * 0.25}, ${x + l * 0.35} ${y + l * 0.35}, ${x} ${y} Z`} fill={kleur} />
      <line x1={x + l * 0.05} y1={y} x2={x + l * 0.9} y2={y} stroke={KLEUR.wit} strokeWidth={l * 0.025} opacity={0.6} />
    </g>
  );
}

/** Een plantje: steel met bladeren, voet op (x, y). */
function Spruit({ x, y, h }: { x: number; y: number; h: number }) {
  return (
    <g>
      <path d={`M ${x} ${y} C ${x - h * 0.08} ${y - h * 0.4}, ${x + h * 0.08} ${y - h * 0.7}, ${x} ${y - h}`} stroke={KLEUR.bladDonker} strokeWidth={h * 0.035} fill="none" strokeLinecap="round" />
      <Blad x={x} y={y - h * 0.45} l={h * 0.45} hoek={-35} />
      <Blad x={x} y={y - h * 0.65} l={h * 0.4} hoek={-150} kleur={KLEUR.bladDonker} />
      <Blad x={x} y={y - h} l={h * 0.35} hoek={-70} />
    </g>
  );
}

function Heuvels({ hoog = 0 }: { hoog?: number }) {
  return (
    <g>
      <path d={`M 0 ${H - 210 - hoog} C 320 ${H - 330 - hoog}, 640 ${H - 170 - hoog}, 980 ${H - 250 - hoog} C 1320 ${H - 330 - hoog}, 1620 ${H - 200 - hoog}, ${W} ${H - 280 - hoog} L ${W} ${H} L 0 ${H} Z`} fill={KLEUR.heuvel} opacity={0.55} />
      <path d={`M 0 ${H - 120 - hoog} C 420 ${H - 220 - hoog}, 760 ${H - 90 - hoog}, 1180 ${H - 160 - hoog} C 1500 ${H - 210 - hoog}, 1760 ${H - 120 - hoog}, ${W} ${H - 150 - hoog} L ${W} ${H} L 0 ${H} Z`} fill={KLEUR.blad} opacity={0.7} />
    </g>
  );
}

function Tafereel({ id, beweging }: { id: SlideId; beweging: boolean }) {
  switch (id) {
    case 'vandaag':
      return (
        <>
          <Zon x={1660} y={230} r={95} />
          <Heuvels />
          <Molen x={1180} y={835} h={430} beweging={beweging} />
          <Molen x={1400} y={870} h={330} duur={13} beweging={beweging} />
          <Molen x={1590} y={850} h={260} duur={11} beweging={beweging} />
          <Boom x={140} y={930} h={230} />
          <Boom x={300} y={960} h={170} />
        </>
      );
    case 'batches':
      return (
        <>
          <Zon x={260} y={200} r={70} />
          <Heuvels hoog={-40} />
          {[60, 330, 600, 870, 1140, 1410, 1680].map((x, i) => (
            <Huis key={x} x={x} y={1040 - (i % 2) * 18} b={200 - (i % 3) * 14} />
          ))}
          <Boom x={300} y={1040} h={140} />
          <Boom x={1110} y={1040} h={150} />
        </>
      );
    case 'geld':
      return (
        <>
          <Zon x={W / 2} y={-20} r={150} />
          <Spruit x={120} y={H} h={420} />
          <Spruit x={260} y={H} h={300} />
          <Spruit x={1800} y={H} h={460} />
          <Spruit x={1660} y={H} h={320} />
          <Blad x={1500} y={260} l={90} hoek={20} />
          <Blad x={420} y={330} l={70} hoek={160} kleur={KLEUR.bladDonker} />
        </>
      );
    case 'team':
      return (
        <>
          <Zon x={1720} y={190} r={75} />
          <Heuvels hoog={-20} />
          <Molen x={220} y={880} h={380} beweging={beweging} />
          <Molen x={420} y={900} h={280} duur={12} beweging={beweging} />
          <Huis x={1240} y={1030} b={210} />
          <Huis x={1500} y={1040} b={180} />
          <Boom x={1180} y={1035} h={150} />
          <Boom x={1740} y={1040} h={170} />
        </>
      );
    case 'actie':
      return (
        <>
          <Zon x={1600} y={260} r={130} />
          {[
            [180, 220, 90, 30], [420, 140, 60, 120], [760, 90, 70, 200], [1120, 170, 55, 60],
            [240, 760, 80, 300], [620, 900, 65, 210], [1300, 880, 75, 20], [1760, 820, 90, 250],
          ].map(([x, y, l, hoek], i) => (
            <Blad key={i} x={x} y={y} l={l} hoek={hoek} kleur={i % 2 ? KLEUR.oranje : KLEUR.blad} />
          ))}
          <Heuvels hoog={-90} />
        </>
      );
    default:
      return null;
  }
}

/* Per slide een zachte kleurwas, zodat ook de bovenkant niet "dood" oogt. */
const WAS: Record<SlideId, string> = {
  vandaag: 'radial-gradient(60% 55% at 85% 15%, rgba(253,230,138,0.16), transparent 70%), radial-gradient(70% 60% at 10% 100%, rgba(52,211,153,0.16), transparent 70%)',
  batches: 'radial-gradient(60% 55% at 15% 10%, rgba(253,230,138,0.12), transparent 70%), radial-gradient(80% 60% at 60% 100%, rgba(147,197,253,0.16), transparent 70%)',
  geld: 'radial-gradient(60% 50% at 50% 0%, rgba(253,230,138,0.14), transparent 70%), radial-gradient(60% 60% at 0% 100%, rgba(52,211,153,0.16), transparent 70%), radial-gradient(60% 60% at 100% 100%, rgba(52,211,153,0.14), transparent 70%)',
  team: 'radial-gradient(60% 55% at 90% 10%, rgba(253,230,138,0.12), transparent 70%), radial-gradient(70% 60% at 20% 100%, rgba(196,181,253,0.16), transparent 70%)',
  actie: 'radial-gradient(60% 55% at 85% 20%, rgba(253,186,116,0.18), transparent 70%), radial-gradient(70% 60% at 10% 100%, rgba(52,211,153,0.14), transparent 70%)',
};

export function DuurzaamDecor({ id, reducedMotion }: { id: SlideId; reducedMotion: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <style>{'@keyframes molenDraai { to { transform: rotate(360deg); } }'}</style>
      <AnimatePresence initial={false}>
        <motion.div
          key={id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 1.2, ease: 'easeInOut' }}
          className="absolute inset-0"
          style={{ background: WAS[id] }}
        >
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMax slice" style={{ opacity: 0.13 }}>
            <defs>
              <radialGradient id="zonGloed">
                <stop offset="0%" stopColor={KLEUR.zon} stopOpacity={0.6} />
                <stop offset="100%" stopColor={KLEUR.zon} stopOpacity={0} />
              </radialGradient>
            </defs>
            <Tafereel id={id} beweging={!reducedMotion} />
          </svg>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
