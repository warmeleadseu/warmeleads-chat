'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  ListBulletIcon,
  Squares2X2Icon,
  CalendarIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  FunnelIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { useAdmin } from '../adminContext';
import {
  CalendarMonthView,
} from './_components/CalendarMonthView';
import { CalendarWeekView } from './_components/CalendarWeekView';
import { CalendarListView } from './_components/CalendarListView';
import { EventDrawer } from './_components/EventDrawer';
import {
  EVENT_TYPES,
  TYPE_META,
  type AdminOption,
  type CalendarEvent,
  type CalendarView,
  type EventInput,
  type EventType,
} from './_lib/types';
import {
  addDays,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  toLocalInputValue,
  MONTH_LABELS_NL,
} from './_lib/datetime';

interface FetchRange {
  fromIso: string;
  toIso: string;
}

function rangeForView(view: CalendarView, anchor: Date): FetchRange {
  if (view === 'month') {
    const monthStart = startOfMonth(anchor);
    const monthEnd = endOfMonth(anchor);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);
    return { fromIso: gridStart.toISOString(), toIso: gridEnd.toISOString() };
  }
  if (view === 'week') {
    return {
      fromIso: startOfWeek(anchor).toISOString(),
      toIso: endOfWeek(anchor).toISOString(),
    };
  }
  // list: 60 days window centred a bit forward
  const start = addDays(new Date(), -7);
  const end = addDays(new Date(), 60);
  return { fromIso: start.toISOString(), toIso: end.toISOString() };
}

function viewLabel(view: CalendarView, anchor: Date): string {
  if (view === 'month') {
    return `${MONTH_LABELS_NL[anchor.getMonth()]} ${anchor.getFullYear()}`;
  }
  if (view === 'week') {
    const ws = startOfWeek(anchor);
    const we = endOfWeek(anchor);
    if (ws.getMonth() === we.getMonth()) {
      return `${ws.getDate()} – ${we.getDate()} ${MONTH_LABELS_NL[ws.getMonth()]} ${ws.getFullYear()}`;
    }
    return `${ws.getDate()} ${MONTH_LABELS_NL[ws.getMonth()]} – ${we.getDate()} ${MONTH_LABELS_NL[we.getMonth()]} ${we.getFullYear()}`;
  }
  return 'Komende periode';
}

function shiftAnchor(view: CalendarView, anchor: Date, dir: -1 | 1): Date {
  if (view === 'month') {
    const c = new Date(anchor);
    c.setMonth(c.getMonth() + dir);
    return c;
  }
  if (view === 'week') {
    return addDays(anchor, dir * 7);
  }
  return addDays(anchor, dir * 7);
}

export default function TeamAgendaPage() {
  return (
    <Suspense fallback={null}>
      <TeamAgendaInner />
    </Suspense>
  );
}

