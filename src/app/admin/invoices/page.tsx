'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowPathIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  description: string;
  subtotal: number;
  btw_percentage: number;
  btw_amount: number;
  total_incl_btw: number;
  mollie_payment_id: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/invoices');
      if (res.ok) setInvoices(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const filtered = useMemo(() => {
    if (!search) return invoices;
    const s = search.toLowerCase();
    return invoices.filter(i =>
      i.invoice_number.toLowerCase().includes(s) ||
      i.customer_name.toLowerCase().includes(s) ||
      i.customer_email.toLowerCase().includes(s) ||
      i.description.toLowerCase().includes(s)
    );
  }, [invoices, search]);

  const totalRevenue = useMemo(() =>
    invoices.reduce((sum, i) => sum + Number(i.total_incl_btw), 0)
  , [invoices]);

  const downloadPdf = useCallback(async (invoice: Invoice) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const res = await fetch(`/api/invoices/${invoice.id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoice_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('PDF downloaden mislukt');
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <DocumentTextIcon className="h-7 w-7 text-brand-purple" />
            Facturen
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {invoices.length} facturen &middot; &euro;{totalRevenue.toFixed(2)} totaal incl. BTW
          </p>
        </div>
        <button onClick={fetchInvoices} disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50">
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Vernieuwen
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Zoek op factuurnummer, klant of omschrijving..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-brand-purple/50 focus:bg-white"
          />
        </div>
      </div>

      {loading && invoices.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <ArrowPathIcon className="mr-2 h-5 w-5 animate-spin" /> Laden...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
          Geen facturen gevonden
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Factuurnr.</th>
                  <th className="px-4 py-3">Klant</th>
                  <th className="px-4 py-3">Omschrijving</th>
                  <th className="px-4 py-3 text-right">Excl. BTW</th>
                  <th className="px-4 py-3 text-right">BTW</th>
                  <th className="px-4 py-3 text-right">Incl. BTW</th>
                  <th className="px-4 py-3">Datum</th>
                  <th className="px-4 py-3 text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(inv => (
                  <tr key={inv.id} className="group transition hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <span className="rounded bg-brand-purple/10 px-2 py-0.5 text-xs font-bold text-brand-purple">{inv.invoice_number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{inv.customer_name}</p>
                      <p className="text-[11px] text-slate-400">{inv.customer_email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{inv.description}</td>
                    <td className="px-4 py-3 text-right text-slate-700">&euro;{Number(inv.subtotal).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">&euro;{Number(inv.btw_amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">&euro;{Number(inv.total_incl_btw).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500" />
                        {new Date(inv.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      {inv.paid_at && (
                        <p className="text-[10px] text-emerald-600">
                          Betaald {new Date(inv.paid_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button onClick={() => downloadPdf(inv)} title="Download PDF"
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-brand-purple/10 hover:text-brand-purple">
                          <ArrowDownTrayIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="space-y-3 md:hidden">
            {filtered.map(inv => (
              <div key={inv.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded bg-brand-purple/10 px-2 py-0.5 text-xs font-bold text-brand-purple">{inv.invoice_number}</span>
                  <button onClick={() => downloadPdf(inv)} title="Download PDF"
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-brand-purple/10 hover:text-brand-purple">
                    <ArrowDownTrayIcon className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm font-semibold text-slate-900">{inv.customer_name}</p>
                <p className="text-xs text-slate-500">{inv.description}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">&euro;{Number(inv.total_incl_btw).toFixed(2)} <span className="text-[10px] font-normal text-slate-400">incl. BTW</span></span>
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                    {new Date(inv.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
