'use client';

import { useState } from 'react';
import {
  ChatBubbleLeftEllipsisIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarDaysIcon,
  ArrowsRightLeftIcon,
  UserPlusIcon,
  ArrowDownTrayIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  PlusIcon,
  PencilSquareIcon,
  PaperAirplaneIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

export interface Activity {
  id: string;
  type: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  admin_user_id: string | null;
}

const ICONS: Record<string, { Icon: React.ComponentType<{ className?: string }>; color: string }> = {
  note: { Icon: ChatBubbleLeftEllipsisIcon, color: 'bg-slate-100 text-slate-500' },
  call: { Icon: PhoneIcon, color: 'bg-emerald-100 text-emerald-600' },
  email: { Icon: EnvelopeIcon, color: 'bg-sky-100 text-sky-600' },
  meeting: { Icon: CalendarDaysIcon, color: 'bg-purple-100 text-purple-600' },
  status_change: { Icon: ArrowsRightLeftIcon, color: 'bg-orange-100 text-orange-600' },
  assignment: { Icon: UserPlusIcon, color: 'bg-amber-100 text-amber-600' },
  import: { Icon: ArrowDownTrayIcon, color: 'bg-indigo-100 text-indigo-600' },
  conversion: { Icon: CheckBadgeIcon, color: 'bg-emerald-100 text-emerald-700' },
  task_created: { Icon: PlusIcon, color: 'bg-blue-100 text-blue-600' },
  task_completed: { Icon: CheckCircleIcon, color: 'bg-emerald-100 text-emerald-600' },
  created: { Icon: SparklesIcon, color: 'bg-brand-purple/10 text-brand-purple' },
  updated: { Icon: PencilSquareIcon, color: 'bg-slate-100 text-slate-500' },
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = diff / 60000;
  if (min < 1) return 'zojuist';
  if (min < 60) {
    const m = Math.floor(min);
    return `${m} ${m === 1 ? 'minuut' : 'minuten'} geleden`;
  }
  const hrs = min / 60;
  if (hrs < 24) {
    const h = Math.floor(hrs);
    return `${h} ${h === 1 ? 'uur' : 'uur'} geleden`;
  }
  const days = hrs / 24;
  if (days < 7) {
    const d = Math.floor(days);
    return `${d} ${d === 1 ? 'dag' : 'dagen'} geleden`;
  }
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

interface Props {
  prospectId: string;
  activities: Activity[];
  onAdded: (a: Activity) => void;
}

const QUICK_TYPES: { type: 'note' | 'call' | 'email' | 'meeting'; label: string }[] = [
  { type: 'note', label: 'Notitie' },
  { type: 'call', label: 'Belnotitie' },
  { type: 'email', label: 'E-mail' },
  { type: 'meeting', label: 'Afspraak' },
];

export function ActivityTimeline({ prospectId, activities, onAdded }: Props) {
  const [type, setType] = useState<'note' | 'call' | 'email' | 'meeting'>('note');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'contact' | 'system'>('all');

  const submit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await adminFetch(`/api/admin/prospects/${prospectId}/activities`, {
        method: 'POST',
        body: JSON.stringify({ type, title: title.trim(), body: body.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.activity) {
        onAdded(data.activity);
        setTitle('');
        setBody('');
      } else {
        setError(data.error || 'Activiteit opslaan mislukt');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activiteit opslaan mislukt');
    } finally {
      setSaving(false);
    }
  };

  const CONTACT_TYPES = new Set(['note', 'call', 'email', 'meeting']);
  const filteredActivities = activities.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'contact') return CONTACT_TYPES.has(a.type);
    return !CONTACT_TYPES.has(a.type);
  });

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">×</button>
        </div>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_TYPES.map(t => (
            <button
              key={t.type}
              type="button"
              onClick={() => setType(t.type)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                type === t.type
                  ? 'bg-brand-purple text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Wat gebeurde er? (bv. 'Gebeld, geen gehoor, bel maandag terug')"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-purple/50"
        />
        {(type === 'email' || type === 'meeting' || type === 'note') && (
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Optionele toelichting..."
            rows={2}
            className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-purple/50"
          />
        )}
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={saving || !title.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-purple/90 disabled:opacity-50"
          >
            <PaperAirplaneIcon className="h-3.5 w-3.5" />
            Opslaan
          </button>
        </div>
      </div>

      {activities.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {([
            { id: 'all', label: 'Alles' },
            { id: 'contact', label: 'Contact' },
            { id: 'system', label: 'Systeem' },
          ] as const).map(o => (
            <button
              key={o.id}
              type="button"
              onClick={() => setFilter(o.id)}
              className={`rounded-full px-2.5 py-1 font-medium ring-1 ring-inset transition-colors ${
                filter === o.id
                  ? 'bg-brand-purple/10 text-brand-purple ring-brand-purple/30'
                  : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {o.label}
            </button>
          ))}
          <span className="ml-auto text-slate-400">{filteredActivities.length} van {activities.length}</span>
        </div>
      )}

      {activities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
          Nog geen activiteiten.
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-xs text-slate-400">
          Geen activiteiten in dit filter.
        </div>
      ) : (
        <ol className="relative space-y-3 pl-5">
          <span className="absolute left-[10px] top-2 bottom-2 w-px bg-slate-200" aria-hidden />
          {filteredActivities.map(a => {
            const cfg = ICONS[a.type] || ICONS.note;
            const { Icon, color } = cfg;
            return (
              <li key={a.id} className="relative">
                <span className={`absolute -left-[18px] top-1 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-white ${color}`}>
                  <Icon className="h-3 w-3" />
                </span>
                <div className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">{a.title}</p>
                    <span className="shrink-0 text-[11px] text-slate-400">{relTime(a.created_at)}</span>
                  </div>
                  {a.body && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-500">{a.body}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
