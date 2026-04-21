'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { portalFetch } from '@/lib/portalAuth';
import {
  XMarkIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  CalendarDaysIcon,
  ClockIcon,
  UserIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  NoSymbolIcon,
  PencilSquareIcon,
  TrashIcon,
  ChatBubbleBottomCenterTextIcon,
  UserGroupIcon,
  BriefcaseIcon,
} from '@heroicons/react/24/outline';
import type { Appointment } from './page';

interface TeamMember { id: string; name: string; role: string }

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Ingepland',
  completed: 'Voltooid',
  no_show: 'No-show',
  cancelled: 'Geannuleerd',
  rescheduled: 'Verzet',
};

const STATUS_DOT: Record<string, string> = {
  scheduled: 'bg-indigo-500',
  completed: 'bg-emerald-500',
  no_show: 'bg-rose-500',
  cancelled: 'bg-slate-400',
  rescheduled: 'bg-amber-500',
};

export default function AppointmentDetailModal({
  appointment,
  team,
  canEdit,
  canViewAll,
  branchNames,
  onClose,
  onUpdated,
}: {
  appointment: Appointment;
  team: TeamMember[];
  canEdit: boolean;
  canViewAll: boolean;
  branchNames: Record<string, string>;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [contactName, setContactName] = useState(appointment.contact_name);
  const [contactPhone, setContactPhone] = useState(appointment.contact_phone || '');
  const [contactEmail, setContactEmail] = useState(appointment.contact_email || '');
  const [street, setStreet] = useState(appointment.street || '');
  const [houseNumber, setHouseNumber] = useState(appointment.house_number || '');
  const [postcode, setPostcode] = useState(appointment.postcode || '');
  const [city, setCity] = useState(appointment.city || '');
  const [notes, setNotes] = useState(appointment.notes || '');
  const [portalUserId, setPortalUserId] = useState<string | null>(appointment.portal_user_id);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const s = new Date(appointment.starts_at);
  const e = new Date(s.getTime() + appointment.duration_minutes * 60_000);
  const assignee = team.find(m => m.id === appointment.portal_user_id);

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        street: street.trim() || null,
        house_number: houseNumber.trim() || null,
        postcode: postcode.trim() || null,
        city: city.trim() || null,
        notes: notes.trim() || null,
      };
      if (canViewAll) body.portal_user_id = portalUserId;
      const res = await portalFetch(`/api/portal/appointments/${appointment.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Opslaan mislukt'); return; }
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (status: string) => {
    setSaving(true);
    setErr(null);
    try {
      const res = await portalFetch(`/api/portal/appointments/${appointment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Mislukt'); return; }
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setSaving(true);
    try {
      const res = await portalFetch(`/api/portal/appointments/${appointment.id}`, {
        method: 'DELETE',
      });
      if (res.ok) onUpdated();
    } finally {
      setSaving(false);
    }
  };

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
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 300 }}
        onClick={ev => ev.stopPropagation()}
        className="flex h-[100dvh] w-full flex-col bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:rounded-t-2xl" style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT[appointment.status] || 'bg-slate-400'}`} />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{STATUS_LABELS[appointment.status]}</span>
            </div>
            <h2 className="truncate text-lg font-bold text-slate-900">{appointment.contact_name}</h2>
            <p className="truncate text-xs text-slate-500">
              {branchNames[appointment.branch] || appointment.branch}
            </p>
          </div>
          <button onClick={onClose} className="ml-2 rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Time block */}
          <section className="mb-4 rounded-xl border border-slate-200 bg-gradient-to-br from-brand-purple/5 to-brand-pink/5 p-4">
            <div className="flex items-start gap-3">
              <CalendarDaysIcon className="mt-0.5 h-5 w-5 text-brand-purple" />
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900">
                  {s.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-600">
                  <ClockIcon className="h-3.5 w-3.5" />
                  {s.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })} – {e.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                  <span className="text-xs text-slate-400">· {appointment.duration_minutes} min</span>
                </p>
              </div>
            </div>
          </section>

          {!editing ? (
            <>
              {/* Contact */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Contact</h3>
                {appointment.contact_phone && (
                  <a href={`tel:${appointment.contact_phone}`} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-slate-300">
                    <PhoneIcon className="h-4 w-4 text-slate-400" />
                    <span className="flex-1">{appointment.contact_phone}</span>
                    <span className="text-xs font-semibold text-brand-purple">Bel</span>
                  </a>
                )}
                {appointment.contact_email && (
                  <a href={`mailto:${appointment.contact_email}`} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-slate-300">
                    <EnvelopeIcon className="h-4 w-4 text-slate-400" />
                    <span className="flex-1 truncate">{appointment.contact_email}</span>
                  </a>
                )}
                {(appointment.street || appointment.postcode || appointment.city) && (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent([appointment.street, appointment.house_number, appointment.postcode, appointment.city].filter(Boolean).join(' '))}`}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-slate-300"
                  >
                    <MapPinIcon className="h-4 w-4 text-slate-400" />
                    <div className="flex-1">
                      <p>{[appointment.street, appointment.house_number].filter(Boolean).join(' ')}</p>
                      <p className="text-xs text-slate-500">{[appointment.postcode, appointment.city].filter(Boolean).join(' ')}</p>
                    </div>
                    <span className="text-xs font-semibold text-brand-purple">Route</span>
                  </a>
                )}
              </section>

              {assignee && (
                <section className="mt-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Adviseur</h3>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                    <UserIcon className="h-4 w-4 text-slate-400" />
                    <span>{assignee.name}</span>
                    <span className="ml-auto text-xs text-slate-400">{assignee.role}</span>
                  </div>
                </section>
              )}

              {appointment.notes && (
                <section className="mt-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Opmerkingen</h3>
                  <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                    <ChatBubbleBottomCenterTextIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <p className="whitespace-pre-wrap">{appointment.notes}</p>
                  </div>
                </section>
              )}

              {/* Status actions */}
              {canEdit && appointment.status === 'scheduled' && (
                <section className="mt-5">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Markeer als</h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button onClick={() => changeStatus('completed')} disabled={saving} className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                      <CheckCircleIcon className="h-4 w-4" /> Voltooid
                    </button>
                    <button onClick={() => changeStatus('no_show')} disabled={saving} className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50">
                      <ExclamationCircleIcon className="h-4 w-4" /> No-show
                    </button>
                  </div>
                </section>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <Input label="Naam *" value={contactName} onChange={setContactName} />
              <Input label="Telefoon" value={contactPhone} onChange={setContactPhone} />
              <Input label="Email" value={contactEmail} onChange={setContactEmail} />
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input label="Straat" value={street} onChange={setStreet} />
                <div className="w-20">
                  <Input label="Nr." value={houseNumber} onChange={setHouseNumber} />
                </div>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <Input label="Postcode" value={postcode} onChange={setPostcode} />
                <Input label="Plaats" value={city} onChange={setCity} />
              </div>
              {canViewAll && team.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Adviseur</label>
                  <select value={portalUserId || ''} onChange={ev => setPortalUserId(ev.target.value || null)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-purple/50">
                    <option value="">Niet toegewezen</option>
                    {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Opmerkingen</label>
                <textarea value={notes} onChange={ev => setNotes(ev.target.value)} rows={3} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-purple/50" />
              </div>
            </div>
          )}

          {err && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>
          )}
        </div>

        <footer className="flex items-center gap-2 border-t border-slate-200 bg-white px-5 py-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}>
          {!editing ? (
            <>
              {canEdit && appointment.status !== 'cancelled' && (
                <>
                  {!confirmDelete ? (
                    <button onClick={() => setConfirmDelete(true)} className="flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-rose-600 hover:bg-rose-50">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  ) : (
                    <button onClick={doDelete} disabled={saving} className="flex h-11 items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 text-sm font-semibold text-rose-700">
                      Bevestig
                    </button>
                  )}
                  <button onClick={() => setEditing(true)} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <PencilSquareIcon className="h-4 w-4" /> Bewerken
                  </button>
                </>
              )}
              <button onClick={onClose} className="h-11 flex-1 rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink text-sm font-bold text-white shadow-sm">
                Sluiten
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(false)} className="h-11 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Annuleren
              </button>
              <button onClick={save} disabled={saving || !contactName.trim()} className="h-11 flex-1 rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink text-sm font-bold text-white shadow-sm disabled:opacity-50">
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
            </>
          )}
        </footer>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-purple/50" />
    </div>
  );
}
