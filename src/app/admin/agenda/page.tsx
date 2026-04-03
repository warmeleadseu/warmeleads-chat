'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminFetch } from '@/lib/adminAuth';
import {
  CalendarDaysIcon,
  ClockIcon,
  UserIcon,
  PhoneIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
  TrashIcon,
  XCircleIcon,
  CheckCircleIcon,
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline';

/* ── Types ── */
interface Booking {
  id: string;
  date: string;
  time: string;
  name: string;
  company: string | null;
  email: string;
  phone: string;
  branch: string | null;
  message: string | null;
  status: string;
  created_at: string;
}

interface BlockedDate {
  id: string;
  date: string;
  time: string | null;
  reason: string | null;
}

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

interface Schedule {
  days: Record<string, DaySchedule>;
  lunch: { enabled: boolean; start: string; end: string };
  slotDuration: number;
}

/* ── Constants ── */
const TABS = ['Overzicht', 'Boekingen', 'Beschikbaarheid'] as const;
const DAYS_NL = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const MONTHS_NL = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'];
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Maandag', tuesday: 'Dinsdag', wednesday: 'Woensdag', thursday: 'Donderdag',
  friday: 'Vrijdag', saturday: 'Zaterdag', sunday: 'Zondag',
};

const DEFAULT_SCHEDULE: Schedule = {
  days: {
    monday:    { enabled: true,  start: '09:00', end: '17:00' },
    tuesday:   { enabled: true,  start: '09:00', end: '17:00' },
    wednesday: { enabled: true,  start: '09:00', end: '17:00' },
    thursday:  { enabled: true,  start: '09:00', end: '17:00' },
    friday:    { enabled: true,  start: '09:00', end: '17:00' },
    saturday:  { enabled: false, start: '09:00', end: '17:00' },
    sunday:    { enabled: false, start: '09:00', end: '17:00' },
  },
  lunch: { enabled: true, start: '12:30', end: '13:00' },
  slotDuration: 30,
};

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstWeekday(y: number, m: number) { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; }
function fmtDate(d: string) { return new Date(d + 'T00:00:00').toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }); }

