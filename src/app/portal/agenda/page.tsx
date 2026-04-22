'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { usePortal } from '../portalContext';
import { portalFetch } from '@/lib/portalAuth';
import { PERMISSIONS } from '@/lib/portalPermissions';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  CalendarDaysIcon,
  ClockIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import BookAppointmentModal from './BookAppointmentModal';
import AppointmentDetailModal from './AppointmentDetailModal';
import AvailabilityPanel from '../AvailabilityPanel';
import { PageHeader, ToggleGroup, T } from '../_ui';

export interface Appointment {
  id: string;
  customer_id: string;
  portal_user_id: string | null;
  branch: string;
  batch_id: string | null;
  lead_id: string | null;
  lead_assignment_id: string | null;
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  street: string | null;
  house_number: string | null;
  postcode: string | null;
  city: string | null;
  starts_at: string;
  duration_minutes: number;
  travel_buffer_minutes: number;
  status: 'scheduled' | 'completed' | 'no_show' | 'cancelled' | 'rescheduled';
  notes: string | null;
  source: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
}

const DAY_SHORT = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
const DAY_LONG = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-indigo-100 border-indigo-300 text-indigo-900',
  completed: 'bg-emerald-100 border-emerald-300 text-emerald-900',
  no_show: 'bg-rose-100 border-rose-300 text-rose-900',
  cancelled: 'bg-slate-100 border-slate-300 text-slate-500 line-through',
  rescheduled: 'bg-amber-100 border-amber-300 text-amber-900',
};

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day; // monday first
  r.setDate(r.getDate() + diff);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
}

function fmtDayShort(d: Date): string {
  return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
}

