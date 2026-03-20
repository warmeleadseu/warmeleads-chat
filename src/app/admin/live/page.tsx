'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { adminFetch } from '@/lib/adminAuth';

const REFRESH_INTERVAL = 30_000;

const PERIOD_LABELS: Record<string, string> = {
  day: '24 uur',
  '3days': '3 dagen',
  week: 'Week',
  month: 'Maand',
  quarter: 'Kwartaal',
  year: 'Jaar',
};

const BRANCH_COLORS: Record<string, { bar: string; glow: string; badge: string; fill: string }> = {
  thuisbatterij: { bar: 'from-emerald-400 to-emerald-500', glow: 'shadow-emerald-500/30', badge: 'bg-emerald-500/20 text-emerald-300', fill: '#34d399' },
  airco: { bar: 'from-sky-400 to-sky-500', glow: 'shadow-sky-500/30', badge: 'bg-sky-500/20 text-sky-300', fill: '#38bdf8' },
};
const DEFAULT_BRANCH = { bar: 'from-purple-400 to-purple-500', glow: 'shadow-purple-500/30', badge: 'bg-purple-500/20 text-purple-300', fill: '#a78bfa' };

interface PeriodStat { leads: number; prevLeads: number; assigned: number; prevAssigned: number; }
interface BatchInfo { id: string; customer: string; branch: string; batchSize: number; delivered: number; pricePerLead: number | null; leadsPerWeek: number | null; notes: string | null; }
interface RecentLead { id: string; name: string; branch: string; city: string; province: string; createdAt: string; }
interface LiveData {
  totalLeads: number;
  activeCustomers: number;
  totalCustomers: number;
  activeBatches: BatchInfo[];
  completedBatchCount: number;
  totalRevenue: number;
  completedRevenue: number;
  recentLeads: RecentLead[];
  periodStats: Record<string, PeriodStat>;
  provinceBreakdown: Record<string, number>;
  branchBreakdown: Record<string, number>;
  phoneQuality: { total: number; invalid: number; validPct: number };
  timestamp: string;
}

// ─── Province SVG paths (simplified NL + BE) ─────────────────────────
const NL_PROVINCES: Record<string, { d: string; cx: number; cy: number }> = {
  'Groningen':       { d: 'M145,10 L180,10 L185,35 L170,50 L145,45 Z', cx: 163, cy: 28 },
  'Friesland':       { d: 'M100,10 L145,10 L145,45 L130,50 L95,40 Z', cx: 120, cy: 28 },
  'Drenthe':         { d: 'M145,45 L170,50 L175,80 L140,85 L130,65 Z', cx: 152, cy: 65 },
  'Overijssel':      { d: 'M130,65 L140,85 L175,80 L180,110 L145,115 L120,95 Z', cx: 150, cy: 92 },
  'Flevoland':       { d: 'M95,70 L115,65 L120,95 L105,100 L90,85 Z', cx: 105, cy: 82 },
  'Gelderland':      { d: 'M120,95 L145,115 L180,110 L175,145 L130,150 L100,130 Z', cx: 140, cy: 125 },
  'Utrecht':         { d: 'M85,95 L100,95 L100,130 L85,125 Z', cx: 92, cy: 112 },
  'Noord-Holland':   { d: 'M55,15 L95,15 L95,70 L75,80 L55,70 Z', cx: 75, cy: 45 },
  'Zuid-Holland':     { d: 'M50,80 L85,80 L85,125 L70,140 L45,130 Z', cx: 67, cy: 108 },
  'Zeeland':         { d: 'M25,140 L55,130 L70,140 L60,165 L25,165 Z', cx: 48, cy: 150 },
  'Noord-Brabant':   { d: 'M70,140 L130,150 L140,175 L75,180 L60,165 Z', cx: 102, cy: 162 },
  'Limburg':         { d: 'M140,150 L175,145 L180,195 L155,210 L140,195 Z', cx: 160, cy: 178 },
};

