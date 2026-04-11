'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  PencilSquareIcon,
  XMarkIcon,
  EyeIcon,
  EyeSlashIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  CameraIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import Image from 'next/image';
import { adminFetch } from '@/lib/adminAuth';
import { useAdmin } from '../adminContext';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  phone?: string | null;
  title?: string | null;
  avatar_url?: string | null;
}

export default function UsersPage() {
  const { user: currentUser } = useAdmin();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<AdminUser | null>(null);

  const isSuperAdmin = currentUser.role === 'superadmin';

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch('/api/admin/users');
    if (res.ok) {
      const d = await res.json();
      setUsers(d.users || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleActive = async (u: AdminUser) => {
    if (u.is_active) {
      setConfirmDeactivate(u);
      return;
    }
    await adminFetch('/api/admin/users', {
      method: 'PUT',
      body: JSON.stringify({ id: u.id, is_active: true }),
    });
    fetchUsers();
  };

  const handleDeactivate = async () => {
    if (!confirmDeactivate) return;
    await adminFetch('/api/admin/users', {
      method: 'DELETE',
      body: JSON.stringify({ id: confirmDeactivate.id }),
    });
    setConfirmDeactivate(null);
    fetchUsers();
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <ExclamationTriangleIcon className="mb-4 h-12 w-12 text-amber-400" />
        <h2 className="text-lg font-bold text-slate-800">Geen toegang</h2>
        <p className="mt-1 text-sm text-slate-500">U heeft geen toegang tot deze pagina</p>
      </div>
    );
  }

  const roleBadge = (role: string) => {
    if (role === 'superadmin') return 'bg-purple-100 text-purple-700';
    if (role === 'accountmanager') return 'bg-amber-100 text-amber-700';
    return 'bg-blue-100 text-blue-700';
  };

  const roleLabel = (role: string) => {
    if (role === 'superadmin') return 'Superadmin';
    if (role === 'accountmanager') return 'Accountmanager';
    return 'Admin';
  };

  const statusBadge = (active: boolean) => {
    if (active) return 'bg-emerald-100 text-emerald-700';
    return 'bg-red-100 text-red-600';
  };

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Gebruikersbeheer</h1>
          <p className="mt-0.5 text-sm text-slate-500">Beheer admin-gebruikers en rechten</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-button-gradient px-3.5 py-2 text-sm font-bold text-white shadow-sm"
        >
          <PlusIcon className="h-4 w-4" /> Nieuwe gebruiker
        </button>
      </div>

      {loading ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="divide-y divide-slate-100">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-48 animate-pulse rounded bg-slate-50" />
                </div>
                <div className="h-5 w-16 animate-pulse rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center shadow-sm">
          <UserGroupIcon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-500">Nog geen gebruikers. Voeg je eerste admin toe.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Naam</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">E-mail</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Rol</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Laatste login</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => (
                  <tr key={u.id} className={`transition hover:bg-slate-50/50 ${!u.is_active ? 'opacity-60' : ''}`}>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {u.avatar_url ? (
                          <Image
                            src={u.avatar_url}
                            alt={u.name}
                            width={36}
                            height={36}
                            className="h-9 w-9 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-purple/20 to-brand-purple/10">
                            <span className="text-sm font-bold text-brand-purple">
                              {u.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="font-semibold text-slate-900">{u.name}</span>
                          {u.id === currentUser.id && (
                            <span className="ml-1.5 text-[10px] font-medium text-slate-400">(jij)</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-600">{u.email}</td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${roleBadge(u.role)}`}>
                        {u.role === 'superadmin' && <ShieldCheckIcon className="h-3 w-3" />}
                        {roleLabel(u.role)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusBadge(u.is_active)}`}>
                        {u.is_active ? 'Actief' : 'Inactief'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-500">
                      {formatDate(u.last_login)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditing(u)}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-brand-purple"
                          title="Bewerken"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        {u.id !== currentUser.id && (
                          <button
                            onClick={() => toggleActive(u)}
                            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                              u.is_active
                                ? 'text-red-500 hover:bg-red-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {u.is_active ? 'Deactiveer' : 'Activeer'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {(editing || showNew) && (
          <UserFormModal
            user={editing}
            onClose={() => { setEditing(null); setShowNew(false); }}
            onSaved={() => { setEditing(null); setShowNew(false); fetchUsers(); }}
          />
        )}
      </AnimatePresence>

      {/* Deactivation Confirmation */}
      <AnimatePresence>
        {confirmDeactivate && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
              onClick={() => setConfirmDeactivate(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            >
              <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Gebruiker deactiveren</h3>
                    <p className="text-sm text-slate-500">
                      Weet u zeker dat u <strong>{confirmDeactivate.name}</strong> wilt deactiveren?
                    </p>
                  </div>
                </div>
                <p className="mb-5 text-xs text-slate-500">
                  De gebruiker kan dan niet meer inloggen. U kunt dit later ongedaan maken.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmDeactivate(null)}
                    className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={handleDeactivate}
                    className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700"
                  >
                    Deactiveer
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

interface CustomerOption { id: string; name: string; account_manager_id?: string | null; }

function UserFormModal({ user, onClose, onSaved }: { user: AdminUser | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || 'admin',
    password: '',
    phone: user?.phone || '',
    title: user?.title || '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [assignedCustomerIds, setAssignedCustomerIds] = useState<Set<string>>(new Set());
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar_url || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAM = form.role === 'accountmanager';

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    setUploadingAvatar(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('user_id', user.id);
      const res = await adminFetch('/api/admin/users/avatar', { method: 'POST', body: fd, raw: true });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Upload mislukt');
      }
      const { avatar_url } = await res.json();
      setAvatarUrl(avatar_url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload mislukt');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAvatarDelete = async () => {
    if (!user?.id) return;
    setUploadingAvatar(true);
    try {
      await adminFetch('/api/admin/users/avatar', {
        method: 'DELETE',
        body: JSON.stringify({ user_id: user.id }),
      });
      setAvatarUrl(null);
    } catch { /* ignore */ } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    if (!isAM) return;
    setLoadingCustomers(true);
    adminFetch('/api/admin/customers')
      .then(r => r.ok ? r.json() : { customers: [] })
      .then((data: { customers?: CustomerOption[] }) => {
        const custs = data.customers || [];
        setCustomers(custs);
        if (isEdit) {
          setAssignedCustomerIds(new Set(
            custs.filter(c => c.account_manager_id === user!.id).map(c => c.id)
          ));
        }
      })
      .finally(() => setLoadingCustomers(false));
  }, [isAM, isEdit, user]);

  const save = async () => {
    if (!form.name || !form.email) { setError('Naam en e-mail zijn verplicht'); return; }
    if (!isEdit && !form.password) { setError('Wachtwoord is verplicht voor nieuwe gebruikers'); return; }
    if (form.password && form.password.length < 8) { setError('Wachtwoord moet minimaal 8 tekens zijn'); return; }

    setSaving(true);
    setError('');

    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
      };
      if (form.password) payload.password = form.password;
      if (isEdit) payload.id = user!.id;
      if (isAM) {
        payload.phone = form.phone || null;
        payload.title = form.title || null;
      }

      const res = await adminFetch('/api/admin/users', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Er ging iets mis');
      }

      const result = await res.json();
      const userId = isEdit ? user!.id : result.user?.id;

      if (isAM && userId && customers.length > 0) {
        const updates = customers.map(c => {
          const shouldAssign = assignedCustomerIds.has(c.id);
          const wasAssigned = c.account_manager_id === userId;
          if (shouldAssign && !wasAssigned) {
            return adminFetch('/api/admin/customers', {
              method: 'PUT',
              body: JSON.stringify({ id: c.id, account_manager_id: userId }),
            });
          } else if (!shouldAssign && wasAssigned) {
            return adminFetch('/api/admin/customers', {
              method: 'PUT',
              body: JSON.stringify({ id: c.id, account_manager_id: null }),
            });
          }
          return null;
        }).filter(Boolean);
        await Promise.all(updates);
      }

      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis');
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-[60] w-full max-w-md overflow-y-auto bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? 'Gebruiker bewerken' : 'Nieuwe gebruiker'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
          )}

          {/* Avatar upload — only for existing users */}
          {isEdit && (
            <div className="flex items-center gap-4">
              <div className="group relative">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={form.name}
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded-full object-cover ring-2 ring-slate-100"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-purple/20 to-brand-purple/10 ring-2 ring-slate-100">
                    <span className="text-xl font-bold text-brand-purple">
                      {form.name ? form.name.charAt(0).toUpperCase() : '?'}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition group-hover:bg-black/40"
                >
                  <CameraIcon className="h-5 w-5 text-white opacity-0 transition group-hover:opacity-100" />
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="text-left text-xs font-medium text-brand-purple hover:underline disabled:opacity-50"
                >
                  {uploadingAvatar ? 'Uploaden...' : avatarUrl ? 'Foto wijzigen' : 'Foto uploaden'}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleAvatarDelete}
                    disabled={uploadingAvatar}
                    className="flex items-center gap-1 text-left text-xs text-red-500 hover:underline disabled:opacity-50"
                  >
                    <TrashIcon className="h-3 w-3" /> Verwijderen
                  </button>
                )}
                <p className="text-[10px] text-slate-400">JPG, PNG of WebP · max 2MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Naam *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">E-mail *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Wachtwoord {isEdit ? '(laat leeg om niet te wijzigen)' : '*'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder={isEdit ? '••••••••' : 'Min. 8 tekens'}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:text-slate-600"
              >
                {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Rol *</label>
            <select
              value={form.role}
              onChange={e => set('role', e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
            >
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
              <option value="accountmanager">Accountmanager</option>
            </select>
          </div>

          {/* AM-specific fields */}
          {isAM && (
            <>
              <div className="border-t border-slate-100 pt-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-600">Accountmanager gegevens</p>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Functietitel</label>
                    <input
                      value={form.title}
                      onChange={e => set('title', e.target.value)}
                      placeholder="bijv. Senior Accountmanager"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Telefoonnummer</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => set('phone', e.target.value)}
                      placeholder="bijv. 06 12345678"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-amber-600">
                  Toegewezen klanten
                </label>
                {loadingCustomers ? (
                  <div className="rounded-lg border border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                    Klanten laden...
                  </div>
                ) : customers.length === 0 ? (
                  <p className="text-xs text-slate-400">Nog geen klanten in het systeem.</p>
                ) : (
                  <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                    {customers.map(c => (
                      <label key={c.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={assignedCustomerIds.has(c.id)}
                          onChange={() => {
                            setAssignedCustomerIds(prev => {
                              const next = new Set(prev);
                              if (next.has(c.id)) next.delete(c.id);
                              else next.add(c.id);
                              return next;
                            });
                          }}
                          className="rounded border-slate-300 text-brand-purple focus:ring-brand-purple/20"
                        />
                        <span className="truncate">{c.name}</span>
                        {c.account_manager_id && c.account_manager_id !== user?.id && (
                          <span className="ml-auto shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-600">
                            andere AM
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-slate-100 bg-white px-5 py-4">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Annuleren
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 rounded-lg bg-button-gradient py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? 'Opslaan...' : isEdit ? 'Bijwerken' : 'Aanmaken'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
