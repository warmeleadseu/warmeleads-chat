'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  UserCircleIcon,
  VideoCameraIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlayIcon,
  ScissorsIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { useAdmin } from '../adminContext';
import { EmailSignaturePanel } from './EmailSignaturePanel';

interface Profile {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  title: string | null;
  celebration_video_url: string | null;
  celebration_video_start: number | null;
  celebration_video_end: number | null;
  created_at: string;
  last_login: string | null;
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

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function parseTimeInput(val: string): number {
  if (val.includes(':')) {
    const parts = val.split(':');
    return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
  }
  return parseInt(val) || 0;
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  accountmanager: 'Accountmanager',
};

export default function AccountPage() {
  const { user } = useAdmin();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoStart, setVideoStart] = useState('');
  const [videoEnd, setVideoEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/me');
      if (res.ok) {
        const data = await res.json();
        setProfile(data.user);
        setVideoUrl(data.user.celebration_video_url || '');
        setVideoStart(data.user.celebration_video_start ? formatSeconds(data.user.celebration_video_start) : '');
        setVideoEnd(data.user.celebration_video_end ? formatSeconds(data.user.celebration_video_end) : '');
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);

    if (videoUrl && !extractYouTubeId(videoUrl)) {
      setError('Ongeldige YouTube URL. Gebruik een geldige YouTube link of video ID.');
      setSaving(false);
      return;
    }

    const startSec = videoStart ? parseTimeInput(videoStart) : 0;
    const endSec = videoEnd ? parseTimeInput(videoEnd) : null;

    if (endSec !== null && endSec <= startSec) {
      setError('Eindtijd moet later zijn dan starttijd.');
      setSaving(false);
      return;
    }

    try {
      const res = await adminFetch('/api/admin/me', {
        method: 'PUT',
        body: JSON.stringify({
          celebration_video_url: videoUrl,
          celebration_video_start: startSec,
          celebration_video_end: endSec,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Opslaan mislukt');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      fetchProfile();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis');
    } finally {
      setSaving(false);
    }
  };

  const youtubeId = extractYouTubeId(videoUrl);
  const startSec = videoStart ? parseTimeInput(videoStart) : 0;
  const endSec = videoEnd ? parseTimeInput(videoEnd) : null;
  const clipDuration = endSec && endSec > startSec ? endSec - startSec : null;

  const previewFragment = () => {
    setShowPreview(true);
    setPreviewKey(k => k + 1);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <div className="h-7 w-48 animate-pulse rounded bg-slate-100" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-slate-50" />
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Mijn Account</h1>
        <p className="mt-0.5 text-sm text-slate-500">Bekijk je profiel en personaliseer je instellingen</p>
      </div>

      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="h-1 bg-warmeleads-gradient" />
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-purple/10">
              <UserCircleIcon className="h-8 w-8 text-brand-purple" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-slate-900">{profile?.name || user.name}</h2>
              <p className="truncate text-sm text-slate-500">{profile?.email || user.email}</p>
            </div>
            <span className="shrink-0 rounded-full bg-brand-purple/10 px-3 py-1 text-xs font-bold text-brand-purple">
              {ROLE_LABELS[profile?.role || user.role] || user.role}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {profile?.phone && (
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Telefoon</p>
                <p className="mt-0.5 break-words text-sm font-medium text-slate-700">{profile.phone}</p>
              </div>
            )}
            {profile?.title && (
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Functie</p>
                <p className="mt-0.5 break-words text-sm font-medium text-slate-700">{profile.title}</p>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Lid sinds</p>
              <p className="mt-0.5 text-sm font-medium text-slate-700">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
                  : '-'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Celebration Video Card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
              <VideoCameraIcon className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Viering video</h3>
              <p className="text-xs text-slate-500">
                Dit YouTube-filmpje wordt afgespeeld op het live dashboard als jouw batch betaald wordt.
                {!videoUrl && (
                  <span className="ml-1 text-slate-600">
                    Zolang je hier geen eigen URL hebt staan, gebruiken we de standaard celebration video van WarmeLeads — jouw sales worden dus altijd gevierd.
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
              <ExclamationCircleIcon className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {saved && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700"
            >
              <CheckCircleIcon className="h-4 w-4 shrink-0" />
              Video opgeslagen!
            </motion.div>
          )}

          <div className="space-y-5">
            {/* URL input */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">YouTube URL of Video ID</label>
              <input
                type="text"
                value={videoUrl}
                onChange={e => { setVideoUrl(e.target.value); setError(''); setShowPreview(false); }}
                placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20"
              />
              <p className="mt-1.5 text-[11px] text-slate-400">
                Plak een YouTube link (youtube.com/watch?v=..., youtu.be/... of alleen de video ID)
              </p>
            </div>

            {/* Fragment selection */}
            {youtubeId && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ScissorsIcon className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-bold text-slate-700">Fragment selecteren</span>
                  <span className="text-[11px] text-slate-400">(optioneel)</span>
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  Kies welk stuk van de video afgespeeld wordt. Gebruik het formaat m:ss (bijv. 1:30) of seconden (bijv. 90).
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-500">Starttijd</label>
                    <input
                      type="text"
                      value={videoStart}
                      onChange={e => setVideoStart(e.target.value)}
                      placeholder="0:00"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-500">Eindtijd</label>
                    <input
                      type="text"
                      value={videoEnd}
                      onChange={e => setVideoEnd(e.target.value)}
                      placeholder="Einde van video"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                    />
                  </div>
                </div>
                {clipDuration && (
                  <p className="mt-2 text-xs text-brand-purple font-medium">
                    Fragment: {formatSeconds(startSec)} → {formatSeconds(endSec!)} ({clipDuration} seconden)
                  </p>
                )}
              </div>
            )}

            {/* Large Preview */}
            {youtubeId && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Preview</span>
                  {showPreview && (
                    <button
                      onClick={previewFragment}
                      className="text-xs font-medium text-brand-purple hover:underline"
                    >
                      Fragment opnieuw afspelen
                    </button>
                  )}
                </div>
                {showPreview ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                      <iframe
                        key={previewKey}
                        src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&start=${startSec}${endSec ? `&end=${endSec}` : ''}`}
                        className="absolute inset-0 h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={previewFragment}
                    className="group relative w-full overflow-hidden rounded-xl border border-slate-200 shadow-sm"
                  >
                    <img
                      src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
                      alt="Video thumbnail"
                      className="w-full transition group-hover:brightness-90"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 text-white transition group-hover:bg-brand-purple group-hover:scale-110">
                        <PlayIcon className="h-8 w-8 pl-0.5" />
                      </div>
                    </div>
                    {(startSec > 0 || endSec) && (
                      <div className="absolute bottom-3 left-3 rounded-lg bg-black/70 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
                        {formatSeconds(startSec)} → {endSec ? formatSeconds(endSec) : 'einde'}
                      </div>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-button-gradient px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:shadow-md disabled:opacity-60"
              >
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
              {videoUrl && (
                <button
                  onClick={() => { setVideoUrl(''); setVideoStart(''); setVideoEnd(''); setShowPreview(false); }}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Verwijderen
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="mt-6">
        <EmailSignaturePanel />
      </div>
    </div>
  );
}
