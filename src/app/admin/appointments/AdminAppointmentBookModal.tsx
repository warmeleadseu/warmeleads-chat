'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { adminFetch } from '@/lib/adminAuth';
import {
  XMarkIcon, UserIcon, PhoneIcon, EnvelopeIcon, MapPinIcon,
  CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, CheckCircleIcon, BoltIcon,
} from '@heroicons/react/24/outline';
import SearchableSelect from '@/components/ui/SearchableSelect';

interface Customer { id: string; name: string }
interface BranchOption { slug: string; name: string }
interface Slot { start: string; end: string }
interface TeamMember { id: string; name: string; role: string }

export default function AdminAppointmentBookModal({
  customers,
  branches,
  prefillCustomerId,
  prefillStart,
  onClose,
  onCreated,
}: {
  customers: Customer[];
  branches: BranchOption[];
  prefillCustomerId?: string;
  prefillStart?: Date;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [customerId, setCustomerId] = useState<string>(prefillCustomerId || customers[0]?.id || '');
  const [branch, setBranch] = useState<string>(branches[0]?.slug || '');
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [portalUserId, setPortalUserId] = useState<string | null>(null);
  const [date, setDate] = useState<Date>(prefillStart ? new Date(prefillStart.getFullYear(), prefillStart.getMonth(), prefillStart.getDate()) : new Date());
  const [selectedStart, setSelectedStart] = useState<string | null>(prefillStart ? prefillStart.toISOString() : null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [duration, setDuration] = useState<number>(60);
  const [buffer, setBuffer] = useState<number>(15);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [postcode, setPostcode] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    if (!customerId) { setTeam([]); setPortalUserId(null); return; }
    adminFetch(`/api/admin/portal-users?customer_id=${customerId}`).then(r => r.ok ? r.json() : null).then(data => {
      const list = (data?.users || data || []).filter((u: TeamMember & { is_active?: boolean }) => u.is_active !== false);
      setTeam(list.map((m: TeamMember) => ({ id: m.id, name: m.name, role: m.role })));
    }).catch(() => setTeam([]));
  }, [customerId]);

  const loadSlots = useCallback(async () => {
    if (!customerId || !branch) return;
    setSlotsLoading(true);
    try {
      const from = new Date(date); from.setHours(0, 0, 0, 0);
      const to = new Date(date); to.setHours(23, 59, 59, 999);
      const q = new URLSearchParams({
        customer_id: customerId,
        from: from.toISOString(),
        to: to.toISOString(),
        branch,
      });
      if (portalUserId) q.set('portal_user_id', portalUserId);
      const res = await adminFetch(`/api/admin/appointment-slots?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots || []);
        if (typeof data.duration === 'number') setDuration(data.duration);
        if (typeof data.buffer === 'number') setBuffer(data.buffer);
      }
    } finally {
      setSlotsLoading(false);
    }
  }, [customerId, branch, portalUserId, date]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const handleSubmit = async () => {
    if (!customerId || !selectedStart || !contactName.trim() || !branch) return;
    setSubmitting(true);
    setErr(null);
    try {
      const res = await adminFetch('/api/admin/appointments', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: customerId,
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
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Aanmaken mislukt'); return; }
      onCreated();
    } finally {
      setSubmitting(false);
    }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(today); d.setDate(today.getDate() + i); return d;
  });

  if (typeof window === 'undefined') return null;

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:bg-black/40 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
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
              <p className="text-xs text-slate-500">Selecteer klant, branche en tijdslot</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Klant *">
                <SearchableSelect
                  value={customerId}
                  onChange={v => setCustomerId(v)}
                  options={customers.map(c => ({ value: c.id, label: c.name }))}
                  placeholder="-- Kies klant --"
                  searchPlaceholder="Zoek klant…"
                  ariaLabel="Klant"
                />
              </Field>
              <Field label="Branche *">
                <select value={branch} onChange={e => setBranch(e.target.value)} className={inputCls}>
                  {branches.map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}
                </select>
              </Field>
            </div>

            {team.length > 0 && (
              <Field label="Adviseur">
                <select value={portalUserId || ''} onChange={e => setPortalUserId(e.target.value || null)} className={inputCls}>
                  <option value="">-- Niet toegewezen --</option>
                  {team.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                </select>
              </Field>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Datum</label>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {weekDays.map(d => {
                  const active = d.toDateString() === date.toDateString();
                  return (
                    <button key={d.toISOString()} onClick={() => setDate(d)}
                      className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border-2 text-center transition ${
                        active ? 'border-brand-purple bg-brand-purple text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700'
                      }`}>
                      <span className="text-[10px] font-semibold uppercase">{d.toLocaleDateString('nl-NL', { weekday: 'short' })}</span>
                      <span className="text-base font-bold">{d.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Tijdslot ({duration} min)</label>
              {slotsLoading ? (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-400">
                  <BoltIcon className="mr-2 h-4 w-4 animate-pulse" />Laden...
                </div>
              ) : slots.length === 0 ? (
                <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800">
                  Geen beschikbare slots op deze dag.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                  {slots.map(s => {
                    const active = selectedStart === s.start;
                    return (
                      <button key={s.start} onClick={() => setSelectedStart(s.start)}
                        className={`h-10 rounded-lg border text-sm font-semibold transition ${
                          active ? 'border-brand-purple bg-brand-purple text-white' : 'border-slate-200 bg-white text-slate-700'
                        }`}>
                        {new Date(s.start).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Contactgegevens</h3>
              <Field label="Naam *">
                <input value={contactName} onChange={e => setContactName(e.target.value)} className={inputCls} />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Telefoon"><input value={contactPhone} onChange={e => setContactPhone(e.target.value)} className={inputCls} /></Field>
                <Field label="Email"><input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className={inputCls} /></Field>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <Field label="Straat"><input value={street} onChange={e => setStreet(e.target.value)} className={inputCls} /></Field>
                <div className="w-24"><Field label="Nr."><input value={houseNumber} onChange={e => setHouseNumber(e.target.value)} className={inputCls} /></Field></div>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <Field label="Postcode"><input value={postcode} onChange={e => setPostcode(e.target.value)} className={inputCls} /></Field>
                <Field label="Plaats"><input value={city} onChange={e => setCity(e.target.value)} className={inputCls} /></Field>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Duur (min)">
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
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} />
            </Field>

            {err && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
          </div>
        </div>

        <footer className="flex items-center gap-2 border-t border-slate-200 bg-white px-5 py-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}>
          <button onClick={onClose} className="h-11 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-initial sm:px-5">Annuleren</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !customerId || !selectedStart || !contactName.trim() || !branch}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink px-5 text-sm font-bold text-white shadow-sm disabled:opacity-50"
          >
            {submitting ? 'Bezig...' : <><CheckCircleIcon className="h-4 w-4" /> Inplannen</>}
          </button>
        </footer>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

const inputCls = "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-purple/50";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>{children}</label>;
}