const BE_PROVINCES: Record<string, { d: string; cx: number; cy: number }> = {
  'Antwerpen':        { d: 'M60,225 L95,220 L105,245 L75,250 Z', cx: 83, cy: 235 },
  'Limburg':          { d: 'M105,220 L140,215 L145,245 L105,245 Z', cx: 123, cy: 232 },
  'Vlaams-Brabant':   { d: 'M65,250 L105,245 L105,275 L70,275 Z', cx: 86, cy: 262 },
  'Waals-Brabant':    { d: 'M70,275 L105,275 L105,295 L75,295 Z', cx: 88, cy: 285 },
  'Brussel':          { d: 'M82,265 L92,265 L92,275 L82,275 Z', cx: 87, cy: 270 },
  'Oost-Vlaanderen':  { d: 'M25,230 L60,225 L65,260 L30,265 Z', cx: 45, cy: 245 },
  'West-Vlaanderen':  { d: 'M5,225 L25,220 L30,260 L10,265 Z', cx: 18, cy: 242 },
  'Henegouwen':       { d: 'M10,265 L70,275 L75,310 L15,315 Z', cx: 42, cy: 290 },
  'Namen':            { d: 'M75,295 L120,290 L125,325 L80,330 Z', cx: 100, cy: 310 },
  'Luik':             { d: 'M120,250 L160,245 L165,300 L120,290 Z', cx: 140, cy: 272 },
  'Luxemburg':        { d: 'M120,300 L165,300 L170,345 L125,340 Z', cx: 145, cy: 322 },
};

// ─── Confetti ────────────────────────────────────────────────────────
function fireConfetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#a855f7', '#ec4899', '#34d399', '#facc15', '#38bdf8', '#f97316', '#f43f5e'];
  const particles: { x: number; y: number; vx: number; vy: number; size: number; color: string; rotation: number; rotSpeed: number; life: number }[] = [];

  for (let i = 0; i < 200; i++) {
    particles.push({
      x: canvas.width * (0.3 + Math.random() * 0.4),
      y: canvas.height * 0.3,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 18 - 4,
      size: Math.random() * 8 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 12,
      life: 1,
    });
  }

  let frame = 0;
  const maxFrames = 180;

  function animate() {
    if (frame >= maxFrames) {
      ctx!.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.x += p.vx;
      p.vy += 0.35;
      p.y += p.vy;
      p.vx *= 0.99;
      p.rotation += p.rotSpeed;
      p.life = Math.max(0, 1 - frame / maxFrames);

      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate((p.rotation * Math.PI) / 180);
      ctx!.globalAlpha = p.life;
      ctx!.fillStyle = p.color;
      ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx!.restore();
    }
    frame++;
    requestAnimationFrame(animate);
  }
  animate();
}

function playCelebrationSound() {
  try {
    const ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ac.currentTime + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.15, ac.currentTime + i * 0.12 + 0.05);
      gain.gain.linearRampToValueAtTime(0, ac.currentTime + i * 0.12 + 0.4);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(ac.currentTime + i * 0.12);
      osc.stop(ac.currentTime + i * 0.12 + 0.5);
    });

    setTimeout(() => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 1318.5;
      gain.gain.setValueAtTime(0, ac.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ac.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + 1);
    }, 500);
  } catch { /* browser might block audio */ }
}

// ─── Helpers ─────────────────────────────────────────────────────────
function AnimatedNumber({ value, prefix = '', suffix = '', className = '' }: { value: number; prefix?: string; suffix?: string; className?: string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = value;
    if (prev === value) return;

    const diff = value - prev;
    const steps = Math.min(40, Math.abs(diff));
    if (steps === 0) { setDisplay(value); return; }

    let step = 0;
    const interval = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(prev + diff * eased));
      if (step >= steps) { clearInterval(interval); setDisplay(value); }
    }, 20);
    return () => clearInterval(interval);
  }, [value]);

  return <span className={className}>{prefix}{display.toLocaleString('nl-NL')}{suffix}</span>;
}

