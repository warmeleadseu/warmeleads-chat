'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  TrashIcon,
  CheckIcon,
  CalendarDaysIcon,
  MapPinIcon,
  PencilSquareIcon,
  UserGroupIcon,
  VideoCameraIcon,
  ClipboardIcon,
  ArrowTopRightOnSquareIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import {
  EVENT_TYPES,
  TYPE_META,
  type AdminOption,
  type CalendarEvent,
  type EventInput,
  type EventType,
} from '../_lib/types';
import {
  toLocalInputValue,
  toDateInputValue,
  formatRange,
} from '../_lib/datetime';
import { EntityTypeahead, type EntityValue } from './EntityTypeahead';

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  initial: Partial<EventInput> | null;
  existingEvent: CalendarEvent | null;
  currentAdmin: { id: string; role: string };
  admins: AdminOption[];
  onClose: () => void;
  onSaved: (event: CalendarEvent) => void;
  onDeleted: (id: string) => void;
}

const DEFAULT_VALUES: EventInput = {
  title: '',
  description: '',
  event_type: 'customer_visit',
  starts_at: '',
  ends_at: '',
  all_day: false,
  location: '',
  customer_id: null,
  prospect_id: null,
  participant_ids: [],
  meeting_url: null,
  send_invite: false,
};

function defaultStartFromNow(): { starts_at: string; ends_at: string } {
  const now = new Date();
  now.setMinutes(now.getMinutes() < 30 ? 30 : 0, 0, 0);
  if (now.getMinutes() === 0) now.setHours(now.getHours() + 1);
  const end = new Date(now);
  end.setHours(end.getHours() + 1);
  return { starts_at: toLocalInputValue(now), ends_at: toLocalInputValue(end) };
}

