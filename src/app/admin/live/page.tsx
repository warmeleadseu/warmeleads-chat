'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { adminFetch } from '@/lib/adminAuth';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { audioManager } from '@/lib/celebrationSounds';

const REFRESH_INTERVAL = 30_000;

interface CelebrationEvent {
  id: string;
  event_type: string;
  payload: Record<string, any>;
  created_at: string;
  source?: 'db' | 'test';
}

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

interface PeriodStat { leads: number; prevLeads: number; assigned: number; prevAssigned: number; revenue: number; prevRevenue: number; adSpend: number; prevAdSpend: number; profit: number; prevProfit: number; }
interface BatchInfo { id: string; customer: string; branch: string; batchSize: number; delivered: number; pricePerLead: number | null; leadsPerWeek: number | null; notes: string | null; }
interface RecentLead { id: string; name: string; branch: string; city: string; province: string; createdAt: string; }
interface CostMetrics { monthAdSpend: number; brutoCpl: number; effectieveCpl: number; avgAssignments: number; batchRevenue: number; bulkRevenue: number; bulkAssignmentCount: number; totalProfit: number; }
interface PaidBatch { id: string; batchId: string; customer: string; branch: string; amount: number; paidAt: string; amId: string | null; amName: string | null; amAvatarUrl?: string | null; celebrationVideoUrl: string | null; videoStart?: number | null; videoEnd?: number | null; }
interface AMLeaderboardEntry { id: string; name: string; revenue: number; batches: number; celebrationVideoUrl: string | null; avatarUrl?: string | null; }

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

// ─── Celebration Effects ──────────────────────────────────────────────
type CelebrationVariant = 'confetti' | 'goldenRain' | 'megaBurst';

