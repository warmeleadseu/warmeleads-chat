'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BellAlertIcon,
  VideoCameraIcon,
  SparklesIcon,
  CheckBadgeIcon,
  PlayIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { useAdmin } from '../adminContext';

interface AMUser {
  id: string;
  name: string;
  email: string;
  celebration_video_url: string | null;
  celebration_video_start: number | null;
  celebration_video_end: number | null;
}

interface TestEvent {
  type: string;
  label: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
  bgColor: string;
  borderColor: string;
}

const TEST_EVENTS: TestEvent[] = [
  {
    type: 'confetti',
    label: 'Confetti',
    description: 'Confetti-explosie met geluid op het live dashboard',
    icon: SparklesIcon,
    color: 'text-brand-purple',
    bgColor: 'bg-brand-purple/10',
    borderColor: 'border-brand-purple/20 hover:border-brand-purple/40',
  },
  {
    type: 'batch_complete',
    label: 'Batch voltooid',
    description: 'Batch voltooid overlay met confetti en geluid',
    icon: CheckBadgeIcon,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200 hover:border-emerald-400',
  },
  {
    type: 'sales_bell',
    label: 'Sales Bell',
    description: 'Gouden verkoopnotificatie met geluid en confetti',
    icon: BellAlertIcon,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200 hover:border-amber-400',
  },
  {
    type: 'celebration_video',
    label: 'Celebration Video',
    description: 'Fullscreen viering met YouTube-video, confetti en geluid',
    icon: VideoCameraIcon,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200 hover:border-rose-400',
  },
];

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

