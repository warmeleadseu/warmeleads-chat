'use client';

import { Fragment, useMemo, useState } from 'react';
import {
  buildMonthGrid,
  isSameDay,
  isSameMonth,
  startOfDay,
  endOfDay,
} from '../_lib/datetime';
import { TYPE_META, type CalendarEvent } from '../_lib/types';
import { AdminAvatar } from './AdminAvatar';

interface Props {
  month: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
  onSelectDay: (d: Date) => void;
}

const WEEKDAY_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const MAX_VISIBLE_PER_DAY = 3;

/** Events overlappen een dag wanneer hun [start,end] interval de dag raakt. */
function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  return events.filter(e => {
    const s = new Date(e.starts_at);
    const en = new Date(e.ends_at);
    return s <= dayEnd && en >= dayStart;
  });
}

export function CalendarMonthView({ month, events, onSelectEvent, onSelectDay }: Props) {
  const days = useMemo(() => buildMonthGrid(month), [month]);
  const today = useMemo(() => new Date(), []);
  const [popoverDay, setPopoverDay] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {WEEKDAY_LABELS.map(d => (
          <div key={d} className="px-2 py-2 text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {days.map((day, idx) => {
          const dayEvents = eventsOnDay(events, day);
          const visible = dayEvents.slice(0, MAX_VISIBLE_PER_DAY);
          const hidden = dayEvents.length - visible.length;
          const inMonth = isSameMonth(day, month);
          const isToday = isSameDay(day, today);
          const dayKey = day.toISOString().slice(0, 10);
          return (
            <Fragment key={dayKey}>
              <div
                className={`group relative min-h-[112px] cursor-pointer border-b border-r border-slate-100 p-1.5 transition-colors hover:bg-slate-50 ${
                  inMonth ? 'bg-white' : 'bg-slate-50/40'
                } ${idx % 7 === 6 ? 'border-r-0' : ''}`}
                onClick={() => onSelectDay(day)}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                      isToday
                        ? 'bg-brand-purple text-white'
                        : inMonth
                          ? 'text-slate-700'
                          : 'text-slate-400'
                    }`}
                  >
                    {day.getDate()}
                  </span>
                </div>
                <div className="space-y-1">
                  {visible.map(ev => {
                    const meta = TYPE_META[ev.event_type];
                    const start = new Date(ev.starts_at);
                    const time = ev.all_day
                      ? 'Hele dag'
                      : `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
                    const creatorName = ev.creator?.name || 'Onbekend';
                    return (
                      <button
                        key={ev.id}
                        onClick={e => {
                          e.stopPropagation();
                          onSelectEvent(ev);
                        }}
                        className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] font-medium transition-opacity hover:opacity-90 ${meta.pill}`}
                        title={`${time} · ${ev.title} · ${creatorName}`}
                      >
                        <AdminAvatar
                          id={ev.creator?.id || ev.created_by}
                          name={ev.creator?.name}
                          avatarUrl={ev.creator?.avatar_url}
                          size={14}
                          withWhiteRing
                          withTitle={false}
                        />
                        <span className="shrink-0 opacity-90">{time}</span>
                        <span className="truncate">{ev.title}</span>
                      </button>
                    );
                  })}
                  {hidden > 0 && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setPopoverDay(popoverDay === dayKey ? null : dayKey);
                      }}
                      className="block w-full rounded px-1 py-0.5 text-left text-[11px] font-medium text-slate-500 hover:bg-slate-100"
                    >
                      +{hidden} meer
                    </button>
                  )}
                </div>
                {popoverDay === dayKey && (
                  <div
                    className="absolute left-1 top-9 z-20 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-700">
                        {day.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' })}
                      </span>
                      <button
                        onClick={() => setPopoverDay(null)}
                        className="rounded p-0.5 text-slate-400 hover:bg-slate-100"
                      >
                        ×
                      </button>
                    </div>
                    <div className="space-y-1">
                      {dayEvents.map(ev => {
                        const meta = TYPE_META[ev.event_type];
                        return (
                          <button
                            key={ev.id}
                            onClick={() => {
                              setPopoverDay(null);
                              onSelectEvent(ev);
                            }}
                            className={`flex w-full items-center gap-1.5 truncate rounded px-1.5 py-1 text-left text-[11px] font-medium hover:opacity-90 ${meta.pill}`}
                            title={ev.creator?.name ? `${ev.title} · ${ev.creator.name}` : ev.title}
                          >
                            <AdminAvatar
                              id={ev.creator?.id || ev.created_by}
                              name={ev.creator?.name}
                              avatarUrl={ev.creator?.avatar_url}
                              size={14}
                              withWhiteRing
                              withTitle={false}
                            />
                            <span className="truncate">{ev.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
