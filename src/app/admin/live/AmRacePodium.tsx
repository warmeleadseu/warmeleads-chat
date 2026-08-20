'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

export interface AmRaceEntry {
  id: string;
  name: string;
  revenue: number;
  bulkRevenue: number;
  batches: number;
  avatarUrl?: string | null;
}

/** Hoeveel banen we maximaal op de racebaan tonen (boven dit aantal wordt het te druk op de TV). */
const MAX_LANES = 5;
/** Tempo waarmee podium <-> race afwisselt. */
const ROTATE_MS = 11_000;

type Medal = { ring: string; chip: string; stand: string; text: string; glow: string };
const MEDALS: Medal[] = [
  {
    ring: 'ring-amber-300',
    chip: 'from-amber-300 to-amber-500',
    stand: 'from-amber-400/90 via-amber-500/80 to-amber-600/70',
    text: 'text-amber-300',
    glow: 'rgba(251,191,36,0.45)',
  },
  {
    ring: 'ring-slate-200',
    chip: 'from-slate-200 to-slate-400',
    stand: 'from-slate-300/80 via-slate-400/70 to-slate-500/60',
    text: 'text-slate-200',
    glow: 'rgba(226,232,240,0.35)',
  },
  {
    ring: 'ring-orange-400',
    chip: 'from-orange-400 to-orange-700',
    stand: 'from-orange-500/80 via-orange-600/70 to-orange-800/60',
    text: 'text-orange-300',
    glow: 'rgba(234,88,12,0.35)',
  },
];

const euro = (n: number) => `€${Math.round(n).toLocaleString('nl-NL')}`;
const euroShort = (n: number) => {
  const v = Math.round(n);
  if (v >= 1000) return `€${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace('.', ',')}k`;
  return `€${v.toLocaleString('nl-NL')}`;
};
const total = (e: AmRaceEntry) => e.revenue + e.bulkRevenue;
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

function Avatar({ entry, size, ring }: { entry: AmRaceEntry; size: number; ring?: string }) {
  const cls = `rounded-full object-cover ${ring ?? ''}`;
  if (entry.avatarUrl) {
    return (
      <Image
        src={entry.avatarUrl}
        alt={entry.name}
        width={size}
        height={size}
        className={cls}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-white/15 to-white/5 font-black text-white/80 ${cls}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(entry.name)}
    </div>
  );
}

