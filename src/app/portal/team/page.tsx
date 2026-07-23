'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon,
  ChevronRightIcon,
  UserCircleIcon,
  ShieldCheckIcon,
  EnvelopeIcon,
  PhoneIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { usePortal } from '../portalContext';
import { portalFetch } from '@/lib/portalAuth';
import { PERMISSION_GROUPS, ROLE_DEFAULTS, type Permission, type AssignmentRules } from '@/lib/portalPermissions';
import { EmptyState, PageHeader, Skeleton, T } from '../_ui';

import { PROVINCE_OPTIONS_BE, PROVINCE_OPTIONS_NL } from '@/data/provinces';
import { formatProvinceTargetLabel } from '@/lib/provinceTargetMatch';

const MODE_OPTIONS: { value: AssignmentRules['mode']; label: string; desc: string }[] = [
  { value: 'manual', label: 'Handmatig', desc: 'Alleen handmatig toegewezen leads' },
  { value: 'auto', label: 'Automatisch', desc: 'Op basis van filters hieronder' },
  { value: 'all', label: 'Alle leads', desc: 'Ontvangt alle binnenkomende leads' },
];

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'manager' | 'agent';
  is_active: boolean;
  permissions: string[];
  assignment_rules: Record<string, unknown>;
  last_login_at: string | null;
  last_seen_at: string | null;
  login_count: number;
  phone: string | null;
  created_at: string;
  lead_count: number;
}

interface TeamStats {
  id: string;
  name: string;
  role: string;
  total_leads: number;
  leads_this_week: number;
  conversion_rate: number;
  status_breakdown: Record<string, number>;
}

function showToast(msg: string, type: 'success' | 'error' = 'success') {
  const el = document.createElement('div');
  el.className = `fixed top-4 right-4 z-[100] rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg transition-all ${
    type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
  }`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 5 * 60 * 1000;
}

const ROLE_LABELS: Record<string, string> = { owner: 'Eigenaar', manager: 'Manager', agent: 'Medewerker' };
const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-brand-purple/10 text-brand-purple',
  manager: 'bg-blue-50 text-blue-700',
  agent: 'bg-slate-100 text-slate-600',
};

