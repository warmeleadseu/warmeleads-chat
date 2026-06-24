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
const MAX_LANES = 6;
/** Tempo waarmee podium <-> race afwisselt. */
const ROTATE_MS = 11_000;
/** Medaille-paletten (consistent met de bestaande leaderboard). */
const MEDALS = ['from-amber-400 to-amber-600', 'from-slate-300 to-slate-400', 'from-amber-600 to-amber-800'];

const euro = (n: number) => `€${Math.round(n).toLocaleString('nl-NL')}`;
const total = (e: AmRaceEntry) => e.revenue + e.bulkRevenue;
const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?';

function Avatar({
  entry,
  size,
  ring,
}: {
  entry: AmRaceEntry;
  size: number;
  ring?: string;
}) {
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
      className={`flex items-center justify-center bg-white/[0.08] font-black text-white/70 ${cls}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial(entry.name)}
    </div>
  );
}

// ─── Podium (top 3) ──────────────────────────────────────────────────
function Podium({ entries }: { entries: AmRaceEntry[] }) {
  const top = entries.slice(0, 3);
  // Klassieke podiumvolgorde: 2 - 1 - 3
  const order = [top[1], top[0], top[2]].filter(Boolean) as AmRaceEntry[];
  const standH: Record<number, string> = { 0: 'h-16', 1: 'h-24', 2: 'h-10' };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-base">🏆</span>
        <h2 className="text-sm font-bold text-white/70">Podium deze maand</h2>
      </div>
      <div className="flex flex-1 items-end justify-center gap-3 sm:gap-6">
        {order.map((e) => {
          const rank = top.indexOf(e); // 0,1,2
          const isFirst = rank === 0;
          const medal = MEDALS[rank];
          const avatarSize = isFirst ? 64 : 48;
          return (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + rank * 0.08 }}
              className="flex w-[28%] max-w-[180px] flex-col items-center"
            >
              {isFirst && <span className="mb-0.5 text-xl leading-none">👑</span>}
              <div className="relative">
                {isFirst && <div className="absolute -inset-1 rounded-full bg-amber-400/20 blur-md" />}
                <div className="relative">
                  <Avatar
                    entry={e}
                    size={avatarSize}
                    ring={`ring-2 ring-offset-2 ring-offset-[#0B0E1A] ${
                      rank === 0 ? 'ring-amber-400' : rank === 1 ? 'ring-slate-300' : 'ring-amber-700'
                    }`}
                  />
                  <span
                    className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-black text-white shadow ${medal}`}
                  >
                    {rank + 1}
                  </span>
                </div>
              </div>
              <p className={`mt-1.5 max-w-full truncate text-xs font-bold ${isFirst ? 'text-amber-300' : 'text-white/70'}`}>
                {e.name}
              </p>
              <p className="text-[11px] font-black tabular-nums text-emerald-400">{euro(total(e))}</p>
              <div
                className={`mt-1 w-full rounded-t-lg bg-gradient-to-b ${medal} opacity-80 ${standH[rank]}`}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Racebaan (alle AM's) ────────────────────────────────────────────
function RaceTrack({ entries }: { entries: AmRaceEntry[] }) {
  const lanes = entries.slice(0, MAX_LANES);
  const leaderTotal = total(lanes[0] ?? { revenue: 0, bulkRevenue: 0 } as AmRaceEntry);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-base">🏁</span>
        <h2 className="text-sm font-bold text-white/70">De race naar #1</h2>
        <span className="ml-auto text-[10px] text-white/25">koploper = finish</span>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-1.5">
        {lanes.map((e, i) => {
          const t = total(e);
          const pct = leaderTotal > 0 ? Math.min(100, Math.max(6, (t / leaderTotal) * 100)) : 6;
          const isLeader = i === 0;
          return (
            <div key={e.id} className="flex items-center gap-2">
              <span className="w-4 shrink-0 text-center text-[10px] font-black tabular-nums text-white/30">
                {i + 1}
              </span>
              <div className="relative h-7 flex-1 overflow-hidden rounded-full border border-white/[0.05] bg-white/[0.03]">
                {/* finishvlag rechts */}
                <div
                  className="absolute inset-y-0 right-0 w-1.5 opacity-60"
                  style={{
                    backgroundImage:
                      'repeating-conic-gradient(#fff 0% 25%, #000 0% 50%)',
                    backgroundSize: '6px 6px',
                  }}
                />
                {/* spoor */}
                <motion.div
                  className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${
                    isLeader ? 'from-amber-500/25 to-amber-400/10' : 'from-brand-purple/20 to-brand-purple/5'
                  }`}
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1.4, ease: 'easeOut' }}
                />
                {/* racer */}
                <motion.div
                  className="absolute top-1/2 flex -translate-y-1/2 items-center gap-1"
                  initial={false}
                  animate={{ left: `calc(${pct}% - 24px)` }}
                  transition={{ duration: 1.4, ease: 'easeOut' }}
                >
                  <Avatar
                    entry={e}
                    size={22}
                    ring={isLeader ? 'ring-2 ring-amber-400' : 'ring-1 ring-white/20'}
                  />
                  {isLeader && <span className="text-xs leading-none">🔥</span>}
                </motion.div>
              </div>
              <div className="w-28 shrink-0 text-right">
                <p className={`truncate text-[11px] font-bold ${isLeader ? 'text-amber-300' : 'text-white/60'}`}>
                  {e.name}
                </p>
                <p className="text-[10px] font-black tabular-nums text-emerald-400/90">{euro(t)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
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

  // reduced-motion: alles statisch onder elkaar (geen crossfade-rotatie).
  if (reducedMotion) {
    return (
      <div className="shrink-0 rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.05] to-brand-purple/[0.04] p-4 backdrop-blur-sm">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-[200px]">
            <Podium entries={entries} />
          </div>
          <div className="h-[200px]">
            <RaceTrack entries={entries} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[220px] shrink-0 overflow-hidden rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.05] to-brand-purple/[0.04] p-4 backdrop-blur-sm">
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 p-4"
        >
          {view === 'podium' ? <Podium entries={entries} /> : <RaceTrack entries={entries} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
