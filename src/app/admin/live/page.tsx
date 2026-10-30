'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { adminFetch } from '@/lib/adminAuth';
import { audioManager } from '@/lib/celebrationSounds';
import type { ActieSamenvatting } from '@/lib/lotenActieLaden';
import { DuurzaamDecor } from './DuurzaamDecor';
import { groepeerStaffels, type StaffelWeergave } from '@/lib/amStaffel';
import { bouwSlides, huidigeIndex, leesDuur, leesVasteSlide, onderwerpen, paginaVan, stapIndex, STANDAARD_DUUR_SEC, type SlideId } from '@/lib/liveSlides';
import { ExclamationTriangleIcon, SignalSlashIcon } from '@heroicons/react/24/outline';

/** Langzamer pollen = minder Supabase-load bij open Live-tab (Pro of niet). */
const REFRESH_INTERVAL = 90_000;

/**
 * Het wallboard wordt op één vaste ontwerpmaat gebouwd en daarna als geheel
 * geschaald naar het scherm. Zo ziet een 4K-TV precies hetzelfde als een
 * Full HD-scherm, alleen groter, in plaats van dezelfde pixels op een dubbel
 * zo grote resolutie waardoor alles half zo groot oogt.
 */
const DESIGN_W = 1920;
const DESIGN_H = 1080;

function useStageScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const bereken = () =>
      setScale(Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H));
    bereken();
    window.addEventListener('resize', bereken);
    return () => window.removeEventListener('resize', bereken);
  }, []);
  return scale;
}

/**
 * Typeschaal voor een wallboard dat op circa vier meter afstand wordt gelezen.
 * Vuistregel: leesbare hoogte is ongeveer kijkafstand gedeeld door 250, wat op
 * vier meter neerkomt op zo'n 16mm en dus ruwweg 45px. Alles onder TYPE.meta
 * hoort niet op dit scherm; wie het moet lezen, staat te dichtbij.
 */
const TYPE = {
  hero: 'text-[100px] leading-[0.95]',
  primary: 'text-[44px] leading-[1]',
  secondary: 'text-[30px] leading-[1.1]',
  label: 'text-[22px] leading-[1.2]',
  meta: 'text-[18px] leading-[1.3]',
} as const;

/** Hoe oud data mag zijn voordat het scherm dat toegeeft. */
const STALE_AFTER_MS = REFRESH_INTERVAL * 2.5;

interface CelebrationEvent {
  id: string;
  event_type: string;
  payload: Record<string, any>;
  created_at: string;
  source?: 'db' | 'test';
}

const BRANCH_COLORS: Record<string, { bar: string; glow: string; badge: string; fill: string }> = {
  thuisbatterij: { bar: 'from-emerald-400 to-emerald-500', glow: 'shadow-emerald-500/30', badge: 'bg-emerald-500/20 text-emerald-300', fill: '#34d399' },
  airco: { bar: 'from-sky-400 to-sky-500', glow: 'shadow-sky-500/30', badge: 'bg-sky-500/20 text-sky-300', fill: '#38bdf8' },
};
const DEFAULT_BRANCH = { bar: 'from-purple-400 to-purple-500', glow: 'shadow-purple-500/30', badge: 'bg-purple-500/20 text-purple-300', fill: '#a78bfa' };

interface PeriodStat { leads: number; prevLeads: number; assigned: number; prevAssigned: number; revenue: number; prevRevenue: number; adSpend: number; prevAdSpend: number; profit: number; prevProfit: number; }
interface BatchInfo {
  id: string;
  customer: string;
  branch: string;
  batchSize: number;
  delivered: number;
  pricePerLead: number | null;
  leadsPerDay?: number | null;
  leadsPerWeek: number | null;
  notes: string | null;
  targetAreaLabels?: string[];
}
interface CostMetrics { monthAdSpend: number; brutoCpl: number; effectieveCpl: number; avgAssignments: number; distributionAssignmentTotal?: number; netDistributionAssignmentTotal?: number; approvedReclamationsInWindow?: number; batchRevenue: number; bulkRevenue: number; bulkAssignmentCount: number; totalProfit: number; }
interface PaidBatch { id: string; batchId: string; customer: string; branch: string; amount: number; paidAt: string; amId: string | null; amName: string | null; amAvatarUrl?: string | null; celebrationVideoUrl: string | null; videoStart?: number | null; videoEnd?: number | null; }
interface AMLeaderboardEntry { id: string; name: string; revenue: number; bulkRevenue: number; batches: number; celebrationVideoUrl: string | null; avatarUrl?: string | null; }

interface AiSpendSummaryUI {
  enabled: boolean;
  todayCents: number;
  monthCents: number;
  monthCapCents: number;
  branches: Array<{ branch: string; todayCents: number; monthCents: number }>;
  activeExperiments: number;
}

interface LiveData {
  totalLeads: number;
  activeCustomers: number;
  totalCustomers: number;
  activeBatches: BatchInfo[];
  completedBatchCount: number;
  totalRevenue: number;
  periodStats: Record<string, PeriodStat>;
  branchBreakdown: Record<string, number>;
  phoneQuality: { total: number; invalid: number; validPct: number };
  aiSpend?: AiSpendSummaryUI;
  costMetrics?: CostMetrics;
  recentPaidBatches?: PaidBatch[];
  amLeaderboard?: AMLeaderboardEntry[];
  actie?: ActieSamenvatting | null;
  timestamp: string;
}

// ─── Celebration Effects ──────────────────────────────────────────────
type CelebrationVariant = 'confetti' | 'goldenRain' | 'megaBurst';

const BRANCH_CONFETTI: Record<string, string[]> = {
  thuisbatterij: ['#34d399', '#10b981', '#059669', '#6ee7b7', '#a7f3d0'],
  airco: ['#38bdf8', '#0ea5e9', '#0284c7', '#7dd3fc', '#bae6fd'],
  zonnepanelen: ['#facc15', '#eab308', '#ca8a04', '#fde047', '#fef08a'],
  niche_research: ['#8b5cf6', '#a78bfa', '#6366f1', '#c4b5fd', '#ddd6fe'],
};

