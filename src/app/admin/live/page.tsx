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
interface CostMetrics { monthAdSpend: number; brutoCpl: number; effectieveCpl: number; avgAssignments: number; totalProfit: number; }
interface PaidBatch { id: string; batchId: string; customer: string; branch: string; amount: number; paidAt: string; amId: string | null; amName: string | null; celebrationVideoUrl: string | null; }
interface AMLeaderboardEntry { id: string; name: string; revenue: number; batches: number; celebrationVideoUrl: string | null; }

interface LiveData {
  totalLeads: number;
  activeCustomers: number;
  totalCustomers: number;
  activeBatches: BatchInfo[];
  completedBatchCount: number;
  totalRevenue: number;
  recentLeads: RecentLead[];
  periodStats: Record<string, PeriodStat>;
  provinceBreakdown: Record<string, number>;
  branchBreakdown: Record<string, number>;
  phoneQuality: { total: number; invalid: number; validPct: number };
  costMetrics?: CostMetrics;
  recentPaidBatches?: PaidBatch[];
  amLeaderboard?: AMLeaderboardEntry[];
  timestamp: string;
}

// ─── Province SVG paths (from real CBS/Simplemaps geographic data) ────
// Dutch provinces: derived from simplemaps.com SVG, scaled to viewBox
const NL_PROVINCES: Record<string, { d: string; cx: number; cy: number }> = {
  'Groningen': {
    d: 'M194.7,57.8 L188,47.3 L178.1,38.3 L173,39 L168.1,32.8 L162.3,33.8 L158.2,40.2 L150.5,37.1 L156.1,24.4 L150.8,20.4 L151.1,17 L177.9,13.5 L183.8,14.6 L186.3,21.3 L200.7,29 L200.2,48.9 L194.7,57.8 Z',
    cx: 177.6, cy: 25.8,
  },
  'Friesland': {
    d: 'M151.1,17 L150.8,20.4 L156.1,24.4 L150.5,37.1 L159.4,41.9 L163.3,48.7 L161.7,51.3 L155,51.8 L143.5,59.2 L139.9,57.8 L131.4,60.5 L126.2,58.1 L120.2,61.3 L111,61.5 L101.6,45.9 L111.4,39.5 L114.7,30.7 L121.8,24.8 L136.6,19 L151.1,17 Z',
    cx: 133.1, cy: 40.2,
  },
  'Drenthe': {
    d: 'M157.2,39.9 L165,31.9 L168.1,32.8 L173,39 L178.1,38.3 L188,47.3 L194.7,57.8 L192.1,73.1 L177.3,73 L172,69.8 L167.6,74.1 L161,73.6 L157.9,70.1 L151,69.2 L148.4,64.4 L152.1,61 L148.3,56.9 L163.3,48.7 L157.2,39.9 Z',
    cx: 174.2, cy: 54.6,
  },
  'Overijssel': {
    d: 'M177.3,73 L176.1,83.7 L186.2,86.8 L189.8,85.4 L193.5,91.5 L192.4,100.9 L182.8,109.1 L166.3,104.6 L162.2,99.9 L149.5,101.2 L145.3,94.5 L148.6,88.7 L146.6,84.2 L143.4,81.2 L138.6,83.3 L133.7,75.9 L142.9,72.2 L131.4,60.5 L148.3,56.9 L152.1,61 L148.4,64.4 L151,69.2 L157.9,70.1 L161,73.6 L167.6,74.1 L172,69.8 L177.3,73 Z',
    cx: 162.8, cy: 87,
  },
  'Flevoland': {
    d: 'M131.4,60.5 L142.9,72.2 L134.2,74.6 L132.8,86.1 L122.3,92 L118.9,97.7 L113.7,98.6 L97.9,91.6 L102.3,87 L97.4,76.2 L107.9,67.9 L110.4,68.6 L110.9,61.4 L120.2,61.3 L126.2,58.1 L131.4,60.5 Z',
    cx: 120.3, cy: 76.2,
  },
  'Gelderland': {
    d: 'M135.4,80.4 L139,83.4 L143.4,81.2 L146.6,84.2 L148.6,88.7 L145.3,94.5 L149.1,100.9 L162.2,99.9 L166.3,104.6 L174.8,105.5 L174.5,108.1 L179.9,109.4 L175.1,114.6 L181.9,118.9 L177.2,124 L160.6,126.8 L158.9,129.5 L148.2,124.2 L149.6,128 L138.6,129.9 L139.1,134.7 L117.4,128.5 L111.5,130.1 L108.4,134.6 L99.4,135.5 L92.9,127.4 L98.7,125.6 L104.5,118.6 L115.5,117.9 L123,120.6 L119.9,109.7 L115.8,111.3 L118,107.5 L113.6,104.8 L112.8,98.3 L118.9,97.7 L122.3,92 L132.8,86.1 L135.4,80.4 Z',
    cx: 135.8, cy: 109.5,
  },
  'Utrecht': {
    d: 'M112.9,98.3 L113.6,104.8 L118,107.5 L115.8,111.3 L119.9,109.7 L123,120.6 L115.5,117.9 L101.2,119.3 L97.9,116.8 L87.2,121.1 L82.9,115.4 L86.7,112 L82.4,108.7 L86,105.3 L81.3,101.5 L96,97.5 L94.9,105.3 L102.7,103.9 L105.9,97.6 L112.9,98.3 Z',
    cx: 107, cy: 110.1,
  },
  'Noord-Holland': {
    d: 'M81.3,101.5 L70.5,101.6 L73.5,95.1 L68.1,94.2 L79.6,49.4 L83.7,48.8 L84.5,52.8 L88.4,53.2 L101.6,45.9 L110.9,61.4 L110.4,68.6 L107.9,67.9 L97.4,76.2 L102.3,87 L97.9,91.6 L110.8,97.2 L105.7,97.7 L101.7,104.5 L94.9,105.3 L96,97.5 L81.3,101.5 Z',
    cx: 85.7, cy: 79.3,
  },
  'Zuid-Holland': {
    d: 'M101.7,119.3 L93.2,129.2 L82.4,130.7 L76.8,136.5 L63.3,137.3 L53.2,142.2 L49,141.5 L52.2,138.9 L47,136.7 L44,131.1 L37.2,131.8 L36.7,129.8 L47.3,127.9 L44.3,117.9 L50.5,116.6 L68.5,93.5 L73.5,95.1 L70.5,101.6 L78.5,100.6 L86,105.3 L82.4,108.7 L86.7,112 L82.9,115.4 L87.2,121.1 L97.9,116.8 L101.7,119.3 Z',
    cx: 68.4, cy: 120.5,
  },
  'Zeeland': {
    d: 'M57.3,160.7 L55,157.3 L49,158.1 L41.4,154.7 L35,159.2 L28.2,154.9 L20.6,154.5 L16.3,148.5 L21.9,145.2 L36.2,144.1 L37.2,148.3 L44.3,149.6 L48.7,155.4 L56.5,155.5 L57.3,160.7 Z',
    cx: 32.1, cy: 150.8,
  },
  'Noord-Brabant': {
    d: 'M93.2,129.2 L99.4,135.5 L108.4,134.6 L111.5,130.1 L117.4,128.5 L140,137 L144.4,147.1 L133.9,147.1 L138.7,159.6 L126,164.3 L122.7,170.5 L119.8,171.2 L117,166.4 L103.3,168.3 L96.1,160.3 L94.1,153.3 L88.3,159.1 L81,157.7 L84,157.6 L81.8,152 L74.5,157.3 L70.1,157.2 L67.3,153.5 L62.1,155.6 L63.8,161.6 L57.3,160.7 L58.1,153.7 L53.2,142.2 L63.3,137.3 L76.8,136.5 L82.4,130.7 L93.2,129.2 Z',
    cx: 109.7, cy: 151.1,
  },
  'Limburg': {
    d: 'M139.3,134.7 L146.8,141.7 L152.1,154.6 L151.5,162.4 L144.7,171.5 L144.9,174.3 L148.5,173.4 L149.2,175.6 L138.9,183.9 L134.7,183.1 L135.8,188.4 L142.1,187.8 L145.1,192.3 L140.4,200 L141.7,203 L126.6,202.3 L123.3,196 L130.3,188.8 L134.1,176.5 L119.8,171.2 L126,164.3 L138.7,159.6 L133.9,147.1 L144.4,147.1 L140,137 L135.2,133.8 L139.3,134.7 Z',
    cx: 138.3, cy: 169.9,
  },
};

