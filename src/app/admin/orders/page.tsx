'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrashIcon,
  FunnelIcon,
  ArrowPathIcon,
  ShoppingCartIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { portalBtwRate } from '@/lib/invoiceVat';

interface Order {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_country?: string | null;
  customer_vat_id?: string | null;
  branch: string;
  branch_name: string;
  batch_size: number;
  price_per_lead: number;
  total_price: number;
  status: string;
  paid_at: string | null;
  mollie_payment_id: string | null;
  batch_id: string | null;
  notes: string | null;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircleIcon }> = {
  paid: { label: 'Betaald', color: 'bg-emerald-50 text-emerald-700', icon: CheckCircleIcon },
  pending: { label: 'In afwachting', color: 'bg-amber-50 text-amber-700', icon: ClockIcon },
  failed: { label: 'Mislukt', color: 'bg-red-50 text-red-700', icon: XCircleIcon },
  expired: { label: 'Verlopen', color: 'bg-slate-100 text-slate-500', icon: ClockIcon },
  cancelled: { label: 'Geannuleerd', color: 'bg-slate-100 text-slate-500', icon: XCircleIcon },
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const deleteOrder = useCallback(async (id: string) => {
    if (!confirm('Weet je zeker dat je deze bestelling wilt verwijderen?')) return;
    try {
      const res = await adminFetch('/api/admin/orders', {
        method: 'DELETE',
        body: JSON.stringify({ order_id: id }),
      });
      if (res.ok) {
        setOrders(prev => prev.filter(o => o.id !== id));
        showToast('Bestelling verwijderd');
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || 'Verwijderen mislukt');
      }
    } catch {
      showToast('Verwijderen mislukt');
    }
  }, [showToast]);

  const filtered = useMemo(() => {
    let list = orders;
    if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(o =>
        o.customer_name.toLowerCase().includes(s) ||
        o.customer_email.toLowerCase().includes(s) ||
        o.branch_name.toLowerCase().includes(s) ||
        o.id.toLowerCase().includes(s)
      );
    }
    return list;
  }, [orders, statusFilter, search]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    orders.forEach(o => { c[o.status] = (c[o.status] || 0) + 1; });
    return c;
  }, [orders]);

  const totalRevenue = useMemo(() =>
    orders.filter(o => o.status === 'paid').reduce((sum, o) => sum + Number(o.total_price || 0), 0)
  , [orders]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <ShoppingCartIcon className="h-7 w-7 text-brand-purple" />
            Bestellingen
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {orders.length} bestellingen &middot; &euro;{totalRevenue.toFixed(2)} omzet (excl. BTW)
          </p>
        </div>
        <button onClick={fetchOrders} disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50">
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Vernieuwen
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Zoek op klant, branche of ID..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-brand-purple/50 focus:bg-white"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FunnelIcon className="h-4 w-4 text-slate-400" />
          {['all', 'paid', 'pending', 'failed', 'expired', 'cancelled'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                statusFilter === s
                  ? 'bg-brand-purple text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {s === 'all' ? 'Alles' : STATUS_MAP[s]?.label || s}
              <span className="ml-1 opacity-70">({statusCounts[s] || 0})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading && orders.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <ArrowPathIcon className="mr-2 h-5 w-5 animate-spin" /> Laden...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
          Geen bestellingen gevonden
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Klant</th>
                  <th className="px-4 py-3">Branche</th>
                  <th className="px-4 py-3 text-right">Leads</th>
                  <th className="px-4 py-3 text-right">&euro;/lead</th>
                  <th className="px-4 py-3 text-right">Totaal</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Datum</th>
                  <th className="px-4 py-3 text-right">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(o => {
                  const s = STATUS_MAP[o.status] || STATUS_MAP.pending;
                  const Icon = s.icon;
                  return (
                    <tr key={o.id} className="group transition hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{o.customer_name}</p>
                        <p className="text-[11px] text-slate-400">{o.customer_email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-brand-purple/10 px-2 py-0.5 text-[11px] font-medium text-brand-purple">{o.branch_name}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">{o.batch_size}</td>
                      <td className="px-4 py-3 text-right text-slate-600">&euro;{Number(o.price_per_lead).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        <div>
                          <span className="font-medium text-slate-900">&euro;{Number(o.total_price).toFixed(2)}</span>
                          <span className="ml-1 text-[10px] text-slate-400">excl.</span>
                        </div>
                        {(() => {
                          const rate = portalBtwRate({ country: o.customer_country, vat_id: o.customer_vat_id });
                          const total = Number(o.total_price) * (1 + rate);
                          return (
                            <span className="text-[10px] text-slate-400">&euro;{total.toFixed(2)} {rate === 0 ? '(BTW verlegd)' : 'incl.'}</span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.color}`}>
                          <Icon className="h-3 w-3" />
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(o.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {o.paid_at && (
                          <p className="text-[10px] text-emerald-600">
                            Betaald {new Date(o.paid_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          {o.status !== 'paid' && (
                            <button onClick={() => deleteOrder(o.id)} title="Verwijderen"
                              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500">
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="space-y-3 md:hidden">
            {filtered.map(o => {
              const s = STATUS_MAP[o.status] || STATUS_MAP.pending;
              const Icon = s.icon;
              return (
                <div key={o.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{o.customer_name}</p>
                      <p className="truncate text-[11px] text-slate-400">{o.customer_email}</p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${s.color}`}>
                      <Icon className="h-3 w-3" />
                      {s.label}
                    </span>
                  </div>
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-brand-purple/10 px-2 py-0.5 text-[11px] font-medium text-brand-purple">{o.branch_name}</span>
                    <span className="text-slate-500">{o.batch_size} leads</span>
                    <span className="text-slate-500">&euro;{Number(o.price_per_lead).toFixed(2)}/lead</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-slate-900">&euro;{Number(o.total_price).toFixed(2)}</span>
                      <span className="ml-1 text-[10px] text-slate-400">excl. BTW</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">
                        {new Date(o.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                      </span>
                      {o.status !== 'paid' && (
                        <button onClick={() => deleteOrder(o.id)} title="Verwijderen"
                          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg p-2.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-lg sm:left-auto sm:right-6 sm:max-w-sm">
          <ExclamationTriangleIcon className="h-4 w-4" />
          {toast}
        </div>
      )}
    </div>
  );
}