// ─── Podium (top 3) ──────────────────────────────────────────────────
function Podium({ entries }: { entries: AmRaceEntry[] }) {
  const top = entries.slice(0, 3);
  // Klassieke podiumvolgorde: 2 - 1 - 3
  const order = [top[1], top[0], top[2]].filter(Boolean) as AmRaceEntry[];
  const standH: Record<number, number> = { 0: 48, 1: 34, 2: 24 };
  const avatarSize: Record<number, number> = { 0: 56, 1: 46, 2: 44 };

  return (
    <div className="flex h-full flex-col">
      <Header icon="🏆" title="Podium" subtitle="top 3 deze maand" />
      <div className="relative flex flex-1 items-end justify-center gap-3 sm:gap-7">
        {/* spotlight achter #1 */}
        <div
          className="pointer-events-none absolute bottom-0 left-1/2 h-[120%] w-[42%] -translate-x-1/2"
          style={{
            background:
              'radial-gradient(60% 80% at 50% 100%, rgba(251,191,36,0.18), rgba(251,191,36,0) 70%)',
          }}
        />
        {order.map((e) => {
          const rank = top.indexOf(e); // 0,1,2
          const isFirst = rank === 0;
          const m = MEDALS[rank];
          return (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + rank * 0.1, type: 'spring', stiffness: 120, damping: 16 }}
              className="relative flex w-[30%] max-w-[200px] flex-col items-center"
            >
              {/* sparkles voor #1 */}
              {isFirst &&
                ([
                  { top: '-2%', left: '14%', d: 0 },
                  { top: '6%', left: '78%', d: 0.6 },
                  { top: '30%', left: '4%', d: 1.1 },
                ] as Array<{ top: string; left: string; d: number }>).map((s, i) => (
                  <motion.span
                    key={i}
                    className="pointer-events-none absolute text-amber-200"
                    style={{ top: s.top, left: s.left }}
                    animate={{ opacity: [0, 1, 0], scale: [0.6, 1, 0.6] }}
                    transition={{ duration: 2.2, repeat: Infinity, delay: s.d }}
                  >
                    ✦
                  </motion.span>
                ))}

              {isFirst && (
                <motion.span
                  className="mb-0.5 text-xl leading-none drop-shadow-[0_2px_6px_rgba(251,191,36,0.5)]"
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  👑
                </motion.span>
              )}

              <div className="relative">
                <div
                  className="absolute -inset-1.5 rounded-full blur-md"
                  style={{ background: m.glow }}
                />
                <div className="relative">
                  <Avatar
                    entry={e}
                    size={avatarSize[rank]}
                    ring={`ring-2 ring-offset-2 ring-offset-[#0B0E1A] ${m.ring}`}
                  />
                </div>
              </div>

              <p className={`mt-1.5 max-w-full truncate text-[22px] font-extrabold ${m.text}`}>
                {firstName(e.name)}
              </p>
              <p className="-mt-0.5 text-[22px] font-black tabular-nums text-emerald-400 drop-shadow-[0_1px_4px_rgba(16,185,129,0.35)]">
                {euro(total(e))}
              </p>

              {/* voetstuk met diepte + nummer */}
              <div
                className="relative mt-1.5 w-full overflow-hidden rounded-t-xl border-x border-t border-white/15"
                style={{ height: standH[rank] }}
              >
                <div className={`absolute inset-0 bg-gradient-to-b ${m.stand}`} />
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-black text-black/30">{rank + 1}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      {/* vloer */}
      <div className="mx-auto h-px w-[88%] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
}

// ─── Racebaan (alle AM's) ────────────────────────────────────────────
function RaceTrack({ entries }: { entries: AmRaceEntry[] }) {
  const lanes = entries.slice(0, MAX_LANES);
  const leaderTotal = total(lanes[0] ?? ({ revenue: 0, bulkRevenue: 0 } as AmRaceEntry));

  return (
    <div className="flex h-full flex-col">
      <Header icon="🏁" title="De race naar #1" subtitle="koploper bepaalt de finish" />
      <div className="flex flex-1 flex-col justify-center gap-2">
        {lanes.map((e, i) => {
          const t = total(e);
          const ratio = leaderTotal > 0 ? t / leaderTotal : 0;
          // veld loopt van 5% tot 88%; de finishvlag staat rechts daarvan.
          const pos = leaderTotal > 0 ? Math.min(88, Math.max(5, ratio * 88)) : 5;
          const isLeader = i === 0;
          const gap = leaderTotal - t;
          return (
            <div key={e.id} className="flex items-center gap-2.5">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[18px] font-black tabular-nums ${
                  isLeader ? 'bg-amber-400 text-black' : 'bg-white/10 text-white/40'
                }`}
              >
                {i + 1}
              </span>

              <div className="relative h-8 flex-1 overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.025]">
                {/* wegmarkering (gestreepte middenlijn) */}
                <div
                  className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 opacity-30"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(to right, rgba(255,255,255,0.5) 0 10px, transparent 10px 22px)',
                  }}
                />
                {/* finishvlag rechts */}
                <div
                  className="absolute inset-y-0 right-0 w-2.5"
                  style={{
                    backgroundImage: 'repeating-conic-gradient(#fff 0% 25%, #111 0% 50%)',
                    backgroundSize: '8px 8px',
                    opacity: 0.75,
                  }}
                />
                {/* komeet-trail */}
                <motion.div
                  className={`absolute inset-y-0 left-0 rounded-l-lg bg-gradient-to-r ${
                    isLeader
                      ? 'from-amber-500/40 via-amber-400/15 to-transparent'
                      : 'from-brand-purple/35 via-brand-purple/10 to-transparent'
                  }`}
                  initial={false}
                  animate={{ width: `${pos}%` }}
                  transition={{ type: 'spring', stiffness: 60, damping: 18 }}
                />
                {/* racer */}
                <motion.div
                  className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center"
                  initial={false}
                  animate={{ left: `${pos}%` }}
                  transition={{ type: 'spring', stiffness: 60, damping: 18 }}
                >
                  {isLeader && (
                    <motion.span
                      className="absolute -left-4 text-[22px]"
                      animate={{ x: [0, -2, 0], opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    >
                      🔥
                    </motion.span>
                  )}
                  <div className="relative">
                    {isLeader && (
                      <div className="absolute -inset-1 rounded-full bg-amber-400/30 blur-[3px]" />
                    )}
                    <Avatar
                      entry={e}
                      size={26}
                      ring={`relative ring-2 ${isLeader ? 'ring-amber-300' : 'ring-white/25'}`}
                    />
                  </div>
                </motion.div>
              </div>

              <div className="w-[5.5rem] shrink-0 text-right sm:w-24">
                <p className={`truncate text-[22px] font-bold ${isLeader ? 'text-amber-300' : 'text-white/70'}`}>
                  {firstName(e.name)}
                </p>
                <p className="text-[18px] font-black tabular-nums text-emerald-400/90">{euroShort(t)}</p>
              </div>

              <div className="w-12 shrink-0 text-right">
                {isLeader ? (
                  <span className="text-[18px] font-black uppercase tracking-wider text-amber-400/80">Leider</span>
                ) : (
                  <span className="text-[18px] font-bold tabular-nums text-white/30">−{euroShort(gap)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Header({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="text-[26px] leading-none">{icon}</span>
      <h2 className="text-[22px] font-black uppercase tracking-wide text-white/80">{title}</h2>
      <span className="text-[18px] text-white/30">· {subtitle}</span>
    </div>
  );
}

const SHELL =
  'relative shrink-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d1020] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.25)]';

function ShellBackground() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(70% 120% at 0% 0%, rgba(251,191,36,0.10), transparent 55%), radial-gradient(80% 120% at 100% 100%, rgba(168,85,247,0.12), transparent 55%)',
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </>
  );
}

export function AmRacePodium({
  entries,
  reducedMotion,
}: {
  entries: AmRaceEntry[];
  reducedMotion: boolean;
}) {
  const [view, setView] = useState<'podium' | 'race'>('podium');
  const canRotate = !reducedMotion && entries.length >= 2;

  useEffect(() => {
    if (!canRotate) return;
    const iv = setInterval(() => setView((v) => (v === 'podium' ? 'race' : 'podium')), ROTATE_MS);
    return () => clearInterval(iv);
  }, [canRotate]);

  if (!entries || entries.length === 0) return null;

  // reduced-motion: alles statisch naast elkaar (geen crossfade-rotatie).
  if (reducedMotion) {
    return (
      <div className={SHELL}>
        <ShellBackground />
        <div className="relative grid gap-5 lg:grid-cols-2">
          <div className="h-[224px]">
            <Podium entries={entries} />
          </div>
          <div className="h-[224px]">
            <RaceTrack entries={entries} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${SHELL} h-[260px]`}>
      <ShellBackground />
      {/* view-indicator */}
      <div className="absolute right-4 top-4 z-10 flex gap-1.5">
        {(['podium', 'race'] as const).map((v) => (
          <span
            key={v}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              view === v ? 'w-5 bg-white/70' : 'w-1.5 bg-white/20'
            }`}
          />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="relative h-full"
        >
          {view === 'podium' ? <Podium entries={entries} /> : <RaceTrack entries={entries} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