export default function TestPanelPage() {
  const { user } = useAdmin();
  const [amUsers, setAmUsers] = useState<AMUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<{ type: string; time: number } | null>(null);
  const [error, setError] = useState('');

  const [customCustomer, setCustomCustomer] = useState('Test Klant B.V.');
  const [customAmount, setCustomAmount] = useState('2500');
  const [customBranch, setCustomBranch] = useState('zonnepanelen');
  const [selectedAM, setSelectedAM] = useState('');
  const [customVideoUrl, setCustomVideoUrl] = useState('');

  const fetchAMs = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/users');
      if (res.ok) {
        const d = await res.json();
        const ams = (d.users || []).filter((u: any) => u.role === 'accountmanager' && u.is_active);
        setAmUsers(ams);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAMs(); }, [fetchAMs]);

  const selectedAMData = amUsers.find(am => am.id === selectedAM);
  const effectiveVideoUrl = customVideoUrl || selectedAMData?.celebration_video_url || '';

  const triggerEvent = async (eventType: string) => {
    setSending(eventType);
    setError('');

    const payload: Record<string, unknown> = {
      customer: customCustomer || 'Test Klant B.V.',
      amount: parseFloat(customAmount) || 0,
      branch: customBranch || 'test',
    };

    if (selectedAMData) {
      payload.amId = selectedAMData.id;
      payload.amName = selectedAMData.name;
    }

    if (eventType === 'celebration_video') {
      if (!effectiveVideoUrl) {
        setError('Selecteer een AM met video of vul een YouTube URL in');
        setSending(null);
        return;
      }
      payload.celebrationVideoUrl = effectiveVideoUrl;
      if (selectedAMData) {
        payload.amName = selectedAMData.name;
        if (!customVideoUrl && selectedAMData.celebration_video_start) {
          payload.videoStart = selectedAMData.celebration_video_start;
        }
        if (!customVideoUrl && selectedAMData.celebration_video_end) {
          payload.videoEnd = selectedAMData.celebration_video_end;
        }
      }
    }

    try {
      const res = await adminFetch('/api/admin/test-events', {
        method: 'POST',
        body: JSON.stringify({ event_type: eventType, payload }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Versturen mislukt');
      }
      setLastSent({ type: eventType, time: Date.now() });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis');
    } finally {
      setSending(null);
    }
  };

  const cleanupEvents = async () => {
    await adminFetch('/api/admin/test-events', { method: 'DELETE' });
  };

  if (user.role !== 'superadmin') {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-500">Alleen toegankelijk voor superadmins.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Live Dashboard Testpanel</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Trigger test-events die direct op het live dashboard verschijnen. Open het live dashboard in een apart tabblad om de effecten te zien.
        </p>
      </div>

      {/* Instructie banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-4"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100">
            <PlayIcon className="h-4 w-4 text-sky-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-sky-900">Hoe te gebruiken</p>
            <ol className="mt-1 space-y-0.5 text-sm text-sky-700">
              <li>1. Open het <a href="/admin/live" target="_blank" className="font-bold underline">Live Dashboard</a> in een apart tabblad</li>
              <li>2. Vul hieronder eventueel klantgegevens en AM in</li>
              <li>3. Klik op een event-knop om het te triggeren</li>
              <li>4. Het event verschijnt binnen 5 seconden op het live dashboard</li>
            </ol>
          </div>
        </div>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600"
        >
          <ExclamationCircleIcon className="h-4 w-4 shrink-0" />
          {error}
        </motion.div>
      )}

      <AnimatePresence>
        {lastSent && Date.now() - lastSent.time < 3000 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700"
          >
            <CheckCircleIcon className="h-4 w-4 shrink-0" />
            Event &ldquo;{TEST_EVENTS.find(e => e.type === lastSent.type)?.label}&rdquo; verstuurd! Verschijnt binnen 5 seconden op het live dashboard.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Configuratie */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-bold text-slate-900">Test configuratie</h2>
          <p className="text-xs text-slate-500">Deze gegevens worden meegegeven aan de test-events</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Klantnaam</label>
            <input
              value={customCustomer}
              onChange={e => setCustomCustomer(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
              placeholder="Test Klant B.V."
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Bedrag (€)</label>
            <input
              type="number"
              value={customAmount}
              onChange={e => setCustomAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
              placeholder="2500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Branch</label>
            <input
              value={customBranch}
              onChange={e => setCustomBranch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
              placeholder="zonnepanelen"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Accountmanager</label>
            <select
              value={selectedAM}
              onChange={e => setSelectedAM(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
            >
              <option value="">Geen AM (optioneel)</option>
              {amUsers.map(am => (
                <option key={am.id} value={am.id}>
                  {am.name} {am.celebration_video_url ? '🎬' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom video URL */}
        <div className="border-t border-slate-100 px-5 py-4">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Custom YouTube URL (overschrijft AM video)
          </label>
          <input
            value={customVideoUrl}
            onChange={e => setCustomVideoUrl(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
            placeholder="https://www.youtube.com/watch?v=..."
          />
          {effectiveVideoUrl && (
            <div className="mt-2 flex items-center gap-2">
              <img
                src={`https://img.youtube.com/vi/${extractYouTubeId(effectiveVideoUrl)}/default.jpg`}
                alt="thumbnail"
                className="h-10 w-14 rounded object-cover"
              />
              <span className="text-xs text-slate-500">
                Video actief{selectedAMData && !customVideoUrl ? ` (van ${selectedAMData.name})` : customVideoUrl ? ' (custom)' : ''}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Event buttons */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Events triggeren
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {TEST_EVENTS.map((evt) => {
            const isSending = sending === evt.type;
            const justSent = lastSent?.type === evt.type && Date.now() - lastSent.time < 2000;
            const needsVideo = evt.type === 'celebration_video';
            const hasVideo = !!effectiveVideoUrl;

            return (
              <motion.button
                key={evt.type}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => triggerEvent(evt.type)}
                disabled={isSending || (needsVideo && !hasVideo)}
                className={`group relative overflow-hidden rounded-xl border p-5 text-left shadow-sm transition-all disabled:opacity-50 ${evt.borderColor} bg-white hover:shadow-md`}
              >
                {justSent && (
                  <motion.div
                    initial={{ scaleX: 1 }}
                    animate={{ scaleX: 0 }}
                    transition={{ duration: 2, ease: 'linear' }}
                    className="absolute inset-x-0 top-0 h-1 origin-left bg-emerald-400"
                  />
                )}
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${evt.bgColor}`}>
                    <evt.icon className={`h-6 w-6 ${evt.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900">{evt.label}</h3>
                      {isSending && <ArrowPathIcon className="h-4 w-4 animate-spin text-slate-400" />}
                      {justSent && <CheckCircleIcon className="h-4 w-4 text-emerald-500" />}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{evt.description}</p>
                    {needsVideo && !hasVideo && (
                      <p className="mt-1 text-[11px] font-medium text-rose-500">
                        Selecteer eerst een AM met video of vul een YouTube URL in
                      </p>
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* AM Video overview */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-bold text-slate-900">Accountmanagers &amp; Video&apos;s</h2>
            <p className="text-xs text-slate-500">Overzicht van alle AMs en hun celebration video status</p>
          </div>
          <button
            onClick={cleanupEvents}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            Oude events opruimen
          </button>
        </div>

        {loading ? (
          <div className="p-5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="mb-3 flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-slate-100" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-48 animate-pulse rounded bg-slate-50" />
                </div>
              </div>
            ))}
          </div>
        ) : amUsers.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-slate-400">Geen accountmanagers gevonden</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {amUsers.map((am) => {
              const hasVideo = !!am.celebration_video_url;
              const ytId = hasVideo ? extractYouTubeId(am.celebration_video_url!) : null;
              return (
                <div key={am.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-purple/10 text-sm font-bold text-brand-purple">
                    {am.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900">{am.name}</p>
                    <p className="text-xs text-slate-500">{am.email}</p>
                  </div>
                  {hasVideo ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://img.youtube.com/vi/${ytId}/default.jpg`}
                        alt="Video"
                        className="h-9 w-12 rounded object-cover"
                      />
                      <div>
                        <span className="block text-xs font-medium text-emerald-600">Video ingesteld</span>
                        {(am.celebration_video_start || am.celebration_video_end) && (
                          <span className="block text-[10px] text-slate-400">
                            Fragment: {Math.floor((am.celebration_video_start || 0) / 60)}:{((am.celebration_video_start || 0) % 60).toString().padStart(2, '0')}
                            {' → '}
                            {am.celebration_video_end ? `${Math.floor(am.celebration_video_end / 60)}:${(am.celebration_video_end % 60).toString().padStart(2, '0')}` : 'einde'}
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setSelectedAM(am.id);
                            setCustomVideoUrl('');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="text-[11px] font-medium text-brand-purple hover:underline"
                        >
                          Selecteer &amp; test
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-400">
                      Geen video
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
