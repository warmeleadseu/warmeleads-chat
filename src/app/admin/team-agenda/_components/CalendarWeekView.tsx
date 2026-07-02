'use client';

import { useMemo } from 'react';
import {
  buildWeekDays,
  isSameDay,
  startOfDay,
  endOfDay,
} from '../_lib/datetime';
import { TYPE_META, type CalendarEvent } from '../_lib/types';
import { AdminAvatar } from './AdminAvatar';
import { colorForAdmin, firstNameForName } from '../_lib/admin-color';

interface Props {
  weekStart: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
  onSelectSlot: (start: Date) => void;
}

const HOUR_START = 7;
const HOUR_END = 21;
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
const SLOT_HEIGHT_PX = 48;

interface Positioned {
  ev: CalendarEvent;
  top: number;
  height: number;
}

function eventsForDay(events: CalendarEvent[], day: Date): Positioned[] {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const list: Positioned[] = [];
  for (const ev of events) {
    if (ev.all_day) continue;
    const s = new Date(ev.starts_at);
    const e = new Date(ev.ends_at);
    if (s > dayEnd || e < dayStart) continue;
    const clampedStart = s < dayStart ? dayStart : s;
    const clampedEnd = e > dayEnd ? dayEnd : e;
    const startMinutes =
      (clampedStart.getHours() - HOUR_START) * 60 + clampedStart.getMinutes();
    const endMinutes =
      (clampedEnd.getHours() - HOUR_START) * 60 + clampedEnd.getMinutes();
    const totalMinutes = (HOUR_END - HOUR_START + 1) * 60;
    const top = Math.max(0, (startMinutes / 60) * SLOT_HEIGHT_PX);
    const rawHeight = ((endMinutes - startMinutes) / 60) * SLOT_HEIGHT_PX;
    const height = Math.max(20, rawHeight);
    if (startMinutes >= totalMinutes) continue;
    list.push({ ev, top, height });
  }
  return list;
}

function allDayEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  return events.filter(ev => {
    if (!ev.all_day) return false;
    const s = new Date(ev.starts_at);
    const e = new Date(ev.ends_at);
    return s <= dayEnd && e >= dayStart;
  });
}

export function CalendarWeekView({ weekStart, events, onSelectEvent, onSelectSlot }: Props) {
  const days = useMemo(() => buildWeekDays(weekStart), [weekStart]);
  const today = useMemo(() => new Date(), []);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <div className="min-w-[640px]">
      {/* Day header */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-200 bg-slate-50">
        <div />
        {days.map(d => {
          const isToday = isSameDay(d, today);
          return (
            <div key={d.toISOString()} className="border-l border-slate-200 px-2 py-2 text-center">
              <div
                className={`text-[11px] font-semibold uppercase tracking-wider ${
                  isToday ? 'text-brand-purple' : 'text-slate-500'
                }`}
              >
                {d.toLocaleDateString('nl-NL', { weekday: 'short' })}
              </div>
              <div
                className={`mt-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${
                  isToday ? 'bg-brand-purple text-white' : 'text-slate-700'
                }`}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day strip */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-200 bg-slate-50/60">
        <div className="px-2 py-1 text-[10px] font-semibold uppercase leading-tight tracking-wider text-slate-400">
          Hele dag
        </div>
        {days.map(d => {
          const items = allDayEventsForDay(events, d);
          return (
            <div key={d.toISOString()} className="border-l border-slate-200 px-1 py-1 space-y-1 min-h-[28px]">
              {items.map(ev => {
                const meta = TYPE_META[ev.event_type];
                const amColor = colorForAdmin(ev.creator?.id || ev.created_by);
                return (
                  <button
                    key={ev.id}
                    onClick={() => onSelectEvent(ev)}
                    style={{ borderLeft: `3px solid ${amColor.bg}` }}
                    className={`flex w-full items-center gap-1 truncate rounded-r px-1 py-0.5 text-left text-[11px] font-medium hover:opacity-90 ${meta.pill}`}
                    title={ev.creator?.name ? `${ev.title} · ${ev.creator.name}` : ev.title}
                  >
                    <AdminAvatar
                      id={ev.creator?.id || ev.created_by}
                      name={ev.creator?.name}
                      avatarUrl={ev.creator?.avatar_url}
                      size={14}
                      withWhiteRing
                      withAmRing
                      withTitle={false}
                    />
                    <span className="truncate">{ev.title}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="relative grid grid-cols-[60px_repeat(7,1fr)]">
        {/* hour labels */}
        <div className="bg-slate-50/60">
          {HOURS.map(h => (
            <div
              key={h}
              style={{ height: SLOT_HEIGHT_PX }}
              className="border-b border-slate-100 px-2 pt-1 text-right text-[10px] font-medium text-slate-400"
            >
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        {days.map(d => {
          const items = eventsForDay(events, d);
          return (
            <div key={d.toISOString()} className="relative border-l border-slate-200">
              {HOURS.map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    const slot = new Date(d);
                    slot.setHours(h, 0, 0, 0);
                    onSelectSlot(slot);
                  }}
                  style={{ height: SLOT_HEIGHT_PX }}
                  className="block w-full border-b border-slate-100 transition-colors hover:bg-brand-purple/5"
                  aria-label={`Plan op ${d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric' })} ${h}:00`}
                />
              ))}
              {items.map(({ ev, top, height }) => {
                const meta = TYPE_META[ev.event_type];
                const creatorName = ev.creator?.name || 'Onbekend';
                const amColor = colorForAdmin(ev.creator?.id || ev.created_by);
                const firstName = firstNameForName(ev.creator?.name);
                return (
                  <button
                    key={ev.id}
                    onClick={e => {
                      e.stopPropagation();
                      onSelectEvent(ev);
                    }}
                    style={{
                      top,
                      height,
                      borderLeft: `4px solid ${amColor.bg}`,
                    }}
                    className={`absolute left-1 right-1 z-10 overflow-hidden rounded-r-md px-1.5 py-1 text-left text-[11px] font-medium leading-tight shadow-sm transition-opacity hover:opacity-95 ${meta.pill}`}
                    title={`${ev.title} · ${creatorName}`}
                  >
                    <div className="flex items-center gap-1">
                      <AdminAvatar
                        id={ev.creator?.id || ev.created_by}
                        name={ev.creator?.name}
                        avatarUrl={ev.creator?.avatar_url}
                        size={height > 36 ? 16 : 12}
                        withWhiteRing
                        withAmRing
                        withTitle={false}
                      />
                      <span className="truncate font-semibold">{ev.title}</span>
                    </div>
                    {height > 36 && ev.location && (
                      <div className="mt-0.5 truncate text-[10px] opacity-90">{ev.location}</div>
                    )}
                    {height > 52 && ev.creator?.name && (
                      <div className="mt-1">
                        <span
                          style={{ borderColor: amColor.bg, color: amColor.bg }}
                          className="inline-flex items-center rounded-full border bg-white/95 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                        >
                          {firstName}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