const BRANCH_CONFETTI: Record<string, string[]> = {
  thuisbatterij: ['#34d399', '#10b981', '#059669', '#6ee7b7', '#a7f3d0'],
  airco: ['#38bdf8', '#0ea5e9', '#0284c7', '#7dd3fc', '#bae6fd'],
  zonnepanelen: ['#facc15', '#eab308', '#ca8a04', '#fde047', '#fef08a'],
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
  am_avatar_url?: string | null;
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const celebrationIframeRef = useRef<HTMLIFrameElement>(null);
  const prevBatchPcts = useRef<Record<string, number>>({});
  const seenPaidIds = useRef<Set<string>>(new Set());
  const processedCelebrationIds = useRef<Set<string>>(new Set());

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

  // Load undisplayed celebrations on mount + subscribe to Realtime
  useEffect(() => {
    let mounted = true;

    // Fetch existing undisplayed celebrations
    adminFetch('/api/admin/celebrations').then(async res => {
      if (!res.ok || !mounted) return;
      const { events } = await res.json();
      if (events && events.length > 0 && mounted) {
        events.forEach((evt: any, idx: number) => {
          const ce: CelebrationEvent = { ...evt, source: 'db' };
          setTimeout(() => {
            if (mounted) processCelebration(ce);
          }, idx * 2000);
        });
      }
    }).catch(() => {});

    // Subscribe to Realtime for new celebration events
    let channel: ReturnType<ReturnType<typeof getSupabaseBrowserClient>['channel']> | null = null;
    let testChannel: ReturnType<ReturnType<typeof getSupabaseBrowserClient>['channel']> | null = null;

    try {
      const sb = getSupabaseBrowserClient();

      channel = sb.channel('celebration-events')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'celebration_events',
        }, (payload) => {
          if (!mounted) return;
          const row = payload.new as any;
          processCelebration({ id: row.id, event_type: row.event_type, payload: row.payload || {}, created_at: row.created_at, source: 'db' });
        })
        .subscribe();

      testChannel = sb.channel('test-events')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'live_test_events',
        }, (payload) => {
          if (!mounted) return;
          const row = payload.new as any;
          if (row.consumed) return;
          processCelebration({ id: row.id, event_type: row.event_type, payload: row.payload || {}, created_at: row.created_at, source: 'test' });
          // Mark test event as consumed
          adminFetch('/api/admin/test-events', { method: 'GET' }).catch(() => {});
        })
        .subscribe();
    } catch { /* Realtime not available, fall back to polling */ }

    // Fallback polling for test events (in case Realtime is not available)
    const testPollIv = setInterval(async () => {
      try {
        const res = await adminFetch('/api/admin/test-events');
        if (!res.ok) return;
        const { events } = await res.json();
        if (!events || events.length === 0) return;
        for (const evt of events) {
          const ce: CelebrationEvent = { id: evt.id, event_type: evt.event_type, payload: evt.payload || {}, created_at: evt.created_at, source: 'test' };
          processCelebration(ce);
        }
      } catch { /* silent */ }
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(testPollIv);
      if (channel) { try { getSupabaseBrowserClient().removeChannel(channel); } catch {} }
      if (testChannel) { try { getSupabaseBrowserClient().removeChannel(testChannel); } catch {} }
    };
  }, [processCelebration]);

  // Auto-close celebration video when YouTube reports playback ended
  useEffect(() => {
    if (!celebrationVideo?.celebrationVideoUrl) return;

    const handleMessage = (e: MessageEvent) => {
      if (!e.origin.includes('youtube.com')) return;
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data.event === 'onStateChange' && data.info === 0) {
          setTimeout(() => setCelebrationVideo(null), 1500);
        }
      } catch { /* not a YouTube message */ }
    };

    window.addEventListener('message', handleMessage);

    // Tell YouTube iframe we want state change events
    const sendListening = setInterval(() => {
      if (celebrationIframeRef.current?.contentWindow) {
        celebrationIframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'listening', id: 1 }),
          'https://www.youtube.com'
        );
      }
    }, 800);

    // Safety fallback: close after 3 minutes max if YouTube messaging fails
    const safety = setTimeout(() => setCelebrationVideo(null), 180000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(sendListening);
      clearTimeout(safety);
    };
  }, [celebrationVideo]);

  useEffect(() => { fetchData(); fetchAMTargets(); }, [fetchData, fetchAMTargets]);
  useEffect(() => {
    const mainIv = setInterval(() => { fetchData(); fetchAMTargets(); }, REFRESH_INTERVAL);
    return () => { clearInterval(mainIv); };
  }, [fetchData, fetchAMTargets]);
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
              animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              className="absolute h-[700px] w-[700px] rounded-full bg-emerald-500/20 blur-[150px]"
            />
            <motion.div
              animate={{ scale: [1.1, 0.9, 1.1], opacity: [0.15, 0.35, 0.15] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
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
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
                  className="absolute"
                  style={{ width: 200, height: 200 }}
                >
                  {Array.from({ length: 12 }).map((_, si) => (
                    <motion.div
                      key={si}
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.5, 1.2, 0.5] }}
                      transition={{ repeat: Infinity, duration: 1.5, delay: si * 0.12 }}
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
                      className={`rounded-full px-4 py-1.5 text-sm font-bold ${(BRANCH_COLORS[celebratingBatch.branch] || DEFAULT_BRANCH).badge}`}
                      style={{ boxShadow: `0 0 20px ${(BRANCH_COLORS[celebratingBatch.branch] || DEFAULT_BRANCH).fill}30` }}
                    >
                      {celebratingBatch.branch}
                    </motion.span>
                  )}
                  {celebratingBatch.batchSize && <p className="mt-1 text-base text-white/40">{celebratingBatch.batchSize} leads succesvol uitgeleverd</p>}
                </motion.div>
              ) : (
                <motion.p initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="mt-4 text-lg font-medium text-white/50">
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
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 20, ease: 'linear' }}
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
                  <span className="text-lg font-bold text-white/80">{celebrationVideo.customer}</span>
                  {celebrationVideo.amName && (
                    <span className="rounded-full bg-amber-500/20 px-4 py-1 text-sm font-bold text-amber-300 shadow-lg shadow-amber-500/10">
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
                className="mx-auto mt-4 block rounded-full bg-white/10 px-8 py-2.5 text-sm font-bold text-white/50 transition hover:bg-white/20 hover:text-white"
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
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 15, ease: 'linear' }}
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
                    animate={{ rotate: -360 }}
                    transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
                    className="absolute"
                    style={{ width: 220, height: 220 }}
                  >
                    {Array.from({ length: 8 }).map((_, si) => (
                      <motion.div
                        key={si}
                        animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.4, 0.8] }}
                        transition={{ repeat: Infinity, duration: 1.2, delay: si * 0.15 }}
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
                <p className="text-base text-white/50">{targetHitOverlay.payload.targetLabel}</p>
                <div className="mt-2 flex items-center gap-4">
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 1.1, type: 'spring', damping: 12 }}
                    className="rounded-full bg-amber-500/20 px-4 py-1.5 text-sm font-bold text-amber-300"
                    style={{ boxShadow: '0 0 15px rgba(251,191,36,0.2)' }}
                  >
                    {targetHitOverlay.payload.targetType}: {targetHitOverlay.payload.targetValue?.toLocaleString('nl-NL')}
                  </motion.span>
                  {targetHitOverlay.payload.bonusAmount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 1.3, type: 'spring', damping: 12 }}
                      className="rounded-full bg-emerald-500/20 px-4 py-1.5 text-sm font-bold text-emerald-300"
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
                  animate={{ boxShadow: ['0 0 15px rgba(168,85,247,0.15)', '0 0 35px rgba(168,85,247,0.35)', '0 0 15px rgba(168,85,247,0.15)'] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
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
                <p className="text-lg font-black text-brand-purple" style={{ textShadow: '0 0 20px rgba(168,85,247,0.4)' }}>
                  {milestoneToast.payload.milestoneText || 'Milestone!'}
                </p>
                {milestoneToast.payload.count && (
                  <p className="text-sm text-white/50">{milestoneToast.payload.count} verkopen vandaag</p>
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
              className="relative min-w-[340px] overflow-hidden rounded-2xl bg-[#1a1d2e]/95 px-5 py-4 backdrop-blur-xl"
              style={{
                border: `2px solid ${borderColor}50`,
                boxShadow: `0 0 25px ${borderColor}30, 0 20px 40px -10px rgba(0,0,0,0.5)`,
              }}
            >
              {!reducedMotion && (
              <>
                <motion.div
                  animate={{
                    boxShadow: [
                      `0 0 10px ${borderColor}15, inset 0 0 10px ${borderColor}00`,
                      `0 0 30px ${borderColor}40, inset 0 0 20px ${borderColor}0a`,
                      `0 0 10px ${borderColor}15, inset 0 0 10px ${borderColor}00`,
                    ],
                  }}
                  transition={{ repeat: Infinity, duration: 1.8 }}
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
                      animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                      transition={{ repeat: Infinity, duration: 2 }}
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
                    <span className="text-lg font-black text-white">{toast.amName.charAt(0).toUpperCase()}</span>
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
                      className="text-base font-black tracking-wide text-amber-400"
                      style={{ textShadow: `0 0 12px ${borderColor}60` }}
                    >
                      Ka-Ching!
                    </motion.p>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${bc.badge}`}>{toast.branch}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-medium text-white/70">{toast.customer}</p>
                  {toast.amName && <p className="text-xs text-white/40">door {toast.amName}</p>}
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

            {/* Sound toggle */}
            <button
              onClick={() => {
                const next = audioManager.toggle();
                setSoundEnabled(next);
                if (next) audioManager.ensureContext();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-white/40 transition hover:bg-white/[0.1] hover:text-white/70"
              title={soundEnabled ? 'Geluid uit' : 'Geluid aan'}
            >
              {soundEnabled ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 010 7.07" />
                  <path d="M19.07 4.93a10 10 0 010 14.14" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              )}
            </button>

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
            { label: 'Omzet', value: Math.round(data.totalRevenue), sub: `winst: €${(data.costMetrics?.totalProfit || 0).toLocaleString('nl-NL', { maximumFractionDigits: 0 })}${data.costMetrics?.bulkRevenue ? ` · bulk: €${data.costMetrics.bulkRevenue.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}` : ''}`, color: 'from-amber-500 to-orange-500', prefix: '€' },
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

        {/* Main content + AM sidebar wrapper */}
        <div className="flex min-h-0 flex-1 gap-3">
        {/* Main content column */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden">
        {/* Middle section: Batches + Live Feed + Map */}
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-7">
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
                  const isCelebrating = celebratingBatch?.id === b.id;
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
                {data.costMetrics.bulkRevenue > 0 && (
                  <p className="text-[9px] text-white/25">&euro;{data.costMetrics.batchRevenue.toLocaleString('nl-NL', { maximumFractionDigits: 0 })} batch + &euro;{data.costMetrics.bulkRevenue.toLocaleString('nl-NL', { maximumFractionDigits: 0 })} bulk</p>
                )}
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

        {/* AM Performance Section — inline on <xl */}
        {amTargets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="shrink-0 rounded-2xl border border-amber-500/10 bg-amber-500/[0.04] p-3 backdrop-blur-sm xl:hidden"
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
                          {t.am_avatar_url ? (
                            <Image src={t.am_avatar_url} alt={t.am_name} width={28} height={28} className="h-7 w-7 rounded-full object-cover" />
                          ) : isComplete ? (
                            <span className="text-xs">🎉</span>
                          ) : (
                            <span className="text-[9px] font-black text-white/70">{t.progress_pct}%</span>
                          )}
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

        {/* AM Leaderboard — inline on <xl */}
        {data.amLeaderboard && data.amLeaderboard.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="shrink-0 rounded-2xl border border-brand-purple/10 bg-brand-purple/[0.04] p-3 backdrop-blur-sm xl:hidden"
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
                    <div className="relative h-8 w-8 shrink-0">
                      {am.avatarUrl ? (
                        <Image src={am.avatarUrl} alt={am.name} width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
                          rank < 3 ? `bg-gradient-to-br ${medalBg} text-white shadow-md` : 'bg-white/[0.06] text-white/30'
                        }`}>
                          {am.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black ${
                        rank < 3 ? `bg-gradient-to-br ${medalBg} text-white` : 'bg-white/10 text-white/40'
                      }`}>
                        {rank + 1}
                      </span>
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

        {/* Period comparison — two rows: leads + profit */}
        <div className="grid shrink-0 grid-cols-3 gap-2 lg:grid-cols-6">
          {Object.entries(PERIOD_LABELS).map(([key, label], i) => {
            const stat = ps[key];
            if (!stat) return null;
            const profitPositive = stat.profit >= 0;
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
                {/* Profit line */}
                <div className="mt-2 border-t border-white/[0.04] pt-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-sm font-black tabular-nums ${profitPositive ? 'text-emerald-400/90' : 'text-red-400/90'}`}>
                      {profitPositive ? '+' : ''}&euro;{Math.round(stat.profit).toLocaleString('nl-NL')}
                    </span>
                    <TrendArrow current={stat.profit} previous={stat.prevProfit} />
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[9px] text-white/20">
                    <span>&euro;{Math.round(stat.revenue).toLocaleString('nl-NL')}</span>
                    <span className="text-white/10">-</span>
                    <span>&euro;{Math.round(stat.adSpend).toLocaleString('nl-NL')}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
        </div>{/* end main content column */}

        {/* AM Sidebar — xl only */}
        <div className="hidden xl:flex xl:w-[340px] xl:shrink-0 xl:flex-col xl:gap-3 xl:overflow-y-auto">
          {/* AM Performance */}
          {amTargets.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-amber-500/10 bg-amber-500/[0.04] p-4 backdrop-blur-sm"
            >
              <div className="mb-3 flex items-center gap-2">
                <svg className="h-4 w-4 text-amber-400/60" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd"/></svg>
                <h2 className="text-sm font-bold text-white/70">AM Targets</h2>
              </div>
              <div className="space-y-2.5">
                {[...amTargets].sort((a, b) => b.progress_pct - a.progress_pct).map((t, idx) => {
                  const r = 22;
                  const circ = 2 * Math.PI * r;
                  const filled = Math.min(t.progress_pct, 100);
                  const isComplete = t.progress_pct >= 100;
                  const isClose = t.progress_pct >= 75 && !isComplete;
                  const ringColor = isComplete ? '#34d399' : t.progress_pct >= 75 ? '#fbbf24' : t.progress_pct >= 50 ? '#f97316' : '#f87171';
                  const remaining = Math.max(0, t.target_value - (t as any).current_value || 0);
                  const daysLeft = Math.max(0, Math.ceil((new Date(t.period_end + 'T23:59:59').getTime() - Date.now()) / 86400000));
                  const isTop = idx === 0 && amTargets.length > 1;

                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + idx * 0.05 }}
                      className={`rounded-xl border p-3.5 ${
                        isComplete
                          ? 'border-emerald-500/20 bg-emerald-500/[0.06]'
                          : isTop
                          ? 'border-amber-500/20 bg-amber-500/[0.06]'
                          : isClose
                          ? 'border-amber-500/15 bg-amber-500/[0.04]'
                          : 'border-white/[0.04] bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="relative h-14 w-14 shrink-0">
                          {(isClose || isComplete) && (
                            <div className={`absolute inset-0 rounded-full blur-sm ${isComplete ? 'bg-emerald-400/20' : 'bg-amber-400/15'}`} />
                          )}
                          <svg className="-rotate-90 relative h-14 w-14" viewBox="0 0 56 56">
                            <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                            <circle cx="28" cy="28" r={r} fill="none"
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
                            {t.am_avatar_url ? (
                              <Image src={t.am_avatar_url} alt={t.am_name} width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
                            ) : isComplete ? (
                              <span className="text-base">🎉</span>
                            ) : (
                              <span className="text-[10px] font-black text-white/70">{t.progress_pct}%</span>
                            )}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {isTop && !isComplete && <span className="text-sm">👑</span>}
                            <p className={`truncate text-[13px] font-bold ${isTop && !isComplete ? 'text-amber-300' : 'text-white/70'}`}>{t.am_name}</p>
                          </div>
                          <p className="truncate text-[11px] text-white/30">{t.label}</p>
                          <div className="mt-1 flex items-baseline justify-between text-[11px]">
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
                        </div>
                      </div>
                      {!isComplete && remaining > 0 && (
                        <p className="mt-2 text-[10px] text-white/25">
                          Nog {t.target_type === 'revenue' ? `€${remaining.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}` : remaining} · {daysLeft}d over
                        </p>
                      )}
                      <div className="mt-1 flex items-center justify-between text-[10px] text-white/20">
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
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl border border-brand-purple/10 bg-brand-purple/[0.04] p-4 backdrop-blur-sm"
            >
              <div className="mb-3 flex items-center gap-2">
                <svg className="h-4 w-4 text-brand-purple/60" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                <h2 className="text-sm font-bold text-white/70">Leaderboard</h2>
                <span className="ml-auto text-[10px] text-white/20">
                  {new Date().toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className="space-y-2.5">
                {data.amLeaderboard.map((am, rank) => {
                  const isFirst = rank === 0;
                  const medalColors = ['from-amber-400 to-amber-600', 'from-slate-300 to-slate-400', 'from-amber-600 to-amber-800'];
                  const medalBg = rank < 3 ? medalColors[rank] : '';
                  return (
                    <motion.div
                      key={am.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 + rank * 0.05 }}
                      className={`flex items-center gap-3.5 rounded-xl border p-3 ${
                        isFirst
                          ? 'border-amber-500/20 bg-amber-500/[0.06]'
                          : 'border-white/[0.04] bg-white/[0.02]'
                      }`}
                    >
                      <div className="relative h-9 w-9 shrink-0">
                        {am.avatarUrl ? (
                          <Image src={am.avatarUrl} alt={am.name} width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-black ${
                            rank < 3 ? `bg-gradient-to-br ${medalBg} text-white shadow-md` : 'bg-white/[0.06] text-white/30'
                          }`}>
                            {am.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black ${
                          rank < 3 ? `bg-gradient-to-br ${medalBg} text-white` : 'bg-white/10 text-white/40'
                        }`}>
                          {rank + 1}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-[13px] font-bold ${isFirst ? 'text-amber-300' : 'text-white/70'}`}>{am.name}</p>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="font-bold tabular-nums text-emerald-400">€{am.revenue.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}</span>
                          <span className="text-white/20">·</span>
                          <span className="text-white/30">{am.batches} {am.batches === 1 ? 'batch' : 'batches'}</span>
                        </div>
                      </div>
                      {isFirst && <span className="text-base">👑</span>}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>{/* end AM sidebar */}
        </div>{/* end main + sidebar wrapper */}
      </div>
    </div>
  );
}
