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
  PaperAirplaneIcon,
  BanknotesIcon,
  ReceiptRefundIcon,
  TableCellsIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { adminFetch, adminHeaders } from '@/lib/adminAuth';
import { computeInvoiceVat } from '@/lib/invoiceVat';
import SearchableSelect from '@/components/ui/SearchableSelect';

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
  vat_mode?: string;
  mollie_payment_id: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
  due_date: string | null;
  credit_note_of: string | null;
  batch_order_id: string | null;
  batch_id: string | null;
  uploaded_pdf_path: string | null;
}

interface Customer { id: string; name: string; email: string; country?: string | null; vat_id?: string | null }

type StatusFilter = 'all' | 'open' | 'paid' | 'credit_note' | 'overdue';
type PeriodFilter = 'all' | 'this_month' | 'last_month' | 'this_year' | 'custom';
type SortKey = 'invoice_number' | 'customer' | 'total' | 'date' | 'status';
type SortDir = 'asc' | 'desc';

function isOverdue(inv: Invoice): boolean {
  return inv.status === 'open' && !!inv.due_date && new Date(inv.due_date).getTime() < Date.now();
}

function statusLabel(status: string): string {
  return status === 'open' ? 'Open' : status === 'credit_note' ? 'Creditnota' : 'Betaald';
}