export function EventDrawer({
  open,
  mode,
  initial,
  existingEvent,
  currentAdmin,
  admins,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const [form, setForm] = useState<EventInput>(DEFAULT_VALUES);
  const [customer, setCustomer] = useState<EntityValue | null>(null);
  const [prospect, setProspect] = useState<EntityValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<
    | { tone: 'success' | 'error'; message: string }
    | null
  >(null);
  const [copiedMeetingUrl, setCopiedMeetingUrl] = useState(false);

  const canMutate = useMemo(() => {
    if (mode === 'create') return true;
    if (!existingEvent) return false;
    if (existingEvent.created_by === currentAdmin.id) return true;
    return currentAdmin.role === 'admin' || currentAdmin.role === 'superadmin';
  }, [mode, existingEvent, currentAdmin]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setConfirmDelete(false);
    setInviteFeedback(null);
    setCopiedMeetingUrl(false);
    if (mode === 'edit' && existingEvent) {
      setForm({
        id: existingEvent.id,
        title: existingEvent.title,
        description: existingEvent.description || '',
        event_type: existingEvent.event_type,
        starts_at: existingEvent.all_day
          ? toDateInputValue(new Date(existingEvent.starts_at))
          : toLocalInputValue(new Date(existingEvent.starts_at)),
        ends_at: existingEvent.all_day
          ? toDateInputValue(new Date(existingEvent.ends_at))
          : toLocalInputValue(new Date(existingEvent.ends_at)),
        all_day: existingEvent.all_day,
        location: existingEvent.location || '',
        customer_id: existingEvent.customer?.id || null,
        prospect_id: existingEvent.prospect?.id || null,
        participant_ids: existingEvent.participants.map(p => p.id),
        meeting_url: existingEvent.meeting_url,
        send_invite: false,
      });
      setCustomer(
        existingEvent.customer
          ? { id: existingEvent.customer.id, label: existingEvent.customer.name || 'Klant' }
          : null,
      );
      setProspect(
        existingEvent.prospect
          ? {
              id: existingEvent.prospect.id,
              label: existingEvent.prospect.company_name || 'Prospect',
            }
          : null,
      );
    } else {
      const defaults = defaultStartFromNow();
      const merged: EventInput = {
        ...DEFAULT_VALUES,
        ...defaults,
        participant_ids: [currentAdmin.id],
        ...(initial || {}),
      };
      setForm(merged);
      setCustomer(
        initial?.customer_id ? { id: initial.customer_id, label: 'Geselecteerde klant' } : null,
      );
      setProspect(
        initial?.prospect_id ? { id: initial.prospect_id, label: 'Geselecteerde prospect' } : null,
      );
    }
  }, [open, mode, existingEvent, initial, currentAdmin.id]);

  function patch(p: Partial<EventInput>) {
    setForm(prev => ({ ...prev, ...p }));
  }

  /**
   * Voor nieuwe videocall-events met een gekoppelde klant of prospect
   * staat de "verstuur uitnodiging"-toggle standaard aan, mits we een
   * email in beeld hebben. Bij wisselen van type uit videocall zetten
   * we hem netjes weer uit.
   */
  const linkedRecipientEmail =
    customer && existingEvent?.customer?.id === customer.id
      ? existingEvent.customer.email || null
      : prospect && existingEvent?.prospect?.id === prospect.id
        ? existingEvent.prospect.email || null
        : null;
  useEffect(() => {
    if (mode !== 'create') return;
    if (form.event_type === 'videocall' && (customer || prospect)) {
      if (!form.send_invite) patch({ send_invite: true });
    } else if (form.send_invite) {
      patch({ send_invite: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.event_type, customer?.id, prospect?.id, mode]);

  function toggleParticipant(id: string) {
    setForm(prev => {
      const set = new Set(prev.participant_ids);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, participant_ids: Array.from(set) };
    });
  }

  function setAllDay(allDay: boolean) {
    if (allDay && !form.all_day) {
      const sd = form.starts_at ? new Date(form.starts_at) : new Date();
      const ed = form.ends_at ? new Date(form.ends_at) : new Date(sd);
      patch({
        all_day: true,
        starts_at: toDateInputValue(sd),
        ends_at: toDateInputValue(ed),
      });
    } else if (!allDay && form.all_day) {
      const sd = form.starts_at ? new Date(form.starts_at + 'T09:00') : new Date();
      const ed = form.ends_at ? new Date(form.ends_at + 'T10:00') : new Date(sd);
      patch({
        all_day: false,
        starts_at: toLocalInputValue(sd),
        ends_at: toLocalInputValue(ed),
      });
    }
  }

  async function handleSubmit() {
    if (!canMutate) return;
    setError(null);
    if (!form.title.trim()) {
      setError('Geef het event een titel.');
      return;
    }
    if (!form.starts_at || !form.ends_at) {
      setError('Vul start- en eindtijd in.');
      return;
    }

    let startsIso: string;
    let endsIso: string;
    if (form.all_day) {
      const s = new Date(form.starts_at + 'T00:00:00');
      const e = new Date(form.ends_at + 'T23:59:59');
      if (e < s) {
        setError('Einddatum ligt vóór startdatum.');
        return;
      }
      startsIso = s.toISOString();
      endsIso = e.toISOString();
    } else {
      const s = new Date(form.starts_at);
      const e = new Date(form.ends_at);
      if (e < s) {
        setError('Eindtijd ligt vóór starttijd.');
        return;
      }
      startsIso = s.toISOString();
      endsIso = e.toISOString();
    }

    if (customer && prospect) {
      setError('Koppel óf een klant óf een prospect.');
      return;
    }

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      event_type: form.event_type,
      starts_at: startsIso,
      ends_at: endsIso,
      all_day: form.all_day,
      location: form.location.trim() || null,
      customer_id: customer?.id ?? null,
      prospect_id: prospect?.id ?? null,
      participant_ids: form.participant_ids,
    };
    if (form.event_type === 'videocall' && form.meeting_url) {
      payload.meeting_url = form.meeting_url;
    }
    if (form.event_type === 'videocall' && form.send_invite) {
      payload.send_invite = true;
    }

    setSaving(true);
    setInviteFeedback(null);
    try {
      const url =
        mode === 'edit' && form.id
          ? `/api/admin/team-calendar/${form.id}`
          : '/api/admin/team-calendar';
      const method = mode === 'edit' ? 'PATCH' : 'POST';
      const res = await adminFetch(url, {
        method,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Opslaan mislukt');
        setSaving(false);
        return;
      }
      // Toon eventuele invite-feedback in de UI nog even, zodat het meteen
      // duidelijk is of de uitnodiging daadwerkelijk verstuurd is.
      if (data.invite) {
        applyInviteFeedback(data.invite);
      }
      const { invite: _invite, ...event } = data as CalendarEvent & { invite?: unknown };
      void _invite;
      onSaved(event as CalendarEvent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onbekende fout');
    } finally {
      setSaving(false);
    }
  }

  function applyInviteFeedback(invite: {
    ok: boolean;
    recipient_email?: string | null;
    error?: string;
    skipped_reason?: string;
  }) {
    if (invite.ok && invite.recipient_email) {
      setInviteFeedback({
        tone: 'success',
        message: `Uitnodiging verstuurd naar ${invite.recipient_email}.`,
      });
    } else if (invite.skipped_reason === 'no_recipient_email') {
      setInviteFeedback({
        tone: 'error',
        message: 'Geen e-mailadres bekend bij de gekoppelde klant of prospect — uitnodiging niet verstuurd.',
      });
    } else if (invite.skipped_reason === 'no_linked_recipient') {
      setInviteFeedback({
        tone: 'error',
        message: 'Koppel een klant of prospect aan dit event om de uitnodiging te kunnen versturen.',
      });
    } else if (invite.skipped_reason === 'admin_email_not_warmeleads') {
      setInviteFeedback({
        tone: 'error',
        message: 'Je e-mailadres is geen @warmeleads.eu-adres; uitnodiging niet verstuurd.',
      });
    } else if (!invite.ok) {
      setInviteFeedback({
        tone: 'error',
        message: invite.error || 'Versturen van de uitnodiging mislukt.',
      });
    }
  }

  async function handleResendInvite() {
    if (!form.id) return;
    setInviteSending(true);
    setInviteFeedback(null);
    try {
      const res = await adminFetch(`/api/admin/team-calendar/${form.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ send_invite: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteFeedback({
          tone: 'error',
          message: data.error || 'Versturen mislukt',
        });
        return;
      }
      if (data.invite) applyInviteFeedback(data.invite);
      const { invite: _invite, ...event } = data as CalendarEvent & { invite?: unknown };
      void _invite;
      onSaved(event as CalendarEvent);
    } catch (err) {
      setInviteFeedback({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Onbekende fout',
      });
    } finally {
      setInviteSending(false);
    }
  }

  async function handleCopyMeetingUrl() {
    const url = form.meeting_url || existingEvent?.meeting_url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedMeetingUrl(true);
      setTimeout(() => setCopiedMeetingUrl(false), 2000);
    } catch {
      /* clipboard kan geblokkeerd zijn — gebruiker kan de link nog handmatig kopiëren */
    }
  }

  async function handleDelete() {
    if (!form.id) return;
    setSaving(true);
    try {
      const res = await adminFetch(`/api/admin/team-calendar/${form.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Verwijderen mislukt');
        setSaving(false);
        return;
      }
      onDeleted(form.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onbekende fout');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-slate-900/40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {mode === 'edit' ? 'Event bewerken' : 'Nieuw event'}
                </h2>
                {mode === 'edit' && existingEvent && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatRange(
                      new Date(existingEvent.starts_at),
                      new Date(existingEvent.ends_at),
                      existingEvent.all_day,
                    )}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {/* Type */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Type event
                </label>
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPES.map(t => {
                    const meta = TYPE_META[t];
                    const active = form.event_type === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => patch({ event_type: t as EventType })}
                        disabled={!canMutate}
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${
                          active
                            ? `${meta.pill} ring-transparent shadow-sm`
                            : `bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 ${meta.ring}`
                        } ${!canMutate ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Titel
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-brand-purple focus-within:ring-2 focus-within:ring-brand-purple/20">
                  <PencilSquareIcon className="h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => patch({ title: e.target.value })}
                    placeholder="Bv. Bezoek installateur in Zwolle"
                    disabled={!canMutate}
                    className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                    maxLength={200}
                  />
                </div>
              </div>

              {/* All-day toggle */}
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-slate-800">Hele dag</div>
                  <p className="text-[11px] text-slate-500">
                    Voor vakantie, beurzen of meerdaagse events.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAllDay(!form.all_day)}
                  disabled={!canMutate}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    form.all_day ? 'bg-brand-purple' : 'bg-slate-300'
                  } ${!canMutate ? 'opacity-60' : ''}`}
                  aria-pressed={form.all_day}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      form.all_day ? 'left-5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Date/time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Start
                  </label>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-brand-purple focus-within:ring-2 focus-within:ring-brand-purple/20">
                    <CalendarDaysIcon className="h-4 w-4 text-slate-400" />
                    <input
                      type={form.all_day ? 'date' : 'datetime-local'}
                      value={form.starts_at}
                      onChange={e => patch({ starts_at: e.target.value })}
                      disabled={!canMutate}
                      className="w-full bg-transparent text-sm text-slate-800 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Eind
                  </label>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-brand-purple focus-within:ring-2 focus-within:ring-brand-purple/20">
                    <CalendarDaysIcon className="h-4 w-4 text-slate-400" />
                    <input
                      type={form.all_day ? 'date' : 'datetime-local'}
                      value={form.ends_at}
                      onChange={e => patch({ ends_at: e.target.value })}
                      disabled={!canMutate}
                      className="w-full bg-transparent text-sm text-slate-800 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Locatie
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-brand-purple focus-within:ring-2 focus-within:ring-brand-purple/20">
                  <MapPinIcon className="h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={form.location}
                    onChange={e => patch({ location: e.target.value })}
                    placeholder="Adres of online"
                    disabled={!canMutate}
                    className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Customer / Prospect link */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Koppel aan klant of prospect
                </label>
                <div className="space-y-2">
                  <EntityTypeahead
                    kind="customer"
                    value={customer}
                    onChange={v => {
                      setCustomer(v);
                      if (v) setProspect(null);
                    }}
                    disabled={!canMutate || !!prospect}
                  />
                  <EntityTypeahead
                    kind="prospect"
                    value={prospect}
                    onChange={v => {
                      setProspect(v);
                      if (v) setCustomer(null);
                    }}
                    disabled={!canMutate || !!customer}
                  />
                </div>
              </div>

              {/* Videocall sectie */}
              {form.event_type === 'videocall' && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 text-white">
                      <VideoCameraIcon className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-sm font-bold text-indigo-900">Videocall via Jitsi Meet</div>
                      <p className="text-[11px] text-indigo-700">
                        Werkt direct in elke browser — geen account of installatie nodig.
                      </p>
                    </div>
                  </div>

                  {/* Meeting-link weergeven of placeholder */}
                  {form.meeting_url ? (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2">
                      <VideoCameraIcon className="h-4 w-4 shrink-0 text-indigo-500" />
                      <code className="flex-1 truncate text-[12px] font-mono text-indigo-900">
                        {form.meeting_url}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyMeetingUrl}
                        className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50"
                        title="Kopieer link"
                      >
                        {copiedMeetingUrl ? (
                          <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <ClipboardIcon className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <a
                        href={form.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50"
                        title="Open videocall"
                      >
                        <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-lg border border-dashed border-indigo-300 bg-white px-3 py-2 text-[12px] text-indigo-700">
                      We genereren een unieke Jitsi-link zodra je dit event opslaat.
                    </div>
                  )}

                  {/* Verstuur-uitnodiging-toggle */}
                  {canMutate && (customer || prospect) && (
                    <div className="mt-3 flex items-start gap-3 rounded-lg border border-indigo-200 bg-white px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => patch({ send_invite: !form.send_invite })}
                        className={`mt-0.5 relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                          form.send_invite ? 'bg-indigo-500' : 'bg-slate-300'
                        }`}
                        aria-pressed={form.send_invite}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                            form.send_invite ? 'left-4' : 'left-0.5'
                          }`}
                        />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-slate-800">
                          Verstuur uitnodiging per mail
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {mode === 'edit' && existingEvent?.meeting_invite_sent_at
                            ? 'Stuurt een nieuwe uitnodiging naar de gekoppelde ontvanger zodra je opslaat.'
                            : `De gekoppelde ${customer ? 'klant' : 'prospect'} ontvangt een mail met de Jitsi-link, datum en tijd.`}
                          {linkedRecipientEmail && (
                            <> Naar: <span className="font-medium text-slate-700">{linkedRecipientEmail}</span></>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {!customer && !prospect && (
                    <p className="mt-3 text-[11px] text-indigo-700">
                      Tip: koppel een klant of prospect om automatisch een uitnodiging te sturen met de videocall-link.
                    </p>
                  )}

                  {/* Status: uitnodiging eerder verstuurd + opnieuw versturen */}
                  {mode === 'edit' && existingEvent?.meeting_invite_sent_at && (
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <div className="flex items-center gap-2 text-[12px] text-emerald-800">
                        <CheckCircleIcon className="h-4 w-4 shrink-0" />
                        <span>
                          Uitnodiging verstuurd op{' '}
                          {new Date(existingEvent.meeting_invite_sent_at).toLocaleString('nl-NL', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {canMutate && (customer || prospect) && (
                        <button
                          type="button"
                          onClick={handleResendInvite}
                          disabled={inviteSending}
                          className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 disabled:opacity-60"
                        >
                          <PaperAirplaneIcon className="h-3 w-3" />
                          {inviteSending ? 'Bezig…' : 'Opnieuw versturen'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Direct-actie 'verstuur uitnodiging' voor edit zonder eerdere verzending */}
                  {mode === 'edit' &&
                    existingEvent &&
                    !existingEvent.meeting_invite_sent_at &&
                    canMutate &&
                    (customer || prospect) &&
                    existingEvent.meeting_url && (
                      <button
                        type="button"
                        onClick={handleResendInvite}
                        disabled={inviteSending}
                        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                      >
                        <PaperAirplaneIcon className="h-3.5 w-3.5" />
                        {inviteSending ? 'Versturen…' : 'Verstuur uitnodiging nu'}
                      </button>
                    )}

                  {inviteFeedback && (
                    <div
                      className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px] ${
                        inviteFeedback.tone === 'success'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-rose-200 bg-rose-50 text-rose-800'
                      }`}
                    >
                      {inviteFeedback.tone === 'success' ? (
                        <CheckCircleIcon className="h-4 w-4 shrink-0" />
                      ) : (
                        <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                      )}
                      <span>{inviteFeedback.message}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Participants */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  <UserGroupIcon className="mr-1 inline h-3.5 w-3.5" />
                  Deelnemers
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {admins.map(a => {
                    const active = form.participant_ids.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleParticipant(a.id)}
                        disabled={!canMutate}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium transition-all ${
                          active
                            ? 'border-brand-purple bg-brand-purple/5 text-brand-purple'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        } ${!canMutate ? 'opacity-60' : ''}`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase ${
                            active ? 'bg-brand-purple text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {active ? <CheckIcon className="h-3 w-3" /> : a.name.charAt(0)}
                        </span>
                        <span className="truncate">{a.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Notities
                </label>
                <textarea
                  value={form.description}
                  onChange={e => patch({ description: e.target.value })}
                  placeholder="Optionele context, agenda-punten of voorbereiding…"
                  rows={3}
                  disabled={!canMutate}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {error}
                </div>
              )}
            </div>

            <footer className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <div>
                {mode === 'edit' && canMutate && (
                  <>
                    {confirmDelete ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">Zeker weten?</span>
                        <button
                          onClick={handleDelete}
                          disabled={saving}
                          className="rounded-md bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                        >
                          Ja, verwijder
                        </button>
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="rounded-md bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                        >
                          Annuleer
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                        Verwijder
                      </button>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  Annuleer
                </button>
                {canMutate && (
                  <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="rounded-md bg-brand-purple px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-purple/90 disabled:opacity-60"
                  >
                    {saving ? 'Opslaan…' : mode === 'edit' ? 'Wijzigingen opslaan' : 'Event aanmaken'}
                  </button>
                )}
              </div>
            </footer>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
