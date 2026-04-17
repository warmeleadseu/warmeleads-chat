'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  ArrowPathIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { usePortal } from '../portalContext';
import { portalFetch } from '@/lib/portalAuth';
import { PERMISSION_GROUPS, ROLE_DEFAULTS, type Permission } from '@/lib/portalPermissions';

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

const ROLE_LABELS: Record<string, string> = { owner: 'Eigenaar', manager: 'Manager', agent: 'Agent' };
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
      <div className="py-16 text-center">
        <ShieldCheckIcon className="mx-auto h-12 w-12 text-slate-300" />
        <h2 className="mt-4 text-lg font-semibold text-slate-900">Geen toegang</h2>
        <p className="mt-1 text-sm text-slate-500">Je hebt geen rechten om het team te beheren.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-purple" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Team</h1>
          <p className="mt-0.5 text-sm text-slate-500">{members.length} teamleden bij {customer.name}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-purple/90"
        >
          <PlusIcon className="h-4 w-4" />
          Teamlid toevoegen
        </button>
      </div>

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
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <UserCircleIcon className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-3 text-sm font-semibold text-slate-900">Nog geen teamleden</h3>
          <p className="mt-1 text-sm text-slate-500">Voeg je eerste agent of manager toe om leads te verdelen.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-purple/90"
          >
            <PlusIcon className="h-4 w-4" />
            Teamlid toevoegen
          </button>
        </div>
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
                        <span className="text-sm text-slate-600">{st ? `${st.conversion_rate}%` : '—'}</span>
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
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                title="Bewerken"
                              >
                                <PencilSquareIcon className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setDetailMember(member)}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
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
        body: JSON.stringify({ name, email, password, role, permissions, phone: phone || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Aanmaken mislukt');
      onSuccess(data.member);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Aanmaken mislukt');
    }
    setSaving(false);
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className="pointer-events-auto flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)]"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">Teamlid toevoegen</h2>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={submit} className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Naam *</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30"
                  placeholder="Jan de Vries" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">E-mail *</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30"
                  placeholder="jan@bedrijf.nl" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Wachtwoord * (min. 8 tekens)</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm outline-none transition focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Telefoon</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30"
                  placeholder="06-12345678" />
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Rol</label>
              <div className="grid grid-cols-2 gap-2">
                {(['agent', 'manager'] as const).map(r => (
                  <button key={r} type="button" onClick={() => applyRoleDefaults(r)}
                    className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition ${
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
          </form>

          <div className="border-t border-slate-100 px-5 py-3">
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50">Annuleren</button>
              <button onClick={submit} disabled={saving || !name || !email || password.length < 8}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-purple/90 disabled:opacity-50">
                {saving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                Toevoegen
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
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
      const body: Record<string, unknown> = { name, email, phone: phone || null, role, is_active: isActive, permissions };
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
              className={`relative h-6 w-11 rounded-full transition ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
              role="switch" aria-pressed={isActive}>
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${isActive ? 'translate-x-5' : ''}`} />
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
              <p className="text-sm text-slate-500">Eigenaar — alle rechten</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {member.permissions.map(p => (
                  <span key={p} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{p}</span>
                ))}
                {member.permissions.length === 0 && <p className="text-sm text-slate-400">Geen rechten</p>}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
