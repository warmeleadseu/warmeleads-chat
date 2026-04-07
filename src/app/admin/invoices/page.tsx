'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowPathIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  PaperClipIcon,
} from '@heroicons/react/24/outline';
import { adminFetch, adminHeaders } from '@/lib/adminAuth';

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_address: string | null;
  customer_vat_id: string | null;
  description: string;
  line_items: { description: string; quantity: number; unit_price: number; total: number }[];
  subtotal: number;
  btw_percentage: number;
  btw_amount: number;
  total_incl_btw: number;
  mollie_payment_id: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
  batch_order_id: string | null;
  batch_id: string | null;
  uploaded_pdf_path: string | null;
}

interface Customer { id: string; name: string; email: string }

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/invoices');
      if (res.ok) setInvoices(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/customers');
      if (res.ok) {
        const data = await res.json();
        setCustomers(Array.isArray(data) ? data.map((c: Record<string, string>) => ({ id: c.id, name: c.name, email: c.email })) : []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchInvoices(); fetchCustomers(); }, [fetchInvoices, fetchCustomers]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

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
    invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.total_incl_btw), 0)
  , [invoices]);

  const downloadPdf = useCallback(async (invoice: Invoice) => {
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/pdf`, { headers: adminHeaders() });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoice_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('PDF downloaden mislukt'); }
  }, []);

  const deleteInvoice = useCallback(async (inv: Invoice) => {
    if (!confirm(`Weet je zeker dat je factuur ${inv.invoice_number} wilt verwijderen?`)) return;
    try {
      const res = await adminFetch('/api/admin/invoices', {
        method: 'DELETE',
        body: JSON.stringify({ id: inv.id }),
      });
      if (res.ok) {
        setInvoices(prev => prev.filter(i => i.id !== inv.id));
        showToast('Factuur verwijderd');
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || 'Verwijderen mislukt');
      }
    } catch { showToast('Verwijderen mislukt'); }
  }, [showToast]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <DocumentTextIcon className="h-7 w-7 text-brand-purple" />
            Facturen
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {invoices.length} facturen &middot; &euro;{totalRevenue.toFixed(2)} omzet incl. BTW
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-button-gradient px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:shadow-md">
            <PlusIcon className="h-4 w-4" /> Factuur aanmaken
          </button>
          <button onClick={fetchInvoices} disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50">
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Zoek op factuurnummer, klant of omschrijving..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-brand-purple/50 focus:bg-white" />
        </div>
      </div>

      {/* Content */}
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
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Factuurnr.</th>
                  <th className="px-4 py-3">Klant</th>
                  <th className="px-4 py-3">Omschrijving</th>
                  <th className="px-4 py-3 text-right">Excl. BTW</th>
                  <th className="px-4 py-3 text-right">Incl. BTW</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Datum</th>
                  <th className="px-4 py-3 text-right">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(inv => (
                  <tr key={inv.id} className="group transition hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-brand-purple/10 px-2 py-0.5 text-xs font-bold text-brand-purple">{inv.invoice_number}</span>
                        {inv.uploaded_pdf_path && <PaperClipIcon className="h-3.5 w-3.5 text-amber-500" title="Geüploade PDF" />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{inv.customer_name}</p>
                      <p className="text-[11px] text-slate-400">{inv.customer_email}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate text-slate-600">{inv.description}</td>
                    <td className="px-4 py-3 text-right text-slate-700">&euro;{Number(inv.subtotal).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">&euro;{Number(inv.total_incl_btw).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        inv.status === 'credit_note' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {inv.status === 'credit_note' ? 'Creditnota' : 'Betaald'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(inv.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => downloadPdf(inv)} title="Download PDF"
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-brand-purple/10 hover:text-brand-purple">
                          <ArrowDownTrayIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditInvoice(inv)} title="Bewerken"
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-purple">
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => deleteInvoice(inv)} title="Verwijderen"
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map(inv => (
              <div key={inv.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-brand-purple/10 px-2 py-0.5 text-xs font-bold text-brand-purple">{inv.invoice_number}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      inv.status === 'credit_note' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {inv.status === 'credit_note' ? 'Creditnota' : 'Betaald'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => downloadPdf(inv)} className="rounded-lg p-1.5 text-slate-400 hover:text-brand-purple">
                      <ArrowDownTrayIcon className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditInvoice(inv)} className="rounded-lg p-1.5 text-slate-400 hover:text-brand-purple">
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteInvoice(inv)} className="rounded-lg p-1.5 text-slate-400 hover:text-red-500">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm font-semibold text-slate-900">{inv.customer_name}</p>
                <p className="text-xs text-slate-500">{inv.description}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">&euro;{Number(inv.total_incl_btw).toFixed(2)}</span>
                  <span className="text-[11px] text-slate-400">
                    {new Date(inv.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Slide-over panels */}
      <AnimatePresence>
        {showCreate && (
          <InvoicePanel
            key="create"
            customers={customers}
            onClose={() => setShowCreate(false)}
            onSaved={() => { setShowCreate(false); fetchInvoices(); showToast('Factuur aangemaakt'); }}
          />
        )}
        {editInvoice && (
          <EditInvoicePanel
            key="edit"
            invoice={editInvoice}
            onClose={() => setEditInvoice(null)}
            onSaved={() => { setEditInvoice(null); fetchInvoices(); showToast('Factuur bijgewerkt'); }}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-lg">
            <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Create Invoice Panel ────────────────────────────── */

function InvoicePanel({ customers, onClose, onSaved }: {
  customers: Customer[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    customer_id: '',
    description: '',
    subtotal: '',
    btw_percentage: '21',
    status: 'paid',
    paid_at: new Date().toISOString().split('T')[0],
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const sub = Number(form.subtotal) || 0;
  const btwPct = Number(form.btw_percentage) || 21;
  const btwAmount = Math.round(sub * (btwPct / 100) * 100) / 100;
  const total = sub + btwAmount;

  const save = async () => {
    if (!form.customer_id || !form.description || sub <= 0) return;
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/invoices', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: form.customer_id,
          description: form.description,
          subtotal: sub,
          btw_percentage: btwPct,
          status: form.status,
          paid_at: form.paid_at ? new Date(form.paid_at).toISOString() : null,
        }),
      });
      if (!res.ok) { const d = await res.json(); alert(d.error || 'Aanmaken mislukt'); setSaving(false); return; }

      const invoice = await res.json();

      if (pdfFile && invoice?.id) {
        const fd = new FormData();
        fd.append('file', pdfFile);
        fd.append('invoice_id', invoice.id);
        const uploadRes = await fetch('/api/admin/invoices/upload', {
          method: 'POST',
          headers: { Authorization: adminHeaders().Authorization },
          body: fd,
        });
        if (!uploadRes.ok) {
          const d = await uploadRes.json().catch(() => ({}));
          alert(`Factuur aangemaakt, maar PDF upload mislukt: ${d.error || 'onbekende fout'}`);
        }
      }

      onSaved();
    } catch { alert('Er ging iets mis'); }
    setSaving(false);
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="shrink-0 border-b border-slate-100">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">Nieuwe factuur</h2>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Klant *</label>
            <select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50">
              <option value="">Selecteer klant...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Omschrijving *</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="bijv. 100 Zonnepanelen leads"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Bedrag excl. BTW *</label>
              <input type="number" step="0.01" min="0" value={form.subtotal}
                onChange={e => setForm(f => ({ ...f, subtotal: e.target.value }))}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">BTW %</label>
              <input type="number" step="0.01" value={form.btw_percentage}
                onChange={e => setForm(f => ({ ...f, btw_percentage: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50">
                <option value="paid">Betaald</option>
                <option value="credit_note">Creditnota</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Betaaldatum</label>
              <input type="date" value={form.paid_at} onChange={e => setForm(f => ({ ...f, paid_at: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
          </div>

          {/* PDF Upload */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">PDF uploaden (optioneel)</label>
            <div className="relative">
              {pdfFile ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <PaperClipIcon className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="flex-1 truncate text-sm text-emerald-700">{pdfFile.name}</span>
                  <button onClick={() => setPdfFile(null)} className="text-slate-400 hover:text-red-500">
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500 transition hover:border-brand-purple/40 hover:text-brand-purple">
                  <ArrowUpTrayIcon className="h-4 w-4" />
                  <span>Kies een PDF-bestand...</span>
                  <input type="file" accept="application/pdf" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) setPdfFile(e.target.files[0]); }} />
                </label>
              )}
            </div>
            <p className="mt-1 text-[10px] text-slate-400">Upload een eigen factuur-PDF. Deze wordt getoond in het klantportaal i.p.v. de automatisch gegenereerde factuur.</p>
          </div>

          {/* Preview */}
          {sub > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotaal excl. BTW</span>
                <span>&euro;{sub.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>BTW {btwPct}%</span>
                <span>&euro;{btwAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-bold text-slate-900">
                <span>Totaal incl. BTW</span>
                <span>&euro;{total.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 px-5 py-4">
          <button onClick={save} disabled={saving || !form.customer_id || !form.description || sub <= 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-button-gradient py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {saving ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Aanmaken...</> : <><PlusIcon className="h-4 w-4" /> Factuur aanmaken</>}
          </button>
        </div>
      </motion.div>
    </>
  );
}

/* ─── Edit Invoice Panel ──────────────────────────────── */

function EditInvoicePanel({ invoice, onClose, onSaved }: {
  invoice: Invoice;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    description: invoice.description,
    customer_name: invoice.customer_name,
    customer_email: invoice.customer_email,
    customer_address: invoice.customer_address || '',
    customer_vat_id: invoice.customer_vat_id || '',
    subtotal: String(invoice.subtotal),
    btw_percentage: String(invoice.btw_percentage),
    status: invoice.status,
    paid_at: invoice.paid_at ? invoice.paid_at.split('T')[0] : '',
  });
  const [saving, setSaving] = useState(false);
  const [hasUploadedPdf, setHasUploadedPdf] = useState(!!invoice.uploaded_pdf_path);
  const [newPdf, setNewPdf] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const sub = Number(form.subtotal) || 0;
  const btwPct = Number(form.btw_percentage) || 21;
  const btwAmount = Math.round(sub * (btwPct / 100) * 100) / 100;
  const total = sub + btwAmount;

  const save = async () => {
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/invoices', {
        method: 'PUT',
        body: JSON.stringify({
          id: invoice.id,
          description: form.description,
          customer_name: form.customer_name,
          customer_email: form.customer_email,
          customer_address: form.customer_address || null,
          customer_vat_id: form.customer_vat_id || null,
          subtotal: sub,
          btw_percentage: btwPct,
          status: form.status,
          paid_at: form.paid_at ? new Date(form.paid_at).toISOString() : null,
        }),
      });
      if (res.ok) onSaved();
      else { const d = await res.json(); alert(d.error || 'Opslaan mislukt'); }
    } catch { alert('Er ging iets mis'); }
    setSaving(false);
  };

  const uploadPdf = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('invoice_id', invoice.id);
      const res = await fetch('/api/admin/invoices/upload', {
        method: 'POST',
        headers: { Authorization: adminHeaders().Authorization },
        body: fd,
      });
      if (res.ok) {
        setHasUploadedPdf(true);
        setNewPdf(null);
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Upload mislukt');
      }
    } catch { alert('Upload mislukt'); }
    setUploading(false);
  };

  const removePdf = async () => {
    if (!confirm('Geüploade PDF verwijderen? De automatisch gegenereerde PDF wordt dan weer getoond.')) return;
    setUploading(true);
    try {
      const res = await adminFetch('/api/admin/invoices/upload', {
        method: 'DELETE',
        body: JSON.stringify({ invoice_id: invoice.id }),
      });
      if (res.ok) setHasUploadedPdf(false);
      else alert('Verwijderen mislukt');
    } catch { alert('Verwijderen mislukt'); }
    setUploading(false);
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="shrink-0 border-b border-slate-100">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Factuur bewerken</h2>
              <span className="rounded bg-brand-purple/10 px-2 py-0.5 text-xs font-bold text-brand-purple">{invoice.invoice_number}</span>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Omschrijving</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Klantnaam</label>
              <input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">E-mail</label>
              <input value={form.customer_email} onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Adres</label>
              <input value={form.customer_address} onChange={e => setForm(f => ({ ...f, customer_address: e.target.value }))}
                placeholder="Optioneel"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">BTW-nr klant</label>
              <input value={form.customer_vat_id} onChange={e => setForm(f => ({ ...f, customer_vat_id: e.target.value }))}
                placeholder="Optioneel"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Bedrag excl. BTW</label>
              <input type="number" step="0.01" min="0" value={form.subtotal}
                onChange={e => setForm(f => ({ ...f, subtotal: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">BTW %</label>
              <input type="number" step="0.01" value={form.btw_percentage}
                onChange={e => setForm(f => ({ ...f, btw_percentage: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50">
                <option value="paid">Betaald</option>
                <option value="credit_note">Creditnota</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Betaaldatum</label>
              <input type="date" value={form.paid_at} onChange={e => setForm(f => ({ ...f, paid_at: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotaal excl. BTW</span>
              <span>&euro;{sub.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>BTW {btwPct}%</span>
              <span>&euro;{btwAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-bold text-slate-900">
              <span>Totaal incl. BTW</span>
              <span>&euro;{total.toFixed(2)}</span>
            </div>
          </div>

          {invoice.mollie_payment_id && (
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[11px] text-slate-400">Mollie referentie: <span className="font-mono text-slate-500">{invoice.mollie_payment_id}</span></p>
            </div>
          )}

          {/* PDF Management */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Factuur PDF</label>
            {hasUploadedPdf ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PaperClipIcon className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700">Eigen PDF geüpload</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-white hover:text-brand-purple">
                      Vervangen
                      <input type="file" accept="application/pdf" className="hidden"
                        onChange={e => { if (e.target.files?.[0]) uploadPdf(e.target.files[0]); }} />
                    </label>
                    <button onClick={removePdf} disabled={uploading}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50">
                      Verwijderen
                    </button>
                  </div>
                </div>
                {uploading && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-100"><div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-500" /></div>}
              </div>
            ) : (
              <div>
                {newPdf ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PaperClipIcon className="h-4 w-4 text-amber-600" />
                        <span className="truncate text-sm text-amber-700">{newPdf.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => uploadPdf(newPdf)} disabled={uploading}
                          className="rounded-lg bg-brand-purple px-2.5 py-1 text-xs font-bold text-white disabled:opacity-50">
                          {uploading ? 'Uploaden...' : 'Uploaden'}
                        </button>
                        <button onClick={() => setNewPdf(null)} className="text-slate-400 hover:text-red-500">
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {uploading && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-amber-100"><div className="h-full w-1/2 animate-pulse rounded-full bg-amber-500" /></div>}
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500 transition hover:border-brand-purple/40 hover:text-brand-purple">
                    <ArrowUpTrayIcon className="h-4 w-4" />
                    <span>Eigen PDF uploaden...</span>
                    <input type="file" accept="application/pdf" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) setNewPdf(e.target.files[0]); }} />
                  </label>
                )}
                <p className="mt-1 text-[10px] text-slate-400">Momenteel wordt de automatisch gegenereerde PDF getoond. Upload een eigen PDF om deze te vervangen.</p>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 px-5 py-4">
          <button onClick={save} disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-button-gradient py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {saving ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Opslaan...</> : 'Wijzigingen opslaan'}
          </button>
        </div>
      </motion.div>
    </>
  );
}
