'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  PencilSquareIcon,
  CheckIcon,
  ArrowsRightLeftIcon,
  UserPlusIcon,
  CheckBadgeIcon,
  TrashIcon,
  Bars3CenterLeftIcon,
  ListBulletIcon,
  ClockIcon,
  GlobeAltIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  IdentificationIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import {
  PROSPECT_STATUSES,
  PROSPECT_STATUS_LABELS,
  type ProspectStatus,
} from '@/lib/prospects';
import { StatusBadge } from './StatusBadge';
import { ActivityTimeline, type Activity } from './ActivityTimeline';
import { TaskList, type Task } from './TaskList';
import { ProspectFormFields, EMPTY_PROSPECT, type ProspectFormState } from './ProspectFormFields';
import { ComposeMailDrawer } from '../../_components/ComposeMailDrawer';
import { MailHistory } from '../../_components/MailHistory';

export interface ProspectDetail {
  id: string;
  company_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  kvk_nummer: string | null;
  vat_id: string | null;
  address: string | null;
  postcode: string | null;
  city: string | null;
  country: string | null;
  branches: string[] | null;
  company_size: string | null;
  notes: string | null;
  status: ProspectStatus;
  status_changed_at: string | null;
  lost_reason: string | null;
  source: string;
  account_manager_id: string | null;
  assigned_at: string | null;
  converted_to_customer_id: string | null;
  converted_at: string | null;
  next_action_at: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUserOption {
  id: string;
  name: string;
  email?: string | null;
}

export interface BranchOption {
  slug: string;
  name: string;
}

interface Props {
  prospectId: string;
  open: boolean;
  onClose: () => void;
  onUpdated: (p: ProspectDetail) => void;
  onDeleted?: (id: string) => void;
  branches: BranchOption[];
  ams: AdminUserOption[];
  canManage: boolean; // admin/superadmin
  onConvert: (p: ProspectDetail) => void;
}

type Tab = 'overzicht' | 'activiteiten' | 'taken' | 'mail' | 'edit';

export function ProspectDrawer({
  prospectId,
  open,
  onClose,
  onUpdated,
  onDeleted,
  branches,
  ams,
  canManage,
  onConvert,
}: Props) {
  const [tab, setTab] = useState<Tab>('overzicht');
  const [loading, setLoading] = useState(true);
  const [prospect, setProspect] = useState<ProspectDetail | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [am, setAm] = useState<AdminUserOption | null>(null);
  const [editForm, setEditForm] = useState<ProspectFormState>(EMPTY_PROSPECT);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showLost, setShowLost] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab('overzicht');
    setLoading(true);
    setDrawerError(null);
    let cancel = false;
    (async () => {
      try {
        const res = await adminFetch(`/api/admin/prospects/${prospectId}`);
        const data = await res.json().catch(() => ({}));
        if (cancel) return;
        if (res.ok) {
          setProspect(data.prospect);
          setTasks(data.tasks || []);
          setActivities(data.activities || []);
          setAm(data.account_manager || null);
          const p = data.prospect as ProspectDetail;
          setEditForm({
            company_name: p.company_name || '',
            contact_person: p.contact_person || '',
            email: p.email || '',
            phone: p.phone || '',
            website: p.website || '',
            kvk_nummer: p.kvk_nummer || '',
            vat_id: p.vat_id || '',
            address: p.address || '',
            postcode: p.postcode || '',
            city: p.city || '',
            country: p.country || 'NL',
            branches: p.branches || [],
            company_size: p.company_size || '',
            notes: p.notes || '',
          });
        } else {
          setDrawerError(data?.error || `Prospect ophalen mislukt (${res.status})`);
        }
      } catch (err) {
        if (!cancel) setDrawerError(err instanceof Error ? err.message : 'Prospect ophalen mislukt');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [open, prospectId]);

  // ESC sluit de drawer
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showLost) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, showLost, onClose]);

  const refreshActivities = async (id: string) => {
    const aRes = await adminFetch(`/api/admin/prospects/${id}/activities`);
    const aData = await aRes.json();
    if (aRes.ok) setActivities(aData.activities || []);
  };

  const setStatus = async (status: ProspectStatus) => {
    if (!prospect) return;
    if (status === 'verloren') {
      setShowLost(true);
      return;
    }
    if (status === prospect.status) return;
    setDrawerError(null);
    const res = await adminFetch(`/api/admin/prospects/${prospect.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.prospect) {
      setProspect(data.prospect);
      onUpdated(data.prospect);
      refreshActivities(prospect.id);
    } else {
      setDrawerError(data?.error || 'Status wijzigen mislukt');
    }
  };

  const submitLost = async () => {
    if (!prospect || !lostReason.trim()) return;
    setDrawerError(null);
    const res = await adminFetch(`/api/admin/prospects/${prospect.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'verloren', lost_reason: lostReason.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.prospect) {
      setProspect(data.prospect);
      onUpdated(data.prospect);
      setShowLost(false);
      setLostReason('');
      refreshActivities(prospect.id);
    } else {
      setDrawerError(data?.error || 'Status wijzigen mislukt');
    }
  };

  const setAssignment = async (amId: string | null) => {
    if (!prospect) return;
    setDrawerError(null);
    const res = await adminFetch(`/api/admin/prospects/${prospect.id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ account_manager_id: amId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.prospect) {
      setProspect(data.prospect);
      setAm(amId ? ams.find(a => a.id === amId) || null : null);
      onUpdated(data.prospect);
    } else {
      setDrawerError(data?.error || 'AM toewijzen mislukt');
    }
  };

  const saveEdit = async () => {
    if (!prospect) return;
    if (!editForm.company_name.trim()) return;
    setSavingEdit(true);
    setDrawerError(null);
    try {
      const res = await adminFetch(`/api/admin/prospects/${prospect.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.prospect) {
        setProspect(data.prospect);
        onUpdated(data.prospect);
        setTab('overzicht');
      } else {
        setDrawerError(data?.error || 'Opslaan mislukt');
      }
    } catch (err) {
      setDrawerError(err instanceof Error ? err.message : 'Opslaan mislukt');
    } finally {
      setSavingEdit(false);
    }
  };

  const remove = async () => {
    if (!prospect || !canManage) return;
    if (!confirm(`Weet je zeker dat je "${prospect.company_name}" wilt verwijderen?`)) return;
    setDrawerError(null);
    const res = await adminFetch(`/api/admin/prospects/${prospect.id}`, { method: 'DELETE' });
    if (res.ok) {
      onDeleted?.(prospect.id);
      onClose();
    } else {
      const data = await res.json().catch(() => ({}));
      setDrawerError(data?.error || 'Verwijderen mislukt');
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={onClose}
          />
          <motion.div
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-slate-50 shadow-2xl md:max-w-[640px]"
          >
            <div className="flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div className="min-w-0 flex-1">
                {loading || !prospect ? (
                  <div className="space-y-2">
                    <div className="h-5 w-48 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />
                  </div>
                ) : (
                  <>
                    <h2 className="truncate text-lg font-bold text-slate-900">{prospect.company_name}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StatusBadge status={prospect.status} size="sm" />
                      {prospect.kvk_nummer && (
                        <span className="font-mono text-[11px] text-slate-400">KVK {prospect.kvk_nummer}</span>
                      )}
                      {prospect.converted_to_customer_id && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                          <CheckBadgeIcon className="h-3 w-3" />
                          Geconverteerd
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="ml-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex shrink-0 gap-1 border-b border-slate-200 bg-white px-3">
              {([
                { id: 'overzicht', label: 'Overzicht', Icon: Bars3CenterLeftIcon },
                { id: 'activiteiten', label: `Activiteiten${activities.length ? ` (${activities.length})` : ''}`, Icon: ClockIcon },
                { id: 'taken', label: `Taken${tasks.filter(t => !t.completed_at).length ? ` (${tasks.filter(t => !t.completed_at).length})` : ''}`, Icon: ListBulletIcon },
                { id: 'mail', label: 'Mail', Icon: EnvelopeIcon },
                { id: 'edit', label: 'Bewerken', Icon: PencilSquareIcon },
              ] as { id: Tab; label: string; Icon: React.ComponentType<{ className?: string }> }[]).map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`relative inline-flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors ${
                    tab === t.id ? 'text-brand-purple' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <t.Icon className="h-4 w-4" />
                  {t.label}
                  {tab === t.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-t bg-brand-purple" />}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {drawerError && (
                <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
                  <span>{drawerError}</span>
                  <button
                    type="button"
                    onClick={() => setDrawerError(null)}
                    className="rounded p-0.5 text-rose-500 hover:bg-rose-100"
                    aria-label="Sluiten"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
              {loading || !prospect ? (
                <div className="space-y-3">
                  <div className="h-24 animate-pulse rounded-xl bg-white" />
                  <div className="h-24 animate-pulse rounded-xl bg-white" />
                  <div className="h-32 animate-pulse rounded-xl bg-white" />
                </div>
              ) : tab === 'overzicht' ? (
                <Overview
                  prospect={prospect}
                  am={am}
                  ams={ams}
                  branches={branches}
                  canManage={canManage}
                  onStatus={setStatus}
                  onAssign={setAssignment}
                  onConvert={() => onConvert(prospect)}
                  onCompose={() => setComposeOpen(true)}
                />
              ) : tab === 'activiteiten' ? (
                <ActivityTimeline
                  prospectId={prospect.id}
                  activities={activities}
                  onAdded={a => setActivities(prev => [a, ...prev])}
                />
              ) : tab === 'taken' ? (
                <TaskList prospectId={prospect.id} tasks={tasks} onChange={setTasks} />
              ) : tab === 'mail' ? (
                <MailHistory prospectId={prospect.id} />
              ) : (
                <div className="space-y-4">
                  <ProspectFormFields value={editForm} onChange={setEditForm} branches={branches} />
                  <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                    {canManage && (
                      <button
                        type="button"
                        onClick={remove}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                      >
                        <TrashIcon className="h-4 w-4" />
                        Verwijderen
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setTab('overzicht')}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Annuleren
                    </button>
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={savingEdit || !editForm.company_name.trim()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-brand-purple/90 disabled:opacity-50"
                    >
                      <CheckIcon className="h-4 w-4" />
                      Opslaan
                    </button>
                  </div>
                </div>
              )}
            </div>

            {prospect && (
              <ComposeMailDrawer
                open={composeOpen}
                onClose={() => setComposeOpen(false)}
                initialRecipients={[{ type: 'prospect', id: prospect.id, label: prospect.company_name }]}
                onSent={() => {
                  refreshActivities(prospect.id);
                }}
              />
            )}

            {showLost && prospect && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 px-4">
                <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
                  <h3 className="text-base font-bold text-slate-900">Reden voor verloren</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Geef kort aan waarom deze prospect niet doorgaat. Dit helpt het team van toekomstige beslissingen.
                  </p>
                  <textarea
                    value={lostReason}
                    onChange={e => setLostReason(e.target.value)}
                    rows={3}
                    className="mt-3 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-purple/50"
                    placeholder="Bv. te duur, andere leverancier gekozen, geen budget..."
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowLost(false);
                        setLostReason('');
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Annuleren
                    </button>
                    <button
                      type="button"
                      onClick={submitLost}
                      disabled={!lostReason.trim()}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      Markeer als verloren
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function normalizeTelLink(phone: string): string {
  // Normaliseer naar E.164-achtig formaat voor tel:-links.
  // Behoud een leading +; vervang NL/BE-prefixen 0031/0032 naar +31/+32.
  const cleaned = phone.replace(/[\s\-().\/]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('0031')) return `+31${cleaned.slice(4)}`;
  if (cleaned.startsWith('0032')) return `+32${cleaned.slice(4)}`;
  if (cleaned.startsWith('06') || cleaned.startsWith('0')) return `+31${cleaned.slice(1)}`;
  return cleaned;
}

function Overview({
  prospect,
  am,
  ams,
  branches,
  canManage,
  onStatus,
  onAssign,
  onConvert,
  onCompose,
}: {
  prospect: ProspectDetail;
  am: AdminUserOption | null;
  ams: AdminUserOption[];
  branches: BranchOption[];
  canManage: boolean;
  onStatus: (s: ProspectStatus) => void;
  onAssign: (id: string | null) => void;
  onConvert: () => void;
  onCompose: () => void;
}) {
  const fullAddress = [prospect.address, [prospect.postcode, prospect.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  const mapsHref = fullAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
    : null;
  const branchNameMap: Record<string, string> = Object.fromEntries(branches.map(b => [b.slug, b.name]));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pipeline</h3>
          <span className="text-[11px] text-slate-400">
            <ArrowsRightLeftIcon className="mr-1 inline h-3 w-3" />
            laatst gewijzigd{' '}
            {prospect.status_changed_at ? new Date(prospect.status_changed_at).toLocaleDateString('nl-NL') : '—'}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PROSPECT_STATUSES.map(s => {
            const active = prospect.status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onStatus(s)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                  active
                    ? 'bg-brand-purple text-white ring-brand-purple'
                    : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {PROSPECT_STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>
        {prospect.status === 'verloren' && prospect.lost_reason && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <strong>Verloren omdat:</strong> {prospect.lost_reason}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {prospect.contact_person && (
          <Detail Icon={IdentificationIcon} label="Contact" value={prospect.contact_person} />
        )}
        {prospect.email && (
          <Detail
            Icon={EnvelopeIcon}
            label="E-mail"
            value={
              <div className="flex flex-wrap items-center gap-2">
                <a href={`mailto:${prospect.email}`} className="text-brand-purple hover:underline">
                  {prospect.email}
                </a>
                <button
                  type="button"
                  onClick={onCompose}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-purple px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-brand-purple/90"
                  title="Stuur een mail vanuit je eigen WarmeLeads-adres"
                >
                  <EnvelopeIcon className="h-3 w-3" />
                  Mail versturen
                </button>
              </div>
            }
          />
        )}
        {prospect.phone && (
          <Detail
            Icon={PhoneIcon}
            label="Telefoon"
            value={
              <a href={`tel:${normalizeTelLink(prospect.phone)}`} className="text-brand-purple hover:underline">
                {prospect.phone}
              </a>
            }
          />
        )}
        {prospect.website && (
          <Detail
            Icon={GlobeAltIcon}
            label="Website"
            value={
              <a
                href={prospect.website.startsWith('http') ? prospect.website : `https://${prospect.website}`}
                target="_blank"
                rel="noreferrer"
                className="text-brand-purple hover:underline"
              >
                {prospect.website}
              </a>
            }
          />
        )}
        {fullAddress && (
          <Detail
            Icon={MapPinIcon}
            label="Adres"
            value={
              mapsHref ? (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-purple hover:underline"
                >
                  {fullAddress}
                </a>
              ) : (
                fullAddress
              )
            }
          />
        )}
      </div>

      {prospect.branches && prospect.branches.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Interesse in branches</h3>
          <div className="flex flex-wrap gap-1.5">
            {prospect.branches.map(b => (
              <span
                key={b}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
              >
                {branchNameMap[b] || b}
              </span>
            ))}
          </div>
        </div>
      )}

      {prospect.notes && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Notities</h3>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{prospect.notes}</p>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Account manager</h3>
          {canManage && (
            <select
              value={prospect.account_manager_id || ''}
              onChange={e => onAssign(e.target.value || null)}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-purple/50"
            >
              <option value="">Niet toegewezen</option>
              {ams.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <UserPlusIcon className="h-4 w-4 text-slate-400" />
          <span className="text-slate-700">{am?.name || 'Niet toegewezen'}</span>
          {prospect.assigned_at && (
            <span className="text-[11px] text-slate-400">
              sinds {new Date(prospect.assigned_at).toLocaleDateString('nl-NL')}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onCompose}
          disabled={!prospect.email}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-purple px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-purple/90 disabled:cursor-not-allowed disabled:opacity-50"
          title={prospect.email ? 'Stuur een mail vanuit je eigen WarmeLeads-adres' : 'Geen e-mailadres bekend'}
        >
          <EnvelopeIcon className="h-5 w-5" />
          Mail versturen
        </button>
        {!prospect.converted_to_customer_id && (
          <button
            type="button"
            onClick={onConvert}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            <CheckBadgeIcon className="h-5 w-5" />
            Promoveer naar klant
          </button>
        )}
      </div>
    </div>
  );
}

function Detail({
  Icon,
  label,
  value,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-sm text-slate-800">{value}</div>
    </div>
  );
}
