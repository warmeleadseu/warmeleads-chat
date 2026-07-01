'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { portalFetch } from '@/lib/portalAuth';
import {
  XMarkIcon,
  UserIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  ClockIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BoltIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import type { PortalCustomer, ClientPortalUser } from '../portalContext';

interface TeamMember { id: string; name: string; role: string }
interface Slot { start: string; end: string }

export default function BookAppointmentModal({
  customer,
  team,
  canViewAll,
  portalUser,
  initialStart,
  initialPortalUserId,
  initialLead,
  onClose,
  onCreated,
}: {
  customer: PortalCustomer;
  team: TeamMember[];
  canViewAll: boolean;
  portalUser: ClientPortalUser | null;
  initialStart: Date;
  initialPortalUserId: string | null;
  initialLead?: {
    lead_id?: string;
    lead_assignment_id?: string;
    contact_name?: string;
    contact_phone?: string;
    contact_email?: string;
    street?: string;
    house_number?: string;
    postcode?: string;
    city?: string;
    branch?: string;
  };
  onClose: () => void;
  onCreated: () => void;
}) {
  const branches = customer.branches || [];
  const [branch, setBranch] = useState<string>(initialLead?.branch || branches[0] || '');
  const [portalUserId, setPortalUserId] = useState<string | null>(initialPortalUserId);
  const [date, setDate] = useState<Date>(new Date(initialStart.getFullYear(), initialStart.getMonth(), initialStart.getDate()));
  const [selectedStart, setSelectedStart] = useState<string | null>(initialStart.toISOString());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [duration, setDuration] = useState<number>(60);
  const [buffer, setBuffer] = useState<number>(15);
  const [contactName, setContactName] = useState(initialLead?.contact_name || '');
  const [contactPhone, setContactPhone] = useState(initialLead?.contact_phone || '');
  const [contactEmail, setContactEmail] = useState(initialLead?.contact_email || '');
  const [street, setStreet] = useState(initialLead?.street || '');
  const [houseNumber, setHouseNumber] = useState(initialLead?.house_number || '');
  const [postcode, setPostcode] = useState(initialLead?.postcode || '');
  const [city, setCity] = useState(initialLead?.city || '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  // Load slots when date/user/branch changes
  const loadSlots = useCallback(async () => {
    if (!branch) return;
    setSlotsLoading(true);
    try {
      const from = new Date(date);
      from.setHours(0, 0, 0, 0);
      const to = new Date(date);
      to.setHours(23, 59, 59, 999);
      const q = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
        branch,
      });
      if (portalUserId) q.set('portal_user_id', portalUserId);
      const res = await portalFetch(`/api/portal/appointment-slots?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots || []);
        if (typeof data.duration === 'number') setDuration(data.duration);
        if (typeof data.buffer === 'number') setBuffer(data.buffer);
      }
    } finally {
      setSlotsLoading(false);
    }
  }, [date, portalUserId, branch]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const handleSubmit = async () => {
    if (!selectedStart || !contactName.trim() || !branch) return;
    setSubmitting(true);
    setErr(null);
    try {
      const res = await portalFetch('/api/portal/appointments', {
        method: 'POST',
        body: JSON.stringify({
          branch,
          portal_user_id: portalUserId,
          starts_at: selectedStart,
          duration_minutes: duration,
          travel_buffer_minutes: buffer,
          contact_name: contactName.trim(),
          contact_phone: contactPhone.trim() || undefined,
          contact_email: contactEmail.trim() || undefined,
          street: street.trim() || undefined,
          house_number: houseNumber.trim() || undefined,
          postcode: postcode.trim() || undefined,
          city: city.trim() || undefined,
          notes: notes.trim() || undefined,
          lead_id: initialLead?.lead_id,
          lead_assignment_id: initialLead?.lead_assignment_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Aanmaken mislukt');
        return;
      }
      onCreated();
    } finally {
      setSubmitting(false);
    }
  };

  // Maandag als eerste dag van de week (zelfde conventie als de agenda).
  const startOfWeek = (d: Date): Date => {
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    const day = r.getDay();
    r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day));
    return r;
  };

  // De datumstrip toont de volledige week (ma–zo) van de geselecteerde datum,
  // zodat hij overeenkomt met de week die in de agenda geopend was.
  const weekStart = startOfWeek(date);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const weekEnd = weekDays[6];

  // De pijltjes rechtsboven wisselen per week; de geselecteerde weekdag blijft
  // behouden (bv. dinsdag → dinsdag van de vorige/volgende week).
  const shiftWeek = (n: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n * 7);
    setDate(d);
  };

  const canShowAssignee = canViewAll && team.length > 0;

  if (typeof window === 'undefined') return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:bg-black/40 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%', opacity: 1 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 1 }}
        transition={{ type: 'spring', damping: 32, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="flex h-[100dvh] w-full flex-col bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:rounded-t-2xl" style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-pink">
              <CalendarDaysIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Afspraak plannen</h2>
              <p className="text-xs text-slate-500">Selecteer een tijdslot en vul details in</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="space-y-5">
            {/* Branch */}
            {branches.length > 1 && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Branche</label>
                <div className="flex flex-wrap gap-2">
                  {branches.map(b => (
                    <button
                      key={b}
                      onClick={() => setBranch(b)}
                      className={`min-h-10 rounded-xl border-2 px-3 py-1.5 text-sm font-semibold transition ${
                        branch === b
                          ? 'border-brand-purple bg-brand-purple/5 text-brand-purple'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Assignee */}
            {canShowAssignee && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Adviseur</label>
                <select
                  value={portalUserId || ''}
                  onChange={e => setPortalUserId(e.target.value || null)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                >
                  <option value="">-- Niet toegewezen --</option>
                  {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}

            {/* Date selector */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Datum</label>
                <div className="flex items-center gap-1">
                  <button onClick={() => shiftWeek(-1)} aria-label="Vorige week" className="h-8 w-8 rounded-lg border border-slate-200 hover:bg-slate-50">
                    <ChevronLeftIcon className="mx-auto h-3.5 w-3.5" />
                  </button>
                  <span className="px-2 text-xs font-semibold text-slate-700">
                    {weekStart.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} – {weekEnd.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                  </span>
                  <button onClick={() => shiftWeek(1)} aria-label="Volgende week" className="h-8 w-8 rounded-lg border border-slate-200 hover:bg-slate-50">
                    <ChevronRightIcon className="mx-auto h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {weekDays.map(d => {
                  const active = d.toDateString() === date.toDateString();
                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => setDate(d)}
                      className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border-2 text-center transition ${
                        active
                          ? 'border-brand-purple bg-brand-purple text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-[10px] font-semibold uppercase">{d.toLocaleDateString('nl-NL', { weekday: 'short' })}</span>
                      <span className="text-base font-bold">{d.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Slot picker */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Tijdslot ({duration} min)</label>
              {slotsLoading ? (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-400">
                  <BoltIcon className="mr-2 h-4 w-4 animate-pulse" />
                  Tijdsloten laden...
                </div>
              ) : slots.length === 0 ? (
                <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800">
                  Geen beschikbare slots op deze dag.
                  <p className="mt-1 text-xs">Controleer je beschikbaarheid of kies een andere datum.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                  {slots.map(s => {
                    const active = selectedStart === s.start;
                    return (
                      <button
                        key={s.start}
                        onClick={() => setSelectedStart(s.start)}
                        className={`h-10 rounded-lg border text-sm font-semibold transition ${
                          active
                            ? 'border-brand-purple bg-brand-purple text-white shadow-sm'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {new Date(s.start).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Contact details */}
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Contactgegevens</h3>
              <Field label="Naam *" icon={<UserIcon className="h-4 w-4" />}>
                <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Jan Jansen" className={inputCls} />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Telefoon" icon={<PhoneIcon className="h-4 w-4" />}>
                  <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="06..." className={inputCls} />
                </Field>
                <Field label="Email" icon={<EnvelopeIcon className="h-4 w-4" />}>
                  <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="..." className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                <Field label="Straat" icon={<MapPinIcon className="h-4 w-4" />}>
                  <input value={street} onChange={e => setStreet(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Nr.">
                  <input value={houseNumber} onChange={e => setHouseNumber(e.target.value)} className={`${inputCls} sm:w-20`} />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr]">
                <Field label="Postcode">
                  <input value={postcode} onChange={e => setPostcode(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Plaats">
                  <input value={city} onChange={e => setCity(e.target.value)} className={inputCls} />
                </Field>
              </div>
            </div>

            {/* Duration override */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Duur (min)" icon={<ClockIcon className="h-4 w-4" />}>
                <select value={duration} onChange={e => setDuration(parseInt(e.target.value))} className={inputCls}>
                  {[30, 45, 60, 75, 90, 120].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="Reistijd-buffer">
                <select value={buffer} onChange={e => setBuffer(parseInt(e.target.value))} className={inputCls}>
                  {[0, 15, 30, 45, 60].map(n => <option key={n} value={n}>{n} min</option>)}
                </select>
              </Field>
            </div>

            <Field label="Opmerkingen">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} placeholder="Optioneel..." />
            </Field>

            {err && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {err}
              </div>
            )}
          </div>
        </div>

        <footer className="flex items-center gap-2 border-t border-slate-200 bg-white px-5 py-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
          <button onClick={onClose} className="h-11 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-initial sm:px-5">
            Annuleren
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedStart || !contactName.trim() || !branch}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink px-5 text-sm font-bold text-white shadow-sm transition hover:shadow-md disabled:opacity-50 disabled:shadow-none"
          >
            {submitting ? (
              <>Bezig...</>
            ) : (
              <><CheckCircleIcon className="h-4 w-4" /> Afspraak inplannen</>
            )}
          </button>
        </footer>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

const inputCls = "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-purple/50";

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}