function fireCelebration(canvas: HTMLCanvasElement, variant: CelebrationVariant = 'confetti', branch?: string) {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.scale(dpr, dpr);
  const W = window.innerWidth;
  const H = window.innerHeight;

  const defaultColors = ['#a855f7', '#ec4899', '#34d399', '#facc15', '#38bdf8', '#f97316', '#f43f5e', '#ffffff'];
  const branchColors = branch ? BRANCH_CONFETTI[branch] : null;
  const confettiColors = branchColors
    ? [...branchColors, ...branchColors, ...branchColors, ...defaultColors.slice(0, 3)]
    : defaultColors;
  const goldColors = ['#fbbf24', '#f59e0b', '#d97706', '#fcd34d', '#fffbeb', '#b45309'];

  type PShape = 'rect' | 'circle' | 'streamer' | 'star' | 'heart' | 'diamond';
  interface CParticle {
    x: number; y: number; vx: number; vy: number;
    size: number; color: string; rotation: number; rotSpeed: number;
    life: number; maxLife: number; shape: PShape;
    flickerPhase: number; flickerSpeed: number;
    trail: { x: number; y: number }[];
    glowSize: number;
    gravity: number;
    drag: number;
    sparkle: boolean;
  }

  interface Firework {
    x: number; y: number; targetY: number; vy: number;
    color: string; exploded: boolean; trail: { x: number; y: number; alpha: number }[];
    particles: CParticle[];
  }

  interface Shockwave {
    x: number; y: number; radius: number; maxRadius: number;
    life: number; color: string;
  }

  interface ScreenFlash {
    life: number; color: string; intensity: number;
  }

  const particles: CParticle[] = [];
  const fireworks: Firework[] = [];
  const shockwaves: Shockwave[] = [];
  const flashes: ScreenFlash[] = [];
  const shapes: PShape[] = ['rect', 'rect', 'circle', 'streamer', 'star', 'heart', 'diamond'];
  let shakeX = 0, shakeY = 0, shakeDecay = 0;

  function drawStar(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, points: number) {
    c.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? r : r * 0.4;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.closePath();
    c.fill();
  }

  function drawHeart(c: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    c.beginPath();
    c.moveTo(cx, cy + r * 0.3);
    c.bezierCurveTo(cx, cy - r * 0.5, cx - r, cy - r * 0.5, cx - r, cy + r * 0.1);
    c.bezierCurveTo(cx - r, cy + r * 0.6, cx, cy + r, cx, cy + r * 1.1);
    c.bezierCurveTo(cx, cy + r, cx + r, cy + r * 0.6, cx + r, cy + r * 0.1);
    c.bezierCurveTo(cx + r, cy - r * 0.5, cx, cy - r * 0.5, cx, cy + r * 0.3);
    c.closePath();
    c.fill();
  }

  function drawDiamond(c: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    c.beginPath();
    c.moveTo(cx, cy - r);
    c.lineTo(cx + r * 0.6, cy);
    c.lineTo(cx, cy + r);
    c.lineTo(cx - r * 0.6, cy);
    c.closePath();
    c.fill();
  }

  function makeParticle(x: number, y: number, vx: number, vy: number, color: string, opts?: Partial<CParticle>): CParticle {
    const shape = opts?.shape || shapes[Math.floor(Math.random() * shapes.length)];
    return {
      x, y, vx, vy,
      size: opts?.size ?? (Math.random() * 10 + 3),
      color,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 18,
      life: 1,
      maxLife: opts?.maxLife ?? 1,
      shape,
      flickerPhase: Math.random() * Math.PI * 2,
      flickerSpeed: 2 + Math.random() * 5,
      trail: [],
      glowSize: opts?.glowSize ?? (shape === 'star' || shape === 'diamond' ? 12 : 0),
      gravity: opts?.gravity ?? 0.35,
      drag: opts?.drag ?? 0.995,
      sparkle: opts?.sparkle ?? (shape === 'star' || shape === 'diamond'),
    };
  }

  function makeCannon(originX: number, dirX: number, count: number, colors: string[]) {
    for (let i = 0; i < count; i++) {
      particles.push(makeParticle(
        originX + (Math.random() - 0.5) * 60,
        H * 0.92,
        dirX * (Math.random() * 16 + 5),
        -Math.random() * 26 - 12,
        colors[Math.floor(Math.random() * colors.length)],
        { size: Math.random() * 11 + 3, glowSize: Math.random() > 0.7 ? 10 : 0 },
      ));
    }
  }

  function spawnFirework(x: number, targetY: number, color: string) {
    fireworks.push({ x, y: H, targetY, vy: -12 - Math.random() * 6, color, exploded: false, trail: [], particles: [] });
  }

  function explodeFirework(fw: Firework) {
    fw.exploded = true;
    const count = 50 + Math.floor(Math.random() * 40);
    shockwaves.push({ x: fw.x, y: fw.y, radius: 0, maxRadius: 120 + Math.random() * 80, life: 1, color: fw.color });
    flashes.push({ life: 1, color: fw.color, intensity: 0.15 });
    shakeDecay = 12;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = 2 + Math.random() * 6;
      fw.particles.push(makeParticle(
        fw.x, fw.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        fw.color,
        { size: Math.random() * 4 + 2, gravity: 0.04, drag: 0.975, glowSize: 8, maxLife: 0.6 + Math.random() * 0.4, sparkle: true },
      ));
    }
  }

  // Initial setup per variant
  if (variant === 'confetti' || variant === 'megaBurst') {
    const n = variant === 'megaBurst' ? 300 : 200;
    makeCannon(W * 0.04, 1, n, confettiColors);
    makeCannon(W * 0.96, -1, n, confettiColors);
    flashes.push({ life: 1, color: '#ffffff', intensity: variant === 'megaBurst' ? 0.25 : 0.12 });
    shakeDecay = variant === 'megaBurst' ? 18 : 8;
    shockwaves.push({ x: W * 0.04, y: H * 0.92, radius: 0, maxRadius: 200, life: 1, color: confettiColors[0] });
    shockwaves.push({ x: W * 0.96, y: H * 0.92, radius: 0, maxRadius: 200, life: 1, color: confettiColors[1] });
  }

  if (variant === 'goldenRain' || variant === 'megaBurst') {
    const count = variant === 'megaBurst' ? 250 : 180;
    for (let i = 0; i < count; i++) {
      particles.push(makeParticle(
        Math.random() * W,
        -Math.random() * H * 0.5,
        (Math.random() - 0.5) * 2,
        Math.random() * 3 + 1.5,
        goldColors[Math.floor(Math.random() * goldColors.length)],
        { size: Math.random() * 5 + 2, shape: Math.random() > 0.5 ? 'star' : 'circle', gravity: 0.08, glowSize: 6, sparkle: true },
      ));
    }
  }

  if (variant === 'megaBurst') {
    const fwColors = [...confettiColors, ...goldColors];
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        spawnFirework(
          W * 0.15 + Math.random() * W * 0.7,
          H * 0.1 + Math.random() * H * 0.35,
          fwColors[Math.floor(Math.random() * fwColors.length)],
        );
      }, i * 200);
    }
  } else if (variant === 'confetti') {
    const fwColors = confettiColors;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        spawnFirework(
          W * 0.2 + Math.random() * W * 0.6,
          H * 0.15 + Math.random() * H * 0.3,
          fwColors[Math.floor(Math.random() * fwColors.length)],
        );
      }, 300 + i * 350);
    }
  }

  let frame = 0;
  const maxFrames = variant === 'megaBurst' ? 360 : variant === 'goldenRain' ? 240 : 280;
  let running = true;

  function drawParticle(p: CParticle, alpha: number) {
    // Glow trail
    if (p.glowSize > 0 && p.trail.length > 1) {
      ctx!.save();
      ctx!.globalAlpha = alpha * 0.3;
      ctx!.strokeStyle = p.color;
      ctx!.lineWidth = p.size * 0.4;
      ctx!.lineCap = 'round';
      ctx!.shadowColor = p.color;
      ctx!.shadowBlur = p.glowSize;
      ctx!.beginPath();
      ctx!.moveTo(p.trail[0].x, p.trail[0].y);
      for (let t = 1; t < p.trail.length; t++) {
        ctx!.lineTo(p.trail[t].x, p.trail[t].y);
      }
      ctx!.stroke();
      ctx!.restore();
    }

    ctx!.save();
    ctx!.translate(p.x, p.y);
    ctx!.rotate((p.rotation * Math.PI) / 180);
    ctx!.globalAlpha = alpha;
    ctx!.fillStyle = p.color;

    if (p.glowSize > 0) {
      ctx!.shadowColor = p.color;
      ctx!.shadowBlur = p.glowSize;
    }

    switch (p.shape) {
      case 'rect':
        ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        break;
      case 'circle':
        ctx!.beginPath();
        ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx!.fill();
        if (p.sparkle) {
          ctx!.globalAlpha = alpha * 0.6;
          ctx!.fillStyle = '#fff';
          ctx!.beginPath();
          ctx!.arc(-p.size * 0.15, -p.size * 0.15, p.size * 0.2, 0, Math.PI * 2);
          ctx!.fill();
        }
        break;
      case 'star':
        drawStar(ctx!, 0, 0, p.size / 2, 5);
        break;
      case 'heart':
        drawHeart(ctx!, 0, 0, p.size * 0.4);
        break;
      case 'diamond':
        drawDiamond(ctx!, 0, 0, p.size / 2);
        break;
      case 'streamer':
        ctx!.fillRect(-p.size * 0.15, -p.size * 1.5, p.size * 0.3, p.size * 3);
        break;
    }
    ctx!.restore();
  }

  function animate() {
    if (!running) return;
    if (frame >= maxFrames) { ctx!.clearRect(0, 0, W * dpr, H * dpr); canvas.style.transform = ''; return; }

    // Screen shake
    if (shakeDecay > 0) {
      shakeX = (Math.random() - 0.5) * shakeDecay * 1.5;
      shakeY = (Math.random() - 0.5) * shakeDecay * 1.5;
      shakeDecay *= 0.88;
      if (shakeDecay < 0.3) shakeDecay = 0;
      canvas.style.transform = `translate(${shakeX}px, ${shakeY}px)`;
    } else if (shakeX !== 0 || shakeY !== 0) {
      shakeX = 0; shakeY = 0;
      canvas.style.transform = '';
    }

    ctx!.clearRect(0, 0, W, H);

    // Screen flash
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      if (f.life > 0) {
        ctx!.save();
        ctx!.globalAlpha = f.life * f.intensity;
        ctx!.fillStyle = f.color;
        ctx!.fillRect(0, 0, W, H);
        ctx!.restore();
        f.life -= 0.04;
      } else {
        flashes.splice(i, 1);
      }
    }

    // Shockwaves
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * 0.08;
      sw.life -= 0.025;
      if (sw.life <= 0) { shockwaves.splice(i, 1); continue; }
      ctx!.save();
      ctx!.globalAlpha = sw.life * 0.4;
      ctx!.strokeStyle = sw.color;
      ctx!.lineWidth = 3 * sw.life;
      ctx!.shadowColor = sw.color;
      ctx!.shadowBlur = 20 * sw.life;
      ctx!.beginPath();
      ctx!.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.restore();
    }

    // Fireworks (rising trail)
    for (const fw of fireworks) {
      if (!fw.exploded) {
        fw.y += fw.vy;
        fw.vy *= 0.985;
        fw.trail.push({ x: fw.x + (Math.random() - 0.5) * 2, y: fw.y, alpha: 1 });
        if (fw.trail.length > 20) fw.trail.shift();

        // Draw trail
        for (let t = 0; t < fw.trail.length; t++) {
          const tp = fw.trail[t];
          tp.alpha *= 0.92;
          ctx!.save();
          ctx!.globalAlpha = tp.alpha * 0.8;
          ctx!.fillStyle = fw.color;
          ctx!.shadowColor = fw.color;
          ctx!.shadowBlur = 8;
          ctx!.beginPath();
          ctx!.arc(tp.x, tp.y, 2.5 * tp.alpha, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.restore();
        }

        // Draw head
        ctx!.save();
        ctx!.fillStyle = '#ffffff';
        ctx!.shadowColor = fw.color;
        ctx!.shadowBlur = 15;
        ctx!.beginPath();
        ctx!.arc(fw.x, fw.y, 3.5, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();

        if (fw.y <= fw.targetY || fw.vy > -2) {
          explodeFirework(fw);
        }
      } else {
        // Exploded particles
        for (let pi = fw.particles.length - 1; pi >= 0; pi--) {
          const p = fw.particles[pi];
          p.trail.push({ x: p.x, y: p.y });
          if (p.trail.length > 6) p.trail.shift();
          p.x += p.vx;
          p.vy += p.gravity;
          p.y += p.vy;
          p.vx *= p.drag;
          p.rotation += p.rotSpeed;
          p.life -= 0.012;

          if (p.life <= 0) { fw.particles.splice(pi, 1); continue; }
          const flicker = 0.5 + 0.5 * Math.sin(frame * p.flickerSpeed * 0.15 + p.flickerPhase);
          drawParticle(p, p.life * (0.6 + flicker * 0.4));
        }
      }
    }

    // Main particles
    const lifeFraction = frame / maxFrames;
    for (const p of particles) {
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 5) p.trail.shift();
      p.x += p.vx;
      p.vy += p.gravity;
      p.y += p.vy;
      p.vx *= p.drag;
      p.rotation += p.rotSpeed;
      p.life = Math.max(0, 1 - lifeFraction / p.maxLife);

      const flicker = 0.5 + 0.5 * Math.sin(frame * p.flickerSpeed * 0.1 + p.flickerPhase);
      const alpha = p.life * (0.6 + flicker * 0.4);

      drawParticle(p, alpha);
    }

    frame++;
    requestAnimationFrame(animate);
  }
  animate();
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
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

function CountUpAmount({ value, className = '', style }: { value: number; className?: string; style?: React.CSSProperties }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let f = 0;
    const total = 40;
    const iv = setInterval(() => {
      f++;
      const eased = 1 - Math.pow(1 - f / total, 3);
      setDisplay(value * eased);
      if (f >= total) { clearInterval(iv); setDisplay(value); }
    }, 25);
    return () => clearInterval(iv);
  }, [value]);
  return <span className={className} style={style}>&euro;{display.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
}