function fmtDateNl(iso: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return '-'; }
}

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');

  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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
      const res = await adminFetch('/api/admin/customers/options');
      if (res.ok) {
        const data = await res.json();
        const list = data.customers || (Array.isArray(data) ? data : []);
        setCustomers(list.map((c: Record<string, unknown>) => ({
          id: String(c.id),
          name: String(c.name),
          email: String(c.email ?? ''),
          country: (c.country as string) ?? 'NL',
          vat_id: (c.vat_id as string) || null,
        })));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchInvoices(); fetchCustomers(); }, [fetchInvoices, fetchCustomers]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Map invoice-id → invoice_number om creditnota's naar de originele factuur te verwijzen.
  const invoiceNumberById = useMemo(() => {
    const m = new Map<string, string>();
    invoices.forEach(i => m.set(i.id, i.invoice_number));
    return m;
  }, [invoices]);

  // Set van factuur-ids die al een creditnota hebben (om de actie te verbergen).
  const creditedOriginalIds = useMemo(() => {
    const s = new Set<string>();
    invoices.forEach(i => { if (i.credit_note_of) s.add(i.credit_note_of); });
    return s;
  }, [invoices]);

  const countryById = useMemo(() => {
    const m = new Map<string, string>();
    customers.forEach(c => m.set(c.id, (c.country || 'NL')));
    return m;
  }, [customers]);

  // Periode-grenzen op basis van factuurdatum (created_at).
  const periodRange = useMemo((): { from: Date | null; to: Date | null } => {
    const now = new Date();
    if (periodFilter === 'this_month') {
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
    }
    if (periodFilter === 'last_month') {
      return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) };
    }
    if (periodFilter === 'this_year') {
      return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear() + 1, 0, 1) };
    }
    if (periodFilter === 'custom') {
      const from = customFrom ? new Date(customFrom) : null;
      // 'to' inclusief: schuif een dag op zodat de gekozen einddatum meetelt.
      const to = customTo ? new Date(new Date(customTo).getTime() + 24 * 60 * 60 * 1000) : null;
      return { from, to };
    }
    return { from: null, to: null };
  }, [periodFilter, customFrom, customTo]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return invoices.filter(i => {
      if (s) {
        const hit =
          i.invoice_number.toLowerCase().includes(s) ||
          i.customer_name.toLowerCase().includes(s) ||
          i.customer_email.toLowerCase().includes(s) ||
          i.description.toLowerCase().includes(s);
        if (!hit) return false;
      }
      if (statusFilter === 'overdue') {
        if (!isOverdue(i)) return false;
      } else if (statusFilter !== 'all') {
        if (i.status !== statusFilter) return false;
      }
      if (customerFilter && i.customer_id !== customerFilter) return false;
      if (periodRange.from || periodRange.to) {
        const d = new Date(i.created_at).getTime();
        if (periodRange.from && d < periodRange.from.getTime()) return false;
        if (periodRange.to && d >= periodRange.to.getTime()) return false;
      }
      return true;
    });
  }, [invoices, search, statusFilter, customerFilter, periodRange]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'invoice_number': cmp = a.invoice_number.localeCompare(b.invoice_number, 'nl', { numeric: true }); break;
        case 'customer': cmp = a.customer_name.localeCompare(b.customer_name, 'nl'); break;
        case 'total': cmp = Number(a.total_incl_btw) - Number(b.total_incl_btw); break;
        case 'status': cmp = a.status.localeCompare(b.status, 'nl'); break;
        case 'date':
        default: cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
      }
      return cmp * dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sorted, currentPage, pageSize],
  );

  // Reset naar pagina 1 wanneer filters/zoekterm wijzigen.
  useEffect(() => { setPage(1); }, [search, statusFilter, periodFilter, customFrom, customTo, customerFilter, pageSize]);

  // Statistieken afgeleid van de (gefilterde) set.
  const stats = useMemo(() => {
    let paidRevenue = 0, openAmount = 0, overdueAmount = 0, nlVat = 0;
    let countOpen = 0, countPaid = 0, countCredit = 0, countOverdue = 0;
    for (const i of filtered) {
      const total = Number(i.total_incl_btw) || 0;
      if (i.status === 'paid') { paidRevenue += total; countPaid++; }
      else if (i.status === 'open') {
        openAmount += total; countOpen++;
        if (isOverdue(i)) { overdueAmount += total; countOverdue++; }
      } else if (i.status === 'credit_note') { countCredit++; }
      // Af te dragen NL-BTW: uitgereikte facturen (betaald + creditnota), alleen binnenlands.
      if (i.vat_mode !== 'reverse_charge_be' && (i.status === 'paid' || i.status === 'credit_note')) {
        nlVat += Number(i.btw_amount) || 0;
      }
    }
    return { paidRevenue, openAmount, overdueAmount, nlVat, countOpen, countPaid, countCredit, countOverdue };
  }, [filtered]);

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (periodFilter !== 'all' ? 1 : 0) +
    (customerFilter ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const resetFilters = useCallback(() => {
    setSearch(''); setStatusFilter('all'); setPeriodFilter('all');
    setCustomFrom(''); setCustomTo(''); setCustomerFilter('');
  }, []);

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir(key === 'date' || key === 'total' ? 'desc' : 'asc');
      return key;
    });
  }, []);

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

  const sendPaymentLink = useCallback(async (inv: Invoice) => {
    setActionBusy(inv.id);
    try {
      const res = await adminFetch(`/api/admin/invoices/${inv.id}/send-payment-link`, { method: 'POST' });
      if (res.ok) showToast(`Betaallink verstuurd naar ${inv.customer_email || 'de klant'}`);
      else { const d = await res.json().catch(() => ({})); showToast(d.error || 'Betaallink versturen mislukt'); }
    } catch { showToast('Betaallink versturen mislukt'); }
    setActionBusy(null);
  }, [showToast]);

  const markPaid = useCallback(async (inv: Invoice) => {
    if (!confirm(`Factuur ${inv.invoice_number} markeren als betaald?${inv.batch_id ? ' De gekoppelde batch wordt geactiveerd.' : ''}`)) return;
    setActionBusy(inv.id);
    try {
      const res = await adminFetch(`/api/admin/invoices/${inv.id}/mark-paid`, { method: 'POST' });
      if (res.ok) { showToast('Factuur gemarkeerd als betaald'); fetchInvoices(); }
      else { const d = await res.json().catch(() => ({})); showToast(d.error || 'Markeren mislukt'); }
    } catch { showToast('Markeren mislukt'); }
    setActionBusy(null);
  }, [showToast, fetchInvoices]);

  const createCreditNote = useCallback(async (inv: Invoice) => {
    if (!confirm(`Creditnota aanmaken voor factuur ${inv.invoice_number}? Er wordt een gespiegelde negatieve factuur gemaakt en naar de klant gemaild.`)) return;
    setActionBusy(inv.id);
    try {
      const res = await adminFetch(`/api/admin/invoices/${inv.id}/credit-note`, { method: 'POST' });
      if (res.ok) { showToast('Creditnota aangemaakt'); fetchInvoices(); }
      else { const d = await res.json().catch(() => ({})); showToast(d.error || 'Creditnota aanmaken mislukt'); }
    } catch { showToast('Creditnota aanmaken mislukt'); }
    setActionBusy(null);
  }, [showToast, fetchInvoices]);

  const exportCsv = useCallback(() => {
    const sep = ';';
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const num = (n: unknown) => (Number(n) || 0).toFixed(2).replace('.', ',');
    const dmy = (iso: string | null) => {
      if (!iso) return '';
      const d = new Date(iso);
      return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    };

    const headers = [
      'Factuurnummer', 'Factuurdatum', 'Vervaldatum', 'Klant', 'E-mail', 'Land', 'BTW-nummer',
      'Omschrijving', 'Subtotaal', 'BTW%', 'BTW-bedrag', 'Totaal', 'BTW-modus', 'Status', 'Betaaldatum', 'Creditnota van',
    ];
    const rows = sorted.map(i => [
      i.invoice_number,
      dmy(i.created_at),
      dmy(i.due_date),
      i.customer_name,
      i.customer_email,
      countryById.get(i.customer_id) || (i.vat_mode === 'reverse_charge_be' ? 'BE' : 'NL'),
      i.customer_vat_id || '',
      i.description,
      num(i.subtotal),
      String(i.btw_percentage ?? ''),
      num(i.btw_amount),
      num(i.total_incl_btw),
      i.vat_mode === 'reverse_charge_be' ? 'BTW verlegd' : 'NL 21%',
      statusLabel(i.status),
      dmy(i.paid_at),
      i.credit_note_of ? (invoiceNumberById.get(i.credit_note_of) || '') : '',
    ]);

    // BTW-samenvatting onderaan.
    const sumSub = sorted.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
    const sumVat = sorted.reduce((s, i) => s + (Number(i.btw_amount) || 0), 0);
    const sumTotal = sorted.reduce((s, i) => s + (Number(i.total_incl_btw) || 0), 0);

    const lines = [
      headers.map(esc).join(sep),
      ...rows.map(r => r.map(esc).join(sep)),
      '',
      ['', '', '', '', '', '', '', 'TOTAAL', num(sumSub), '', num(sumVat), num(sumTotal), '', '', '', ''].map(esc).join(sep),
    ];

    const csv = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facturen-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${sorted.length} facturen geëxporteerd`);
  }, [sorted, countryById, invoiceNumberById, showToast]);

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
            {invoices.length} facturen{activeFilterCount > 0 ? ` \u00B7 ${sorted.length} in selectie` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-button-gradient px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:shadow-md">
            <PlusIcon className="h-4 w-4" /> Factuur aanmaken
          </button>
          <button onClick={exportCsv} disabled={sorted.length === 0}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50">
            <TableCellsIcon className="h-4 w-4" /> Exporteer CSV
          </button>
          <button onClick={fetchInvoices} disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50">
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Statistiek-kaarten */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Omzet betaald</p>
          <p className="mt-1 truncate text-xl font-bold text-emerald-600">&euro;{stats.paidRevenue.toFixed(2)}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{stats.countPaid} betaald</p>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Openstaand</p>
          <p className="mt-1 truncate text-xl font-bold text-slate-900">&euro;{stats.openAmount.toFixed(2)}</p>
          <p className="mt-0.5 text-[11px] text-red-500">
            {stats.overdueAmount > 0 ? `\u20AC${stats.overdueAmount.toFixed(2)} te laat (${stats.countOverdue})` : `${stats.countOpen} open`}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Aantallen</p>
          <p className="mt-1 truncate text-xl font-bold text-slate-900">{stats.countOpen + stats.countPaid + stats.countCredit}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{stats.countOpen} open &middot; {stats.countPaid} betaald &middot; {stats.countCredit} credit</p>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Af te dragen BTW (NL)</p>
          <p className="mt-1 truncate text-xl font-bold text-brand-purple">&euro;{stats.nlVat.toFixed(2)}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">binnenlands, uitgereikt</p>
        </div>
      </div>

      {/* Filterbalk */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Zoek op factuurnummer, klant of omschrijving..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-brand-purple/50 focus:bg-white" />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50">
              <option value="all">Alle statussen</option>
              <option value="open">Open</option>
              <option value="overdue">Te laat</option>
              <option value="paid">Betaald</option>
              <option value="credit_note">Creditnota</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Periode (factuurdatum)</label>
            <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value as PeriodFilter)}
              className="w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50">
              <option value="all">Alle periodes</option>
              <option value="this_month">Deze maand</option>
              <option value="last_month">Vorige maand</option>
              <option value="this_year">Dit jaar</option>
              <option value="custom">Aangepast…</option>
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Klant</label>
            <SearchableSelect
              value={customerFilter}
              onChange={setCustomerFilter}
              options={[{ value: '', label: 'Alle klanten' }, ...customers.map(c => ({ value: c.id, label: c.name, sub: c.email }))]}
              placeholder="Alle klanten"
              searchPlaceholder="Zoek klant of e-mail…"
              ariaLabel="Klant filter"
            />
          </div>
        </div>
        {periodFilter === 'custom' && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Van</label>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Tot en met</label>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
          </div>
        )}
        {activeFilterCount > 0 && (
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <span className="text-xs text-slate-500">{sorted.length} van {invoices.length} facturen</span>
            <button onClick={resetFilters} className="text-xs font-medium text-brand-purple hover:underline">Filters wissen</button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading && invoices.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <ArrowPathIcon className="mr-2 h-5 w-5 animate-spin" /> Laden...
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
          Geen facturen gevonden
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  <SortableTh label="Factuurnr." sortKey="invoice_number" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Klant" sortKey="customer" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <th className="px-4 py-3">Omschrijving</th>
                  <th className="px-4 py-3 text-right">Excl. BTW</th>
                  <SortableTh label="Incl. BTW" sortKey="total" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <SortableTh label="Status" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Datum" sortKey="date" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <th className="px-4 py-3 text-right">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map(inv => {
                  const overdue = isOverdue(inv);
                  const creditedNumber = inv.credit_note_of ? invoiceNumberById.get(inv.credit_note_of) : null;
                  const canCredit = inv.status === 'paid' && !inv.credit_note_of && !creditedOriginalIds.has(inv.id);
                  const busy = actionBusy === inv.id;
                  return (
                  <tr key={inv.id} className="group transition hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-brand-purple/10 px-2 py-0.5 text-xs font-bold text-brand-purple">{inv.invoice_number}</span>
                        {inv.vat_mode === 'reverse_charge_be' && (
                          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800" title="Intracommunautair">BE verlegd</span>
                        )}
                        {inv.uploaded_pdf_path && <PaperClipIcon className="h-3.5 w-3.5 text-amber-500" title="Geüploade PDF" />}
                      </div>
                      {creditedNumber && (
                        <p className="mt-0.5 text-[10px] text-amber-600">Creditnota van {creditedNumber}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{inv.customer_name}</p>
                      <p className="text-[11px] text-slate-400">{inv.customer_email}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate text-slate-600">{inv.description}</td>
                    <td className="px-4 py-3 text-right text-slate-700">&euro;{Number(inv.subtotal).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">&euro;{Number(inv.total_incl_btw).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          inv.status === 'open' ? 'bg-red-50 text-red-700' : inv.status === 'credit_note' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {statusLabel(inv.status)}
                        </span>
                        {overdue && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white" title={`Vervallen op ${fmtDateNl(inv.due_date)}`}>
                            <ExclamationTriangleIcon className="h-3 w-3" /> Te laat
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(inv.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {inv.status === 'open' && inv.due_date && (
                        <span className={`block text-[10px] ${overdue ? 'text-red-500' : 'text-slate-400'}`}>verv. {fmtDateNl(inv.due_date)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {inv.status === 'open' && (
                          <>
                            <button onClick={() => sendPaymentLink(inv)} disabled={busy} title="Betaallink sturen"
                              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-brand-purple/10 hover:text-brand-purple disabled:opacity-50">
                              <PaperAirplaneIcon className="h-4 w-4" />
                            </button>
                            <button onClick={() => markPaid(inv)} disabled={busy} title="Markeer als betaald"
                              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50">
                              <BanknotesIcon className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {canCredit && (
                          <button onClick={() => createCreditNote(inv)} disabled={busy} title="Creditnota maken"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50">
                            <ReceiptRefundIcon className="h-4 w-4" />
                          </button>
                        )}
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
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {paginated.map(inv => {
              const overdue = isOverdue(inv);
              const creditedNumber = inv.credit_note_of ? invoiceNumberById.get(inv.credit_note_of) : null;
              const canCredit = inv.status === 'paid' && !inv.credit_note_of && !creditedOriginalIds.has(inv.id);
              const busy = actionBusy === inv.id;
              return (
              <div key={inv.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 truncate rounded bg-brand-purple/10 px-2 py-0.5 text-xs font-bold text-brand-purple">{inv.invoice_number}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      inv.status === 'open' ? 'bg-red-50 text-red-700' : inv.status === 'credit_note' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {statusLabel(inv.status)}
                    </span>
                    {overdue && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        <ExclamationTriangleIcon className="h-3 w-3" /> Te laat
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-0.5 self-end">
                    {inv.status === 'open' && (
                      <>
                        <button onClick={() => sendPaymentLink(inv)} disabled={busy} className="rounded-lg p-2.5 text-slate-400 hover:text-brand-purple disabled:opacity-50">
                          <PaperAirplaneIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => markPaid(inv)} disabled={busy} className="rounded-lg p-2.5 text-slate-400 hover:text-emerald-600 disabled:opacity-50">
                          <BanknotesIcon className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {canCredit && (
                      <button onClick={() => createCreditNote(inv)} disabled={busy} className="rounded-lg p-2.5 text-slate-400 hover:text-amber-600 disabled:opacity-50">
                        <ReceiptRefundIcon className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => downloadPdf(inv)} className="rounded-lg p-2.5 text-slate-400 hover:text-brand-purple">
                      <ArrowDownTrayIcon className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditInvoice(inv)} className="rounded-lg p-2.5 text-slate-400 hover:text-brand-purple">
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteInvoice(inv)} className="rounded-lg p-2.5 text-slate-400 hover:text-red-500">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm font-semibold text-slate-900">{inv.customer_name}</p>
                <p className="text-xs text-slate-500">{inv.description}</p>
                {creditedNumber && <p className="mt-0.5 text-[11px] text-amber-600">Creditnota van {creditedNumber}</p>}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">&euro;{Number(inv.total_incl_btw).toFixed(2)}</span>
                  <span className="text-[11px] text-slate-400">
                    {new Date(inv.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
              );
            })}
          </div>

          {/* Paginatie */}
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Per pagina</span>
              <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-brand-purple/50">
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sorted.length)} van {sorted.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">
                Vorige
              </button>
              <span className="px-2 text-xs text-slate-500">Pagina {currentPage} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">
                Volgende
              </button>
            </div>
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
            customers={customers}
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

/* ─── Sorteerbare kolomkop ────────────────────────────── */

function SortableTh({ label, sortKey, activeKey, dir, onSort, align = 'left' }: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const active = activeKey === sortKey;
  return (
    <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''}`}>
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-slate-700 ${active ? 'text-slate-700' : ''}`}
      >
        {label}
        {active ? (
          dir === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />
        ) : (
          <ChevronUpDownIcon className="h-3 w-3 text-slate-300" />
        )}
      </button>
    </th>
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
    status: 'paid',
    paid_at: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const sub = Number(form.subtotal) || 0;
  const selectedCustomer = useMemo(() => customers.find(c => c.id === form.customer_id), [customers, form.customer_id]);
  const vatPrev = useMemo(
    () =>
      computeInvoiceVat({
        subtotalExclBtw: sub,
        country: selectedCustomer?.country,
        customerVatId: selectedCustomer?.vat_id,
      }),
    [sub, selectedCustomer?.country, selectedCustomer?.vat_id],
  );
  const btwAmount = vatPrev.btw_amount;
  const total = vatPrev.total_incl_btw;
  const btwLabel = vatPrev.vat_mode === 'reverse_charge_be' ? 'BTW (verlegd)' : `BTW ${vatPrev.btw_percentage}%`;
  const totalLabel = vatPrev.vat_mode === 'reverse_charge_be' ? 'Totaal' : 'Totaal incl. BTW';

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
          status: form.status,
          paid_at: form.paid_at ? new Date(form.paid_at).toISOString() : null,
          due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
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
            <SearchableSelect
              value={form.customer_id}
              onChange={v => setForm(f => ({ ...f, customer_id: v }))}
              options={customers.map(c => ({ value: c.id, label: c.name, sub: c.email }))}
              placeholder="Selecteer klant..."
              searchPlaceholder="Zoek klant of e-mail…"
              ariaLabel="Klant"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Omschrijving *</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="bijv. 100 Zonnepanelen leads"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Bedrag excl. BTW *</label>
            <input type="number" step="0.01" min="0" value={form.subtotal}
              onChange={e => setForm(f => ({ ...f, subtotal: e.target.value }))}
              placeholder="0.00"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
          </div>
          <p className="text-[11px] text-slate-400 -mt-2">BTW wordt automatisch bepaald o.b.v. het facturatie-land en BTW-nummer van de klant in het klantenbestand.</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50">
                <option value="paid">Betaald</option>
                <option value="open">Open</option>
                <option value="credit_note">Creditnota</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Betaaldatum</label>
              <input type="date" value={form.paid_at} onChange={e => setForm(f => ({ ...f, paid_at: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Vervaldatum</label>
            <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            <p className="mt-1 text-[10px] text-slate-400">Standaard factuurdatum + 14 dagen. Bepaalt de &lsquo;Te laat&rsquo;-signalering voor open facturen.</p>
          </div>

          {/* PDF Upload */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">PDF uploaden (optioneel)</label>
            <div className="relative">
              {pdfFile ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <PaperClipIcon className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="min-w-0 flex-1 truncate text-sm text-emerald-700">{pdfFile.name}</span>
                  <button onClick={() => setPdfFile(null)} className="shrink-0 text-slate-400 hover:text-red-500">
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
                <span>{btwLabel}</span>
                <span>&euro;{btwAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-bold text-slate-900">
                <span>{totalLabel}</span>
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

function EditInvoicePanel({ invoice, customers, onClose, onSaved }: {
  invoice: Invoice;
  customers: Customer[];
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
    status: invoice.status,
    paid_at: invoice.paid_at ? invoice.paid_at.split('T')[0] : '',
    due_date: invoice.due_date ? invoice.due_date.split('T')[0] : '',
  });
  const [saving, setSaving] = useState(false);
  const [hasUploadedPdf, setHasUploadedPdf] = useState(!!invoice.uploaded_pdf_path);
  const [newPdf, setNewPdf] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const sub = Number(form.subtotal) || 0;
  const linkedCustomer = useMemo(() => customers.find(c => c.id === invoice.customer_id), [customers, invoice.customer_id]);
  const vatPrev = useMemo(
    () =>
      computeInvoiceVat({
        subtotalExclBtw: sub,
        country: linkedCustomer?.country,
        customerVatId: linkedCustomer?.vat_id,
      }),
    [sub, linkedCustomer?.country, linkedCustomer?.vat_id],
  );
  const btwAmount = vatPrev.btw_amount;
  const total = vatPrev.total_incl_btw;
  const btwLabel = vatPrev.vat_mode === 'reverse_charge_be' ? 'BTW (verlegd)' : `BTW ${vatPrev.btw_percentage}%`;
  const totalLabel = vatPrev.vat_mode === 'reverse_charge_be' ? 'Totaal' : 'Totaal incl. BTW';

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
          status: form.status,
          paid_at: form.paid_at ? new Date(form.paid_at).toISOString() : null,
          due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Bedrag excl. BTW</label>
            <input type="number" step="0.01" min="0" value={form.subtotal}
              onChange={e => setForm(f => ({ ...f, subtotal: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
          </div>
          <p className="text-[11px] text-slate-400 -mt-2">BTW herberekend server-side o.b.v. klant in klantenbestand (land + BTW-nummer).</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50">
                <option value="paid">Betaald</option>
                <option value="open">Open</option>
                <option value="credit_note">Creditnota</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Betaaldatum</label>
              <input type="date" value={form.paid_at} onChange={e => setForm(f => ({ ...f, paid_at: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Vervaldatum</label>
            <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            <p className="mt-1 text-[10px] text-slate-400">Bepaalt de &lsquo;Te laat&rsquo;-signalering voor open facturen.</p>
          </div>

          {/* Preview */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotaal excl. BTW</span>
              <span>&euro;{sub.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>{btwLabel}</span>
              <span>&euro;{btwAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-bold text-slate-900">
              <span>{totalLabel}</span>
              <span>&euro;{total.toFixed(2)}</span>
            </div>
          </div>

          {invoice.mollie_payment_id && (
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[11px] text-slate-400">Mollie referentie: <span className="break-all font-mono text-slate-500">{invoice.mollie_payment_id}</span></p>
            </div>
          )}

          {/* PDF Management */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Factuur PDF</label>
            {hasUploadedPdf ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <PaperClipIcon className="h-4 w-4 shrink-0 text-amber-600" />
                        <span className="min-w-0 flex-1 truncate text-sm text-amber-700">{newPdf.name}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
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