function TrendArrow({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return <span className="text-xs font-bold text-emerald-400">nieuw</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
        <path d={up ? 'M6 2L10 7H2L6 2Z' : 'M6 10L2 5H10L6 10Z'} fill="currentColor" />
      </svg>
      {up ? '+' : ''}{pct}%
    </span>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}u`;
  return `${Math.floor(hrs / 24)}d`;
}

// ─── Province Heatmap Component ──────────────────────────────────────
function ProvinceMap({ data }: { data: Record<string, number> }) {
  const maxCount = Math.max(1, ...Object.values(data));
  const [hovered, setHovered] = useState<string | null>(null);

  function opacity(name: string): number {
    const count = data[name] || 0;
    if (count === 0) return 0.08;
    return 0.15 + (count / maxCount) * 0.85;
  }

  return (
    <div className="relative">
      <svg viewBox="-5 0 200 355" className="h-full w-full">
        {Object.entries(NL_PROVINCES).map(([name, p]) => (
          <g key={name} onMouseEnter={() => setHovered(name)} onMouseLeave={() => setHovered(null)}>
            <path
              d={p.d}
              fill={`rgba(139, 92, 246, ${opacity(name)})`}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="0.8"
              className="transition-all duration-300 hover:brightness-150"
            />
            {(data[name] || 0) > 0 && (
              <circle cx={p.cx} cy={p.cy} r={Math.max(2, Math.min(6, (data[name] / maxCount) * 6))}
                fill="#a855f7" opacity="0.7" className="animate-pulse" />
            )}
          </g>
        ))}
        <line x1="0" y1="212" x2="190" y2="212" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" strokeDasharray="3,3" />
        <text x="95" y="208" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="5" fontWeight="bold">BELGIË</text>
        {Object.entries(BE_PROVINCES).map(([name, p]) => (
          <g key={name} onMouseEnter={() => setHovered(name)} onMouseLeave={() => setHovered(null)}>
            <path
              d={p.d}
              fill={`rgba(236, 72, 153, ${opacity(name)})`}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="0.8"
              className="transition-all duration-300 hover:brightness-150"
            />
            {(data[name] || 0) > 0 && (
              <circle cx={p.cx} cy={p.cy} r={Math.max(2, Math.min(6, (data[name] / maxCount) * 6))}
                fill="#ec4899" opacity="0.7" className="animate-pulse" />
            )}
          </g>
        ))}
      </svg>
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute left-1/2 top-0 z-20 -translate-x-1/2 rounded-lg border border-white/10 bg-[#1a1d2e] px-3 py-1.5 text-center shadow-xl"
          >
            <p className="text-[11px] font-bold text-white/80">{hovered}</p>
            <p className="text-[10px] tabular-nums text-white/40">{(data[hovered] || 0).toLocaleString('nl-NL')} leads</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Branch Donut Component ──────────────────────────────────────────
function BranchDonut({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  if (total === 0) return <p className="text-center text-xs text-white/20">Geen data</p>;

  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  let cumAngle = -90;

  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 100 100" className="h-20 w-20 shrink-0 lg:h-24 lg:w-24">
        {entries.map(([branch, count]) => {
          const bc = BRANCH_COLORS[branch] || DEFAULT_BRANCH;
          const pct = count / total;
          const angle = pct * 360;
          const startAngle = cumAngle;
          cumAngle += angle;
          const endAngle = cumAngle;

          const largeArc = angle > 180 ? 1 : 0;
          const rad = (a: number) => (a * Math.PI) / 180;
          const x1 = 50 + 40 * Math.cos(rad(startAngle));
          const y1 = 50 + 40 * Math.sin(rad(startAngle));
          const x2 = 50 + 40 * Math.cos(rad(endAngle));
          const y2 = 50 + 40 * Math.sin(rad(endAngle));

          return (
            <path key={branch}
              d={entries.length === 1
                ? 'M50,10 A40,40 0 1,1 49.99,10 Z'
                : `M50,50 L${x1},${y1} A40,40 0 ${largeArc},1 ${x2},${y2} Z`}
              fill={bc.fill}
              opacity="0.85"
              stroke="#0B0E1A"
              strokeWidth="1"
            />
          );
        })}
        <circle cx="50" cy="50" r="22" fill="#0B0E1A" />
        <text x="50" y="48" textAnchor="middle" fill="white" fontSize="14" fontWeight="900" opacity="0.9">
          {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total}
        </text>
        <text x="50" y="58" textAnchor="middle" fill="white" fontSize="6" opacity="0.35">totaal</text>
      </svg>
      <div className="space-y-1.5">
        {entries.map(([branch, count]) => {
          const bc = BRANCH_COLORS[branch] || DEFAULT_BRANCH;
          return (
            <div key={branch} className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: bc.fill }} />
              <span className="text-[11px] font-medium text-white/60">{branch}</span>
              <span className="text-[11px] font-bold tabular-nums text-white/80">{count.toLocaleString('nl-NL')}</span>
              <span className="text-[10px] text-white/25">({Math.round((count / total) * 100)}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────
export default function LiveDashboard() {
  const [data, setData] = useState<LiveData | null>(null);
  const [clock, setClock] = useState(new Date());
  const [refreshIn, setRefreshIn] = useState(REFRESH_INTERVAL / 1000);
  const [newLeadIds, setNewLeadIds] = useState<Set<string>>(new Set());
  const [celebratingBatch, setCelebratingBatch] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevBatchPcts = useRef<Record<string, number>>({});

  const fetchData = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/live-stats');
      if (res.ok) {
        const d: LiveData = await res.json();
        setData(prev => {
          if (prev) {
            const oldIds = new Set(prev.recentLeads.map(l => l.id));
            const fresh = d.recentLeads.filter(l => !oldIds.has(l.id)).map(l => l.id);
            if (fresh.length > 0) {
              setNewLeadIds(new Set(fresh));
              setTimeout(() => setNewLeadIds(new Set()), 3000);
            }
          }

          for (const batch of d.activeBatches) {
            const prevPct = prevBatchPcts.current[batch.id] || 0;
            const newPct = batch.batchSize > 0 ? (batch.delivered / batch.batchSize) * 100 : 0;
            if (newPct >= 100 && prevPct < 100) {
              setCelebratingBatch(batch.id);
              if (canvasRef.current) fireConfetti(canvasRef.current);
              playCelebrationSound();
              setTimeout(() => setCelebratingBatch(null), 5000);
            }
            prevBatchPcts.current[batch.id] = newPct;
          }

          return d;
        });
      }
    } catch { /* silent */ }
    setRefreshIn(REFRESH_INTERVAL / 1000);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { const iv = setInterval(fetchData, REFRESH_INTERVAL); return () => clearInterval(iv); }, [fetchData]);
  useEffect(() => { const iv = setInterval(() => { setClock(new Date()); setRefreshIn(r => Math.max(0, r - 1)); }, 1000); return () => clearInterval(iv); }, []);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0E1A]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-[3px] border-white/10 border-t-brand-purple" />
          <p className="text-sm text-white/30">Live dashboard laden...</p>
        </div>
      </div>
    );
  }

  const ps = data.periodStats;
  const batchDelivered = data.activeBatches.reduce((s, b) => s + b.delivered, 0);
  const batchTotal = data.activeBatches.reduce((s, b) => s + b.batchSize, 0);
  const overallPct = batchTotal > 0 ? Math.round((batchDelivered / batchTotal) * 100) : 0;

  // Speed/streak metrics
  const sortedLeads = [...data.recentLeads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const lastLeadTime = sortedLeads[0]?.createdAt;
  const lastLeadAgo = lastLeadTime ? timeAgo(lastLeadTime) : '—';

  let avgInterval = '—';
  if (sortedLeads.length >= 2) {
    const todayLeads = sortedLeads.filter(l => {
      const d = new Date(l.createdAt);
      const now = new Date();
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    if (todayLeads.length >= 2) {
      const newest = new Date(todayLeads[0].createdAt).getTime();
      const oldest = new Date(todayLeads[todayLeads.length - 1].createdAt).getTime();
      const totalMinutes = (newest - oldest) / 60000;
      const avg = totalMinutes / (todayLeads.length - 1);
      if (avg < 1) avgInterval = `${Math.round(avg * 60)}s`;
      else if (avg < 60) avgInterval = `${Math.round(avg)}m`;
      else avgInterval = `${Math.round(avg / 60)}u`;
    }
  }

  const phoneQuality = data.phoneQuality;
  const phoneColor = phoneQuality.validPct >= 90 ? 'text-emerald-400' : phoneQuality.validPct >= 70 ? 'text-amber-400' : 'text-red-400';
  const phoneRingPct = phoneQuality.validPct;

  return (
    <div className="min-h-screen bg-[#0B0E1A] text-white">
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[100]" />

      {/* Ambient glow effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-64 -top-64 h-[600px] w-[600px] rounded-full bg-brand-purple/[0.07] blur-[180px]" />
        <div className="absolute -bottom-64 -right-64 h-[600px] w-[600px] rounded-full bg-brand-pink/[0.05] blur-[180px]" />
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.03] blur-[150px]" />
      </div>

      {/* Celebration overlay */}
      <AnimatePresence>
        {celebratingBatch && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center"
          >
            <div className="rounded-3xl border border-emerald-500/30 bg-[#0B0E1A]/90 px-12 py-8 text-center shadow-2xl shadow-emerald-500/20 backdrop-blur-xl">
              <motion.p
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ duration: 0.5 }}
                className="mb-2 text-5xl"
              >
                🎉
              </motion.p>
              <p className="text-2xl font-black text-emerald-400">Batch voltooid!</p>
              <p className="mt-1 text-sm text-white/50">Alle leads zijn uitgeleverd</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex h-screen flex-col overflow-hidden p-4 sm:p-6 lg:p-5">
        {/* Top bar */}
        <div className="mb-3 flex shrink-0 items-center justify-between lg:mb-2">
          <Link href="/admin" className="group flex items-center gap-3">
            <Image src="/logo-wit.png" alt="WarmeLeads" width={140} height={42} className="h-8 w-auto opacity-80 transition group-hover:opacity-100" />
            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white/30">Live</span>
          </Link>
          <div className="flex items-center gap-5">
            {/* Speed metrics */}
            <div className="hidden items-center gap-4 lg:flex">
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/25">Laatste lead</p>
                <p className="text-sm font-black tabular-nums text-white/70">{lastLeadAgo} geleden</p>
              </div>
              <div className="h-6 w-px bg-white/[0.06]" />
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/25">Gem. interval</p>
                <p className="text-sm font-black tabular-nums text-white/70">elke {avgInterval}</p>
              </div>
              <div className="h-6 w-px bg-white/[0.06]" />
              {/* Phone quality ring */}
              <div className="flex items-center gap-2">
                <div className="relative h-9 w-9">
                  <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="14" fill="none"
                      stroke={phoneQuality.validPct >= 90 ? '#34d399' : phoneQuality.validPct >= 70 ? '#fbbf24' : '#f87171'}
                      strokeWidth="3"
                      strokeDasharray={`${(phoneRingPct / 100) * 88} 88`}
                      strokeLinecap="round"
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-[9px] font-black ${phoneColor}`}>{phoneQuality.validPct}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/25">Tel. kwaliteit</p>
                  <p className={`text-[11px] font-bold ${phoneColor}`}>
                    {phoneQuality.invalid > 0 ? `${phoneQuality.invalid} verdacht` : 'Alles geldig'}
                  </p>
                </div>
              </div>
            </div>

            <div className="h-6 w-px bg-white/[0.06] lg:block hidden" />

            {/* Refresh indicator */}
            <div className="flex items-center gap-2">
              <div className="relative h-5 w-5">
                <svg className="h-5 w-5 -rotate-90" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                  <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(139,92,246,0.5)" strokeWidth="2"
                    strokeDasharray={`${(1 - refreshIn / (REFRESH_INTERVAL / 1000)) * 50.3} 50.3`}
                    strokeLinecap="round" className="transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                </div>
              </div>
              <span className="text-[11px] tabular-nums text-white/25">{refreshIn}s</span>
            </div>

            {/* Clock */}
            <div className="text-right">
              <p className="text-lg font-bold tabular-nums text-white/80">
                {clock.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
              <p className="text-[11px] text-white/25">
                {clock.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Hero KPIs */}
        <div className="mb-3 grid shrink-0 grid-cols-2 gap-2 lg:mb-2 lg:grid-cols-4">
          {[
            { label: 'Leads vandaag', value: ps.day?.leads || 0, sub: `${ps.day?.assigned || 0} uitgedeeld`, color: 'from-brand-purple to-brand-pink' },
            { label: 'Leads deze week', value: ps.week?.leads || 0, sub: `${ps.week?.assigned || 0} uitgedeeld`, color: 'from-emerald-500 to-emerald-600', trend: ps.week },
            { label: 'Omzet', value: Math.round(data.totalRevenue), sub: `€${data.completedRevenue.toLocaleString('nl-NL')} afgerond`, color: 'from-amber-500 to-orange-500', prefix: '€' },
            { label: 'Totaal leads', value: data.totalLeads, sub: `${data.activeCustomers} klanten actief`, color: 'from-sky-500 to-blue-600' },
          ].map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 backdrop-blur-sm lg:p-4"
            >
              <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${kpi.color}`} />
              <p className="mb-0.5 text-[10px] font-medium text-white/40 lg:text-xs">{kpi.label}</p>
              <div className="flex items-baseline gap-2">
                <AnimatedNumber value={kpi.value} prefix={kpi.prefix} className="text-2xl font-black tracking-tight text-white lg:text-3xl" />
                {kpi.trend && <TrendArrow current={kpi.trend.leads} previous={kpi.trend.prevLeads} />}
              </div>
              <p className="mt-1 text-[11px] text-white/25">{kpi.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Middle section: Batches + Live Feed + Map */}
        <div className="mb-3 grid min-h-0 flex-1 gap-3 lg:mb-2 lg:grid-cols-7">
          {/* Active batches - 3 cols */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm lg:col-span-3">
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                <h2 className="text-sm font-bold text-white/70">Actieve batches</h2>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-white/25">
                <span>{data.activeBatches.length} actief</span>
                <span>{data.completedBatchCount} voltooid</span>
              </div>
            </div>

            {data.activeBatches.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-6">
                <p className="text-sm text-white/20">Geen actieve batches</p>
              </div>
            ) : (
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                {data.activeBatches.map((b, i) => {
                  const pct = b.batchSize > 0 ? Math.min(100, Math.round((b.delivered / b.batchSize) * 100)) : 0;
                  const bc = BRANCH_COLORS[b.branch] || DEFAULT_BRANCH;
                  const isCelebrating = celebratingBatch === b.id;
                  return (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`rounded-xl border p-3 transition-all ${
                        isCelebrating
                          ? 'border-emerald-500/40 bg-emerald-500/[0.08] shadow-lg shadow-emerald-500/20'
                          : 'border-white/[0.04] bg-white/[0.02]'
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white/80">{b.customer}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${bc.badge}`}>{b.branch}</span>
                          {isCelebrating && <span className="text-sm">🎉</span>}
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-black tabular-nums text-white/90">{b.delivered}</span>
                          <span className="text-xs text-white/25">/ {b.batchSize}</span>
                        </div>
                      </div>
                      <div className="relative h-3 overflow-hidden rounded-full bg-white/[0.06]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 1.5, ease: 'easeOut' }}
                          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${bc.bar} shadow-lg ${bc.glow}`}
                        />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/25">
                        <div className="flex gap-3">
                          {b.pricePerLead && <span>€{b.pricePerLead}/lead</span>}
                          {b.leadsPerWeek && <span>{b.leadsPerWeek}/week</span>}
                        </div>
                        <span className="font-bold text-white/40">{pct}%</span>
                      </div>
                    </motion.div>
                  );
                })}

                <div className="mt-1 shrink-0 rounded-xl border border-white/[0.04] bg-white/[0.02] p-2">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-white/40">Totaal voortgang</span>
                    <span className="font-bold tabular-nums text-white/60">{batchDelivered} / {batchTotal} ({overallPct}%)</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${overallPct}%` }}
                      transition={{ duration: 2, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-pink"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Live feed - 2 cols */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm lg:col-span-2">
            <div className="mb-2 flex shrink-0 items-center gap-2">
              <div className="relative">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <div className="absolute inset-0 h-2 w-2 animate-ping rounded-full bg-red-500/50" />
              </div>
              <h2 className="text-sm font-bold text-white/70">Live feed</h2>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              <AnimatePresence initial={false}>
                {data.recentLeads.map((lead) => {
                  const isNew = newLeadIds.has(lead.id);
                  const bc = BRANCH_COLORS[lead.branch] || DEFAULT_BRANCH;
                  return (
                    <motion.div
                      key={lead.id}
                      layout
                      initial={{ opacity: 0, y: -20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      className={`rounded-lg border p-3 transition-all ${
                        isNew
                          ? 'border-emerald-500/30 bg-emerald-500/[0.08] shadow-lg shadow-emerald-500/10'
                          : 'border-white/[0.04] bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {isNew && (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="shrink-0 rounded bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black uppercase text-white"
                              >
                                Nieuw
                              </motion.span>
                            )}
                            <p className="truncate text-sm font-semibold text-white/80">{lead.name || '—'}</p>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/30">
                            {lead.city && <span>{lead.city}</span>}
                            {lead.province && <span className="text-white/15">·</span>}
                            {lead.province && <span>{lead.province}</span>}
                          </div>
                        </div>
                        <div className="ml-2 flex shrink-0 flex-col items-end gap-1">
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${bc.badge}`}>{lead.branch}</span>
                          <span className="text-[10px] tabular-nums text-white/20">{timeAgo(lead.createdAt)}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Right sidebar: Map + Branch donut - 2 cols */}
          <div className="flex flex-col gap-3 overflow-hidden lg:col-span-2">
            {/* Province heatmap */}
            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 backdrop-blur-sm">
              <div className="mb-1 flex items-center gap-2">
                <svg className="h-4 w-4 text-white/40" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
                <h2 className="text-sm font-bold text-white/70">Leads per provincie</h2>
              </div>
              <ProvinceMap data={data.provinceBreakdown} />
            </div>

            {/* Branch breakdown */}
            <div className="shrink-0 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 backdrop-blur-sm">
              <div className="mb-2 flex items-center gap-2">
                <svg className="h-4 w-4 text-white/40" viewBox="0 0 20 20" fill="currentColor"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z"/><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z"/></svg>
                <h2 className="text-sm font-bold text-white/70">Branches</h2>
              </div>
              <BranchDonut data={data.branchBreakdown} />
            </div>

            {/* Mobile: Speed + Phone quality */}
            <div className="grid grid-cols-2 gap-3 lg:hidden">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/25">Snelheid</p>
                <p className="mt-1 text-lg font-black tabular-nums text-white/80">{lastLeadAgo}</p>
                <p className="text-[10px] text-white/25">elke {avgInterval}</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/25">Tel. kwaliteit</p>
                <p className={`mt-1 text-lg font-black ${phoneColor}`}>{phoneQuality.validPct}%</p>
                <p className="text-[10px] text-white/25">{phoneQuality.invalid} verdacht vandaag</p>
              </div>
            </div>
          </div>
        </div>

        {/* Period comparison */}
        <div className="grid shrink-0 grid-cols-3 gap-2 lg:grid-cols-6">
          {Object.entries(PERIOD_LABELS).map(([key, label], i) => {
            const stat = ps[key];
            if (!stat) return null;
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.06 }}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 backdrop-blur-sm"
              >
                <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-white/25 lg:text-[10px]">{label}</p>
                <div className="flex items-baseline gap-1.5">
                  <AnimatedNumber value={stat.leads} className="text-lg font-black tabular-nums text-white/90 lg:text-xl" />
                  <TrendArrow current={stat.leads} previous={stat.prevLeads} />
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-white/25">
                  <span>{stat.assigned} uitgedeeld</span>
                  {stat.leads > 0 && (
                    <span className="rounded bg-white/[0.06] px-1 py-0.5 text-[9px] font-bold text-white/30">
                      {Math.round((stat.assigned / stat.leads) * 100)}%
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