// Belgian provinces: derived from official GeoJSON data (WGS84), projected & simplified
const BE_PROVINCES: Record<string, { d: string; cx: number; cy: number }> = {
  'Brussel': {
    d: 'M90.8,283 L94.3,285.8 L99,283.3 L95.3,273.3 L89.9,275.3 L87.5,281.2 L90.8,283 Z',
    cx: 92.5, cy: 280.7,
  },
  'Antwerpen': {
    d: 'M136.2,244.2 L136.4,240.5 L131.1,239.6 L128,233.1 L129.6,229.9 L126.1,225.2 L120.6,233.1 L118.8,231.2 L113.3,231.3 L113.2,230 L116.1,230.6 L116.7,226 L113.4,223.8 L106.9,230.7 L101.7,230.6 L102.4,226.4 L98.8,226 L94.4,228.4 L96.2,235.5 L86.2,234.7 L91.1,241.9 L89.8,244.3 L91.7,253 L91.1,255.3 L85.9,255.9 L84,257.9 L84.7,262.1 L93.8,263.7 L94.8,266 L99,266.8 L99.6,265.3 L104.3,266.6 L114.2,262.8 L115.2,265.1 L123.6,263.1 L125,259.9 L137.4,253.6 L135,247.6 L136.2,244.2 Z',
    cx: 109.8, cy: 244.3,
  },
  'Vlaams-Brabant': {
    d: 'M129.6,290.4 L129.7,284.5 L133.7,274.2 L127.1,272.7 L130.1,264.4 L132.3,264 L128.7,261.9 L127.4,264.8 L122.9,262.2 L115.2,265.1 L114.2,262.8 L104.3,266.6 L99.6,265.3 L99,266.8 L94.8,266 L93.8,263.7 L87.3,263 L86.5,266.6 L83.1,267.2 L83.5,271.7 L79.9,272.2 L78.2,283.8 L72.6,285.1 L73.1,288.5 L70.4,288.4 L70.1,290.1 L71.2,291.9 L75.1,292.2 L83.2,288.7 L89.7,291.7 L91.8,288.3 L93.8,289.8 L98.2,286.6 L101.2,288.9 L104.3,286 L107,287.3 L107.2,283.6 L112.7,282.2 L119.9,287 L124.7,285.6 L127.7,290.3 L129.6,290.4 Z',
    cx: 102.5, cy: 278.2,
  },
  'Brabant wallon': {
    d: 'M125.5,286.9 L123.6,285.3 L121.5,287.2 L119.6,285.4 L116.6,285.9 L112.1,282.2 L107.2,283.6 L107,287.3 L104.3,286 L101.2,288.9 L98.2,286.6 L93.8,289.8 L91.8,288.3 L89.7,291.7 L83.2,288.7 L80.1,290.9 L80.2,295.2 L82,297.1 L84.2,294.2 L92.1,304.2 L93,302.7 L98.5,303 L98.2,305.1 L100.6,305.8 L105,302.1 L108,302.5 L108.5,298.9 L111.5,298.6 L112.2,300.4 L123.7,296 L125.5,286.9 Z',
    cx: 103.2, cy: 293.1,
  },
  'West-Vlaanderen': {
    d: 'M49,285.7 L52.1,282.3 L48.8,277.5 L49.8,274.8 L46.9,274 L48.9,271.3 L46.8,269.5 L48.3,268.8 L48.4,262.1 L42.7,257.8 L46.4,252.7 L44.4,249.6 L46.1,246.2 L44.3,234.8 L39,236.9 L35.6,235.7 L33.9,238.7 L4,258.2 L8.4,270.8 L6.4,272.8 L6.9,278.4 L8.6,281.7 L13.1,282 L17.2,289.7 L19.8,290.5 L18.8,286.9 L22.7,286.4 L26.5,281.9 L27.4,285 L33.8,283.6 L35.2,286.5 L41.5,286.6 L44.2,290.4 L49,285.7 Z',
    cx: 34, cy: 271,
  },
  'Oost-Vlaanderen': {
    d: 'M87.4,236.4 L78.6,245.3 L69.9,249.3 L70.1,247.4 L65.3,248.1 L65.5,244.6 L55.5,240.6 L51.8,242 L52.4,245.4 L48.5,245.8 L45.2,243.1 L46.1,246.2 L44.4,249.6 L46.4,252.7 L42.7,257.8 L48.4,262.1 L48.3,268.8 L46.8,269.5 L48.9,271.3 L46.9,274 L49.8,274.8 L48.8,277.5 L52.1,282.3 L49,285.7 L52.6,285.7 L53,288.3 L57.9,289.3 L59.9,285.1 L62.9,284.9 L64.5,287.1 L70,287.1 L71.5,288.8 L73.1,288.5 L73.4,284.5 L74.8,285.6 L78.2,283.8 L79.9,272.2 L82.3,272.8 L83.1,267.2 L87,265.8 L87.3,263 L84.7,262.1 L84,257.9 L91.4,254.8 L89.8,244.3 L91.1,241.9 L87.4,236.4 Z',
    cx: 64.9, cy: 264.6,
  },
  'Henegouwen': {
    d: 'M35.2,286.5 L35.9,289.1 L39.3,291 L38.3,294.6 L40.6,305.7 L45,308.7 L49.7,305.1 L51.9,305.8 L51,309 L56.3,308.1 L59,311.6 L59.1,320.7 L61.3,324.4 L63.1,320.4 L67.6,320.1 L70,322.3 L76.4,319.9 L81.5,324.8 L82.2,328.3 L83.5,325.6 L85.9,327.2 L82.9,332 L82,338.7 L85.1,338.5 L86.8,343.6 L82.2,348 L82.6,351.8 L96.7,354.6 L93.2,335.5 L95,334.2 L95.1,330.3 L92.4,330.7 L89.5,328.4 L99.2,322.2 L104.6,322.4 L103.8,304.4 L100.6,305.8 L95.7,302.5 L92.1,304.2 L84.2,294.2 L82,297.1 L80.5,296.3 L79.7,290.2 L71.2,291.9 L70,287.1 L64.5,287.1 L62.9,284.9 L59.9,285.1 L57.9,289.3 L53,288.3 L52.6,285.7 L49,285.7 L44.2,290.4 L41.5,286.6 L35.2,286.5 Z',
    cx: 70.6, cy: 311,
  },
  'Luik': {
    d: 'M143.8,318 L145.2,313.7 L147.5,315.5 L149.6,314.2 L150.9,317 L153.6,316.4 L157.3,319.9 L159.1,319.5 L159.5,323.8 L161.1,324.5 L160,327.9 L167.2,327.3 L166.9,320.8 L172.4,322.4 L174.2,323.8 L175.1,336.1 L178.5,335.5 L179.9,338.9 L180.7,334.9 L182.7,334.8 L182.2,330 L187,327.5 L189.1,323.1 L191.9,323.5 L193.5,321.7 L190.3,317.9 L191.7,311.6 L189.8,308.6 L184.8,308.1 L183.2,305.4 L186.6,296.1 L182.6,296.1 L183.1,294.3 L179.1,289.3 L175.5,289.6 L174.2,286.5 L168.2,286.5 L167.8,290.3 L164.3,289.9 L163,287.3 L158.2,286.8 L158.2,281.8 L145.1,289.6 L143.6,287.1 L137,289.9 L132.9,289.5 L132.6,291.5 L127.7,290.3 L125.5,286.9 L124.2,289 L125.3,291 L123.6,298.1 L126.9,302.8 L126.3,305.3 L131.5,306.9 L132.2,310.2 L134.5,310.1 L135.4,314.8 L138.6,316.7 L139.1,319.2 L143.8,318 Z',
    cx: 159.6, cy: 308.9,
  },
  'Limburg': {
    d: 'M158.2,281.8 L156,279.6 L156.4,276.5 L161.6,270.2 L159.8,269.2 L166.4,253.9 L152,247.4 L149.8,241.3 L145,244.1 L136.2,244.2 L135,247.6 L137.4,253.6 L125,259.9 L123.6,263.1 L127.4,264.8 L128.7,261.9 L130.4,262 L132.3,264 L130.1,264.4 L130.6,266.2 L126.5,270.9 L129,273.7 L131.1,272.7 L133.7,274.2 L129.7,284.5 L129.6,290.4 L132.6,291.5 L132.9,289.5 L137,289.9 L143.6,287.1 L145.1,289.6 L148.6,288.8 L158.2,281.8 Z',
    cx: 140, cy: 269.7,
  },
  'Luxemburg': {
    d: 'M123,366.4 L129.2,369.8 L132.7,375.5 L138.3,375.8 L140.8,378.8 L139.8,382.3 L141.5,380.6 L144,381.9 L146.9,386 L147.7,391.9 L151.8,389.2 L154.4,391.1 L157.1,387.2 L160.7,388.4 L162.4,386.3 L165.8,387.1 L168.7,377.9 L166.9,376.9 L167.4,373.1 L165,372.9 L163,366.8 L161.5,367.2 L160.8,363.3 L162.9,359.9 L160.6,358.4 L162.5,353 L165.6,351.2 L164.6,348.7 L166.6,347.3 L168.4,340.4 L171.6,338.8 L171.7,335.4 L174.7,334.5 L174.2,323.8 L166.9,320.8 L167.2,327.3 L160,327.9 L159.9,320 L157.3,319.9 L153.6,316.4 L150.9,317 L149.6,314.2 L147.5,315.5 L144.4,314.1 L145.4,316.3 L143.6,321.8 L141.3,323.3 L143.8,323.8 L143.9,325.5 L134.7,331.7 L138.4,336.8 L136.4,338.5 L137.7,340.4 L127.4,341.1 L126.5,345.3 L124.3,346.1 L124.8,351.2 L127.5,351.1 L130,356.5 L124,362.1 L123,366.4 Z',
    cx: 150.2, cy: 352.1,
  },
  'Namen': {
    d: 'M96.7,354.6 L109.1,350 L109.9,341.8 L115.9,336.3 L118.4,336.9 L119.5,338.2 L115.7,344.2 L116.7,346.6 L114.2,353 L119.1,357.3 L117.5,367.2 L121.1,367.6 L126.8,358.4 L130,356.5 L127.5,351.1 L124.8,351.2 L124.3,346.1 L126.5,345.3 L127.4,341.1 L137.7,340.4 L136.4,338.5 L138.4,336.8 L134.7,331.7 L143.9,325.5 L143.8,323.8 L141.3,323.3 L144.2,318.5 L141.7,317.3 L139.1,319.2 L138.6,316.7 L136.1,316 L134.5,310.1 L132.2,310.2 L131.5,306.9 L126.3,305.3 L126.9,302.8 L122.8,295.5 L112.2,300.4 L111.5,298.6 L108.5,298.9 L108,302.5 L103.7,302.8 L104.6,322.4 L99.2,322.2 L89.5,328.4 L92.4,330.7 L95.1,330.3 L95,334.2 L93.2,335.5 L96.7,354.6 Z',
    cx: 120.4, cy: 330.9,
  },
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

function playSalesBell() {
  try {
    const ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const bellNotes = [1046.5, 1318.5, 1568, 2093];
    bellNotes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ac.currentTime + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.25, ac.currentTime + i * 0.15 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.15 + 0.6);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(ac.currentTime + i * 0.15);
      osc.stop(ac.currentTime + i * 0.15 + 0.7);
    });
  } catch { /* browser might block audio */ }
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
  const [hovered, setHovered] = useState<{ label: string; key: string } | null>(null);

  function dataKey(name: string, country: 'NL' | 'BE'): string {
    if (name === 'Limburg') return country === 'BE' ? 'Limburg (BE)' : 'Limburg';
    return name;
  }

  function opacity(key: string): number {
    const count = data[key] || 0;
    if (count === 0) return 0.08;
    return 0.15 + (count / maxCount) * 0.85;
  }

  return (
    <div className="relative h-full">
      <svg viewBox="-2 -2 210 410" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        {Object.entries(NL_PROVINCES).map(([name, p]) => {
          const key = dataKey(name, 'NL');
          return (
          <g key={name} onMouseEnter={() => setHovered({ label: name, key })} onMouseLeave={() => setHovered(null)}>
            <path
              d={p.d}
              fill={`rgba(139, 92, 246, ${opacity(key)})`}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="0.6"
              strokeLinejoin="round"
              className="transition-all duration-300 hover:brightness-150"
            />
            {(data[key] || 0) > 0 && (
              <circle cx={p.cx} cy={p.cy} r={Math.max(2, Math.min(5, (data[key] / maxCount) * 5))}
                fill="#a855f7" opacity="0.8" className="animate-pulse" />
            )}
          </g>
          );
        })}
        <line x1="0" y1="226" x2="195" y2="226" stroke="rgba(255,255,255,0.06)" strokeWidth="0.4" strokeDasharray="3,2" />
        <text x="97" y="222" textAnchor="middle" fill="rgba(255,255,255,0.12)" fontSize="5" fontWeight="bold">BELGIË</text>
        {Object.entries(BE_PROVINCES).map(([name, p]) => {
          const key = dataKey(name, 'BE');
          return (
          <g key={name} onMouseEnter={() => setHovered({ label: name, key })} onMouseLeave={() => setHovered(null)}>
            <path
              d={p.d}
              fill={`rgba(236, 72, 153, ${opacity(key)})`}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="0.6"
              strokeLinejoin="round"
              className="transition-all duration-300 hover:brightness-150"
            />
            {(data[key] || 0) > 0 && (
              <circle cx={p.cx} cy={p.cy} r={Math.max(2, Math.min(5, (data[key] / maxCount) * 5))}
                fill="#ec4899" opacity="0.8" className="animate-pulse" />
            )}
          </g>
          );
        })}
      </svg>
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute left-1/2 top-0 z-20 -translate-x-1/2 rounded-lg border border-white/10 bg-[#1a1d2e] px-3 py-1.5 text-center shadow-xl"
          >
            <p className="text-[11px] font-bold text-white/80">{hovered.label}</p>
            <p className="text-[10px] tabular-nums text-white/40">{(data[hovered.key] || 0).toLocaleString('nl-NL')} leads</p>
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
interface AMTargetLive {
  id: string;
  admin_user_id: string;
  am_name: string;
  label: string;
  target_type: string;
  target_value: number;
  bonus_amount: number;
  current_value: number;
  progress_pct: number;
  period_start: string;
  period_end: string;
  status: string;
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  revenue: 'Omzet',
  batches: 'Batches',
  new_customers: 'Klanten',
  leads_delivered: 'Leads',
};

export default function LiveDashboard() {
  const [data, setData] = useState<LiveData | null>(null);
  const [clock, setClock] = useState(new Date());
  const [refreshIn, setRefreshIn] = useState(REFRESH_INTERVAL / 1000);
  const [newLeadIds, setNewLeadIds] = useState<Set<string>>(new Set());
  const [celebratingBatch, setCelebratingBatch] = useState<string | null>(null);
  const [amTargets, setAmTargets] = useState<AMTargetLive[]>([]);
  const [salesToasts, setSalesToasts] = useState<PaidBatch[]>([]);
  const [celebrationVideo, setCelebrationVideo] = useState<PaidBatch | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevBatchPcts = useRef<Record<string, number>>({});
  const seenPaidIds = useRef<Set<string>>(new Set());

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

          // Detect newly paid batches for sales bell + video celebration
          if (d.recentPaidBatches && d.recentPaidBatches.length > 0) {
            const newPaid = d.recentPaidBatches.filter((pb: PaidBatch) => !seenPaidIds.current.has(pb.id));
            if (newPaid.length > 0 && seenPaidIds.current.size > 0) {
              for (const pb of newPaid) {
                setSalesToasts(prev => [pb, ...prev].slice(0, 5));
                setTimeout(() => setSalesToasts(prev => prev.filter(t => t.id !== pb.id)), 8000);
              }
              playSalesBell();
              if (canvasRef.current) fireConfetti(canvasRef.current);

              const withVideo = newPaid.find((pb: PaidBatch) => pb.celebrationVideoUrl);
              if (withVideo) {
                setCelebrationVideo(withVideo);
                setTimeout(() => setCelebrationVideo(null), 20000);
              }
            }
            for (const pb of d.recentPaidBatches) seenPaidIds.current.add(pb.id);
          }

          return d;
        });
      }
    } catch { /* silent */ }
    setRefreshIn(REFRESH_INTERVAL / 1000);
  }, []);

  const fetchAMTargets = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/am-targets');
      if (res.ok) {
        const all: AMTargetLive[] = await res.json();
        setAmTargets(all.filter(t => t.status === 'active'));
      }
    } catch { /* silent */ }
  }, []);

  const fetchTestEvents = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/test-events');
      if (!res.ok) return;
      const { events } = await res.json();
      if (!events || events.length === 0) return;

      for (const evt of events) {
        const p = evt.payload || {};
        switch (evt.event_type) {
          case 'confetti':
            if (canvasRef.current) fireConfetti(canvasRef.current);
            playCelebrationSound();
            break;

          case 'batch_complete':
            setCelebratingBatch('test-' + evt.id);
            if (canvasRef.current) fireConfetti(canvasRef.current);
            playCelebrationSound();
            setTimeout(() => setCelebratingBatch(null), 5000);
            break;

          case 'sales_bell': {
            const toast: PaidBatch = {
              id: 'test-' + evt.id,
              batchId: '',
              customer: p.customer || 'Test Klant B.V.',
              branch: p.branch || 'test',
              amount: p.amount || 1250,
              paidAt: new Date().toISOString(),
              amId: p.amId || null,
              amName: p.amName || null,
              celebrationVideoUrl: null,
            };
            setSalesToasts(prev => [toast, ...prev].slice(0, 5));
            setTimeout(() => setSalesToasts(prev => prev.filter(t => t.id !== toast.id)), 8000);
            playSalesBell();
            if (canvasRef.current) fireConfetti(canvasRef.current);
            break;
          }

          case 'celebration_video': {
            const vid: PaidBatch = {
              id: 'test-' + evt.id,
              batchId: '',
              customer: p.customer || 'Test Klant B.V.',
              branch: p.branch || 'test',
              amount: p.amount || 2500,
              paidAt: new Date().toISOString(),
              amId: p.amId || null,
              amName: p.amName || 'Accountmanager',
              celebrationVideoUrl: p.celebrationVideoUrl || null,
            };
            setSalesToasts(prev => [vid, ...prev].slice(0, 5));
            setTimeout(() => setSalesToasts(prev => prev.filter(t => t.id !== vid.id)), 8000);
            playSalesBell();
            if (canvasRef.current) fireConfetti(canvasRef.current);
            if (vid.celebrationVideoUrl) {
              setCelebrationVideo(vid);
              setTimeout(() => setCelebrationVideo(null), 25000);
            }
            break;
          }
        }
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchData(); fetchAMTargets(); fetchTestEvents(); }, [fetchData, fetchAMTargets, fetchTestEvents]);
  useEffect(() => {
    const mainIv = setInterval(() => { fetchData(); fetchAMTargets(); }, REFRESH_INTERVAL);
    const testIv = setInterval(fetchTestEvents, 5000);
    return () => { clearInterval(mainIv); clearInterval(testIv); };
  }, [fetchData, fetchAMTargets, fetchTestEvents]);
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
  const lastLeadAgo = lastLeadTime ? timeAgo(lastLeadTime) : '-';

  let avgInterval = '-';
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

      {/* Batch completion overlay */}
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

      {/* Sales Celebration Video Overlay */}
      <AnimatePresence>
        {celebrationVideo && celebrationVideo.celebrationVideoUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 backdrop-blur-md"
            onClick={() => setCelebrationVideo(null)}
          >
            <motion.div
              initial={{ scale: 0.7, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.7, y: 40 }}
              transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              className="relative w-full max-w-3xl px-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="mb-4 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.3, 1] }}
                  transition={{ duration: 0.6 }}
                  className="mb-2 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30"
                >
                  <span className="text-3xl">🔔</span>
                </motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-3xl font-black text-amber-400"
                >
                  Nieuwe verkoop!
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mt-1 text-white/60"
                >
                  <span className="font-bold text-white">{celebrationVideo.customer}</span>
                  {celebrationVideo.amName && <span> — verkocht door <span className="font-bold text-amber-300">{celebrationVideo.amName}</span></span>}
                  {celebrationVideo.amount > 0 && <span> — <span className="font-bold text-emerald-400">€{celebrationVideo.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</span></span>}
                </motion.p>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="overflow-hidden rounded-2xl border-2 border-amber-500/30 shadow-2xl shadow-amber-500/20"
              >
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${extractYouTubeId(celebrationVideo.celebrationVideoUrl!)}?autoplay=1&start=0`}
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
                className="mx-auto mt-4 block rounded-lg bg-white/10 px-6 py-2 text-sm font-medium text-white/60 transition hover:bg-white/20 hover:text-white"
              >
                Sluiten
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sales Bell Toast Notifications */}
      <div className="fixed right-4 top-4 z-[85] flex flex-col gap-2 sm:right-6 sm:top-6">
        <AnimatePresence>
          {salesToasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-[#1a1d2e]/95 px-4 py-3 shadow-2xl shadow-amber-500/10 backdrop-blur-xl"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
                <span className="text-lg">🔔</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-amber-400">Verkoop!</p>
                <p className="truncate text-xs text-white/60">
                  {toast.customer}
                  {toast.amount > 0 && <span className="ml-1 font-bold text-emerald-400">€{toast.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</span>}
                </p>
                {toast.amName && <p className="text-[10px] text-white/30">door {toast.amName}</p>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

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
        <div className="mb-3 grid shrink-0 grid-cols-2 gap-2 lg:mb-2 lg:grid-cols-5">
          {[
            { label: 'Leads vandaag', value: ps.day?.leads || 0, sub: `${ps.day?.assigned || 0} uitgedeeld`, color: 'from-brand-purple to-brand-pink' },
            { label: 'Leads deze week', value: ps.week?.leads || 0, sub: `${ps.week?.assigned || 0} uitgedeeld`, color: 'from-emerald-500 to-emerald-600', trend: ps.week },
            { label: 'Omzet', value: Math.round(data.totalRevenue), sub: `winst: €${(data.costMetrics?.totalProfit || 0).toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`, color: 'from-amber-500 to-orange-500', prefix: '€' },
            { label: 'Eff. CPL', value: data.costMetrics?.effectieveCpl || 0, sub: `${data.costMetrics?.avgAssignments || 0}x uitgedeeld · bruto €${(data.costMetrics?.brutoCpl || 0).toFixed(2)}`, color: 'from-teal-400 to-emerald-500', prefix: '€', decimals: 2 },
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
                {(kpi as any).decimals ? (
                  <span className="text-2xl font-black tracking-tight text-white lg:text-3xl">{kpi.prefix}{kpi.value.toFixed((kpi as any).decimals)}</span>
                ) : (
                  <AnimatedNumber value={kpi.value} prefix={kpi.prefix} className="text-2xl font-black tracking-tight text-white lg:text-3xl" />
                )}
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
                            <p className="truncate text-sm font-semibold text-white/80">{lead.name || '-'}</p>
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

        {/* Financial strip */}
        {data.costMetrics && (data.costMetrics.monthAdSpend > 0 || data.costMetrics.effectieveCpl > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="shrink-0 rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.04] p-3 backdrop-blur-sm"
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <div className="px-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/50">Ad spend</p>
                <p className="mt-0.5 text-lg font-black tabular-nums text-white/80">&euro;{data.costMetrics.monthAdSpend.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="px-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/50">Bruto CPL</p>
                <p className="mt-0.5 text-lg font-black tabular-nums text-white/80">&euro;{data.costMetrics.brutoCpl.toFixed(2)}</p>
              </div>
              <div className="px-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/50">Eff. CPL</p>
                <p className="mt-0.5 text-lg font-black tabular-nums text-emerald-400">&euro;{data.costMetrics.effectieveCpl.toFixed(2)}</p>
                <p className="text-[9px] text-white/25">{data.costMetrics.avgAssignments}x uitgedeeld</p>
              </div>
              <div className="px-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/50">Omzet</p>
                <p className="mt-0.5 text-lg font-black tabular-nums text-white/80">&euro;{data.totalRevenue.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="px-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/50">Winst</p>
                <p className={`mt-0.5 text-lg font-black tabular-nums ${data.costMetrics.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {data.costMetrics.totalProfit >= 0 ? '+' : ''}&euro;{data.costMetrics.totalProfit.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* AM Performance Section */}
        {amTargets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="shrink-0 rounded-2xl border border-amber-500/10 bg-amber-500/[0.04] p-3 backdrop-blur-sm"
          >
            <div className="mb-2 flex items-center gap-2">
              <svg className="h-4 w-4 text-amber-400/60" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd"/></svg>
              <h2 className="text-sm font-bold text-white/70">AM Performance</h2>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {amTargets.map(t => {
                const r = 16;
                const circ = 2 * Math.PI * r;
                const filled = Math.min(t.progress_pct, 100);
                const isComplete = t.progress_pct >= 100;
                const isClose = t.progress_pct >= 75 && !isComplete;
                const ringColor = isComplete ? '#34d399' : t.progress_pct >= 75 ? '#fbbf24' : t.progress_pct >= 50 ? '#f97316' : '#f87171';
                const remaining = Math.max(0, t.target_value - (t as any).current_value || 0);
                const daysLeft = Math.max(0, Math.ceil((new Date(t.period_end + 'T23:59:59').getTime() - Date.now()) / 86400000));

                return (
                  <motion.div
                    key={t.id}
                    animate={isClose ? { boxShadow: ['0 0 0px rgba(251,191,36,0)', '0 0 12px rgba(251,191,36,0.15)', '0 0 0px rgba(251,191,36,0)'] } : undefined}
                    transition={isClose ? { repeat: Infinity, duration: 2.5 } : undefined}
                    className={`rounded-xl border p-3 ${
                      isComplete
                        ? 'border-emerald-500/20 bg-emerald-500/[0.06]'
                        : isClose
                        ? 'border-amber-500/15 bg-amber-500/[0.04]'
                        : 'border-white/[0.04] bg-white/[0.02]'
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <div className="relative h-10 w-10 shrink-0">
                        {(isClose || isComplete) && (
                          <div className={`absolute inset-0 rounded-full blur-sm ${isComplete ? 'bg-emerald-400/20' : 'bg-amber-400/15'}`} />
                        )}
                        <svg className="-rotate-90 relative h-10 w-10" viewBox="0 0 40 40">
                          <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                          <circle cx="20" cy="20" r={r} fill="none"
                            stroke={ringColor}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray={circ}
                            strokeDashoffset={circ - (filled / 100) * circ}
                            className="transition-all duration-1000"
                            style={isClose ? { filter: `drop-shadow(0 0 3px ${ringColor})` } : undefined}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          {isComplete
                            ? <span className="text-xs">🎉</span>
                            : <span className="text-[9px] font-black text-white/70">{t.progress_pct}%</span>
                          }
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-bold text-white/70">{t.am_name}</p>
                        <p className="truncate text-[9px] text-white/30">{t.label}</p>
                      </div>
                    </div>
                    <div className="flex items-baseline justify-between text-[10px]">
                      <span className="font-bold tabular-nums text-white/60">
                        {t.target_type === 'revenue'
                          ? `€${t.current_value.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`
                          : t.current_value.toLocaleString('nl-NL')}
                      </span>
                      <span className="text-white/20">
                        / {t.target_type === 'revenue'
                          ? `€${t.target_value.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`
                          : t.target_value.toLocaleString('nl-NL')}
                      </span>
                    </div>
                    {!isComplete && remaining > 0 && (
                      <p className="mt-0.5 text-[9px] text-white/25">
                        Nog {t.target_type === 'revenue' ? `€${remaining.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}` : remaining} · {daysLeft}d over
                      </p>
                    )}
                    <div className="mt-1 flex items-center justify-between text-[9px] text-white/20">
                      <span>{TARGET_TYPE_LABELS[t.target_type] || t.target_type}</span>
                      {t.bonus_amount > 0 && (
                        <span className={isComplete ? 'font-bold text-emerald-400/70' : 'text-amber-400/60'}>
                          {isComplete ? '✓ ' : ''}€{t.bonus_amount.toLocaleString('nl-NL', { maximumFractionDigits: 0 })} bonus
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* AM Leaderboard */}
        {data.amLeaderboard && data.amLeaderboard.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="shrink-0 rounded-2xl border border-brand-purple/10 bg-brand-purple/[0.04] p-3 backdrop-blur-sm"
          >
            <div className="mb-2 flex items-center gap-2">
              <svg className="h-4 w-4 text-brand-purple/60" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
              <h2 className="text-sm font-bold text-white/70">AM Leaderboard</h2>
              <span className="ml-auto text-[10px] text-white/25">
                {new Date().toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.amLeaderboard.map((am, rank) => {
                const isFirst = rank === 0;
                const medalColors = ['from-amber-400 to-amber-600', 'from-slate-300 to-slate-400', 'from-amber-600 to-amber-800'];
                const medalBg = rank < 3 ? medalColors[rank] : '';
                return (
                  <motion.div
                    key={am.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + rank * 0.05 }}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                      isFirst
                        ? 'border-amber-500/20 bg-amber-500/[0.06] shadow-lg shadow-amber-500/5'
                        : 'border-white/[0.04] bg-white/[0.02]'
                    }`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                      rank < 3 ? `bg-gradient-to-br ${medalBg} text-white shadow-md` : 'bg-white/[0.06] text-white/30'
                    }`}>
                      {rank + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-bold ${isFirst ? 'text-amber-300' : 'text-white/70'}`}>{am.name}</p>
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="font-bold tabular-nums text-emerald-400">€{am.revenue.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}</span>
                        <span className="text-white/20">·</span>
                        <span className="text-white/30">{am.batches} {am.batches === 1 ? 'batch' : 'batches'}</span>
                      </div>
                    </div>
                    {isFirst && (
                      <span className="text-lg">👑</span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

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