/* ── Page ── */
export default function AgendaPage() {
  const [tab, setTab] = useState<typeof TABS[number]>('Overzicht');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [schedule, setSchedule] = useState<Schedule>(DEFAULT_SCHEDULE);
  const [blocked, setBlocked] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [blockForm, setBlockForm] = useState({ date: '', reason: '' });
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, aRes] = await Promise.all([
        adminFetch('/api/admin/bookings'),
        adminFetch('/api/admin/bookings/availability'),
      ]);
      const bData = await bRes.json();
      const aData = await aRes.json();
      setBookings(bData.bookings || []);
      if (aData.schedule) setSchedule(aData.schedule);
      setBlocked(aData.blocked || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Actions ── */
  const cancelBooking = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze afspraak wilt annuleren? De klant ontvangt een e-mail.')) return;
    const res = await adminFetch('/api/admin/bookings', {
      method: 'PATCH',
      body: JSON.stringify({ id, status: 'geannuleerd' }),
    });
    if (res.ok) { showToast('Afspraak geannuleerd'); loadData(); }
  };

  const deleteBooking = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze boeking definitief wilt verwijderen?')) return;
    const res = await adminFetch('/api/admin/bookings', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
    if (res.ok) { showToast('Boeking verwijderd'); loadData(); }
  };

  const saveSchedule = async (newSchedule: Schedule) => {
    setSaving(true);
    const res = await adminFetch('/api/admin/bookings/availability', {
      method: 'POST',
      body: JSON.stringify({ type: 'schedule', value: newSchedule }),
    });
    if (res.ok) { setSchedule(newSchedule); showToast('Beschikbaarheid opgeslagen'); }
    setSaving(false);
  };

  const addBlock = async () => {
    if (!blockForm.date) return;
    const res = await adminFetch('/api/admin/bookings/availability', {
      method: 'POST',
      body: JSON.stringify({ type: 'block', date: blockForm.date, reason: blockForm.reason || null }),
    });
    if (res.ok) {
      setBlockForm({ date: '', reason: '' });
      showToast('Dag geblokkeerd');
      loadData();
    }
  };

  const removeBlock = async (id: string) => {
    const res = await adminFetch('/api/admin/bookings/availability', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
    if (res.ok) { showToast('Blokkering verwijderd'); loadData(); }
  };

  /* ── Derived ── */
  const today = new Date().toISOString().split('T')[0];
  const upcomingBookings = bookings
    .filter(b => b.date >= today && b.status === 'bevestigd')
    .slice(0, 10);

  const bookingsOnDate = selectedDate
    ? bookings.filter(b => b.date === selectedDate)
    : [];

  const blockedDates = new Set(blocked.filter(b => !b.time).map(b => b.date));

  const bookingDates: Record<string, number> = {};
  bookings.filter(b => b.status === 'bevestigd').forEach(b => {
    bookingDates[b.date] = (bookingDates[b.date] || 0) + 1;
  });

  const filteredBookings = bookings.filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (searchFilter) {
      const s = searchFilter.toLowerCase();
      return b.name.toLowerCase().includes(s) || b.email.toLowerCase().includes(s) || (b.company || '').toLowerCase().includes(s) || b.phone.includes(s);
    }
    return true;
  });

  /* ── Calendar helpers ── */
  const totalDays = daysInMonth(calYear, calMonth);
  const firstDay = firstWeekday(calYear, calMonth);
  const canGoPrev = calYear > now.getFullYear() || (calYear === now.getFullYear() && calMonth > now.getMonth());

  const prevMonth = () => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Toast */}
      {toast && (
        <div className="fixed right-4 top-4 z-50 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 md:text-2xl">Agenda</h1>
          <p className="mt-0.5 text-sm text-slate-500">Beheer je strategiegesprekken en beschikbaarheid</p>
        </div>
        <div className="flex gap-2">
          {upcomingBookings.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-purple/10 px-3 py-1 text-xs font-semibold text-brand-purple">
              <CalendarDaysIcon className="h-3.5 w-3.5" />
              {upcomingBookings.length} aankomend
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition sm:text-sm ${
              tab === t ? 'bg-white text-brand-purple shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ═══ TAB: Overzicht ═══ */}
      {tab === 'Overzicht' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Calendar */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <button onClick={prevMonth} disabled={!canGoPrev} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-30">
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <h3 className="text-sm font-semibold text-slate-900">{MONTHS_NL[calMonth]} {calYear}</h3>
              <button onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50">
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-1.5 grid grid-cols-7 gap-1">
              {DAYS_NL.map(d => (
                <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: totalDays }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${calYear}-${(calMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                const isBlocked = blockedDates.has(dateStr);
                const count = bookingDates[dateStr] || 0;
                const isSelected = selectedDate === dateStr;
                const isToday = dateStr === today;

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                    className={`relative flex h-10 flex-col items-center justify-center rounded-lg text-xs font-medium transition md:h-11 ${
                      isSelected
                        ? 'bg-brand-purple text-white shadow-sm'
                        : isBlocked
                          ? 'bg-red-50 text-red-400'
                          : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{day}</span>
                    <div className="absolute bottom-1 flex gap-0.5">
                      {count > 0 && <span className={`h-1 w-1 rounded-full ${isSelected ? 'bg-white' : 'bg-brand-purple'}`} />}
                      {isBlocked && <span className={`h-1 w-1 rounded-full ${isSelected ? 'bg-white' : 'bg-red-400'}`} />}
                    </div>
                    {isToday && !isSelected && <span className="absolute right-1 top-1 h-1 w-1 rounded-full bg-brand-orange" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-brand-purple" /> Boeking</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Geblokkeerd</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-brand-orange" /> Vandaag</span>
            </div>

            {/* Bookings for selected date */}
            {selectedDate && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <h4 className="mb-2 text-xs font-semibold text-slate-600">
                  {fmtDate(selectedDate)} {blockedDates.has(selectedDate) && <span className="ml-1 text-red-500">(geblokkeerd)</span>}
                </h4>
                {bookingsOnDate.length === 0 ? (
                  <p className="text-xs text-slate-400">Geen afspraken op deze dag</p>
                ) : (
                  <div className="space-y-2">
                    {bookingsOnDate.map(b => (
                      <div key={b.id} className={`flex items-center justify-between rounded-lg border p-2.5 ${b.status === 'geannuleerd' ? 'border-red-100 bg-red-50/50' : 'border-slate-100 bg-slate-50'}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-brand-purple">{b.time}</span>
                            <span className="truncate text-xs font-semibold text-slate-800">{b.name}</span>
                          </div>
                          {b.company && <p className="text-[10px] text-slate-400">{b.company}</p>}
                        </div>
                        {b.status === 'bevestigd' && (
                          <button onClick={() => cancelBooking(b.id)} className="ml-2 shrink-0 rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-500" title="Annuleren">
                            <XCircleIcon className="h-4 w-4" />
                          </button>
                        )}
                        {b.status === 'geannuleerd' && (
                          <span className="ml-2 shrink-0 text-[10px] font-medium text-red-400">Geannuleerd</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Upcoming bookings */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
              <ClockIcon className="h-4 w-4 text-brand-purple" />
              Aankomende afspraken
            </h3>
            {upcomingBookings.length === 0 ? (
              <div className="rounded-lg bg-slate-50 py-8 text-center">
                <CalendarDaysIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                <p className="text-xs font-medium text-slate-500">Geen aankomende afspraken</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingBookings.map(b => (
                  <div key={b.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 transition hover:border-brand-purple/20">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-brand-purple">
                        {fmtDate(b.date)} - {b.time}
                      </span>
                      <button onClick={() => cancelBooking(b.id)} className="rounded p-0.5 text-slate-300 transition hover:text-red-500" title="Annuleren">
                        <XCircleIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{b.name}</p>
                    {b.company && <p className="text-[11px] text-slate-400">{b.company}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a href={`tel:${b.phone}`} className="inline-flex items-center gap-1 rounded bg-brand-purple/5 px-2 py-0.5 text-[10px] font-medium text-brand-purple transition hover:bg-brand-purple/10">
                        <PhoneIcon className="h-2.5 w-2.5" /> {b.phone}
                      </a>
                      <a href={`mailto:${b.email}`} className="inline-flex items-center gap-1 rounded bg-brand-purple/5 px-2 py-0.5 text-[10px] font-medium text-brand-purple transition hover:bg-brand-purple/10">
                        <EnvelopeIcon className="h-2.5 w-2.5" /> {b.email}
                      </a>
                    </div>
                    {b.branch && (
                      <span className="mt-1.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{b.branch}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB: Boekingen ═══ */}
      {tab === 'Boekingen' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Zoek op naam, e-mail, bedrijf..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20 sm:max-w-xs"
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
            >
              <option value="all">Alle statussen</option>
              <option value="bevestigd">Bevestigd</option>
              <option value="geannuleerd">Geannuleerd</option>
            </select>
            <span className="text-xs text-slate-400">{filteredBookings.length} resultaten</span>
          </div>

          {filteredBookings.length === 0 ? (
            <div className="py-12 text-center">
              <CalendarDaysIcon className="mx-auto mb-2 h-10 w-10 text-slate-200" />
              <p className="text-sm text-slate-400">Geen boekingen gevonden</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-400">
                      <th className="px-4 py-3 font-semibold">Datum</th>
                      <th className="px-4 py-3 font-semibold">Tijd</th>
                      <th className="px-4 py-3 font-semibold">Naam</th>
                      <th className="px-4 py-3 font-semibold">Bedrijf</th>
                      <th className="px-4 py-3 font-semibold">Contact</th>
                      <th className="px-4 py-3 font-semibold">Branche</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Acties</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map(b => (
                      <tr key={b.id} className={`border-b border-slate-50 transition hover:bg-slate-50/50 ${b.status === 'geannuleerd' ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3 font-medium text-slate-800">{fmtDate(b.date)}</td>
                        <td className="px-4 py-3 font-semibold text-brand-purple">{b.time}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{b.name}</td>
                        <td className="px-4 py-3 text-slate-500">{b.company || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <a href={`tel:${b.phone}`} className="text-xs text-brand-purple hover:underline">{b.phone}</a>
                            <a href={`mailto:${b.email}`} className="text-xs text-slate-400 hover:underline">{b.email}</a>
                          </div>
                        </td>
                        <td className="px-4 py-3">{b.branch ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{b.branch}</span> : '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            b.status === 'bevestigd' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                          }`}>
                            {b.status === 'bevestigd' ? <CheckCircleIcon className="h-3 w-3" /> : <XCircleIcon className="h-3 w-3" />}
                            {b.status === 'bevestigd' ? 'Bevestigd' : 'Geannuleerd'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {b.status === 'bevestigd' && (
                              <button onClick={() => cancelBooking(b.id)} className="rounded p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500" title="Annuleren">
                                <XCircleIcon className="h-4 w-4" />
                              </button>
                            )}
                            <button onClick={() => deleteBooking(b.id)} className="rounded p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500" title="Verwijderen">
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-2 p-3 md:hidden">
                {filteredBookings.map(b => (
                  <div key={b.id} className={`rounded-lg border p-3 ${b.status === 'geannuleerd' ? 'border-red-100 bg-red-50/30 opacity-60' : 'border-slate-100'}`}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-brand-purple">{fmtDate(b.date)} - {b.time}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${b.status === 'bevestigd' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                        {b.status === 'bevestigd' ? 'Bevestigd' : 'Geannuleerd'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{b.name}</p>
                    {b.company && <p className="text-[11px] text-slate-400">{b.company}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a href={`tel:${b.phone}`} className="inline-flex items-center gap-1 text-[11px] text-brand-purple"><PhoneIcon className="h-3 w-3" /> {b.phone}</a>
                      <a href={`mailto:${b.email}`} className="inline-flex items-center gap-1 text-[11px] text-slate-400"><EnvelopeIcon className="h-3 w-3" /> {b.email}</a>
                    </div>
                    <div className="mt-2 flex justify-end gap-1">
                      {b.status === 'bevestigd' && (
                        <button onClick={() => cancelBooking(b.id)} className="rounded p-1.5 text-slate-400 hover:text-red-500"><XCircleIcon className="h-4 w-4" /></button>
                      )}
                      <button onClick={() => deleteBooking(b.id)} className="rounded p-1.5 text-slate-400 hover:text-red-500"><TrashIcon className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ TAB: Beschikbaarheid ═══ */}
      {tab === 'Beschikbaarheid' && (
        <div className="space-y-6">
          {/* Weekly schedule */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
            <h3 className="mb-1 text-sm font-bold text-slate-900">Standaard werkdagen</h3>
            <p className="mb-4 text-xs text-slate-400">Stel in op welke dagen en tijden je beschikbaar bent voor gesprekken.</p>

            <div className="space-y-2">
              {DAY_KEYS.map(key => {
                const day = schedule.days[key] || { enabled: false, start: '09:00', end: '17:00' };
                return (
                  <div key={key} className={`flex items-center gap-3 rounded-lg border p-3 transition ${day.enabled ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50/50'}`}>
                    <button
                      onClick={() => {
                        const upd = { ...schedule, days: { ...schedule.days, [key]: { ...day, enabled: !day.enabled } } };
                        saveSchedule(upd);
                      }}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 transition ${
                        day.enabled ? 'border-brand-purple bg-brand-purple text-white' : 'border-slate-300 text-transparent'
                      }`}
                    >
                      {day.enabled && <CheckCircleIcon className="h-4 w-4" />}
                    </button>
                    <span className={`w-24 text-sm font-semibold ${day.enabled ? 'text-slate-800' : 'text-slate-400'}`}>{DAY_LABELS[key]}</span>
                    {day.enabled ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={day.start}
                          onChange={e => {
                            const upd = { ...schedule, days: { ...schedule.days, [key]: { ...day, start: e.target.value } } };
                            saveSchedule(upd);
                          }}
                          className="rounded border border-slate-200 px-2 py-1 text-xs"
                        />
                        <span className="text-xs text-slate-400">tot</span>
                        <input
                          type="time"
                          value={day.end}
                          onChange={e => {
                            const upd = { ...schedule, days: { ...schedule.days, [key]: { ...day, end: e.target.value } } };
                            saveSchedule(upd);
                          }}
                          className="rounded border border-slate-200 px-2 py-1 text-xs"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Niet beschikbaar</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lunch break */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Lunchpauze</h3>
                <p className="text-xs text-slate-400">Blokkeer automatisch een tijdsblok voor lunch.</p>
              </div>
              <button
                onClick={() => {
                  const upd = { ...schedule, lunch: { ...schedule.lunch, enabled: !schedule.lunch.enabled } };
                  saveSchedule(upd);
                }}
                className={`relative h-6 w-11 rounded-full transition ${schedule.lunch.enabled ? 'bg-brand-purple' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${schedule.lunch.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {schedule.lunch.enabled && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="time"
                  value={schedule.lunch.start}
                  onChange={e => saveSchedule({ ...schedule, lunch: { ...schedule.lunch, start: e.target.value } })}
                  className="rounded border border-slate-200 px-2 py-1 text-xs"
                />
                <span className="text-xs text-slate-400">tot</span>
                <input
                  type="time"
                  value={schedule.lunch.end}
                  onChange={e => saveSchedule({ ...schedule, lunch: { ...schedule.lunch, end: e.target.value } })}
                  className="rounded border border-slate-200 px-2 py-1 text-xs"
                />
              </div>
            )}
          </div>

          {/* Slot duration */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
            <h3 className="mb-1 text-sm font-bold text-slate-900">Slot duur</h3>
            <p className="mb-3 text-xs text-slate-400">Hoe lang duurt een tijdslot in de kalender?</p>
            <select
              value={schedule.slotDuration}
              onChange={e => saveSchedule({ ...schedule, slotDuration: Number(e.target.value) })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
            >
              <option value={15}>15 minuten</option>
              <option value={30}>30 minuten</option>
              <option value={45}>45 minuten</option>
              <option value={60}>60 minuten</option>
            </select>
          </div>

          {/* Blocked dates */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
            <h3 className="mb-1 text-sm font-bold text-slate-900">Geblokkeerde dagen</h3>
            <p className="mb-4 text-xs text-slate-400">Blokkeer specifieke dagen waarop je niet beschikbaar bent (feestdagen, vakantie, etc.).</p>

            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
              <input
                type="date"
                value={blockForm.date}
                onChange={e => setBlockForm(f => ({ ...f, date: e.target.value }))}
                min={today}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
              />
              <input
                type="text"
                value={blockForm.reason}
                onChange={e => setBlockForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Reden (optioneel)"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
              />
              <button
                onClick={addBlock}
                disabled={!blockForm.date}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-40"
              >
                <NoSymbolIcon className="h-4 w-4" />
                Blokkeer dag
              </button>
            </div>

            {blocked.filter(b => !b.time).length === 0 ? (
              <p className="text-xs text-slate-400">Geen geblokkeerde dagen</p>
            ) : (
              <div className="space-y-1.5">
                {blocked.filter(b => !b.time).map(b => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <ExclamationTriangleIcon className="h-4 w-4 text-red-400" />
                      <span className="text-sm font-medium text-slate-800">{fmtDate(b.date)}</span>
                      {b.reason && <span className="text-xs text-slate-400">{b.reason}</span>}
                    </div>
                    <button onClick={() => removeBlock(b.id)} className="rounded p-1 text-slate-400 transition hover:text-red-500" title="Verwijderen">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {saving && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-brand-purple" />
              Opslaan...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
