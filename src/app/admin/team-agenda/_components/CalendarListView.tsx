'use client';

import { useMemo } from 'react';
import {
  CalendarDaysIcon,
  MapPinIcon,
  UserGroupIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline';
import { formatRange, formatTime } from '../_lib/datetime';
import { TYPE_META, type CalendarEvent } from '../_lib/types';

interface Props {
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
}

interface DayBucket {
  key: string;
  date: Date;
  events: CalendarEvent[];
}

function groupByDay(events: CalendarEvent[]): DayBucket[] {
  const map = new Map<string, DayBucket>();
  for (const ev of events) {
    const start = new Date(ev.starts_at);
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    const bucket = map.get(key);
    if (bucket) {
      bucket.events.push(ev);
    } else {
      map.set(key, {
        key,
        date: new Date(start.getFullYear(), start.getMonth(), start.getDate()),
        events: [ev],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function CalendarListView({ events, onSelectEvent }: Props) {
  const buckets = useMemo(() => groupByDay(events), [events]);

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
        <CalendarDaysIcon className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-500">Geen events in deze periode</p>
        <p className="text-xs text-slate-400">Klik op &quot;Nieuw event&quot; om er één te plannen.</p>
      </div>
    );
  }

  const today = new Date();
  return (
    <div className="space-y-4">
      {buckets.map(b => {
        const isToday =
          b.date.getDate() === today.getDate() &&
          b.date.getMonth() === today.getMonth() &&
          b.date.getFullYear() === today.getFullYear();
        return (
          <div key={b.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800">
                  {b.date.toLocaleDateString('nl-NL', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </span>
                {isToday && (
                  <span className="rounded-full bg-brand-purple/10 px-2 py-0.5 text-[10px] font-semibold text-brand-purple">
                    Vandaag
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium text-slate-400">
                {b.events.length} event{b.events.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {b.events.map(ev => {
                const meta = TYPE_META[ev.event_type];
                const start = new Date(ev.starts_at);
                const end = new Date(ev.ends_at);
                const company = ev.customer?.name || ev.prospect?.company_name || null;
                return (
                  <button
                    key={ev.id}
                    onClick={() => onSelectEvent(ev)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className={`mt-1 h-9 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">
                          {ev.title}
                        </span>
                        <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${meta.soft}`}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDaysIcon className="h-3.5 w-3.5" />
                          {ev.all_day
                            ? 'Hele dag'
                            : `${formatTime(start)} – ${formatTime(end)}`}
                        </span>
                        {ev.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPinIcon className="h-3.5 w-3.5" />
                            <span className="truncate">{ev.location}</span>
                          </span>
                        )}
                        {company && (
                          <span className="inline-flex items-center gap-1">
                            <BuildingOffice2Icon className="h-3.5 w-3.5" />
                            <span className="truncate">{company}</span>
                          </span>
                        )}
                        {ev.participants.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <UserGroupIcon className="h-3.5 w-3.5" />
                            {ev.participants.map(p => p.name).join(', ')}
                          </span>
                        )}
                      </div>
                      {ev.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{ev.description}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {formatRange(start, end, ev.all_day)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