export default function TeamPage() {
  const { customer, isOwner, hasPermission } = usePortal();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [stats, setStats] = useState<TeamStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [detailMember, setDetailMember] = useState<TeamMember | null>(null);

  const canManage = isOwner || hasPermission('team.manage');

  const fetchMembers = useCallback(async () => {
    try {
      const [membersRes, statsRes] = await Promise.all([
        portalFetch('/api/portal/team'),
        portalFetch('/api/portal/team/stats'),
      ]);
      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data.members || []);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const statsMap = useMemo(() => {
    const map: Record<string, TeamStats> = {};
    stats.forEach(s => { map[s.id] = s; });
    return map;
  }, [stats]);

  if (!canManage) {
    return (
      <EmptyState
        icon={ShieldCheckIcon}
        title="Geen toegang"
        body="Je hebt geen rechten om het team te beheren."
      />
    );
  }

  if (loading) {
    return <Skeleton.Page />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        subtitle={`${members.length} teamleden bij ${customer.name}`}
        action={
          <button
            onClick={() => setShowAddModal(true)}
            className={T.btnPrimary}
          >
            <PlusIcon className="h-4 w-4" />
            Teamlid toevoegen
          </button>
        }
      />

      {/* Stats cards */}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Teamleden" value={members.length} />
          <StatCard label="Actief" value={members.filter(m => m.is_active).length} />
          <StatCard label="Online" value={members.filter(m => isOnline(m.last_seen_at)).length} />
          <StatCard label="Totaal leads" value={stats.reduce((s, st) => s + st.total_leads, 0)} />
        </div>
      )}

      {/* Members list */}
      {members.length === 0 ? (
        <EmptyState
          icon={UserCircleIcon}
          title="Nog geen teamleden"
          body="Voeg je eerste medewerker of manager toe om leads te verdelen."
          cta={
            <button
              onClick={() => setShowAddModal(true)}
              className={T.btnPrimary}
            >
              <PlusIcon className="h-4 w-4" />
              Teamlid toevoegen
            </button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Naam</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 sm:table-cell">Rol</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400 md:table-cell">Leads</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400 md:table-cell">Conversie</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map(member => {
                  const st = statsMap[member.id];
                  const online = isOnline(member.last_seen_at);
                  return (
                    <tr key={member.id} className="transition hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-purple/10 text-sm font-bold text-brand-purple">
                            {member.name.charAt(0).toUpperCase()}
                            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${online ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                          </div>
                          <div className="min-w-0">
                            <button
                              onClick={() => setDetailMember(member)}
                              className="block truncate text-sm font-medium text-slate-900 hover:text-brand-purple"
                            >
                              {member.name}
                            </button>
                            <p className="truncate text-xs text-slate-400">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${ROLE_COLORS[member.role]}`}>
                          {ROLE_LABELS[member.role]}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-center md:table-cell">
                        <span className="text-sm font-medium text-slate-900">{st?.total_leads || member.lead_count}</span>
                        {st && st.leads_this_week > 0 && (
                          <span className="ml-1 text-xs text-emerald-500">+{st.leads_this_week}</span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-center md:table-cell">
                        <span className="text-sm text-slate-600">{st ? `${st.conversion_rate}%` : '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {member.is_active ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Actief
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                            Inactief
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {member.role !== 'owner' && (
                            <>
                              <button
                                onClick={() => setEditMember(member)}
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                title="Bewerken"
                              >
                                <PencilSquareIcon className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setDetailMember(member)}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                            title="Details"
                          >
                            <ChevronRightIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddMemberModal
            customer={customer}
            onClose={() => setShowAddModal(false)}
            onSuccess={(m) => {
              setMembers(prev => [...prev, m]);
              setShowAddModal(false);
              showToast('Teamlid toegevoegd');
            }}
          />
        )}
      </AnimatePresence>

      {/* Edit slide-over */}
      <AnimatePresence>
        {editMember && (
          <EditMemberPanel
            member={editMember}
            customer={customer}
            members={members}
            onClose={() => setEditMember(null)}
            onUpdate={(updated) => {
              setMembers(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
              setEditMember(null);
              showToast('Teamlid bijgewerkt');
            }}
            onDelete={(id) => {
              setMembers(prev => prev.filter(m => m.id !== id));
              setEditMember(null);
              showToast('Teamlid verwijderd');
            }}
          />
        )}
      </AnimatePresence>

      {/* Detail slide-over */}
      <AnimatePresence>
        {detailMember && (
          <MemberDetailPanel
            member={detailMember}
            stats={statsMap[detailMember.id]}
            onClose={() => setDetailMember(null)}
            onEdit={() => {
              if (detailMember.role !== 'owner') {
                setEditMember(detailMember);
                setDetailMember(null);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

/* ─── Assignment Rules Editor ─── */

function AssignmentRulesEditor({
  rules,
  onChange,
  customerBranches,
}: {
  rules: AssignmentRules;
  onChange: (r: AssignmentRules) => void;
  customerBranches: string[];
}) {
  const mode = rules.mode || 'manual';
  const branches = rules.branches || [];
  const regions = rules.regions || { type: 'provinces' as const, values: [] };
  const weight = rules.round_robin_weight || 1;

  const setMode = (m: AssignmentRules['mode']) => onChange({ ...rules, mode: m });
  const toggleBranch = (b: string) => {
    const next = branches.includes(b) ? branches.filter(x => x !== b) : [...branches, b];
    onChange({ ...rules, branches: next });
  };
  const toggleProvince = (p: string) => {
    const vals = regions.values || [];
    const next = vals.includes(p) ? vals.filter(x => x !== p) : [...vals, p];
    onChange({ ...rules, regions: { type: 'provinces', values: next } });
  };

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">Lead toewijzing</label>
      <div className="space-y-3 rounded-xl border border-slate-200 p-3">
        {/* Mode selector */}
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          {MODE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              className={`rounded-lg border-2 px-3 py-2.5 text-left transition sm:text-center ${
                mode === opt.value
                  ? 'border-brand-purple bg-brand-purple/5 text-brand-purple'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <p className="text-xs font-semibold">{opt.label}</p>
              <p className="mt-0.5 text-[10px] leading-tight text-slate-400">{opt.desc}</p>
            </button>
          ))}
        </div>

        {/* Filters — only for 'auto' mode */}
        {mode === 'auto' && (
          <div className="space-y-3 border-t border-slate-100 pt-3">
            {/* Branches */}
            {customerBranches.length > 1 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Branches</p>
                <div className="flex flex-wrap gap-1.5">
                  {customerBranches.map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => toggleBranch(b)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                        branches.includes(b)
                          ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
                {branches.length === 0 && (
                  <p className="mt-1 text-[10px] text-slate-400">Geen selectie = alle branches</p>
                )}
              </div>
            )}

            {/* Provinces */}
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Regio&apos;s (provincies)</p>
              <div className="space-y-2">
                <div>
                  <p className="mb-1 text-[10px] font-medium text-slate-400">Nederland</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PROVINCE_OPTIONS_NL.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleProvince(opt.value)}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                          regions.values?.includes(opt.value)
                            ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-medium text-slate-400">Belgi&euml;</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PROVINCE_OPTIONS_BE.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleProvince(opt.value)}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                          regions.values?.includes(opt.value)
                            ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {(!regions.values || regions.values.length === 0) && (
                <p className="mt-1 text-[10px] text-slate-400">Geen selectie = alle regio&apos;s</p>
              )}
            </div>

            {/* Limits */}
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Leads-limieten</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-0.5 block text-[10px] text-slate-400">Max per dag</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Onbeperkt"
                    value={rules.max_leads_per_day || ''}
                    onChange={e => onChange({ ...rules, max_leads_per_day: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none transition focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] text-slate-400">Max per week</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Onbeperkt"
                    value={rules.max_leads_per_week || ''}
                    onChange={e => onChange({ ...rules, max_leads_per_week: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none transition focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30"
                  />
                </div>
              </div>
            </div>

            {/* Appointment limits */}
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Afspraken-limieten</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-0.5 block text-[10px] text-slate-400">Max per dag</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Onbeperkt"
                    value={rules.max_appointments_per_day || ''}
                    onChange={e => onChange({ ...rules, max_appointments_per_day: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none transition focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] text-slate-400">Max per week</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Onbeperkt"
                    value={rules.max_appointments_per_week || ''}
                    onChange={e => onChange({ ...rules, max_appointments_per_week: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none transition focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Weight — for 'auto' and 'all' */}
        {(mode === 'auto' || mode === 'all') && (
          <div className={mode === 'all' ? 'border-t border-slate-100 pt-3' : ''}>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Gewicht (round-robin)</p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={5}
                value={weight}
                onChange={e => onChange({ ...rules, round_robin_weight: parseInt(e.target.value) })}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-purple"
              />
              <span className="min-w-[2.5rem] rounded-md bg-brand-purple/10 px-2 py-0.5 text-center text-xs font-bold text-brand-purple">
                {weight}x
              </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              Hoger gewicht = meer leads t.o.v. andere teamleden
            </p>
          </div>
        )}

        {mode === 'manual' && (
          <p className="text-xs text-slate-400">
            Deze gebruiker ontvangt geen automatische leads. Wijs leads handmatig toe via de leadsoverzichten (selecteer leads of open een lead).
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Assignment Rules Summary (read-only) ─── */

function AssignmentRulesSummary({ rules }: { rules: Record<string, unknown> }) {
  const r = rules as AssignmentRules;
  const mode = r.mode || 'manual';

  if (mode === 'manual' || !r.mode) {
    return (
      <p className="text-sm text-slate-500">Handmatig: alleen via leadsoverzichten toewijzen</p>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
          {mode === 'all' ? 'Alle leads' : 'Automatisch'}
        </span>
        {r.round_robin_weight && r.round_robin_weight > 1 && (
          <span className="rounded-md bg-brand-purple/10 px-2 py-0.5 text-xs font-semibold text-brand-purple">
            {r.round_robin_weight}x gewicht
          </span>
        )}
      </div>
      {mode === 'auto' && (
        <>
          {r.branches && r.branches.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] text-slate-400">Branches:</span>
              {r.branches.map(b => (
                <span key={b} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{b}</span>
              ))}
            </div>
          )}
          {r.regions?.values && r.regions.values.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] text-slate-400">Regio&apos;s:</span>
              {r.regions.values.map(v => (
                <span key={v} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                  {formatProvinceTargetLabel(v)}
                </span>
              ))}
            </div>
          )}
          {(r.max_leads_per_day || r.max_leads_per_week) && (
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>Leads:</span>
              {r.max_leads_per_day && <span>Max {r.max_leads_per_day}/dag</span>}
              {r.max_leads_per_day && r.max_leads_per_week && <span>&middot;</span>}
              {r.max_leads_per_week && <span>Max {r.max_leads_per_week}/week</span>}
            </div>
          )}
          {(r.max_appointments_per_day || r.max_appointments_per_week) && (
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>Afspraken:</span>
              {r.max_appointments_per_day && <span>Max {r.max_appointments_per_day}/dag</span>}
              {r.max_appointments_per_day && r.max_appointments_per_week && <span>&middot;</span>}
              {r.max_appointments_per_week && <span>Max {r.max_appointments_per_week}/week</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Add Member Modal ─── */

function AddMemberModal({
  customer,
  onClose,
  onSuccess,
}: {
  customer: { name: string; branches: string[] };
  onClose: () => void;
  onSuccess: (m: TeamMember) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'manager' | 'agent'>('agent');
  const [permissions, setPermissions] = useState<string[]>(ROLE_DEFAULTS.agent);
  const [phone, setPhone] = useState('');
  const [assignmentRules, setAssignmentRules] = useState<AssignmentRules>({ mode: 'manual' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const togglePerm = (perm: string) => {
    setPermissions(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
  };

  const applyRoleDefaults = (r: 'manager' | 'agent') => {
    setRole(r);
    setPermissions(ROLE_DEFAULTS[r]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await portalFetch('/api/portal/team', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role, permissions, phone: phone || undefined, assignment_rules: assignmentRules }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Aanmaken mislukt');
      onSuccess(data.member);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Aanmaken mislukt');
    }
    setSaving(false);
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (typeof window === 'undefined') return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:bg-black/40 sm:p-4 sm:backdrop-blur-[2px]"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="flex h-[100dvh] w-full max-w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[min(92vh,920px)] sm:max-w-4xl sm:rounded-2xl sm:border sm:border-slate-200"
      >
        <div
          className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-5 py-4 sm:rounded-t-2xl"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}
        >
          <div>
            <h2 className="text-lg font-bold text-slate-900">Teamlid toevoegen</h2>
            <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">Vul gegevens in en stel rechten in</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600" aria-label="Sluiten">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4" style={{ WebkitOverflowScrolling: 'touch' }}>
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Naam *</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30"
                  placeholder="Jan de Vries" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">E-mail *</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30"
                  placeholder="jan@bedrijf.nl" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Wachtwoord * (min. 8 tekens)</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
                    className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm outline-none transition focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Telefoon</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30"
                  placeholder="06-12345678" />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Rol</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(['agent', 'manager'] as const).map(r => (
                  <button key={r} type="button" onClick={() => applyRoleDefaults(r)}
                    className={`rounded-xl border-2 px-3 py-3 text-left text-sm font-medium transition ${
                      role === r ? 'border-brand-purple bg-brand-purple/5 text-brand-purple' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}>
                    {ROLE_LABELS[r]}
                    <p className="mt-0.5 text-[11px] font-normal text-slate-400">
                      {r === 'agent' ? 'Beperkte rechten, eigen leads' : 'Kan team beheren, alle leads'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Rechten</label>
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                {PERMISSION_GROUPS.map(group => (
                  <div key={group.label} className="rounded-xl border border-slate-200 p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</p>
                    <div className="space-y-1">
                      {group.permissions.map(perm => (
                        <label key={perm.key} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-50">
                          <input type="checkbox" checked={permissions.includes(perm.key)} onChange={() => togglePerm(perm.key)}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-purple focus:ring-brand-purple/30" />
                          <span className="text-sm leading-snug text-slate-700">{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <AssignmentRulesEditor
              rules={assignmentRules}
              onChange={setAssignmentRules}
              customerBranches={customer.branches}
            />
          </div>

          <div
            className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-white px-5 py-3"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
          >
            <button type="button" onClick={onClose} className="min-h-11 rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50">
              Annuleren
            </button>
            <button
              type="submit"
              disabled={saving || !name || !email || password.length < 8}
              className="inline-flex min-h-11 min-w-[7rem] items-center justify-center gap-2 rounded-xl bg-brand-purple px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-purple/90 disabled:opacity-50"
            >
              {saving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
              Toevoegen
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/* ─── Edit Member Panel ─── */

function EditMemberPanel({
  member,
  customer,
  members,
  onClose,
  onUpdate,
  onDelete,
}: {
  member: TeamMember;
  customer: { branches: string[] };
  members: TeamMember[];
  onClose: () => void;
  onUpdate: (m: TeamMember) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email);
  const [phone, setPhone] = useState(member.phone || '');
  const [role, setRole] = useState(member.role);
  const [isActive, setIsActive] = useState(member.is_active);
  const [permissions, setPermissions] = useState<string[]>(member.permissions);
  const [newPassword, setNewPassword] = useState('');
  const [assignmentRules, setAssignmentRules] = useState<AssignmentRules>((member.assignment_rules || { mode: 'manual' }) as AssignmentRules);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reassignTo, setReassignTo] = useState('unassign');
  const [error, setError] = useState('');

  const togglePerm = (perm: string) => {
    setPermissions(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = { name, email, phone: phone || null, role, is_active: isActive, permissions, assignment_rules: assignmentRules };
      if (newPassword.length >= 8) body.password = newPassword;
      const res = await portalFetch(`/api/portal/team/${member.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bijwerken mislukt');
      onUpdate({ ...member, ...data.member });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Bijwerken mislukt');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await portalFetch(`/api/portal/team/${member.id}?reassign_to=${reassignTo}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Verwijderen mislukt');
      }
      onDelete(member.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verwijderen mislukt');
    }
    setDeleting(false);
  };

  const otherMembers = members.filter(m => m.id !== member.id && m.role !== 'owner');

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Teamlid bewerken</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Naam</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Telefoon</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Nieuw wachtwoord (laat leeg om niet te wijzigen)</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30"
              placeholder="Min. 8 tekens" />
          </div>

          {/* Role */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Rol</label>
            <div className="grid grid-cols-2 gap-2">
              {(['agent', 'manager'] as const).map(r => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition ${
                    role === r ? 'border-brand-purple bg-brand-purple/5 text-brand-purple' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}>
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
            <span className="text-sm text-slate-700">Account actief</span>
            <button type="button" onClick={() => setIsActive(!isActive)}
              className={`relative h-7 w-12 rounded-full transition ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
              role="switch" aria-checked={isActive} aria-label="Account actief">
              <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${isActive ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Permissions */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Rechten</label>
            <div className="space-y-3 rounded-xl border border-slate-200 p-3">
              {PERMISSION_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</p>
                  <div className="space-y-1">
                    {group.permissions.map(perm => (
                      <label key={perm.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={permissions.includes(perm.key)} onChange={() => togglePerm(perm.key)}
                          className="h-4 w-4 rounded border-slate-300 text-brand-purple focus:ring-brand-purple/30" />
                        <span className="text-sm text-slate-700">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assignment Rules */}
          <AssignmentRulesEditor
            rules={assignmentRules}
            onChange={setAssignmentRules}
            customerBranches={customer.branches}
          />

          {/* Delete section */}
          <div className="border-t border-slate-100 pt-4">
            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50">
                <TrashIcon className="h-4 w-4" />
                Teamlid verwijderen
              </button>
            ) : (
              <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-semibold text-red-800">Weet je zeker dat je {member.name} wilt verwijderen?</p>
                {member.lead_count > 0 && (
                  <div>
                    <p className="mb-2 text-xs text-red-700">Er zijn {member.lead_count} leads toegewezen. Wat wil je ermee doen?</p>
                    <select value={reassignTo} onChange={e => setReassignTo(e.target.value)}
                      className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm">
                      <option value="unassign">Niet meer toewijzen (beschikbaar voor iedereen)</option>
                      {otherMembers.map(m => (
                        <option key={m.id} value={m.id}>Hertoewijzen aan {m.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={handleDelete} disabled={deleting}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">
                    {deleting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <TrashIcon className="h-4 w-4" />}
                    Definitief verwijderen
                  </button>
                  <button onClick={() => setShowDeleteConfirm(false)}
                    className="rounded-lg px-3 py-2 text-sm text-red-700 transition hover:bg-red-100">Annuleren</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 px-5 py-3">
          <div className="flex items-center justify-end gap-3">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50">Annuleren</button>
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-purple/90 disabled:opacity-50">
              {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <CheckIcon className="h-4 w-4" />}
              Opslaan
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ─── Member Detail Panel ─── */

function MemberDetailPanel({
  member,
  stats,
  onClose,
  onEdit,
}: {
  member: TeamMember;
  stats?: TeamStats;
  onClose: () => void;
  onEdit: () => void;
}) {
  const online = isOnline(member.last_seen_at);

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Teamlid details</h2>
          <div className="flex items-center gap-2">
            {member.role !== 'owner' && (
              <button onClick={onEdit} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-purple" title="Bewerken">
                <PencilSquareIcon className="h-5 w-5" />
              </button>
            )}
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-5">
          {/* Profile header */}
          <div className="flex items-center gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-purple/10 text-xl font-bold text-brand-purple">
              {member.name.charAt(0).toUpperCase()}
              <span className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white ${online ? 'bg-emerald-400' : 'bg-slate-300'}`} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{member.name}</h3>
              <div className="flex items-center gap-2">
                <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${ROLE_COLORS[member.role]}`}>
                  {ROLE_LABELS[member.role]}
                </span>
                {member.is_active ? (
                  <span className="text-xs text-emerald-600">Actief</span>
                ) : (
                  <span className="text-xs text-slate-400">Inactief</span>
                )}
              </div>
            </div>
          </div>

          {/* Contact info */}
          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <EnvelopeIcon className="h-4 w-4 text-slate-400" />
              {member.email}
            </div>
            {member.phone && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <PhoneIcon className="h-4 w-4 text-slate-400" />
                {member.phone}
              </div>
            )}
          </div>

          {/* Activity */}
          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Activiteit</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-400">Laatste login</p>
                <p className="text-sm font-medium text-slate-700">
                  {member.last_login_at ? new Date(member.last_login_at).toLocaleDateString('nl-NL') : 'Nooit'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Aantal logins</p>
                <p className="text-sm font-medium text-slate-700">{member.login_count}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Lid sinds</p>
                <p className="text-sm font-medium text-slate-700">
                  {new Date(member.created_at).toLocaleDateString('nl-NL')}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Status</p>
                <p className="text-sm font-medium text-slate-700">{online ? 'Online' : 'Offline'}</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="space-y-2 rounded-xl border border-slate-200 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Prestaties</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-slate-400">Totaal leads</p>
                  <p className="text-lg font-bold text-slate-900">{stats.total_leads}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Deze week</p>
                  <p className="text-lg font-bold text-emerald-600">{stats.leads_this_week}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Conversie</p>
                  <p className="text-lg font-bold text-brand-purple">{stats.conversion_rate}%</p>
                </div>
              </div>
              {Object.keys(stats.status_breakdown).length > 0 && (
                <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                  {Object.entries(stats.status_breakdown).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between text-xs">
                      <span className="capitalize text-slate-500">{status.replace(/_/g, ' ')}</span>
                      <span className="font-medium text-slate-700">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Permissions */}
          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Rechten</p>
            {member.role === 'owner' ? (
              <p className="text-sm text-slate-500">Eigenaar (alle rechten)</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {member.permissions.map(p => (
                  <span key={p} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{p}</span>
                ))}
                {member.permissions.length === 0 && <p className="text-sm text-slate-400">Geen rechten</p>}
              </div>
            )}
          </div>

          {/* Assignment Rules */}
          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Lead toewijzing</p>
            {member.role === 'owner' ? (
              <p className="text-sm text-slate-500">Eigenaar (ontvangt alle leads)</p>
            ) : (
              <AssignmentRulesSummary rules={member.assignment_rules} />
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
