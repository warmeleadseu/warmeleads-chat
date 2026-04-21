'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { adminFetch } from '@/lib/adminAuth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
  ClockIcon,
  UserIcon,
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  PencilSquareIcon,
  PlusIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import AdminAppointmentBookModal from './AdminAppointmentBookModal';
import AdminAppointmentDetail from './AdminAppointmentDetail';

interface Customer { id: string; name: string }
interface BranchOption { slug: string; name: string }

export interface AdminAppointment {
  id: string;
  customer_id: string;
  portal_user_id: string | null;
  branch: string;
  batch_id: string | null;
  lead_id: string | null;
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
  status: string;
  notes: string | null;
  source: string;
  customers?: { id: string; name: string } | null;
  portal_users?: { id: string; name: string } | null;
}

const STATUS_DOT: Record<string, string> = {
  scheduled: 'bg-indigo-500',
  completed: 'bg-emerald-500',
  no_show: 'bg-rose-500',
  cancelled: 'bg-slate-400',
  rescheduled: 'bg-amber-500',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Ingepland',
  completed: 'Voltooid',
  no_show: 'No-show',
  cancelled: 'Geannuleerd',
  rescheduled: 'Verzet',
};

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  return r;
}

function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function sameYMD(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function AdminAppointmentsPage() {
  const [view, setView] = useState<'week' | 'day' | 'list'>('week');
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showBook, setShowBook] = useState(false);
  const [bookPrefill, setBookPrefill] = useState<{ start?: Date; customerId?: string } | null>(null);
  const [detail, setDetail] = useState<AdminAppointment | null>(null);

  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const rangeStart = useMemo(() => {
    if (view === 'day') return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    if (view === 'week') return weekStart;
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return addDays(t, -7);
  }, [view, weekStart, anchor]);

  const rangeEnd = useMemo(() => {
    if (view === 'day') return addDays(rangeStart, 1);
    if (view === 'week') return addDays(weekStart, 7);
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return addDays(t, 60);
  }, [view, weekStart, rangeStart]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        from: rangeStart.toISOString(),
        to: rangeEnd.toISOString(),
        limit: '500',
      });
      if (customerFilter !== 'all') q.set('customer_id', customerFilter);
      if (statusFilter !== 'all') q.set('status', statusFilter);
      if (branchFilter !== 'all') q.set('branch', branchFilter);
      const res = await adminFetch(`/api/admin/appointments?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAppointments(Array.isArray(data) ? data : []);
      } else {
        setAppointments([]);
      }
    } finally {
      setLoading(false);
    }
  }, [rangeStart, rangeEnd, customerFilter, statusFilter, branchFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    adminFetch('/api/admin/customers?is_active=true').then(r => r.ok ? r.json() : null).then(d => {
      if (Array.isArray(d)) setCustomers(d.map((c: Customer) => ({ id: c.id, name: c.name })));
      else if (d?.customers) setCustomers(d.customers.map((c: Customer) => ({ id: c.id, name: c.name })));
    }).catch(() => {});
    adminFetch('/api/admin/branches').then(r => r.ok ? r.json() : null).then(d => {
      if (Array.isArray(d)) setBranches(d);
      else if (d?.branches) setBranches(d.branches);
    }).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return appointments;
    const s = search.toLowerCase();
    return appointments.filter(a =>
      a.contact_name.toLowerCase().includes(s) ||
      a.contact_phone?.toLowerCase().includes(s) ||
      a.city?.toLowerCase().includes(s) ||
      a.customers?.name.toLowerCase().includes(s),
    );
  }, [appointments, search]);

  const byDay = useMemo(() => {
    const m = new Map<string, AdminAppointment[]>();
    for (const a of filtered) {
      const d = new Date(a.starts_at);
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = m.get(k) || [];
      arr.push(a);
      m.set(k, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    return m;
  }, [filtered]);

  function apptsForDay(d: Date) {
    return byDay.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) || [];
  }

  const shift = (n: number) => setAnchor(view === 'day' ? addDays(anchor, n) : addDays(anchor, n * 7));
  const goToday = () => setAnchor(new Date());

  const headerLabel = view === 'week'
    ? `${days[0].toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} — ${days[6].toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : view === 'day'
    ? anchor.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : `${rangeStart.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} — ${rangeEnd.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`;

  const customerNameById = useMemo(() => {
    const m: Record<string, string> = {};
    customers.forEach(c => { m[c.id] = c.name; });
    return m;
  }, [customers]);

  const branchNameById = useMemo(() => {
    const m: Record<string, string> = {};
    branches.forEach(b => { m[b.slug] = b.name; });
    return m;
  }, [branches]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Afspraken</h1>
          <p className="mt-0.5 text-sm text-slate-500">Plan en beheer klant-afspraken · {filtered.length} in zicht</p>
        </div>
        <button
          onClick={() => { setBookPrefill(null); setShowBook(true); }}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink px-4 text-sm font-bold text-white shadow-sm hover:shadow-md"
        >
          <PlusIcon className="h-4 w-4" />
          Nieuwe afspraak
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
            <ChevronLeftIcon className="mx-auto h-4 w-4" />
          </button>
          <button onClick={goToday} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Vandaag</button>
          <button onClick={() => shift(1)} className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
            <ChevronRightIcon className="mx-auto h-4 w-4" />
          </button>
        </div>
        <span className="ml-1 text-sm font-semibold text-slate-700">{headerLabel}</span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Zoek naam, plaats..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm outline-none focus:border-brand-purple/50 sm:w-56"
            />
          </div>
          <select value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm">
            <option value="all">Alle klanten</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm">
            <option value="all">Alle branches</option>
            {branches.map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm">
            <option value="all">Alle statussen</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {[['day', 'Dag'], ['week', 'Week'], ['list', 'Lijst']].map(([v, lbl]) => (
              <button
                key={v}
                onClick={() => setView(v as 'day' | 'week' | 'list')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${view === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Week grid */}
      {view === 'week' && (
        <div className="overflow-x-auto">
          <div className="grid min-w-[900px] grid-cols-7 gap-2">
            {days.map(d => {
              const dayAppts = apptsForDay(d);
              const today = sameYMD(d, new Date());
              return (
                <div key={d.toISOString()} className={`rounded-2xl border shadow-sm ${today ? 'border-brand-purple/40 bg-brand-purple/5' : 'border-slate-200 bg-white'}`}>
                  <header className="border-b border-slate-200 px-3 py-2">
                    <p className={`text-[11px] font-semibold uppercase tracking-wider ${today ? 'text-brand-purple' : 'text-slate-500'}`}>
                      {d.toLocaleDateString('nl-NL', { weekday: 'short' })}
                    </p>
                    <p className={`text-base font-bold ${today ? 'text-brand-purple' : 'text-slate-900'}`}>{d.getDate()}</p>
                  </header>
                  <div className="max-h-[600px] space-y-1.5 overflow-y-auto p-2">
                    {dayAppts.length === 0 ? (
                      <button
                        onClick={() => {
                          const t = new Date(d); t.setHours(9, 0, 0, 0);
                          setBookPrefill({ start: t }); setShowBook(true);
                        }}
                        className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 py-4 text-[11px] text-slate-400 hover:bg-slate-50"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                        Geen afspraken
                      </button>
                    ) : dayAppts.map(a => {
                      const s = new Date(a.starts_at);
                      return (
                        <button
                          key={a.id}
                          onClick={() => setDetail(a)}
                          className="flex w-full items-start gap-2 rounded-lg border border-slate-200 bg-white p-2 text-left shadow-sm transition hover:border-brand-purple/40 hover:shadow-md"
                        >
                          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[a.status]}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-slate-500">
                              {s.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })} · {a.duration_minutes}min
                            </p>
                            <p className="truncate text-xs font-bold text-slate-900">{a.contact_name}</p>
                            <p className="truncate text-[11px] text-slate-500">
                              {a.customers?.name || customerNameById[a.customer_id]}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day view */}
      {view === 'day' && (
        <DayListAdmin
          date={anchor}
          appts={apptsForDay(anchor)}
          loading={loading}
          customerNameById={customerNameById}
          branchNameById={branchNameById}
          onSelect={setDetail}
          onCreate={(t) => { setBookPrefill({ start: t }); setShowBook(true); }}
        />
      )}

      {/* List view */}
      {view === 'list' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-6 text-sm text-slate-400">Laden...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">Geen afspraken</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map(a => {
                const s = new Date(a.starts_at);
                return (
                  <button
                    key={a.id}
                    onClick={() => setDetail(a)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[a.status]}`} />
                    <div className="min-w-14 w-16 shrink-0 text-xs">
                      <p className="font-semibold text-slate-900">{s.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</p>
                      <p className="text-slate-500">{s.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{a.contact_name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {a.customers?.name || customerNameById[a.customer_id]} · {branchNameById[a.branch] || a.branch}
                        {a.city ? ` · ${a.city}` : ''}
                      </p>
                    </div>
                    <span className="hidden text-xs text-slate-400 sm:block">{STATUS_LABELS[a.status]}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showBook && (
          <AdminAppointmentBookModal
            customers={customers}
            branches={branches}
            prefillCustomerId={bookPrefill?.customerId}
            prefillStart={bookPrefill?.start}
            onClose={() => setShowBook(false)}
            onCreated={() => { setShowBook(false); load(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detail && (
          <AdminAppointmentDetail
            appointment={detail}
            customers={customers}
            branches={branches}
            onClose={() => setDetail(null)}
            onUpdated={() => { setDetail(null); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function DayListAdmin({
  date, appts, loading, customerNameById, branchNameById, onSelect, onCreate,
}: {
  date: Date;
  appts: AdminAppointment[];
  loading: boolean;
  customerNameById: Record<string, string>;
  branchNameById: Record<string, string>;
  onSelect: (a: AdminAppointment) => void;
  onCreate: (t: Date) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-bold text-slate-900">{date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </div>
        <button
          onClick={() => { const t = new Date(date); t.setHours(9, 0, 0, 0); onCreate(t); }}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Toevoegen
        </button>
      </header>
      <div className="divide-y divide-slate-100">
        {loading ? (
          <div className="p-4 text-sm text-slate-400">Laden...</div>
        ) : appts.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-slate-400">Geen afspraken vandaag</div>
        ) : appts.map(a => {
          const s = new Date(a.starts_at);
          const e = new Date(s.getTime() + a.duration_minutes * 60_000);
          return (
            <button
              key={a.id}
              onClick={() => onSelect(a)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
            >
              <div className={`flex h-11 w-16 shrink-0 flex-col items-center justify-center rounded-md text-[11px] font-semibold text-white ${a.status === 'scheduled' ? 'bg-indigo-500' : a.status === 'completed' ? 'bg-emerald-500' : a.status === 'no_show' ? 'bg-rose-500' : 'bg-slate-400'}`}>
                <span>{s.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-[9px] opacity-80">{e.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{a.contact_name}</p>
                <p className="truncate text-xs text-slate-500">
                  {a.customers?.name || customerNameById[a.customer_id]} · {branchNameById[a.branch] || a.branch}
                  {a.city ? ` · ${a.city}` : ''}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