function TrendArrow({ current, previous, groot = false }: { current: number; previous: number; groot?: boolean }) {
  const maat = groot ? 'text-[40px]' : 'text-[22px]';
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return <span className={`${maat} font-bold text-emerald-400`}>nieuw</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-1 ${maat} font-bold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
      <svg className={groot ? 'h-7 w-7' : 'h-3 w-3'} viewBox="0 0 12 12" fill="none">
        <path d={up ? 'M6 2L10 7H2L6 2Z' : 'M6 10L2 5H10L6 10Z'} fill="currentColor" />
      </svg>
      {up ? '+' : ''}{pct}%
    </span>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────
interface AMTargetLive {
  id: string;
  admin_user_id: string;
  am_name: string;
  am_avatar_url?: string | null;
  am_active?: boolean;
  label: string;
  target_type: string;
  target_value: number;
  bonus_amount: number;
  current_value: number;
  progress_pct: number;
  period_start: string;
  period_end: string;
  status: string;
  notes?: string | null;
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  revenue: 'Omzet',
  batches: 'Batches',
  new_customers: 'Klanten',
  leads_delivered: 'Leads',
};

// ─── Slides ──────────────────────────────────────────────────────────

/**
 * Het balkje onder het huidige onderwerp. Houdt zelf de tijd bij, zodat
 * alleen dit balkje tien keer per seconde ververst en niet het hele scherm.
 * Een JS-klok en geen CSS-animatie: bij "minder beweging" zet globals.css
 * elke animatie op 0,01ms, en dan zou de slideshow doorrazen.
 */
function SlideVoortgang({ duurMs, stil, onKlaar }: { duurMs: number; stil: boolean; onKlaar: () => void }) {
  const [verstreken, setVerstreken] = useState(0);
  const klaarRef = useRef(onKlaar);
  klaarRef.current = onKlaar;
  const gemeld = useRef(false);

  useEffect(() => {
    if (stil) return;
    let vorige = Date.now();
    const iv = setInterval(() => {
      const nu = Date.now();
      const stap = nu - vorige;
      vorige = nu;
      setVerstreken(v => v + stap);
    }, 100);
    return () => clearInterval(iv);
  }, [stil]);

  useEffect(() => {
    if (verstreken >= duurMs && !gemeld.current) {
      gemeld.current = true;
      klaarRef.current();
    }
  }, [verstreken, duurMs]);

  return (
    <div
      className={`h-full rounded-full ${stil ? 'bg-white/40' : 'bg-gradient-to-r from-brand-purple to-brand-pink'}`}
      style={{ width: `${Math.min(100, (verstreken / duurMs) * 100)}%` }}
    />
  );
}

function SlideKop({ titel, rechts }: { titel: string; rechts?: React.ReactNode }) {
  return (
    <div className="mb-5 flex shrink-0 items-end justify-between gap-6">
      <h2 className={`${TYPE.primary} font-black tracking-tight text-white/90`}>{titel}</h2>
      {rechts}
    </div>
  );
}

const euro = (n: number, decimalen = 0) =>
  `€${n.toLocaleString('nl-NL', { minimumFractionDigits: decimalen, maximumFractionDigits: decimalen })}`;

function SlideVandaag({ data }: { data: LiveData }) {
  const dag = data.periodStats.day;
  const cm = data.costMetrics;
  const kpis: { label: string; waarde: React.ReactNode; sub: string; trend?: React.ReactNode }[] = [
    {
      label: 'Leads laatste 24 uur',
      waarde: <AnimatedNumber value={dag?.leads || 0} />,
      sub: `${dag?.assigned || 0} uitgedeeld`,
      trend: dag ? <TrendArrow current={dag.leads} previous={dag.prevLeads} /> : null,
    },
    {
      label: 'Winst deze maand',
      waarde: <AnimatedNumber value={Math.round(cm?.totalProfit || 0)} prefix="€" />,
      sub: `omzet deze maand ${euro(Math.round(data.totalRevenue))}`,
    },
    {
      label: 'Effectieve CPL',
      waarde: euro(cm?.effectieveCpl || 0, 2),
      sub: `deze maand · ${cm?.avgAssignments || 0}x uitgedeeld`,
    },
    {
      label: 'Leads totaal',
      waarde: <AnimatedNumber value={data.totalLeads} />,
      sub: `${data.activeCustomers} klanten actief`,
    },
  ];

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="relative flex min-h-0 flex-1 flex-col justify-center overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-brand-purple/25 to-brand-pink/10 px-16">
        <p className={`${TYPE.secondary} font-semibold uppercase tracking-wider text-white/55`}>Omzet laatste 24 uur</p>
        <div className="mt-4 flex items-end gap-8">
          <AnimatedNumber
            value={Math.round(dag?.revenue || 0)}
            prefix="€"
            className="text-[220px] font-black leading-[0.9] tracking-tight tabular-nums text-white"
          />
          {dag && (
            <span className="mb-5">
              <TrendArrow current={dag.revenue} previous={dag.prevRevenue} groot />
            </span>
          )}
        </div>
        <p className={`${TYPE.secondary} mt-6 tabular-nums text-white/45`}>
          vorige 24 uur: {euro(Math.round(dag?.prevRevenue || 0))}
        </p>
      </div>

      <div className="grid h-[290px] shrink-0 grid-cols-4 gap-5">
        {kpis.map(k => (
          <div key={k.label} className="flex min-w-0 flex-col justify-center rounded-3xl border border-white/[0.06] bg-white/[0.03] px-8">
            <p className={`${TYPE.label} font-semibold uppercase tracking-wide text-white/45`}>{k.label}</p>
            <div className="mt-3 flex items-baseline gap-4">
              <span className="text-[72px] font-black leading-none tracking-tight tabular-nums text-white">{k.waarde}</span>
              {k.trend}
            </div>
            <p className={`${TYPE.label} mt-3 truncate tabular-nums text-white/40`}>{k.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideBatches({
  batches, pagina, paginas, aantalActief, aantalVoltooid, geleverd, totaal, totaalPct, celebratingId,
}: {
  batches: BatchInfo[];
  pagina: number;
  paginas: number;
  aantalActief: number;
  aantalVoltooid: number;
  geleverd: number;
  totaal: number;
  totaalPct: number;
  celebratingId: string | null;
}) {
  return (
    <div className="flex h-full flex-col">
      <SlideKop
        titel={paginas > 1 ? `Actieve batches ${pagina}/${paginas}` : 'Actieve batches'}
        rechts={
          <div className="w-[560px] shrink-0">
            <div className={`${TYPE.label} flex items-baseline justify-between tabular-nums text-white/50`}>
              <span>{aantalActief} actief · {aantalVoltooid} voltooid</span>
              <span className="font-bold text-white/75">{geleverd.toLocaleString('nl-NL')} / {totaal.toLocaleString('nl-NL')} ({totaalPct}%)</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-pink" style={{ width: `${totaalPct}%` }} />
            </div>
          </div>
        }
      />
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-4 gap-4">
        {batches.map(b => {
          const pct = b.batchSize > 0 ? Math.min(100, Math.round((b.delivered / b.batchSize) * 100)) : 0;
          const bc = BRANCH_COLORS[b.branch] || DEFAULT_BRANCH;
          const viert = celebratingId === b.id;
          const tempo = b.leadsPerDay ? `${b.leadsPerDay}/dag` : b.leadsPerWeek ? `${b.leadsPerWeek}/week` : null;
          const gebied = (b.targetAreaLabels ?? []).join(' · ');
          return (
            <div
              key={b.id}
              className={`flex min-h-0 flex-col justify-center rounded-2xl border px-6 ${
                viert ? 'border-emerald-500/40 bg-emerald-500/[0.08] shadow-lg shadow-emerald-500/20' : 'border-white/[0.05] bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`${TYPE.secondary} truncate font-bold text-white/90`}>{b.customer}</span>
                  <span className={`shrink-0 rounded-full px-3 py-0.5 text-[20px] font-bold ${bc.badge}`}>{b.branch}</span>
                  {viert && <span className="text-[30px]">🎉</span>}
                </div>
                <div className="flex shrink-0 items-baseline gap-2">
                  <span className={`${TYPE.primary} font-black tabular-nums text-white`}>{b.delivered}</span>
                  <span className={`${TYPE.label} tabular-nums text-white/35`}>/ {b.batchSize}</span>
                </div>
              </div>
              <div className="relative mt-3 h-4 overflow-hidden rounded-full bg-white/[0.06]">
                <div className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${bc.bar} shadow-lg ${bc.glow}`} style={{ width: `${pct}%` }} />
              </div>
              <div className={`${TYPE.meta} mt-2.5 flex items-center justify-between gap-4 tabular-nums text-white/40`}>
                <span className="min-w-0 truncate">
                  {[b.pricePerLead ? `€${b.pricePerLead}/lead` : null, tempo, gebied || null].filter(Boolean).join(' · ')}
                </span>
                <span className="shrink-0 font-bold text-white/60">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SlideGeld({ data, costMetrics: cm }: { data: LiveData; costMetrics: CostMetrics }) {
  const ai = data.aiSpend;
  const tegels: { label: string; waarde: string; kleur: string; sub?: string; uitleg?: string }[] = [
    { label: 'Ad spend deze maand', waarde: euro(cm.monthAdSpend), kleur: 'text-white' },
    { label: 'Bruto CPL deze maand', waarde: euro(cm.brutoCpl, 2), kleur: 'text-white' },
    {
      label: 'Effectieve CPL deze maand',
      waarde: euro(cm.effectieveCpl, 2),
      kleur: 'text-emerald-400',
      sub: `${cm.avgAssignments}x uitgedeeld${cm.approvedReclamationsInWindow ? ` · −${cm.approvedReclamationsInWindow} reclamaties` : ''}`,
      uitleg: 'Spend gedeeld door netto-toewijzingen (goedgekeurde reclamaties tellen niet als levering, kosten blijven volledig staan).',
    },
    {
      label: 'Omzet deze maand',
      waarde: euro(data.totalRevenue),
      kleur: 'text-white',
      sub: cm.bulkRevenue > 0 ? `${euro(cm.batchRevenue)} batch + ${euro(cm.bulkRevenue)} bulk` : undefined,
    },
    {
      label: 'Winst deze maand',
      waarde: `${cm.totalProfit >= 0 ? '+' : ''}${euro(cm.totalProfit)}`,
      sub: 'omzet min ad spend',
      kleur: cm.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400',
    },
    {
      label: 'AI spend deze maand',
      waarde: euro((ai?.monthCents || 0) / 100, 2),
      kleur: ai?.enabled ? 'text-purple-300' : 'text-white/30',
      sub: ai?.enabled ? `${ai.activeExperiments} live · vandaag ${euro((ai.todayCents || 0) / 100, 2)}` : 'AI uit',
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <SlideKop
        titel="Geld"
        rechts={
          <p className={`${TYPE.secondary} font-semibold capitalize text-white/50`}>
            {new Date().toLocaleDateString('nl-NL', { month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' })}
          </p>
        }
      />
      <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-5">
        {tegels.map(t => (
          <div
            key={t.label}
            title={t.uitleg}
            className="flex min-w-0 flex-col justify-center rounded-3xl border border-emerald-500/10 bg-emerald-500/[0.04] px-10"
          >
            <p className={`${TYPE.label} font-bold uppercase tracking-widest text-emerald-400/60`}>{t.label}</p>
            <p className={`mt-4 text-[84px] font-black leading-none tracking-tight tabular-nums ${t.kleur}`}>{t.waarde}</p>
            <p className={`${TYPE.label} mt-4 truncate tabular-nums text-white/40`}>{t.sub ?? '\u00a0'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideActie({ actie, nu }: { actie: ActieSamenvatting; nu: Date }) {
  const resterendMs = Date.parse(actie.eind) - nu.getTime();
  const dagen = Math.floor(resterendMs / 86_400_000);
  const uren = Math.floor((resterendMs % 86_400_000) / 3_600_000);
  const aftellen = resterendMs <= 0 ? null : dagen >= 1 ? `nog ${dagen} ${dagen === 1 ? 'dag' : 'dagen'}` : `nog ${Math.max(1, uren)} uur`;
  const meeste = Math.max(1, ...actie.top.map(t => t.loten));

  return (
    <div className="flex h-full flex-col">
      <SlideKop
        titel={`Actie: ${actie.prijsLeads} gratis leads`}
        rechts={<p className={`${TYPE.label} text-white/45`}>1 lot per {actie.leadsPerLot} leads in een betaalde batch</p>}
      />
      <div className="grid min-h-0 flex-1 grid-cols-5 gap-5">
        <div className="col-span-2 flex flex-col gap-5">
          <div className="flex flex-1 flex-col justify-center rounded-3xl border border-orange-400/20 bg-gradient-to-br from-orange-500/20 to-brand-pink/10 px-10">
            {actie.winnaar ? (
              <>
                <p className={`${TYPE.secondary} font-semibold uppercase tracking-wider text-orange-200/70`}>Winnaar</p>
                <p className="mt-4 text-[72px] font-black leading-[1.05] tracking-tight text-white">{actie.winnaar} 🎉</p>
                <p className={`${TYPE.secondary} mt-5 text-white/55`}>wint {actie.prijsLeads} gratis leads</p>
              </>
            ) : (
              <>
                <p className={`${TYPE.secondary} font-semibold uppercase tracking-wider text-orange-200/70`}>Trekking</p>
                <p className="mt-4 text-[110px] font-black leading-none tracking-tight text-white">{aftellen ?? 'binnenkort'}</p>
                <p className={`${TYPE.secondary} mt-5 text-white/55`}>
                  {aftellen ? `loopt tot en met ${actie.eindLabel}` : 'de actie is afgelopen'}
                </p>
              </>
            )}
          </div>
          <div className="grid h-[220px] shrink-0 grid-cols-2 gap-5">
            {[
              { label: 'Loten in de pot', waarde: actie.totaalLoten },
              { label: 'Deelnemers', waarde: actie.deelnemers },
            ].map(k => (
              <div key={k.label} className="flex flex-col justify-center rounded-3xl border border-white/[0.06] bg-white/[0.03] px-8">
                <p className={`${TYPE.label} font-semibold uppercase tracking-wide text-white/45`}>{k.label}</p>
                <AnimatedNumber value={k.waarde} className="mt-3 text-[72px] font-black leading-none tabular-nums text-white" />
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-3 flex min-h-0 flex-col rounded-3xl border border-white/[0.06] bg-white/[0.03] p-8">
          <h3 className={`${TYPE.secondary} mb-5 font-bold text-white/75`}>Meeste loten</h3>
          {actie.top.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <p className={`${TYPE.secondary} text-white/30`}>Nog geen loten. De eerste betaalde batch opent de pot.</p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col justify-start gap-4">
              {actie.top.map((t, i) => (
                <div key={t.klant + i}>
                  <div className="flex items-baseline justify-between gap-4">
                    <p className={`${TYPE.secondary} min-w-0 truncate font-bold ${i === 0 ? 'text-orange-300' : 'text-white/85'}`}>{t.klant}</p>
                    <span className={`${TYPE.secondary} shrink-0 font-black tabular-nums text-white`}>
                      {t.loten} {t.loten === 1 ? 'lot' : 'loten'}
                    </span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/[0.07]">
                    <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-brand-pink" style={{ width: `${(t.loten / meeste) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const MAX_TARGETS = 6;
const MAX_LEADERBOARD = 8;

/** Een bonusstaffel als één regel: balk tot de hoogste trede, met een streepje per trede. */
function StaffelRegel({ s }: { s: StaffelWeergave }) {
  const top = s.treden[s.treden.length - 1]?.waarde || 1;
  const bedrag = (n: number) => (s.target_type === 'revenue' ? euro(n) : n.toLocaleString('nl-NL'));
  const kort = (n: number) => (s.target_type === 'revenue' ? `€${(n / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 1 })}k` : n.toLocaleString('nl-NL'));
  const dagen = Math.max(0, Math.ceil((new Date(s.period_end + 'T23:59:59').getTime() - Date.now()) / 86400000));
  const alles = !s.volgende;
  return (
    <div className={`rounded-2xl border px-5 py-3 ${s.bonus > 0 ? 'border-emerald-500/25 bg-emerald-500/[0.07]' : 'border-white/[0.05] bg-white/[0.02]'}`}>
      <div className="flex items-baseline justify-between gap-4">
        <p className={`${TYPE.secondary} min-w-0 flex-1 truncate font-bold text-white/85`}>
          {s.am_name}
          <span className={`${TYPE.meta} ml-3 font-medium text-white/35`}>{bedrag(s.huidig)} deze maand</span>
        </p>
        <span className={`${TYPE.secondary} shrink-0 font-black tabular-nums ${s.bonus > 0 ? 'text-emerald-400' : 'text-white/60'}`}>
          {alles ? '🎉 ' : ''}{euro(s.bonus)} bonus
        </span>
      </div>
      <div className="relative mt-2 h-3 rounded-full bg-white/[0.07]">
        <div
          className={`h-full rounded-full ${alles ? 'bg-emerald-400' : 'bg-gradient-to-r from-amber-400 to-emerald-400'}`}
          style={{ width: `${Math.min(100, (s.huidig / top) * 100)}%` }}
        />
        {s.treden.map(t => (
          <span
            key={t.waarde}
            className={`absolute top-1/2 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full ${t.gehaald ? 'bg-white' : 'bg-white/30'}`}
            style={{ left: `${(t.waarde / top) * 100}%` }}
          />
        ))}
      </div>
      <div className="relative mt-1 h-[24px]">
        {s.treden.map(t => (
          <span
            key={t.waarde}
            className={`${TYPE.meta} absolute -translate-x-1/2 whitespace-nowrap tabular-nums ${t.gehaald ? 'font-bold text-emerald-400/80' : 'text-white/35'}`}
            style={{ left: `${Math.min(96, (t.waarde / top) * 100)}%` }}
          >
            {kort(t.waarde)}
          </span>
        ))}
      </div>
      <p className={`${TYPE.meta} mt-1 tabular-nums text-white/40`}>
        {s.volgende
          ? `nog ${bedrag(s.volgende.nog)} tot ${bedrag(s.volgende.waarde)} (${euro(s.volgende.bonus)} bonus) · ${dagen}d over`
          : 'hoogste trede gehaald'}
      </p>
    </div>
  );
}

function SlideTeam({ targets, leaderboard }: { targets: AMTargetLive[]; leaderboard: AMLeaderboardEntry[] }) {
  /* Staffels (zie src/lib/amStaffel.ts) als één regel; andere targets los, beste voortgang eerst. */
  const regels = groepeerStaffels([...targets].sort((a, b) => b.progress_pct - a.progress_pct));
  const beide = targets.length > 0 && leaderboard.length > 0;
  const bedrag = (t: AMTargetLive, n: number) => (t.target_type === 'revenue' ? euro(n) : n.toLocaleString('nl-NL'));

  return (
    <div className="flex h-full flex-col">
      <SlideKop titel="Team" />
      <div className={`grid min-h-0 flex-1 gap-5 ${beide ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {targets.length > 0 && (
          <div className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-amber-500/10 bg-amber-500/[0.04] p-6">
            <h3 className={`${TYPE.secondary} mb-4 font-bold text-white/75`}>Targets</h3>
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              {regels.slice(0, MAX_TARGETS).map(r => {
                if (r.soort === 'staffel') return <StaffelRegel key={r.sleutel} s={r} />;
                const t = r.target;
                const klaar = t.progress_pct >= 100;
                const kleur = klaar ? 'bg-emerald-400' : t.progress_pct >= 75 ? 'bg-amber-400' : t.progress_pct >= 50 ? 'bg-orange-400' : 'bg-red-400';
                const rest = Math.max(0, t.target_value - t.current_value);
                const dagen = Math.max(0, Math.ceil((new Date(t.period_end + 'T23:59:59').getTime() - Date.now()) / 86400000));
                return (
                  <div
                    key={t.id}
                    className={`rounded-2xl border px-5 py-3 ${klaar ? 'border-emerald-500/25 bg-emerald-500/[0.07]' : 'border-white/[0.05] bg-white/[0.02]'}`}
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <p className={`${TYPE.secondary} min-w-0 flex-1 truncate font-bold text-white/85`}>
                        {t.am_name}
                        <span className={`${TYPE.meta} ml-3 font-medium text-white/35`}>{t.label || TARGET_TYPE_LABELS[t.target_type] || t.target_type}</span>
                      </p>
                      <span className={`${TYPE.secondary} shrink-0 font-black tabular-nums text-white`}>
                        {klaar ? '🎉 ' : ''}{Math.round(t.progress_pct)}%
                      </span>
                    </div>
                    <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/[0.07]">
                      <div className={`h-full rounded-full ${kleur}`} style={{ width: `${Math.min(100, t.progress_pct)}%` }} />
                    </div>
                    <p className={`${TYPE.meta} mt-1.5 flex justify-between gap-4 tabular-nums text-white/40`}>
                      <span className="truncate">
                        {bedrag(t, t.current_value)} van {bedrag(t, t.target_value)}
                        {!klaar && rest > 0 ? ` · nog ${bedrag(t, rest)} · ${dagen}d over` : ''}
                      </span>
                      {t.bonus_amount > 0 && (
                        <span className={`shrink-0 ${klaar ? 'font-bold text-emerald-400/80' : 'text-amber-400/70'}`}>
                          {euro(t.bonus_amount)} bonus
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}
              {regels.length > MAX_TARGETS && (
                <p className={`${TYPE.meta} text-center tabular-nums text-white/35`}>+{regels.length - MAX_TARGETS} niet getoond</p>
              )}
            </div>
          </div>
        )}

        {leaderboard.length > 0 && (
          <div className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-brand-purple/10 bg-brand-purple/[0.04] p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className={`${TYPE.secondary} font-bold text-white/75`}>Leaderboard</h3>
              <span className={`${TYPE.label} text-white/35`}>
                {new Date().toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              {leaderboard.slice(0, MAX_LEADERBOARD).map((am, rank) => {
                const eerste = rank === 0;
                const medaille = ['from-amber-400 to-amber-600', 'from-slate-300 to-slate-400', 'from-amber-600 to-amber-800'][rank];
                return (
                  <div
                    key={am.id}
                    className={`flex items-center gap-4 rounded-2xl border px-5 py-2.5 ${
                      eerste ? 'border-amber-500/20 bg-amber-500/[0.06]' : 'border-white/[0.04] bg-white/[0.02]'
                    }`}
                  >
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[26px] font-black ${
                        medaille ? `bg-gradient-to-br ${medaille} text-white` : 'bg-white/[0.06] text-white/40'
                      }`}
                    >
                      {rank + 1}
                    </span>
                    {am.avatarUrl && (
                      <Image src={am.avatarUrl} alt={am.name} width={48} height={48} className="h-12 w-12 shrink-0 rounded-full object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`${TYPE.secondary} truncate font-bold ${eerste ? 'text-amber-300' : 'text-white/80'}`}>
                        {am.name}{eerste ? ' 👑' : ''}
                      </p>
                      <p className={`${TYPE.meta} truncate tabular-nums text-white/35`}>
                        {am.batches} {am.batches === 1 ? 'batch' : 'batches'}
                        {am.bulkRevenue > 0 ? ` · ${euro(am.bulkRevenue)} bulk` : ''}
                      </p>
                    </div>
                    <span className={`${TYPE.secondary} shrink-0 font-black tabular-nums text-emerald-400`}>
                      {euro(am.revenue + am.bulkRevenue)}
                    </span>
                  </div>
                );
              })}
              {leaderboard.length > MAX_LEADERBOARD && (
                <p className={`${TYPE.meta} text-center tabular-nums text-white/35`}>+{leaderboard.length - MAX_LEADERBOARD} niet getoond</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


export default function LiveDashboard() {
  const [data, setData] = useState<LiveData | null>(null);
  const [clock, setClock] = useState(new Date());
  const [refreshIn, setRefreshIn] = useState(REFRESH_INTERVAL / 1000);
  /* Wanneer kwam er voor het laatst geldige data binnen, en hoeveel pogingen
     zijn er sindsdien mislukt. Zonder dit is een bevroren scherm niet te
     onderscheiden van een werkend scherm. */
  const [lastOkAt, setLastOkAt] = useState<number | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [celebratingBatch, setCelebratingBatch] = useState<{ id: string; customer?: string; branch?: string; batchSize?: number } | null>(null);
  const [amTargets, setAmTargets] = useState<AMTargetLive[]>([]);
  const [salesToasts, setSalesToasts] = useState<PaidBatch[]>([]);
  const [celebrationVideo, setCelebrationVideo] = useState<PaidBatch | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(audioManager.enabled);
  const [celebrationQueue, setCelebrationQueue] = useState<CelebrationEvent[]>([]);
  const [activeOverlay, setActiveOverlay] = useState<CelebrationEvent | null>(null);
  const [targetHitOverlay, setTargetHitOverlay] = useState<CelebrationEvent | null>(null);
  const [milestoneToast, setMilestoneToast] = useState<CelebrationEvent | null>(null);

  const reducedMotion = useReducedMotion();
  const stageScale = useStageScale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const celebrationIframeRef = useRef<HTMLIFrameElement>(null);
  const prevBatchPcts = useRef<Record<string, number>>({});
  const seenPaidIds = useRef<Set<string>>(new Set());
  const processedCelebrationIds = useRef<Set<string>>(new Set());
  /* Slideshow: welke slide staat er, en staat hij stil. De instellingen uit
     de URL (?slide=batches, ?duur=20) lezen we pas na het laden in, zodat
     server en browser hetzelfde eerste beeld hebben. */
  const [slideKey, setSlideKey] = useState<string | null>(null);
  const [gepauzeerd, setGepauzeerd] = useState(false);
  const [slideInstelling, setSlideInstelling] = useState<{ duurSec: number; vast: SlideId | null }>({ duurSec: STANDAARD_DUUR_SEC, vast: null });

  const fetchData = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/live-stats');
      if (res.ok) {
        const d: LiveData = await res.json();
        setData(() => {
          for (const batch of d.activeBatches) {
            const prevPct = prevBatchPcts.current[batch.id] || 0;
            const newPct = batch.batchSize > 0 ? (batch.delivered / batch.batchSize) * 100 : 0;
            if (newPct >= 100 && prevPct < 100) {
              setCelebratingBatch({ id: batch.id, customer: batch.customer, branch: batch.branch, batchSize: batch.batchSize });
              if (canvasRef.current) fireCelebration(canvasRef.current, 'megaBurst', batch.branch);
              audioManager.playForEvent('batch_complete');
              setTimeout(() => setCelebratingBatch(null), 5000);
            }
            prevBatchPcts.current[batch.id] = newPct;
          }

          // Seed seenPaidIds to prevent duplicate processing
          if (d.recentPaidBatches && d.recentPaidBatches.length > 0) {
            for (const pb of d.recentPaidBatches) seenPaidIds.current.add(pb.id);
          }

          return d;
        });
        setLastOkAt(Date.now());
        setFailedAttempts(0);
      } else {
        setFailedAttempts(n => n + 1);
      }
    } catch {
      /* Netwerkfout: cijfers op het scherm blijven staan, maar het scherm
         geeft voortaan zelf aan dat ze niet meer vers zijn. */
      setFailedAttempts(n => n + 1);
    }
    setRefreshIn(REFRESH_INTERVAL / 1000);
  }, []);

  const fetchAMTargets = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/am-targets');
      if (res.ok) {
        const all: AMTargetLive[] = await res.json();
        /* Alleen wat nu loopt: een actieve target van een actieve medewerker
           waarvan de periode vandaag omvat. Anders bleef een verlopen target
           (of iemand die uit dienst is) gewoon op het scherm staan. */
        const vandaag = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
        setAmTargets(all.filter(t => t.status === 'active' && t.am_active !== false && t.period_start <= vandaag && t.period_end >= vandaag));
      }
    } catch { /* silent */ }
  }, []);

  // Process a celebration event (from queue, realtime, or test)
  const processCelebration = useCallback((evt: CelebrationEvent) => {
    if (processedCelebrationIds.current.has(evt.id)) return;
    processedCelebrationIds.current.add(evt.id);

    const p = evt.payload || {};
    const branch = p.branch || undefined;

    switch (evt.event_type) {
      case 'sale':
      case 'sales_bell': {
        const toast: PaidBatch = {
          id: evt.id,
          batchId: p.batchId || '',
          customer: p.customer || 'Onbekend',
          branch: p.branch || 'onbekend',
          amount: p.amount || 0,
          paidAt: p.paidAt || new Date().toISOString(),
          amId: p.amId || null,
          amName: p.amName || null,
          amAvatarUrl: p.amAvatarUrl || null,
          celebrationVideoUrl: p.celebrationVideoUrl || null,
          videoStart: p.videoStart ?? null,
          videoEnd: p.videoEnd ?? null,
        };
        setSalesToasts(prev => [toast, ...prev].slice(0, 5));
        setTimeout(() => setSalesToasts(prev => prev.filter(t => t.id !== toast.id)), 8000);
        audioManager.playForEvent('sale', p.amount);
        if (canvasRef.current) fireCelebration(canvasRef.current, 'goldenRain', branch);

        if (toast.celebrationVideoUrl) {
          setCelebrationQueue(q => [...q, { ...evt, payload: { ...p, _videoToast: toast } }]);
        }
        break;
      }

      case 'celebration_video': {
        const vid: PaidBatch = {
          id: evt.id,
          batchId: '',
          customer: p.customer || 'Test Klant B.V.',
          branch: p.branch || 'test',
          amount: p.amount || 2500,
          paidAt: new Date().toISOString(),
          amId: p.amId || null,
          amName: p.amName || 'Accountmanager',
          amAvatarUrl: p.amAvatarUrl || null,
          celebrationVideoUrl: p.celebrationVideoUrl || null,
          videoStart: p.videoStart ?? null,
          videoEnd: p.videoEnd ?? null,
        };
        setSalesToasts(prev => [vid, ...prev].slice(0, 5));
        setTimeout(() => setSalesToasts(prev => prev.filter(t => t.id !== vid.id)), 8000);
        audioManager.playForEvent('celebration_video');
        if (canvasRef.current) fireCelebration(canvasRef.current, 'goldenRain', branch);
        if (vid.celebrationVideoUrl) {
          setCelebrationVideo(vid);
        }
        break;
      }

      case 'confetti':
        audioManager.playForEvent('confetti');
        if (canvasRef.current) fireCelebration(canvasRef.current, 'confetti', branch);
        break;

      case 'batch_complete':
        setCelebratingBatch({ id: evt.id, customer: p.customer, branch: p.branch, batchSize: p.batchSize });
        audioManager.playForEvent('batch_complete');
        if (canvasRef.current) fireCelebration(canvasRef.current, 'megaBurst', branch);
        setTimeout(() => setCelebratingBatch(null), 5000);
        break;

      case 'target_hit':
        setTargetHitOverlay(evt);
        audioManager.playForEvent('target_hit');
        if (canvasRef.current) fireCelebration(canvasRef.current, 'megaBurst');
        setTimeout(() => setTargetHitOverlay(null), 8000);
        break;

      case 'milestone':
        setMilestoneToast(evt);
        audioManager.playForEvent('milestone');
        if (canvasRef.current) fireCelebration(canvasRef.current, 'confetti');
        setTimeout(() => setMilestoneToast(null), 5000);
        break;
    }

    // Mark persistent celebration events as displayed
    if (evt.source === 'db') {
      adminFetch('/api/admin/celebrations', {
        method: 'PATCH',
        body: JSON.stringify({ ids: [evt.id] }),
      }).catch(() => {});
    }
  }, []);

  // Process celebration video queue (sequential)
  useEffect(() => {
    if (celebrationVideo || celebrationQueue.length === 0) return;
    const next = celebrationQueue[0];
    setCelebrationQueue(q => q.slice(1));
    const p = next.payload || {};
    if (p._videoToast) {
      setCelebrationVideo(p._videoToast);
    }
  }, [celebrationVideo, celebrationQueue]);

  // Live-events via admin-API-polling. Realtime via de publieke anon-key is
  // bewust uitgezet: de RLS op celebration_events/live_test_events is
  // dichtgezet (service-role only) en de tabellen staan niet meer in de
  // realtime-publication. We pollen daarom de admin-geauthenticeerde routes.
  useEffect(() => {
    let mounted = true;
    const processed = new Set<string>();

    const pollCelebrations = async () => {
      try {
        const res = await adminFetch('/api/admin/celebrations');
        if (!res.ok || !mounted) return;
        const { events } = await res.json();
        if (!events || events.length === 0) return;
        events.forEach((evt: any, idx: number) => {
          if (processed.has(evt.id)) return;
          processed.add(evt.id);
          const ce: CelebrationEvent = { ...evt, source: 'db' };
          setTimeout(() => {
            if (mounted) processCelebration(ce);
          }, idx * 2000);
        });
      } catch { /* silent */ }
    };

    const pollTestEvents = async () => {
      try {
        const res = await adminFetch('/api/admin/test-events');
        if (!res.ok || !mounted) return;
        const { events } = await res.json();
        if (!events || events.length === 0) return;
        for (const evt of events) {
          if (processed.has(evt.id)) continue;
          processed.add(evt.id);
          processCelebration({ id: evt.id, event_type: evt.event_type, payload: evt.payload || {}, created_at: evt.created_at, source: 'test' });
        }
      } catch { /* silent */ }
    };

    void pollCelebrations();
    void pollTestEvents();
    const celebIv = setInterval(pollCelebrations, 8_000);
    const testIv = setInterval(pollTestEvents, 8_000);

    return () => {
      mounted = false;
      clearInterval(celebIv);
      clearInterval(testIv);
    };
  }, [processCelebration]);

  // Auto-close celebration video when YouTube reports playback ended
  useEffect(() => {
    if (!celebrationVideo?.celebrationVideoUrl) return;

    let closed = false;
    const close = () => { if (!closed) { closed = true; setTimeout(() => setCelebrationVideo(null), 2000); } };

    const handleMessage = (e: MessageEvent) => {
      if (!e.origin.includes('youtube.com')) return;
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data.event === 'onStateChange' && data.info === 0) close();
      } catch { /* not a YouTube message */ }
    };

    window.addEventListener('message', handleMessage);

    const sendListening = setInterval(() => {
      if (celebrationIframeRef.current?.contentWindow) {
        celebrationIframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'listening', id: 1 }),
          'https://www.youtube.com'
        );
      }
    }, 800);

    // Duration-based fallback: close 2s after the clip should have ended
    const start = celebrationVideo.videoStart || 0;
    const end = celebrationVideo.videoEnd;
    const durationMs = end ? (end - start) * 1000 : null;
    const durationTimer = durationMs
      ? setTimeout(close, durationMs + 2000)
      : null;

    // Safety fallback: close after 3 minutes max
    const safety = setTimeout(close, 180000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(sendListening);
      if (durationTimer) clearTimeout(durationTimer);
      clearTimeout(safety);
    };
  }, [celebrationVideo]);

  useEffect(() => { fetchData(); fetchAMTargets(); }, [fetchData, fetchAMTargets]);
  useEffect(() => {
    const mainIv = setInterval(() => { fetchData(); fetchAMTargets(); }, REFRESH_INTERVAL);
    return () => { clearInterval(mainIv); };
  }, [fetchData, fetchAMTargets]);
  useEffect(() => { const iv = setInterval(() => { setClock(new Date()); setRefreshIn(r => Math.max(0, r - 1)); }, 1000); return () => clearInterval(iv); }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setSlideInstelling({ duurSec: leesDuur(q.get('duur')), vast: leesVasteSlide(q.get('slide')) });
  }, []);

  const cm = data?.costMetrics;
  const slides = useMemo(
    () =>
      bouwSlides(
        {
          batches: data?.activeBatches.length ?? 0,
          heeftGeld: !!cm && (cm.monthAdSpend > 0 || cm.effectieveCpl > 0),
          heeftTeam: amTargets.length > 0 || (data?.amLeaderboard?.length ?? 0) > 0,
          heeftActie: !!data?.actie,
        },
        slideInstelling,
      ),
    [data?.activeBatches.length, cm, amTargets.length, data?.amLeaderboard?.length, data?.actie, slideInstelling],
  );
  const slideIndex = huidigeIndex(slides, slideKey);
  const slide = slides[slideIndex];
  const slideOnderwerpen = useMemo(() => onderwerpen(slides), [slides]);
  /* Tijdens een viering staat de slideshow even stil, daarna loopt hij verder. */
  const viering = !!(celebratingBatch || celebrationVideo || targetHitOverlay);
  const slideshowStil = gepauzeerd || viering || slides.length <= 1;

  const gaNaar = useCallback((i: number) => setSlideKey(slides[i]?.key ?? null), [slides]);
  const stapSlide = useCallback(
    (stap: 1 | -1) => setSlideKey(k => slides[stapIndex(huidigeIndex(slides, k), slides.length, stap)]?.key ?? null),
    [slides],
  );
  const volgendeSlide = useCallback(() => stapSlide(1), [stapSlide]);

  /* Pijltjes bladeren, spatie pauzeert. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight') stapSlide(1);
      else if (e.key === 'ArrowLeft') stapSlide(-1);
      else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setGepauzeerd(p => !p);
      } else return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stapSlide]);

  if (!data) {
    /* Blijft de eerste ophaling mislukken, dan zegt het scherm dat ook. Een
       spinner die eindeloos doordraait ziet er hetzelfde uit als een scherm
       dat gewoon traag is, en dat is precies het verschil dat je wilt zien. */
    const stuck = failedAttempts >= 2;
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0E1A] px-12">
        <div className="text-center">
          {stuck ? (
            <>
              <ExclamationTriangleIcon className="mx-auto mb-6 h-20 w-20 text-red-400" />
              <p className={`${TYPE.primary} font-black text-white`}>Geen verbinding</p>
              <p className={`${TYPE.label} mt-4 text-white/60`}>
                Het dashboard kan de cijfers niet ophalen. Nieuwe poging elke{' '}
                {REFRESH_INTERVAL / 1000} seconden.
              </p>
              <p className={`${TYPE.meta} mt-2 tabular-nums text-white/35`}>
                {failedAttempts} mislukte pogingen
              </p>
            </>
          ) : (
            <>
              <div
                className={`mx-auto mb-6 h-16 w-16 rounded-full border-[4px] border-white/10 border-t-brand-purple ${
                  reducedMotion ? '' : 'animate-spin'
                }`}
              />
              <p className={`${TYPE.label} text-white/60`}>Live dashboard laden</p>
            </>
          )}
        </div>
      </div>
    );
  }

  /* Leeftijd van de cijfers, voor de statusbalk bovenin. */
  const dataAgeMs = lastOkAt ? clock.getTime() - lastOkAt : null;
  const isStale = failedAttempts > 0 || (dataAgeMs !== null && dataAgeMs > STALE_AFTER_MS);

  const batchDelivered = data.activeBatches.reduce((s, b) => s + b.delivered, 0);
  const batchTotal = data.activeBatches.reduce((s, b) => s + b.batchSize, 0);
  const overallPct = batchTotal > 0 ? Math.round((batchDelivered / batchTotal) * 100) : 0;

  const phoneQuality = data.phoneQuality;
  const phoneColor = phoneQuality.validPct >= 90 ? 'text-emerald-400' : phoneQuality.validPct >= 70 ? 'text-amber-400' : 'text-red-400';
  const phoneRingPct = phoneQuality.validPct;

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-[#0B0E1A] text-white">
      <div
        style={{
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `scale(${stageScale})`,
          transformOrigin: 'center center',
        }}
        className="relative shrink-0"
      >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-[100]" />

      {/* Batch completion overlay - Cinematic */}
      <AnimatePresence>
        {celebratingBatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center"
          >
            {/* Multi-layer pulsing aurora */}
            <motion.div
              animate={reducedMotion ? undefined : { scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
              transition={reducedMotion ? undefined : { repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              className="absolute h-[700px] w-[700px] rounded-full bg-emerald-500/20 blur-[150px]"
            />
            <motion.div
              animate={reducedMotion ? undefined : { scale: [1.1, 0.9, 1.1], opacity: [0.15, 0.35, 0.15] }}
              transition={reducedMotion ? undefined : { repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              className="absolute h-[500px] w-[500px] rounded-full bg-teal-400/15 blur-[120px]"
            />
            <div className="relative flex flex-col items-center">
              <div className="relative mb-6 flex items-center justify-center" style={{ width: 140, height: 140 }}>
                {/* Triple expanding shockwave rings */}
                {[0, 0.15, 0.3].map((delay, ri) => (
                  <motion.div
                    key={ri}
                    initial={{ scale: 0, opacity: 0.7 }}
                    animate={{ scale: 3 + ri * 0.5, opacity: 0 }}
                    transition={{ duration: 1.8, ease: 'easeOut', delay }}
                    className="absolute rounded-full"
                    style={{ width: 140, height: 140, border: `${2 - ri * 0.5}px solid rgba(52,211,153,${0.6 - ri * 0.15})` }}
                  />
                ))}
                {/* Rotating particle ring */}
                <motion.div
                  animate={reducedMotion ? undefined : { rotate: 360 }}
                  transition={reducedMotion ? undefined : { repeat: Infinity, duration: 8, ease: 'linear' }}
                  className="absolute"
                  style={{ width: 200, height: 200 }}
                >
                  {Array.from({ length: 12 }).map((_, si) => (
                    <motion.div
                      key={si}
                      animate={reducedMotion ? undefined : { opacity: [0.3, 1, 0.3], scale: [0.5, 1.2, 0.5] }}
                      transition={reducedMotion ? undefined : { repeat: Infinity, duration: 1.5, delay: si * 0.12 }}
                      className="absolute h-2 w-2 rounded-full bg-emerald-400"
                      style={{
                        left: 100 + Math.cos((si / 12) * Math.PI * 2) * 90,
                        top: 100 + Math.sin((si / 12) * Math.PI * 2) * 90,
                        boxShadow: '0 0 10px rgba(52,211,153,0.6)',
                      }}
                    />
                  ))}
                </motion.div>
                {/* Icon with bounce */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: [0, 1.4, 1], rotate: 0 }}
                  transition={{ duration: 0.7, ease: [0.175, 0.885, 0.32, 1.275] }}
                  className="relative flex h-[110px] w-[110px] items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600"
                  style={{ boxShadow: '0 0 40px rgba(52,211,153,0.5), 0 0 80px rgba(52,211,153,0.2), 0 20px 60px rgba(52,211,153,0.3)' }}
                >
                  <svg className="h-16 w-16 text-white" viewBox="0 0 24 24" fill="none">
                    <motion.path
                      d="M5 13l4 4L19 7"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, delay: 0.5, ease: 'easeOut' }}
                    />
                  </svg>
                </motion.div>
              </div>
              <motion.h2
                initial={{ opacity: 0, y: 30, letterSpacing: '0.4em', scale: 0.8 }}
                animate={{ opacity: 1, y: 0, letterSpacing: '0.15em', scale: 1 }}
                transition={{ delay: 0.5, duration: 0.9, type: 'spring', damping: 15 }}
                className="text-5xl font-black text-emerald-400 lg:text-6xl"
                style={{ textShadow: '0 0 40px rgba(52,211,153,0.6), 0 0 80px rgba(52,211,153,0.3), 0 4px 20px rgba(0,0,0,0.5)' }}
              >
                BATCH VOLTOOID
              </motion.h2>
              {celebratingBatch.customer ? (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, type: 'spring' }} className="mt-4 flex flex-col items-center gap-2">
                  <p className="text-xl font-bold text-white/80">{celebratingBatch.customer}</p>
                  {celebratingBatch.branch && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 1.1, type: 'spring', damping: 12 }}
                      className={`rounded-full px-4 py-1.5 text-[22px] font-bold ${(BRANCH_COLORS[celebratingBatch.branch] || DEFAULT_BRANCH).badge}`}
                      style={{ boxShadow: `0 0 20px ${(BRANCH_COLORS[celebratingBatch.branch] || DEFAULT_BRANCH).fill}30` }}
                    >
                      {celebratingBatch.branch}
                    </motion.span>
                  )}
                  {celebratingBatch.batchSize && <p className="mt-1 text-[26px] text-white/40">{celebratingBatch.batchSize} leads succesvol uitgeleverd</p>}
                </motion.div>
              ) : (
                <motion.p initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="mt-4 text-[26px] font-medium text-white/50">
                  Alle leads zijn succesvol uitgeleverd
                </motion.p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sales Celebration Video Overlay - Cinema Mode */}
      <AnimatePresence>
        {celebrationVideo && celebrationVideo.celebrationVideoUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/90 backdrop-blur-lg"
            onClick={() => setCelebrationVideo(null)}
          >
            {/* Rotating spotlight rays */}
            <motion.div
              animate={reducedMotion ? undefined : { rotate: 360 }}
              transition={reducedMotion ? undefined : { repeat: Infinity, duration: 20, ease: 'linear' }}
              className="pointer-events-none absolute inset-0 opacity-[0.07]"
              style={{
                background: 'conic-gradient(from 0deg, transparent, rgba(251,191,36,0.4), transparent, rgba(251,191,36,0.4), transparent, rgba(251,191,36,0.4), transparent)',
              }}
            />
            {/* Center glow */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/10 blur-[200px]" />

            <motion.div
              initial={{ scale: 0.7, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.7, y: 40 }}
              transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              className="relative w-full max-w-6xl px-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="mb-4 text-center">
                <motion.h2
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', damping: 15 }}
                  className="text-4xl font-black uppercase tracking-wider text-amber-400 lg:text-5xl"
                  style={{ textShadow: '0 0 30px rgba(251,191,36,0.6), 0 0 60px rgba(251,191,36,0.3), 0 0 100px rgba(251,191,36,0.1)' }}
                >
                  Nieuwe verkoop!
                </motion.h2>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-2 flex flex-wrap items-center justify-center gap-3"
                >
                  <span className="text-[26px] font-bold text-white/80">{celebrationVideo.customer}</span>
                  {celebrationVideo.amName && (
                    <span className="rounded-full bg-amber-500/20 px-4 py-1 text-[22px] font-bold text-amber-300 shadow-lg shadow-amber-500/10">
                      {celebrationVideo.amName}
                    </span>
                  )}
                  {celebrationVideo.amount > 0 && (
                    <CountUpAmount value={celebrationVideo.amount} className="text-2xl font-black text-emerald-400" />
                  )}
                </motion.div>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="overflow-hidden rounded-2xl shadow-2xl shadow-amber-500/20"
                style={{
                  border: '3px solid rgba(251,191,36,0.4)',
                  boxShadow: '0 0 30px rgba(251,191,36,0.15), 0 25px 50px -12px rgba(0,0,0,0.5), inset 0 0 30px rgba(251,191,36,0.05)',
                }}
              >
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    ref={celebrationIframeRef}
                    src={`https://www.youtube.com/embed/${extractYouTubeId(celebrationVideo.celebrationVideoUrl!)}?autoplay=1&enablejsapi=1&start=${celebrationVideo.videoStart || 0}${celebrationVideo.videoEnd ? `&end=${celebrationVideo.videoEnd}` : ''}`}
                    className="absolute inset-0 h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </motion.div>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                onClick={() => setCelebrationVideo(null)}
                className="mx-auto mt-4 block rounded-full bg-white/10 px-8 py-2.5 text-[22px] font-bold text-white/50 transition hover:bg-white/20 hover:text-white"
              >
                Sluiten
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Target Hit Overlay */}
      <AnimatePresence>
        {targetHitOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : undefined}
            className="fixed inset-0 z-[92] flex items-center justify-center"
            onClick={() => setTargetHitOverlay(null)}
          >
            {/* Layered radial glow */}
            <motion.div
              animate={reducedMotion ? undefined : { scale: [1, 1.2, 1], opacity: [0.2, 0.55, 0.2] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              className="absolute h-[700px] w-[700px] rounded-full bg-amber-500/20 blur-[150px]"
            />
            <motion.div
              animate={reducedMotion ? undefined : { scale: [1.1, 0.85, 1.1], opacity: [0.1, 0.3, 0.1] }}
              transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
              className="absolute h-[400px] w-[400px] rounded-full bg-orange-400/15 blur-[100px]"
            />
            {/* Rotating light rays */}
            {!reducedMotion && (
              <motion.div
                animate={reducedMotion ? undefined : { rotate: 360 }}
                transition={reducedMotion ? undefined : { repeat: Infinity, duration: 15, ease: 'linear' }}
                className="pointer-events-none absolute opacity-[0.06]"
                style={{
                  width: 800, height: 800,
                  background: 'conic-gradient(from 0deg, transparent, rgba(251,191,36,0.5), transparent, rgba(251,191,36,0.5), transparent, rgba(251,191,36,0.5), transparent)',
                }}
              />
            )}
            <div className="relative flex flex-col items-center">
              <div className="relative mb-6 flex items-center justify-center" style={{ width: 140, height: 140 }}>
                {/* Trophy shockwave rings */}
                {!reducedMotion && [0, 0.2, 0.4].map((delay, ri) => (
                  <motion.div
                    key={ri}
                    initial={{ scale: 0, opacity: 0.8 }}
                    animate={{ scale: 3.5 + ri * 0.5, opacity: 0 }}
                    transition={{ duration: 2, ease: 'easeOut', delay }}
                    className="absolute rounded-full"
                    style={{ width: 140, height: 140, border: `${2 - ri * 0.5}px solid rgba(251,191,36,${0.6 - ri * 0.15})` }}
                  />
                ))}
                {/* Orbiting stars */}
                {!reducedMotion && (
                  <motion.div
                    animate={reducedMotion ? undefined : { rotate: -360 }}
                    transition={reducedMotion ? undefined : { repeat: Infinity, duration: 6, ease: 'linear' }}
                    className="absolute"
                    style={{ width: 220, height: 220 }}
                  >
                    {Array.from({ length: 8 }).map((_, si) => (
                      <motion.div
                        key={si}
                        animate={reducedMotion ? undefined : { opacity: [0.4, 1, 0.4], scale: [0.8, 1.4, 0.8] }}
                        transition={reducedMotion ? undefined : { repeat: Infinity, duration: 1.2, delay: si * 0.15 }}
                        className="absolute text-amber-300"
                        style={{
                          left: 110 + Math.cos((si / 8) * Math.PI * 2) * 100 - 6,
                          top: 110 + Math.sin((si / 8) * Math.PI * 2) * 100 - 6,
                          fontSize: 12,
                          filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.8))',
                        }}
                      >
                        ★
                      </motion.div>
                    ))}
                  </motion.div>
                )}
                <motion.div
                  initial={reducedMotion ? undefined : { scale: 0, rotate: -180 }}
                  animate={reducedMotion ? undefined : { scale: [0, 1.4, 1], rotate: 0 }}
                  transition={{ duration: 0.7, ease: [0.175, 0.885, 0.32, 1.275] }}
                  className="relative flex h-[110px] w-[110px] items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600"
                  style={{ boxShadow: '0 0 40px rgba(251,191,36,0.5), 0 0 80px rgba(251,191,36,0.25), 0 20px 60px rgba(251,191,36,0.3)' }}
                >
                  <svg className="h-16 w-16 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9H4.5a2.5 2.5 0 010-5C7 4 7 7 7 7M18 9h1.5a2.5 2.5 0 000-5C17 4 17 7 17 7" />
                    <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
                    <path d="M18 2H6v7a6 6 0 1012 0V2z" />
                  </svg>
                </motion.div>
              </div>
              <motion.h2
                initial={reducedMotion ? undefined : { opacity: 0, y: 30, letterSpacing: '0.4em', scale: 0.8 }}
                animate={{ opacity: 1, y: 0, letterSpacing: '0.15em', scale: 1 }}
                transition={{ delay: 0.5, duration: 0.9, type: 'spring', damping: 15 }}
                className="text-5xl font-black text-amber-400 lg:text-6xl"
                style={{ textShadow: '0 0 40px rgba(251,191,36,0.6), 0 0 80px rgba(251,191,36,0.3), 0 4px 20px rgba(0,0,0,0.5)' }}
              >
                TARGET GEHAALD!
              </motion.h2>
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, type: 'spring' }} className="mt-4 flex flex-col items-center gap-2">
                <p className="text-xl font-bold text-white/80">{targetHitOverlay.payload.amName}</p>
                <p className="text-[26px] text-white/50">{targetHitOverlay.payload.targetLabel}</p>
                <div className="mt-2 flex items-center gap-4">
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 1.1, type: 'spring', damping: 12 }}
                    className="rounded-full bg-amber-500/20 px-4 py-1.5 text-[22px] font-bold text-amber-300"
                    style={{ boxShadow: '0 0 15px rgba(251,191,36,0.2)' }}
                  >
                    {targetHitOverlay.payload.targetType}: {targetHitOverlay.payload.targetValue?.toLocaleString('nl-NL')}
                  </motion.span>
                  {targetHitOverlay.payload.bonusAmount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 1.3, type: 'spring', damping: 12 }}
                      className="rounded-full bg-emerald-500/20 px-4 py-1.5 text-[22px] font-bold text-emerald-300"
                      style={{ boxShadow: '0 0 15px rgba(52,211,153,0.2)' }}
                    >
                      +&euro;{targetHitOverlay.payload.bonusAmount.toLocaleString('nl-NL')} bonus
                    </motion.span>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Milestone Toast */}
      <AnimatePresence>
        {milestoneToast && (
          <motion.div
            initial={{ opacity: 0, y: -60, scale: 0.7 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -60, scale: 0.7 }}
            transition={reducedMotion ? { duration: 0 } : { type: 'spring', damping: 14, stiffness: 200 }}
            className="fixed left-1/2 top-6 z-[88] -translate-x-1/2"
          >
            <div className="relative flex items-center gap-4 rounded-2xl bg-[#1a1d2e]/95 px-7 py-5 backdrop-blur-xl"
              style={{ border: '2px solid rgba(168,85,247,0.5)', boxShadow: '0 0 40px rgba(168,85,247,0.25), 0 0 80px rgba(168,85,247,0.1), 0 20px 40px -10px rgba(0,0,0,0.5)' }}
            >
              {!reducedMotion && (
                <motion.div
                  animate={reducedMotion ? undefined : { boxShadow: ['0 0 15px rgba(168,85,247,0.15)', '0 0 35px rgba(168,85,247,0.35)', '0 0 15px rgba(168,85,247,0.15)'] }}
                  transition={reducedMotion ? undefined : { repeat: Infinity, duration: 1.5 }}
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                />
              )}
              <motion.span
                className="text-3xl"
                animate={reducedMotion ? undefined : { scale: [1, 1.3, 1], rotate: [0, -15, 15, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              >
                🏆
              </motion.span>
              <div>
                <p className="text-[26px] font-black text-brand-purple" style={{ textShadow: '0 0 20px rgba(168,85,247,0.4)' }}>
                  {milestoneToast.payload.milestoneText || 'Milestone!'}
                </p>
                {milestoneToast.payload.count && (
                  <p className="text-[22px] text-white/50">{milestoneToast.payload.count} verkopen vandaag</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sales Bell Toast Notifications - Premium */}
      <div className="fixed right-4 top-4 z-[85] flex flex-col gap-3 sm:right-6 sm:top-6">
        <AnimatePresence>
          {salesToasts.map((toast) => {
            const bc = BRANCH_COLORS[toast.branch] || DEFAULT_BRANCH;
            const borderColor = bc.fill || 'rgba(251,191,36,0.35)';
            return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 140, scale: 0.8, rotateY: -15 }}
              animate={{ opacity: 1, x: 0, scale: reducedMotion ? 1 : [0.8, 1.05, 1], rotateY: 0 }}
              exit={{ opacity: 0, x: 140, scale: 0.8 }}
              transition={reducedMotion ? { duration: 0.15 } : { type: 'spring', damping: 16, stiffness: 220 }}
              className="relative w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl bg-[#1a1d2e]/95 px-5 py-4 backdrop-blur-xl sm:w-auto sm:min-w-[340px]"
              style={{
                border: `2px solid ${borderColor}50`,
                boxShadow: `0 0 25px ${borderColor}30, 0 20px 40px -10px rgba(0,0,0,0.5)`,
              }}
            >
              {!reducedMotion && (
              <>
                <motion.div
                  animate={reducedMotion ? undefined : {
                    boxShadow: [
                      `0 0 10px ${borderColor}15, inset 0 0 10px ${borderColor}00`,
                      `0 0 30px ${borderColor}40, inset 0 0 20px ${borderColor}0a`,
                      `0 0 10px ${borderColor}15, inset 0 0 10px ${borderColor}00`,
                    ],
                  }}
                  transition={reducedMotion ? undefined : { repeat: Infinity, duration: 1.8 }}
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                />
                {/* Shine sweep */}
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '200%' }}
                  transition={{ duration: 1.2, delay: 0.3, ease: 'easeInOut' }}
                  className="pointer-events-none absolute inset-y-0 w-[60px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${borderColor}20, transparent)` }}
                />
              </>
              )}
              <div className="flex items-center gap-4">
                {toast.amAvatarUrl ? (
                  <motion.div
                    initial={reducedMotion ? undefined : { scale: 0, rotate: -90 }}
                    animate={reducedMotion ? undefined : { scale: 1, rotate: 0 }}
                    transition={{ delay: 0.2, type: 'spring', damping: 12 }}
                    className="relative shrink-0"
                  >
                    <Image src={toast.amAvatarUrl} alt={toast.amName || ''} width={48} height={48} className="h-12 w-12 rounded-full object-cover shadow-lg" style={{ boxShadow: `0 0 15px ${borderColor}40` }} />
                    <motion.div
                      animate={reducedMotion ? undefined : { scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                      transition={reducedMotion ? undefined : { repeat: Infinity, duration: 2 }}
                      className="absolute inset-0 rounded-full"
                      style={{ border: `2px solid ${borderColor}60` }}
                    />
                  </motion.div>
                ) : (
                <motion.div
                  initial={reducedMotion ? undefined : { scale: 0, rotate: -90 }}
                  animate={reducedMotion ? undefined : { scale: 1, rotate: [0, -10, 10, -5, 5, 0] }}
                  transition={{ duration: 0.7, delay: 0.2, type: 'spring' }}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600"
                  style={{ boxShadow: `0 0 20px ${borderColor}40` }}
                >
                  {toast.amName ? (
                    <span className="text-[26px] font-black text-white">{toast.amName.charAt(0).toUpperCase()}</span>
                  ) : (
                  <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 003.4 0" />
                  </svg>
                  )}
                </motion.div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <motion.p
                      animate={reducedMotion ? undefined : { scale: [1, 1.08, 1] }}
                      transition={{ repeat: 2, duration: 0.4, delay: 0.4 }}
                      className="text-[26px] font-black tracking-wide text-amber-400"
                      style={{ textShadow: `0 0 12px ${borderColor}60` }}
                    >
                      Ka-Ching!
                    </motion.p>
                    <span className={`rounded-full px-2 py-0.5 text-[18px] font-bold ${bc.badge}`}>{toast.branch}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[22px] font-medium text-white/70">{toast.customer}</p>
                  {toast.amName && <p className="text-[22px] text-white/40">door {toast.amName}</p>}
                </div>
                {toast.amount > 0 && (
                  <motion.div
                    initial={reducedMotion ? undefined : { scale: 0 }}
                    animate={reducedMotion ? undefined : { scale: [0, 1.2, 1] }}
                    transition={{ delay: 0.3, type: 'spring', damping: 12 }}
                  >
                    <CountUpAmount value={toast.amount} className="text-xl font-black text-emerald-400" style={{ textShadow: '0 0 15px rgba(52,211,153,0.4)' }} />
                  </motion.div>
                )}
              </div>
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 8, ease: 'linear' }}
                className="absolute bottom-0 left-0 right-0 h-[3px] origin-left"
                style={{ background: `linear-gradient(to right, ${borderColor}, ${borderColor}80)` }}
              />
            </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Zacht duurzaamheidstafereel achter de slide in beeld. */}
      <DuurzaamDecor id={slide.id} reducedMotion={reducedMotion} />

      <div className="relative z-10 flex h-full flex-col overflow-hidden p-5">
        {/* Bovenbalk: blijft staan terwijl de slides wisselen */}
        <div className="mb-4 flex h-[64px] shrink-0 items-center justify-between">
          <Link href="/admin" className="group flex items-center gap-3">
            <Image src="/logo-wit.png" alt="WarmeLeads" width={140} height={42} className="h-9 w-auto opacity-80 transition group-hover:opacity-100" />
            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[18px] font-bold uppercase tracking-widest text-white/30">Live</span>
          </Link>
          <div className="flex items-center gap-5">
            {/* Telefoonkwaliteit: de ring is de indicator, het getal staat ernaast. */}
            <div className="flex items-center gap-2.5">
              <svg className="h-10 w-10 shrink-0 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke={phoneQuality.validPct >= 90 ? '#34d399' : phoneQuality.validPct >= 70 ? '#fbbf24' : '#f87171'}
                  strokeWidth="4"
                  strokeDasharray={`${(phoneRingPct / 100) * 88} 88`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="leading-tight">
                <p className="text-[18px] font-bold uppercase tracking-wider text-white/30">Tel. kwaliteit</p>
                <p className={`text-[22px] font-black tabular-nums ${phoneColor}`}>
                  {phoneQuality.validPct}%
                  <span className="ml-2 text-[18px] font-semibold text-white/35">
                    {phoneQuality.invalid > 0 ? `${phoneQuality.invalid} verdacht` : 'alles geldig'}
                  </span>
                </p>
              </div>
            </div>

            <div className="h-6 w-px bg-white/[0.06]" />

            {/* Geluid aan/uit */}
            <button
              onClick={() => {
                const next = audioManager.toggle();
                setSoundEnabled(next);
                if (next) audioManager.ensureContext();
              }}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.06] text-white/40 transition hover:bg-white/[0.1] hover:text-white/70"
              title={soundEnabled ? 'Geluid uit' : 'Geluid aan'}
            >
              {soundEnabled ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 010 7.07" />
                  <path d="M19.07 4.93a10 10 0 010 14.14" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              )}
            </button>

            {/* Verbindingsstatus: leesbaar vanaf de andere kant van de ruimte */}
            <div className="flex items-center gap-3">
              {isStale ? (
                <div className="flex items-center gap-3 rounded-2xl bg-red-500/15 px-5 py-2.5 ring-2 ring-red-500/40">
                  <SignalSlashIcon className="h-8 w-8 shrink-0 text-red-400" />
                  <div className="leading-tight">
                    <p className={`${TYPE.label} font-bold text-red-300`}>Cijfers niet vers</p>
                    <p className={`${TYPE.meta} tabular-nums text-red-300/70`}>
                      {dataAgeMs !== null ? `${Math.round(dataAgeMs / 60000)} min oud` : 'verbinding kwijt'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span
                    className={`h-3.5 w-3.5 shrink-0 rounded-full bg-emerald-400 ${
                      reducedMotion ? '' : 'animate-pulse'
                    }`}
                  />
                  <p className={`${TYPE.meta} tabular-nums text-white/45`}>
                    live · {refreshIn}s
                  </p>
                </div>
              )}
            </div>

            {/* Klok */}
            <div className="text-right">
              <p className="text-[26px] font-bold tabular-nums text-white/80">
                {clock.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
              <p className="text-[18px] text-white/25">
                {clock.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* De slide in beeld. Eén onderwerp tegelijk op het volle scherm. */}
        <div className="relative min-h-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={slide.key}
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reducedMotion ? { opacity: 1 } : { opacity: 0, x: -60 }}
              transition={{ duration: reducedMotion ? 0 : 0.45, ease: [0.25, 0.4, 0.25, 1] }}
              className="absolute inset-0"
            >
              {slide.id === 'vandaag' && <SlideVandaag data={data} />}
              {slide.id === 'batches' && (
                <SlideBatches
                  batches={paginaVan(data.activeBatches, slide.pagina)}
                  pagina={slide.pagina}
                  paginas={slide.paginas}
                  aantalActief={data.activeBatches.length}
                  aantalVoltooid={data.completedBatchCount}
                  geleverd={batchDelivered}
                  totaal={batchTotal}
                  totaalPct={overallPct}
                  celebratingId={celebratingBatch?.id ?? null}
                />
              )}
              {slide.id === 'geld' && data.costMetrics && <SlideGeld data={data} costMetrics={data.costMetrics} />}
              {slide.id === 'team' && <SlideTeam targets={amTargets} leaderboard={data.amLeaderboard ?? []} />}
              {slide.id === 'actie' && data.actie && <SlideActie actie={data.actie} nu={clock} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Voortgang onderaan: alle onderwerpen, het huidige loopt vol tot de volgende */}
        <div className="mt-4 flex h-[64px] shrink-0 items-center gap-4">
          <div className="flex min-w-0 flex-1 gap-3">
            {slideOnderwerpen.map(o => {
              const actief = o.id === slide.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => gaNaar(o.eersteIndex)}
                  className={`min-w-0 flex-1 rounded-xl px-4 py-2 text-left transition ${
                    actief ? 'bg-white/[0.07]' : 'bg-white/[0.02] hover:bg-white/[0.05]'
                  }`}
                >
                  <p className={`${TYPE.label} truncate font-bold ${actief ? 'text-white/90' : 'text-white/35'}`}>
                    {o.titel}
                    {actief && o.paginas > 1 && (
                      <span className="ml-2 font-semibold tabular-nums text-white/45">
                        {slide.pagina}/{o.paginas}
                      </span>
                    )}
                  </p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                    {actief && (
                      <SlideVoortgang key={slide.key} duurMs={slide.duurMs} stil={slideshowStil} onKlaar={volgendeSlide} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {(gepauzeerd || viering) && slides.length > 1 && (
            <p className={`${TYPE.meta} shrink-0 font-semibold text-amber-300/80`}>
              {gepauzeerd ? 'Gepauzeerd · spatie om verder te gaan' : 'Even stil tijdens de viering'}
            </p>
          )}
        </div>
      </div>
      </div>{/* end vaste ontwerpmaat */}
    </div>
  );
}
