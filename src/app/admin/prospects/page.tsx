'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  Squares2X2Icon,
  ListBulletIcon,
  UserPlusIcon,
  ArrowPathIcon,
  XMarkIcon,
  ClockIcon,
  BriefcaseIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import {
  PROSPECT_STATUSES,
  PROSPECT_STATUS_LABELS,
  type ProspectStatus,
} from '@/lib/prospects';
import { useAdmin } from '../adminContext';
import { StatusBadge } from './_components/StatusBadge';
import { ProspectDrawer, type ProspectDetail, type AdminUserOption, type BranchOption } from './_components/ProspectDrawer';
import { ProspectFormFields, EMPTY_PROSPECT, type ProspectFormState } from './_components/ProspectFormFields';
import { BulkAssignDialog } from './_components/BulkAssignDialog';
import { ConvertToCustomerDialog } from './_components/ConvertToCustomerDialog';
import { ProspectsKanban, type KanbanProspect } from './_components/ProspectsKanban';

interface ProspectListRow extends KanbanProspect {
  email: string | null;
  phone: string | null;
  postcode: string | null;
  kvk_nummer: string | null;
  source: string;
  created_at: string;
  status_changed_at: string | null;
}

type ViewMode = 'list' | 'kanban';

export default function ProspectsPage() {
  const { user } = useAdmin();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isAm = user.role === 'accountmanager';
  const canManage = user.role === 'admin' || user.role === 'superadmin';

  const [view, setView] = useState<ViewMode>(
    (searchParams.get('view') as ViewMode) === 'kanban' ? 'kanban' : 'list',
  );
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [amFilter, setAmFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [deferredSearch, statusFilter, amFilter, branchFilter]);

  const [prospects, setProspects] = useState<ProspectListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [ams, setAms] = useState<AdminUserOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);

  const drawerIdParam = searchParams.get('id');
  const [drawerId, setDrawerId] = useState<string | null>(drawerIdParam);

  useEffect(() => {
    setDrawerId(drawerIdParam);
  }, [drawerIdParam]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<ProspectFormState>(EMPTY_PROSPECT);
  const [creating, setCreating] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [convertProspect, setConvertProspect] = useState<ProspectDetail | null>(null);

  const limit = view === 'kanban' ? 200 : 50;

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(view === 'kanban' ? 1 : page));
        params.set('limit', String(limit));
        if (deferredSearch.trim()) params.set('search', deferredSearch.trim());
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (amFilter !== 'all') params.set('account_manager_id', amFilter);
        if (branchFilter !== 'all') params.set('branch', branchFilter);
        params.set('include_stats', '1');

        const res = await adminFetch(`/api/admin/prospects?${params}`);
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setProspects(data.prospects || []);
          setTotal(data.total || 0);
          if (data.stats) setStats(data.stats);
          setFetchError(null);
        } else {
          setFetchError(data?.error || `Prospects ophalen mislukt (${res.status})`);
        }
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Prospects ophalen mislukt');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, limit, deferredSearch, statusFilter, amFilter, branchFilter, view],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    let cancel = false;
    Promise.all([
      adminFetch('/api/admin/account-managers').then(r => r.json()).catch(() => ({ account_managers: [] })),
      adminFetch('/api/admin/branches').then(r => r.json()).catch(() => ({ branches: [] })),
    ]).then(([amData, branchData]) => {
      if (cancel) return;
      setAms((amData.account_managers || []).map((a: { id: string; name: string; email: string | null }) => ({ id: a.id, name: a.name, email: a.email })));
      setBranches((branchData.branches || [])
        .filter((b: { is_active?: boolean }) => b.is_active !== false)
        .map((b: { slug: string; name: string }) => ({ slug: b.slug, name: b.name })));
    });
    return () => { cancel = true; };
  }, []);

  const amNames = useMemo(() => Object.fromEntries(ams.map(a => [a.id, a.name])), [ams]);
  const branchNames = useMemo(() => Object.fromEntries(branches.map(b => [b.slug, b.name])), [branches]);

  const allSelected = prospects.length > 0 && prospects.every(p => selected.has(p.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(prospects.map(p => p.id)));
  };
  const toggle = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const switchView = (mode: ViewMode) => {
    setView(mode);
    const params = new URLSearchParams(searchParams);
    if (mode === 'kanban') params.set('view', 'kanban');
    else params.delete('view');
    router.replace(`/admin/prospects${params.toString() ? `?${params}` : ''}`);
  };

  const openDrawer = useCallback(
    (id: string | null) => {
      setDrawerId(id);
      const params = new URLSearchParams(searchParams);
      if (id) params.set('id', id);
      else params.delete('id');
      router.replace(`/admin/prospects${params.toString() ? `?${params}` : ''}`, { scroll: false });
    },
    [router, searchParams],
  );

  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!createForm.company_name.trim() || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await adminFetch('/api/admin/prospects', {
        method: 'POST',
        body: JSON.stringify(createForm),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.prospect) {
        setShowCreate(false);
        setCreateForm(EMPTY_PROSPECT);
        await fetchData();
        openDrawer(data.prospect.id);
      } else {
        setCreateError(data.error || 'Aanmaken mislukt');
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Aanmaken mislukt');
    } finally {
      setCreating(false);
    }
  };

  const moveStatus = async (id: string, status: ProspectStatus, lostReason?: string) => {
    const original = prospects.find(p => p.id === id);
    setProspects(prev => prev.map(p => (p.id === id ? { ...p, status } : p)));
    const res = await adminFetch(`/api/admin/prospects/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, lost_reason: lostReason }),
    });
    if (!res.ok) {
      if (original) {
        setProspects(prev => prev.map(p => (p.id === id ? original : p)));
      }
      const data = await res.json().catch(() => null);
      setFetchError(data?.error || 'Status wijzigen mislukt');
      return;
    }
    fetchData(true);
  };

  const onProspectUpdated = (p: ProspectDetail) => {
    setProspects(prev => prev.map(x => (x.id === p.id ? { ...x, ...p, open_task_count: x.open_task_count } : x)));
  };

  const onProspectDeleted = (id: string) => {
    setProspects(prev => prev.filter(p => p.id !== id));
    setSelected(prev => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  return (
    <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
            <BriefcaseIcon className="h-6 w-6 text-brand-purple sm:h-7 sm:w-7" />
            Prospects
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Installateur-bedrijven die we als klant willen winnen. Niet te verwarren met Leads CRM (consumer-leads).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <Link
              href="/admin/prospects/import"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:flex-initial"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Importeren
            </Link>
          )}
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-purple/90 sm:flex-initial"
          >
            <PlusIcon className="h-4 w-4" />
            Nieuwe prospect
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8">
        <KpiTile label="Totaal" value={stats.total ?? total} accent="bg-slate-50 text-slate-700" />
        {PROSPECT_STATUSES.map(s => (
          <KpiTile
            key={s}
            label={PROSPECT_STATUS_LABELS[s]}
            value={stats[s] ?? 0}
            accent={statusColorClass(s)}
            active={statusFilter === s}
            onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
          />
        ))}
      </div>

      {fetchError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          <div className="flex items-start justify-between gap-3">
            <span>{fetchError}</span>
            <button
              type="button"
              onClick={() => fetchData(true)}
              className="shrink-0 rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            >
              Opnieuw proberen
            </button>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Zoek op bedrijfsnaam, contact, e-mail, KVK, plaats..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-purple/50"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-purple/50"
          >
            <option value="all">Alle statussen</option>
            {PROSPECT_STATUSES.map(s => (
              <option key={s} value={s}>{PROSPECT_STATUS_LABELS[s]}</option>
            ))}
          </select>
          {!isAm && (
            <select
              value={amFilter}
              onChange={e => setAmFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-purple/50"
            >
              <option value="all">Alle AMs</option>
              <option value="unassigned">Niet toegewezen</option>
              {ams.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
          {branches.length > 0 && (
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-purple/50"
            >
              <option value="all">Alle branches</option>
              {branches.map(b => (
                <option key={b.slug} value={b.slug}>{b.name}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => fetchData(true)}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
            aria-label="Verversen"
          >
            <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <div className="ml-auto flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => switchView('list')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                view === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ListBulletIcon className="h-4 w-4" />
              Lijst
            </button>
            <button
              type="button"
              onClick={() => switchView('kanban')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                view === 'kanban' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Squares2X2Icon className="h-4 w-4" />
              Kanban
            </button>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-brand-purple/5 px-3 py-2 ring-1 ring-inset ring-brand-purple/20">
            <span className="text-xs font-semibold text-brand-purple">{selected.size} geselecteerd</span>
            {canManage && (
              <button
                type="button"
                onClick={() => setBulkOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
              >
                <UserPlusIcon className="h-3.5 w-3.5" />
                Bulk-toewijzen
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-auto inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
              Selectie wissen
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      {view === 'list' ? (
        <ListView
          prospects={prospects}
          loading={loading}
          selected={selected}
          allSelected={allSelected}
          toggle={toggle}
          toggleAll={toggleAll}
          amNames={amNames}
          onOpen={openDrawer}
          page={page}
          total={total}
          limit={limit}
          onPage={setPage}
          canManage={canManage}
        />
      ) : (
        <ProspectsKanban
          prospects={prospects}
          amNames={amNames}
          branchNames={branchNames}
          onMove={moveStatus}
          onOpen={openDrawer}
          canDrag
        />
      )}

      {/* Drawer */}
      {drawerId && (
        <ProspectDrawer
          prospectId={drawerId}
          open
          onClose={() => openDrawer(null)}
          onUpdated={onProspectUpdated}
          onDeleted={onProspectDeleted}
          branches={branches}
          ams={ams}
          canManage={canManage}
          onConvert={p => setConvertProspect(p)}
        />
      )}

      {/* Create */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => { setShowCreate(false); setCreateError(null); }}
        >
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">Nieuwe prospect</h2>
              <button
                type="button"
                onClick={() => { setShowCreate(false); setCreateError(null); }}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <ProspectFormFields value={createForm} onChange={setCreateForm} branches={branches} />
              {createError && (
                <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {createError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
              <button
                type="button"
                onClick={() => { setShowCreate(false); setCreateError(null); }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !createForm.company_name.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-brand-purple/90 disabled:opacity-50"
              >
                <PlusIcon className="h-4 w-4" />
                {creating ? 'Aanmaken...' : 'Prospect aanmaken'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk assign */}
      <BulkAssignDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        prospectIds={Array.from(selected)}
        ams={ams}
        onDone={() => {
          setBulkOpen(false);
          setSelected(new Set());
          fetchData(true);
        }}
      />

      {/* Convert */}
      {convertProspect && (
        <ConvertToCustomerDialog
          open
          onClose={() => setConvertProspect(null)}
          prospect={convertProspect}
          branches={branches}
          onDone={customerId => {
            setConvertProspect(null);
            openDrawer(null);
            router.push(`/admin/customers?highlight=${customerId}`);
          }}
        />
      )}
    </div>
  );
}

function KpiTile({
  label,
  value,
  accent,
  active,
  onClick,
}: {
  label: string;
  value: number;
  accent: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const cls = `rounded-xl border bg-white px-3 py-2.5 text-left ring-1 ring-inset transition-shadow ${
    active ? 'border-brand-purple/40 ring-brand-purple/30 shadow-sm' : 'border-slate-200 ring-slate-100 hover:shadow-sm motion-reduce:hover:shadow-none'
  }`;
  const inner = (
    <>
      <div className={`mb-1 inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${accent}`}>
        {label}
      </div>
      <div className="text-xl font-bold text-slate-900 tabular-nums">{value.toLocaleString('nl-NL')}</div>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={cls}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

function statusColorClass(s: ProspectStatus): string {
  switch (s) {
    case 'nieuw':
      return 'bg-slate-100 text-slate-600';
    case 'contact':
      return 'bg-sky-100 text-sky-700';
    case 'gekwalificeerd':
      return 'bg-purple-100 text-purple-700';
    case 'voorstel':
      return 'bg-orange-100 text-orange-700';
    case 'gewonnen':
      return 'bg-emerald-100 text-emerald-700';
    case 'verloren':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-500';
  }
}

function ListView({
  prospects,
  loading,
  selected,
  allSelected,
  toggle,
  toggleAll,
  amNames,
  onOpen,
  page,
  total,
  limit,
  onPage,
  canManage,
}: {
  prospects: ProspectListRow[];
  loading: boolean;
  selected: Set<string>;
  allSelected: boolean;
  toggle: (id: string) => void;
  toggleAll: () => void;
  amNames: Record<string, string>;
  onOpen: (id: string) => void;
  page: number;
  total: number;
  limit: number;
  onPage: (p: number) => void;
  canManage: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="my-2 h-12 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }

  if (prospects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <BriefcaseIcon className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-3 text-base font-semibold text-slate-700">Nog geen prospects</h3>
        <p className="mt-1 text-sm text-slate-500">
          Begin met het toevoegen van een prospect of importeer een Excel/CSV-lijst.
        </p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {canManage && (
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-slate-300 text-brand-purple focus:ring-brand-purple"
                  />
                </th>
              )}
              <th className="px-3 py-2.5">Bedrijf</th>
              <th className="px-3 py-2.5">Contact</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">AM</th>
              <th className="px-3 py-2.5">Volgende actie</th>
              <th className="px-3 py-2.5 text-right">Bijgewerkt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {prospects.map(p => (
              <tr
                key={p.id}
                className="cursor-pointer transition-colors hover:bg-slate-50"
                onClick={() => onOpen(p.id)}
              >
                {canManage && (
                  <td className="px-3 py-2.5" onClick={e => { e.stopPropagation(); toggle(p.id); }}>
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                      onClick={e => e.stopPropagation()}
                      className="h-4 w-4 rounded border-slate-300 text-brand-purple focus:ring-brand-purple"
                    />
                  </td>
                )}
                <td className="px-3 py-2.5">
                  <div className="font-semibold text-slate-900">{p.company_name}</div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    {p.kvk_nummer && <span className="font-mono">KVK {p.kvk_nummer}</span>}
                    {p.city && <span>{p.city}</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {p.contact_person && <div className="text-slate-700">{p.contact_person}</div>}
                  {p.email && <div className="text-[11px] text-slate-400">{p.email}</div>}
                  {p.phone && <div className="text-[11px] text-slate-400">{p.phone}</div>}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={p.status} size="sm" />
                </td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1 text-xs text-slate-700">
                    <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                    {p.account_manager_id ? amNames[p.account_manager_id] || '...' : (
                      <span className="text-slate-400">Niet toegewezen</span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  {p.next_action_at ? (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                      <ClockIcon className="h-3.5 w-3.5" />
                      {new Date(p.next_action_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">—</span>
                  )}
                  {(p.open_task_count ?? 0) > 0 && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      {p.open_task_count}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right text-[11px] text-slate-400">
                  {new Date(p.updated_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2.5 text-xs text-slate-500">
          <span>
            Pagina {page} van {totalPages} <span className="text-slate-400">({total} prospects)</span>
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 disabled:opacity-50"
            >
              Vorige
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPage(page + 1)}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 disabled:opacity-50"
            >
              Volgende
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