function sameYMD(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function AgendaPage() {
  const { customer, portalUser, hasPermission } = usePortal();

  const canEdit = hasPermission(PERMISSIONS.APPOINTMENTS_EDIT);
  const canViewAll = hasPermission(PERMISSIONS.APPOINTMENTS_VIEW_ALL);
  const canManageAvailability = hasPermission(PERMISSIONS.AVAILABILITY_MANAGE);

  const [view, setView] = useState<'week' | 'day'>(typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week');
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [filterUserId, setFilterUserId] = useState<string | 'all' | 'unassigned'>('all');
  const [showBook, setShowBook] = useState(false);
  const [bookSlot, setBookSlot] = useState<{ start: Date; portalUserId?: string | null } | null>(null);
  const [detail, setDetail] = useState<Appointment | null>(null);
  const [showAvailability, setShowAvailability] = useState(false);
  const [branchNames, setBranchNames] = useState<Record<string, string>>({});
  const [availabilityPortalReady, setAvailabilityPortalReady] = useState(false);

  useEffect(() => {
    setAvailabilityPortalReady(true);
  }, []);

  useEffect(() => {
    if (!showAvailability) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showAvailability]);

  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  // Stable date bounds — new Date() every render would change load()'s identity and retrigger useEffect infinitely.
  const rangeStart = useMemo(() => {
    if (view === 'week') return weekStart;
    return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  }, [view, weekStart, anchor]);
  const rangeEnd = useMemo(() => {
    if (view === 'week') return addDays(weekStart, 7);
    return addDays(rangeStart, 1);
  }, [view, weekStart, rangeStart]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        from: rangeStart.toISOString(),
        to: rangeEnd.toISOString(),
      });
      if (filterUserId === 'unassigned') q.set('portal_user_id', 'null');
      else if (filterUserId !== 'all') q.set('portal_user_id', filterUserId);
      const res = await portalFetch(`/api/portal/appointments?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAppointments(Array.isArray(data) ? data : []);
      } else {
        setAppointments([]);
      }
    } finally {
      setLoading(false);
    }
  }, [rangeStart, rangeEnd, filterUserId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!canViewAll && !portalUser) return;
    portalFetch('/api/portal/team-list')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setTeam((data.members || []).map((m: TeamMember) => ({ id: m.id, name: m.name, role: m.role })));
      })
      .catch(() => {});
  }, [canViewAll, portalUser]);

  useEffect(() => {
    portalFetch('/api/portal/branches')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          const map: Record<string, string> = {};
          (data.branches || data).forEach((b: { slug: string; name: string }) => { map[b.slug] = b.name; });
          setBranchNames(map);
        }
      })
      .catch(() => {});
  }, []);

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const d = new Date(a.starts_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(key) || [];
      arr.push(a);
      map.set(key, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    return map;
  }, [appointments]);

  function apptsForDay(d: Date): Appointment[] {
    return appointmentsByDay.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) || [];
  }

  const goPrev = () => setAnchor(view === 'week' ? addDays(anchor, -7) : addDays(anchor, -1));
  const goNext = () => setAnchor(view === 'week' ? addDays(anchor, 7) : addDays(anchor, 1));
  const goToday = () => setAnchor(new Date());

  const handleCreateSlot = (start: Date, portalUserId?: string | null) => {
    if (!canEdit) return;
    setBookSlot({ start, portalUserId });
    setShowBook(true);
  };

  const openNewAppointment = () => {
    if (!canEdit) return;
    const now = new Date();
    const rounded = new Date(now);
    rounded.setMinutes(now.getMinutes() < 30 ? 30 : 60, 0, 0);
    setBookSlot({ start: rounded });
    setShowBook(true);
  };

  // Header label
  const headerLabel = view === 'week'
    ? `${days[0].toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} — ${days[6].toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : anchor.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Hour grid config for desktop
  const HOUR_START = 7;
  const HOUR_END = 22;
  const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

  return (
    <div className="space-y-5 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-0">
      <PageHeader
        title="Agenda"
        subtitle={canViewAll ? 'Beheer je afspraken en beschikbaarheid' : 'Jouw afspraken en planning'}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canManageAvailability && (
              <button
                onClick={() => setShowAvailability(true)}
                className={T.btnSecondary}
              >
                <Cog6ToothIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Beschikbaarheid</span>
              </button>
            )}
            {canEdit && (
              <button
                onClick={openNewAppointment}
                className={T.btnPrimary}
              >
                <PlusIcon className="h-4 w-4" />
                Nieuwe afspraak
              </button>
            )}
          </div>
        }
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-1">
          <button onClick={goPrev} className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50" aria-label="Vorige">
            <ChevronLeftIcon className="mx-auto h-4 w-4" />
          </button>
          <button onClick={goToday} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Vandaag
          </button>
          <button onClick={goNext} className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50" aria-label="Volgende">
            <ChevronRightIcon className="mx-auto h-4 w-4" />
          </button>
        </div>
        <span className="ml-1 text-sm font-semibold text-slate-700">{headerLabel}</span>

        <div className="ml-auto">
          <ToggleGroup
            value={view}
            onChange={(v: 'week' | 'day') => setView(v)}
            options={[
              { value: 'day', label: 'Dag' },
              { value: 'week', label: 'Week' },
            ]}
            ariaLabel="Agenda-weergave"
          />
        </div>

        {canViewAll && team.length > 0 && (
          <select
            value={filterUserId}
            onChange={e => setFilterUserId(e.target.value as 'all' | 'unassigned' | string)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-brand-purple/50"
          >
            <option value="all">Alle adviseurs</option>
            <option value="unassigned">Niet toegewezen</option>
            {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
      </div>

      {/* Week view (desktop) */}
      {view === 'week' && (
        <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
          <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))]">
            <div className="border-b border-slate-200 bg-slate-50 p-2"></div>
            {days.map((d) => {
              const isToday = sameYMD(d, new Date());
              return (
                <div key={d.toISOString()} className={`border-b border-l border-slate-200 p-2 text-center ${isToday ? 'bg-brand-purple/5' : 'bg-slate-50'}`}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{DAY_SHORT[d.getDay()]}</div>
                  <div className={`text-sm font-bold ${isToday ? 'text-brand-purple' : 'text-slate-900'}`}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>

          <div className="relative grid grid-cols-[60px_repeat(7,minmax(0,1fr))]" style={{ height: `${(HOUR_END - HOUR_START) * 48}px` }}>
            {/* Hours column */}
            <div className="relative border-r border-slate-200">
              {HOURS.map(h => (
                <div key={h} className="flex h-12 items-start justify-end pr-1 text-[10px] font-medium text-slate-400">
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>
            {days.map((d) => {
              const dayAppts = apptsForDay(d);
              return (
                <div key={d.toISOString()} className="relative border-r border-slate-200">
                  {HOURS.map(h => (
                    <button
                      key={h}
                      disabled={!canEdit}
                      onClick={() => {
                        const start = new Date(d);
                        start.setHours(h, 0, 0, 0);
                        handleCreateSlot(start);
                      }}
                      className="block h-12 w-full border-b border-slate-100 transition hover:bg-brand-purple/5 disabled:hover:bg-transparent"
                    />
                  ))}
                  {dayAppts.map(a => {
                    const s = new Date(a.starts_at);
                    const minutesFromStart = (s.getHours() - HOUR_START) * 60 + s.getMinutes();
                    if (minutesFromStart < 0 || minutesFromStart >= (HOUR_END - HOUR_START) * 60) return null;
                    const top = (minutesFromStart / 60) * 48;
                    const height = Math.max(22, (a.duration_minutes / 60) * 48 - 2);
                    return (
                      <button
                        key={a.id}
                        onClick={() => setDetail(a)}
                        className={`absolute left-1 right-1 overflow-hidden rounded-md border px-1.5 py-1 text-left text-[11px] font-semibold shadow-sm hover:z-10 hover:shadow-md ${STATUS_STYLES[a.status] || STATUS_STYLES.scheduled}`}
                        style={{ top: `${top}px`, height: `${height}px` }}
                      >
                        <div className="truncate">{s.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</div>
                        <div className="truncate">{a.contact_name}</div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day / mobile week view as list */}
      <div className={view === 'week' ? 'space-y-2 md:hidden' : 'space-y-2'}>
        {view === 'day' ? (
          <DayList
            date={anchor}
            appts={apptsForDay(anchor)}
            loading={loading}
            branchNames={branchNames}
            onSelect={setDetail}
            onCreate={(t) => handleCreateSlot(t)}
            canEdit={canEdit}
          />
        ) : (
          days.map(d => (
            <DayList
              key={d.toISOString()}
              date={d}
              appts={apptsForDay(d)}
              loading={loading}
              branchNames={branchNames}
              onSelect={setDetail}
              onCreate={(t) => handleCreateSlot(t)}
              canEdit={canEdit}
              compact
            />
          ))
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showBook && bookSlot && (
          <BookAppointmentModal
            customer={customer}
            team={team}
            canViewAll={canViewAll}
            portalUser={portalUser}
            initialStart={bookSlot.start}
            initialPortalUserId={bookSlot.portalUserId ?? (portalUser?.role === 'agent' ? portalUser.id : null)}
            onClose={() => { setShowBook(false); setBookSlot(null); }}
            onCreated={() => { setShowBook(false); setBookSlot(null); load(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detail && (
          <AppointmentDetailModal
            appointment={detail}
            team={team}
            canEdit={canEdit}
            canViewAll={canViewAll}
            branchNames={branchNames}
            onClose={() => setDetail(null)}
            onUpdated={() => { setDetail(null); load(); }}
          />
        )}
      </AnimatePresence>

      {availabilityPortalReady &&
        createPortal(
          <AnimatePresence>
            {showAvailability && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/40"
                onClick={() => setShowAvailability(false)}
              >
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                  onClick={e => e.stopPropagation()}
                  className="absolute inset-y-0 right-0 flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl"
                >
                  <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur" style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}>
                    <div className="flex items-center gap-2">
                      <CalendarDaysIcon className="h-5 w-5 text-brand-purple" />
                      <h2 className="text-lg font-bold text-slate-900">Beschikbaarheid</h2>
                    </div>
                    <button type="button" onClick={() => setShowAvailability(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}>
                    <AvailabilityPanel
                      portalUserId={portalUser?.role === 'agent' ? portalUser.id : null}
                      canEdit={canManageAvailability}
                    />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

function DayList({
  date,
  appts,
  loading,
  branchNames,
  onSelect,
  onCreate,
  canEdit,
  compact = false,
}: {
  date: Date;
  appts: Appointment[];
  loading: boolean;
  branchNames: Record<string, string>;
  onSelect: (a: Appointment) => void;
  onCreate: (t: Date) => void;
  canEdit: boolean;
  compact?: boolean;
}) {
  const isToday = sameYMD(date, new Date());
  return (
    <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${compact ? '' : ''}`}>
      <header className={`flex items-center justify-between px-4 py-2.5 ${isToday ? 'bg-brand-purple/5' : 'bg-slate-50'}`}>
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className={`h-4 w-4 ${isToday ? 'text-brand-purple' : 'text-slate-400'}`} />
          <span className={`text-sm font-bold ${isToday ? 'text-brand-purple' : 'text-slate-900'}`}>
            {isToday ? 'Vandaag' : DAY_LONG[date.getDay()]}
          </span>
          <span className="text-xs text-slate-400">·</span>
          <span className="text-xs text-slate-500">{date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}</span>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              const now = new Date();
              const base = new Date(date);
              if (sameYMD(date, now)) base.setHours(now.getHours() + 1, 0, 0, 0);
              else base.setHours(9, 0, 0, 0);
              onCreate(base);
            }}
            className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-brand-purple"
            aria-label="Afspraak toevoegen"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        )}
      </header>
      <div className="divide-y divide-slate-100">
        {loading ? (
          <div className="p-4 text-sm text-slate-400">Laden...</div>
        ) : appts.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-slate-400">Geen afspraken</div>
        ) : (
          appts.map(a => {
            const s = new Date(a.starts_at);
            const e = new Date(s.getTime() + a.duration_minutes * 60_000);
            return (
              <button
                key={a.id}
                onClick={() => onSelect(a)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
              >
                <div className={`mt-0.5 flex h-10 w-14 shrink-0 flex-col items-center justify-center rounded-md border text-[11px] font-semibold ${STATUS_STYLES[a.status] || STATUS_STYLES.scheduled}`}>
                  <span>{s.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-[9px] opacity-75">{e.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{a.contact_name}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-500">
                    <span>{branchNames[a.branch] || a.branch}</span>
                    {a.city && (
                      <span className="flex items-center gap-1">
                        <MapPinIcon className="h-3 w-3" />
                        {a.city}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <ClockIcon className="h-3 w-3" />
                      {a.duration_minutes}min
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