function TeamAgendaInner() {
  const { user } = useAdmin();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<CalendarView>('month');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminOption[]>([]);

  const [participantFilter, setParticipantFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<EventType[]>([]);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerInitial, setDrawerInitial] = useState<Partial<EventInput> | null>(null);
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);

  const range = useMemo(() => rangeForView(view, anchor), [view, anchor]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('from', range.fromIso);
      params.set('to', range.toIso);
      const res = await adminFetch(`/api/admin/team-calendar?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setEvents(data as CalendarEvent[]);
      } else {
        setEvents([]);
      }
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [range.fromIso, range.toIso]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminFetch('/api/admin/account-managers');
        const data = await res.json();
        if (cancelled) return;
        const list = (data.account_managers || []) as Array<{ id: string; name: string; email: string | null }>;
        setAdmins(list.map(a => ({ id: a.id, name: a.name, email: a.email })));
      } catch {
        if (!cancelled) setAdmins([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Make sure current admin is always selectable in filters/forms even if AM list omits them
  useEffect(() => {
    setAdmins(prev => {
      if (prev.some(a => a.id === user.id)) return prev;
      return [...prev, { id: user.id, name: user.name, email: user.email }];
    });
  }, [user.id, user.name, user.email]);

  // Open the create-drawer when arriving with ?create=1 (used by Plan-bezoek-buttons).
  useEffect(() => {
    if (searchParams.get('create') !== '1') return;
    const customerId = searchParams.get('customer_id');
    const prospectId = searchParams.get('prospect_id');
    const type = searchParams.get('type') as EventType | null;
    const title = searchParams.get('title');
    const now = new Date();
    now.setMinutes(now.getMinutes() < 30 ? 30 : 0, 0, 0);
    if (now.getMinutes() === 0) now.setHours(now.getHours() + 1);
    const end = new Date(now);
    end.setHours(end.getHours() + 1);
    setDrawerMode('create');
    setActiveEvent(null);
    setDrawerInitial({
      title: title || '',
      event_type: (type && (EVENT_TYPES as readonly string[]).includes(type)
        ? type
        : 'customer_visit') as EventType,
      starts_at: toLocalInputValue(now),
      ends_at: toLocalInputValue(end),
      customer_id: customerId || null,
      prospect_id: prospectId || null,
      participant_ids: [user.id],
    });
    setDrawerOpen(true);
    // Clean the URL so a refresh does not re-open the drawer.
    const cleaned = new URLSearchParams(searchParams.toString());
    cleaned.delete('create');
    cleaned.delete('customer_id');
    cleaned.delete('prospect_id');
    cleaned.delete('type');
    cleaned.delete('title');
    const rest = cleaned.toString();
    router.replace(`/admin/team-agenda${rest ? `?${rest}` : ''}`);
  }, [searchParams, router, user.id]);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter(ev => {
      if (typeFilter.length > 0 && !typeFilter.includes(ev.event_type)) return false;
      if (participantFilter.length > 0) {
        const ids = new Set(ev.participants.map(p => p.id));
        if (!participantFilter.some(id => ids.has(id))) return false;
      }
      if (term) {
        const haystack = [
          ev.title,
          ev.location || '',
          ev.description || '',
          ev.customer?.name || '',
          ev.prospect?.company_name || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [events, typeFilter, participantFilter, search]);

  function openCreate(prefill: Partial<EventInput> | null = null) {
    setDrawerMode('create');
    setActiveEvent(null);
    setDrawerInitial(prefill);
    setDrawerOpen(true);
  }

  function openEvent(ev: CalendarEvent) {
    setDrawerMode('edit');
    setActiveEvent(ev);
    setDrawerInitial(null);
    setDrawerOpen(true);
  }

  function handleDayClick(day: Date) {
    const startsAt = new Date(day);
    startsAt.setHours(9, 0, 0, 0);
    const endsAt = new Date(startsAt);
    endsAt.setHours(10, 0, 0, 0);
    openCreate({
      starts_at: toLocalInputValue(startsAt),
      ends_at: toLocalInputValue(endsAt),
    });
  }

  function handleSlotClick(start: Date) {
    const endsAt = new Date(start);
    endsAt.setHours(endsAt.getHours() + 1);
    openCreate({
      starts_at: toLocalInputValue(start),
      ends_at: toLocalInputValue(endsAt),
    });
  }

  function handleSaved(ev: CalendarEvent) {
    setEvents(prev => {
      const filtered = prev.filter(p => p.id !== ev.id);
      return [...filtered, ev].sort(
        (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      );
    });
    setDrawerOpen(false);
  }

  function handleDeleted(id: string) {
    setEvents(prev => prev.filter(p => p.id !== id));
    setDrawerOpen(false);
  }

  function toggleType(t: EventType) {
    setTypeFilter(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]));
  }
  function toggleParticipant(id: string) {
    setParticipantFilter(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  }

  const activeFilterCount =
    typeFilter.length + participantFilter.length + (search.trim().length > 0 ? 1 : 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Team-agenda</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gedeelde agenda voor klantbezoeken, prospect-bezoeken, beurzen, vakantie en intern overleg.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openCreate(null)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-purple/90"
          >
            <PlusIcon className="h-4 w-4" />
            Nieuw event
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAnchor(shiftAnchor(view, anchor, -1))}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Vorige periode"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setAnchor(new Date())}
            className="rounded-md px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Vandaag
          </button>
          <button
            onClick={() => setAnchor(shiftAnchor(view, anchor, 1))}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Volgende periode"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
          <span className="ml-2 text-sm font-bold text-slate-800">{viewLabel(view, anchor)}</span>
          {loading && (
            <span className="ml-2 text-[11px] font-medium text-slate-400">laden…</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(s => !s)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold ring-1 transition ${
              showFilters || activeFilterCount > 0
                ? 'bg-brand-purple/10 text-brand-purple ring-brand-purple/20'
                : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            <FunnelIcon className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-brand-purple/20 px-1.5 py-0.5 text-[10px] font-bold text-brand-purple">
                {activeFilterCount}
              </span>
            )}
          </button>
          <div className="flex overflow-hidden rounded-md ring-1 ring-slate-200">
            <button
              onClick={() => setView('month')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold ${
                view === 'month' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
              title="Maand"
            >
              <Squares2X2Icon className="h-3.5 w-3.5" />
              Maand
            </button>
            <button
              onClick={() => setView('week')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold ${
                view === 'week' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
              title="Week"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              Week
            </button>
            <button
              onClick={() => setView('list')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold ${
                view === 'list' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
              title="Lijst"
            >
              <ListBulletIcon className="h-3.5 w-3.5" />
              Lijst
            </button>
          </div>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Zoeken
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-brand-purple focus-within:ring-2 focus-within:ring-brand-purple/20">
              <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Zoek op titel, locatie of klantnaam"
                className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Type
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EVENT_TYPES.map(t => {
                const meta = TYPE_META[t];
                const active = typeFilter.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition ${
                      active
                        ? `${meta.pill} ring-transparent`
                        : `bg-white text-slate-600 ring-slate-200 hover:bg-slate-50`
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                    {meta.label}
                    {active && <CheckCircleIcon className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Deelnemers
            </div>
            <div className="flex flex-wrap gap-1.5">
              {admins.map(a => {
                const active = participantFilter.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleParticipant(a.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition ${
                      active
                        ? 'bg-brand-purple text-white ring-transparent'
                        : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold uppercase ${
                        active ? 'bg-white/30' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {a.name.charAt(0)}
                    </span>
                    {a.name}
                  </button>
                );
              })}
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setSearch('');
                setTypeFilter([]);
                setParticipantFilter([]);
              }}
              className="text-xs font-semibold text-rose-600 hover:underline"
            >
              Wis alle filters
            </button>
          )}
        </div>
      )}

      {/* View body */}
      {filteredEvents.length === 0 && !loading && view !== 'list' && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
          <CalendarDaysIcon className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">
            Geen events in deze periode
            {activeFilterCount > 0 ? ' met de huidige filters' : ''}.
          </p>
          <button
            onClick={() => openCreate(null)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-purple/90"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Plan een event
          </button>
        </div>
      )}

      {!(filteredEvents.length === 0 && !loading && view !== 'list') &&
        (view === 'month' ? (
          <CalendarMonthView
            month={anchor}
            events={filteredEvents}
            onSelectEvent={openEvent}
            onSelectDay={handleDayClick}
          />
        ) : view === 'week' ? (
          <CalendarWeekView
            weekStart={startOfWeek(anchor)}
            events={filteredEvents}
            onSelectEvent={openEvent}
            onSelectSlot={handleSlotClick}
          />
        ) : (
          <CalendarListView events={filteredEvents} onSelectEvent={openEvent} />
        ))}

      <EventDrawer
        open={drawerOpen}
        mode={drawerMode}
        initial={drawerInitial}
        existingEvent={activeEvent}
        currentAdmin={{ id: user.id, role: user.role }}
        admins={admins}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
