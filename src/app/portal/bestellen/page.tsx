'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePortal } from '../portalContext';
import { portalFetch } from '@/lib/portalAuth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  MinusIcon,
  PlusIcon,
  CreditCardIcon,
  ClockIcon,
  SparklesIcon,
  TrashIcon,
  ArrowRightIcon,
  BoltIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';

interface Batch {
  id: string;
  branch: string;
  branch_name?: string;
  batch_size: number;
  leads_delivered: number;
  price_per_lead: number;
  total_price: number;
  leads_per_day: number | null;
  leads_per_week: number | null;
  lead_filters: unknown[];
  status: string;
  compensations?: { amount: number; reason: string }[];
}

interface Order {
  id: string;
  branch: string;
  batch_size: number;
  price_per_lead: number;
  total_price: number;
  status: string;
  created_at: string;
  paid_at: string | null;
}

interface PricingTier { min_leads: number; price_per_lead: number }
interface PricingData {
  tiers: PricingTier[];
  min_batch_size: number;
  nationwide_discount: number;
  is_custom: boolean;
}

const BTW_RATE = 0.21;

function formatCurrency(value: number) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { text: string; cls: string; dot: string }> = {
    paid: { text: 'Betaald', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
    pending: { text: 'In behandeling', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
    failed: { text: 'Mislukt', cls: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
    expired: { text: 'Verlopen', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
    cancelled: { text: 'Geannuleerd', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
  };
  const s = map[status] || { text: status, cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.text}
    </span>
  );
}

export default function BestellenPage() {
  const { customer } = usePortal();
  const searchParams = useSearchParams();
  const router = useRouter();

  const sourceBatchId = searchParams.get('batch');
  const orderRedirectId = searchParams.get('order');
  const redirectStatus = searchParams.get('status');

  const [batches, setBatches] = useState<{ active: Batch[]; completed: Batch[] }>({ active: [], completed: [] });
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [batchSize, setBatchSize] = useState(100);
  const [customSize, setCustomSize] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [leadsPerDay, setLeadsPerDay] = useState<number | null>(null);
  const [customSpeed, setCustomSpeed] = useState('');
  const [useCustomSpeed, setUseCustomSpeed] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [showOrders, setShowOrders] = useState(false);
  const [pendingCancelOrderId, setPendingCancelOrderId] = useState<string | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [welcomeDiscount, setWelcomeDiscount] = useState<{ active: boolean; expiresAt: string | null }>({ active: false, expiresAt: null });

  const [redirectOrder, setRedirectOrder] = useState<Order | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchData = useCallback(async () => {
    if (!customer) return;
    try {
      const [batchRaw, orderRaw] = await Promise.all([
        portalFetch('/api/portal/batches'),
        portalFetch('/api/portal/orders'),
      ]);
      const batchRes = batchRaw.ok ? await batchRaw.json() : { active: [], completed: [] };
      const orderRes = orderRaw.ok ? await orderRaw.json() : [];
      if (!batchRaw.ok || !orderRaw.ok) showToast('Gegevens konden niet volledig geladen worden', 'error');
      setBatches({ active: batchRes.active || [], completed: batchRes.completed || [] });
      setOrders(Array.isArray(orderRes) ? orderRes : []);
      return { batches: batchRes, orders: Array.isArray(orderRes) ? orderRes : [] };
    } catch {
      showToast('Gegevens konden niet geladen worden', 'error');
      return undefined;
    }
  }, [customer, showToast]);

  useEffect(() => {
    if (!customer) return;
    fetchData().then((result) => {
      if (!result) return;
      const allBatches = [...(result.batches.active || []), ...(result.batches.completed || [])];

      if (orderRedirectId && redirectStatus === 'redirect') {
        const found = result.orders.find((o: Order) => o.id === orderRedirectId);
        if (found) {
          setRedirectOrder(found);
          if (found.status === 'pending') {
            let pollCount = 0;
            pollRef.current = setInterval(async () => {
              pollCount++;
              if (pollCount > 40) {
                if (pollRef.current) clearInterval(pollRef.current);
                return;
              }
              try {
                const res = await portalFetch('/api/portal/orders').then(r => r.json());
                const updated = (Array.isArray(res) ? res : []).find((o: Order) => o.id === orderRedirectId);
                if (updated && updated.status !== 'pending') {
                  setRedirectOrder(updated);
                  if (pollRef.current) clearInterval(pollRef.current);
                }
              } catch { /* ignore */ }
            }, 3000);
          }
        }
      }

      if (sourceBatchId && !orderRedirectId) {
        const match = allBatches.find((b: Batch) => b.id === sourceBatchId);
        if (match) {
          setSelectedBranch(match.branch);
          const comps: { amount: number }[] = Array.isArray(match.compensations) ? match.compensations : [];
          const totalComp = comps.reduce((s: number, c: { amount: number }) => s + c.amount, 0);
          const originalSize = match.batch_size - totalComp;
          setBatchSize(originalSize);
          const standardSizes = [30, 50, 100, 200, 500];
          if (!standardSizes.includes(originalSize)) {
            setUseCustom(true);
            setCustomSize(String(originalSize));
          }
          if (match.leads_per_day && match.leads_per_day > 0) {
            setLeadsPerDay(match.leads_per_day);
          }
        }
      }

      if (!sourceBatchId && !orderRedirectId && allBatches.length > 0) {
        setSelectedBranch(allBatches[0].branch);
      }
    }).finally(() => setLoading(false));

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [customer, sourceBatchId, orderRedirectId, redirectStatus, fetchData]);

  useEffect(() => {
    if (!selectedBranch) { setPricingData(null); return; }
    portalFetch(`/api/portal/pricing?branch=${selectedBranch}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPricingData(data); })
      .catch(() => {});
  }, [selectedBranch]);

  useEffect(() => {
    portalFetch('/api/portal/welcome-offer')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setWelcomeDiscount({ active: data.active, expiresAt: data.expires_at });
      })
      .catch(() => {});
  }, []);

  const allBatches = useMemo(() => [...batches.active, ...batches.completed], [batches]);

  const branchGroups = useMemo(() => {
    const map = new Map<string, { branch: string; name: string; batches: Batch[] }>();
    allBatches.forEach(b => {
      const key = b.branch;
      if (!map.has(key)) map.set(key, { branch: key, name: b.branch_name || b.branch, batches: [] });
      map.get(key)!.batches.push(b);
    });
    return Array.from(map.values());
  }, [allBatches]);

  const activeBranch = useMemo(() => branchGroups.find(g => g.branch === selectedBranch), [branchGroups, selectedBranch]);
  const sourceBatch = useMemo(() => activeBranch?.batches[0] || null, [activeBranch]);

  const effectiveSize = useCustom ? (parseInt(customSize) || 0) : batchSize;
  const effectiveSpeed = useCustomSpeed ? (parseInt(customSpeed) || 0) : leadsPerDay;

  const SPEED_PRESETS = useMemo(() => {
    if (effectiveSize <= 0) return [5, 10, 20];
    const presets: number[] = [];
    const targetDays = [30, 14, 7];
    for (const days of targetDays) {
      const perDay = Math.ceil(effectiveSize / days);
      if (perDay >= 1 && !presets.includes(perDay)) presets.push(perDay);
    }
    if (presets.length < 3) {
      for (const fallback of [5, 10, 20]) {
        if (!presets.includes(fallback)) presets.push(fallback);
        if (presets.length >= 3) break;
      }
    }
    return presets.sort((a, b) => a - b).slice(0, 3);
  }, [effectiveSize]);

  const estimatedDays = effectiveSpeed && effectiveSpeed > 0
    ? Math.ceil(effectiveSize / effectiveSpeed)
    : null;

  const dynamicPricePerLead = useMemo(() => {
    if (!pricingData || !pricingData.tiers || pricingData.tiers.length === 0) {
      return sourceBatch?.price_per_lead || 0;
    }
    const sorted = [...pricingData.tiers].sort((a, b) => b.min_leads - a.min_leads);
    const tier = sorted.find(t => effectiveSize >= t.min_leads);
    return tier ? tier.price_per_lead : (sourceBatch?.price_per_lead || 0);
  }, [pricingData, effectiveSize, sourceBatch]);

  const pricePerLead = dynamicPricePerLead;
  const subtotalBeforeDiscount = effectiveSize * pricePerLead;
  const discountAmount = welcomeDiscount.active ? Math.round(subtotalBeforeDiscount * 0.20 * 100) / 100 : 0;
  const subtotal = subtotalBeforeDiscount - discountAmount;
  const btwAmount = Math.round(subtotal * BTW_RATE * 100) / 100;
  const totalInclBtw = subtotal + btwAmount;
  const minBatchSize = pricingData?.min_batch_size || 10;
  const QUICK_SIZES = useMemo(() => {
    const min = minBatchSize;
    const defaults = [50, 100, 200, 500].filter(s => s >= min);
    if (defaults.length === 0) return [min];
    if (!defaults.includes(min) && min < defaults[0]) defaults.unshift(min);
    return defaults.slice(0, 4);
  }, [minBatchSize]);

  const handleCancelOrder = (orderId: string) => {
    setPendingCancelOrderId(orderId);
  };

  const confirmCancelOrder = async () => {
    if (!pendingCancelOrderId) return;
    setCancellingOrder(true);
    try {
      const res = await portalFetch('/api/portal/orders', {
        method: 'DELETE',
        body: JSON.stringify({ order_id: pendingCancelOrderId }),
      });
      if (res.ok) {
        setOrders(prev => prev.filter(o => o.id !== pendingCancelOrderId));
        setPendingCancelOrderId(null);
        showToast('Bestelling verwijderd');
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || 'Verwijderen mislukt', 'error');
      }
    } catch {
      showToast('Verwijderen mislukt', 'error');
    } finally {
      setCancellingOrder(false);
    }
  };

  const handleOrder = async () => {
    if (!sourceBatch || effectiveSize < minBatchSize) return;
    setSubmitting(true);
    try {
      const res = await portalFetch('/api/portal/orders', {
        method: 'POST',
        body: JSON.stringify({
          batch_size: effectiveSize,
          source_batch_id: sourceBatch.id,
          branch: sourceBatch.branch,
          price_per_lead: pricePerLead,
          leads_per_day: effectiveSpeed || null,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Bestelling mislukt', 'error');
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch {
      showToast('Er is iets misgegaan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!customer) return null;

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="space-y-5 p-4 sm:p-6">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-4 w-64 animate-pulse rounded bg-slate-50" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
      </div>
    );
  }

  /* ── Redirect status screen after Mollie payment ── */
  if (redirectOrder) {
    const isPaid = redirectOrder.status === 'paid';
    const isPending = redirectOrder.status === 'pending';
    const isExpired = redirectOrder.status === 'expired';
    const isCancelled = redirectOrder.status === 'cancelled';
    const isFailed = !isPaid && !isPending;

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 18, stiffness: 280 }}
          className={`mb-6 flex h-20 w-20 items-center justify-center rounded-full shadow-lg ${
            isPaid ? 'bg-emerald-500 shadow-emerald-200' : isPending ? 'bg-amber-400 shadow-amber-200' : 'bg-red-500 shadow-red-200'
          }`}
        >
          {isPaid ? (
            <CheckCircleIcon className="h-10 w-10 text-white" />
          ) : isPending ? (
            <ClockIcon className="h-10 w-10 text-white" />
          ) : (
            <XCircleIcon className="h-10 w-10 text-white" />
          )}
        </motion.div>

        <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="text-xl font-bold text-slate-900 sm:text-2xl">
          {isPaid ? 'Betaling gelukt!' : isPending ? 'Betaling wordt verwerkt...' : isExpired ? 'Betaling verlopen' : isCancelled ? 'Betaling geannuleerd' : 'Betaling niet gelukt'}
        </motion.h2>

        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
          {isPaid
            ? 'Je nieuwe batch is aangemaakt en leads worden automatisch toegewezen. Je ontvangt een bevestiging per e-mail.'
            : isPending
            ? 'De betaling wordt verwerkt. Dit duurt meestal een paar seconden.'
            : 'De betaling is helaas niet gelukt. Je kunt het opnieuw proberen.'}
        </motion.p>

        {isPending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="mt-4 flex items-center gap-2 text-xs text-amber-600">
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
            <span>Status wordt automatisch bijgewerkt...</span>
          </motion.div>
        )}

        {isPaid && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-4">
            <div className="flex items-center gap-2">
              <CheckCircleSolid className="h-5 w-5 text-emerald-500" />
              <p className="text-sm font-semibold text-emerald-800">
                {redirectOrder.batch_size} leads &middot; &euro;{(Number(redirectOrder.total_price) * 1.21).toFixed(2)} incl. BTW
              </p>
            </div>
            <p className="mt-1 text-xs text-emerald-600">Je batch is direct actief en leads worden automatisch toegewezen</p>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button onClick={() => router.push('/portal')}
            className="rounded-xl bg-brand-purple px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-purple/90">
            Naar mijn leads
          </button>
          {isFailed && (
            <button onClick={() => { setRedirectOrder(null); router.replace('/portal/bestellen'); }}
              className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Opnieuw proberen
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  /* ── No batches: new customer first-order flow ── */
  if (allBatches.length === 0) {
    return (
      <NewCustomerOrderView
        customer={customer}
        welcomeDiscount={welcomeDiscount}
        showToast={showToast}
        toast={toast}
      />
    );
  }

  const pendingOrders = orders.filter(o => o.status !== 'paid');
  const paidOrders = orders.filter(o => o.status === 'paid');
  const pendingCancelOrder = pendingCancelOrderId
    ? orders.find(o => o.id === pendingCancelOrderId) || null
    : null;
  const canCheckout = !submitting && effectiveSize >= minBatchSize && !!sourceBatch;

  /* ── Main ordering view ── */
  return (
    <div className="space-y-6 pb-28 sm:pb-0">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[100] w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-xl ${
              toast.type === 'error' ? 'bg-red-600' : 'bg-slate-900'
            }`}>
            <div className="flex items-center gap-2">
              {toast.type === 'error' ? <XCircleIcon className="h-4 w-4 text-red-200" /> : <CheckCircleIcon className="h-4 w-4 text-emerald-400" />}
              {toast.msg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Bestellen</h1>
          <p className="mt-0.5 text-sm text-slate-500">Bestel een nieuwe batch leads voor je bedrijf</p>
        </div>
        {orders.length > 0 && (
          <button
            onClick={() => setShowOrders(!showOrders)}
            className={`inline-flex min-h-10 items-center gap-1.5 self-start rounded-xl border px-3.5 py-2 text-xs font-semibold transition sm:self-auto ${
              showOrders
                ? 'border-brand-purple bg-brand-purple text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <DocumentTextIcon className="h-3.5 w-3.5" />
            Bestellingen
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              showOrders
                ? 'bg-white/20 text-white'
                : pendingOrders.length > 0
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-500'
            }`}>
              {orders.length}
            </span>
          </button>
        )}
      </div>

      {/* Orders panel (collapsible) */}
      <AnimatePresence initial={false}>
        {showOrders && orders.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
              <div className="space-y-2">
                {orders.slice(0, 8).map(o => (
                  <div key={o.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-800">{o.batch_size} leads &middot; {o.branch}</p>
                        <StatusBadge status={o.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {new Date(o.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {o.status === 'paid' && <> &middot; &euro;{(Number(o.total_price) * 1.21).toFixed(2)} incl. BTW</>}
                      </p>
                    </div>
                    {o.status !== 'paid' && (
                      <button onClick={() => handleCancelOrder(o.id)}
                        className="ml-3 shrink-0 rounded-lg p-2 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                        title="Verwijderen">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                {orders.length > 8 && (
                  <Link href="/portal/account" className="block pt-1 text-center text-xs font-medium text-brand-purple hover:underline">
                    Alle {orders.length} bestellingen bekijken
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        {/* Branch selector (only if multiple branches) */}
        {branchGroups.length > 1 && (
          <section>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">Branche</label>
            <div className="relative -mx-1 px-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-4 bg-gradient-to-r from-slate-50 to-transparent sm:hidden" />
              <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-4 bg-gradient-to-l from-slate-50 to-transparent sm:hidden" />
              <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1.5">
              {branchGroups.map(g => {
                const isSelected = selectedBranch === g.branch;
                const activeBatch = g.batches.find(b => b.status === 'active');
                const pct = activeBatch && activeBatch.batch_size > 0 ? Math.round((activeBatch.leads_delivered / activeBatch.batch_size) * 100) : null;
                return (
                  <button key={g.branch} onClick={() => setSelectedBranch(g.branch)}
                    className={`group relative min-h-11 shrink-0 rounded-xl border-2 px-4 py-3 text-left transition ${
                      isSelected
                        ? 'border-brand-purple bg-brand-purple/5 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}>
                    <p className={`text-sm font-semibold ${isSelected ? 'text-brand-purple' : 'text-slate-700'}`}>{g.name}</p>
                    {pct !== null && (
                      <p className="mt-0.5 text-[11px] text-slate-400">Huidige batch: {pct}%</p>
                    )}
                    {isSelected && <span className="absolute -top-1 right-2 flex h-2 w-2 rounded-full bg-brand-purple" />}
                  </button>
                );
              })}
              </div>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 sm:hidden">Swipe om alle branches te zien</p>
          </section>
        )}

        {/* Single branch auto-selected header */}
        {branchGroups.length === 1 && activeBranch && (
          <section className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-pink">
              <BoltIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{activeBranch.name}</p>
              <p className="text-xs text-slate-400">&euro;{pricePerLead.toFixed(2)} per lead excl. BTW</p>
            </div>
          </section>
        )}

        {/* Current batch info */}
        {sourceBatch && sourceBatch.status === 'active' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Huidige batch</span>
              <span className="text-xs font-bold text-slate-600">
                {sourceBatch.leads_delivered}/{sourceBatch.batch_size} leads
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-pink transition-all duration-700"
                style={{ width: `${Math.min(100, sourceBatch.batch_size > 0 ? (sourceBatch.leads_delivered / sourceBatch.batch_size) * 100 : 0)}%` }}
              />
            </div>
            {sourceBatch.leads_delivered >= sourceBatch.batch_size * 0.8 && (
              <p className="mt-2 text-xs font-medium text-amber-600">
                <SparklesIcon className="mr-1 inline h-3.5 w-3.5" />
                Bijna vol! Bestel nu een vervolg batch zodat je geen leads mist.
              </p>
            )}
          </section>
        )}

        {/* Completed batch context */}
        {sourceBatch && sourceBatch.status === 'completed' && (() => {
          const comps: { amount: number }[] = Array.isArray(sourceBatch.compensations) ? sourceBatch.compensations : [];
          const totalComp = comps.reduce((s: number, c: { amount: number }) => s + c.amount, 0);
          const origSize = sourceBatch.batch_size - totalComp;
          return (
            <section className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
              <CheckCircleSolid className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Herbestelling op basis van je vorige batch</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {sourceBatch.branch_name || sourceBatch.branch} &middot; {origSize} leads &middot; Voltooid
                </p>
              </div>
            </section>
          );
        })()}

        {/* Batch size selector */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <label className="mb-3 block text-sm font-semibold text-slate-800">Hoeveel leads wil je bestellen?</label>

          {/* Quick selection */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {QUICK_SIZES.map(size => {
              const isActive = !useCustom && batchSize === size;
              let sizePrice = pricePerLead;
              if (pricingData && pricingData.tiers.length > 0) {
                const sorted = [...pricingData.tiers].sort((a, b) => b.min_leads - a.min_leads);
                const tier = sorted.find(t => size >= t.min_leads);
                if (tier) sizePrice = tier.price_per_lead;
              }
              const price = Math.round(size * sizePrice * (1 + BTW_RATE) * 100) / 100;
              return (
                <button key={size} onClick={() => { setBatchSize(size); setUseCustom(false); }}
                  className={`relative rounded-2xl border-2 p-3 text-left transition ${
                    isActive
                      ? 'border-brand-purple bg-brand-purple/5 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                  }`}>
                  {isActive && (
                    <CheckCircleSolid className="absolute right-2 top-2 h-5 w-5 text-brand-purple" />
                  )}
                  <p className={`text-2xl font-bold ${isActive ? 'text-brand-purple' : 'text-slate-900'}`}>{size}</p>
                  <p className="text-[11px] text-slate-400">leads</p>
                  <p className={`mt-1 text-xs font-semibold ${isActive ? 'text-brand-purple' : 'text-slate-500'}`}>
                    &euro;{price.toFixed(2)}
                    <span className="font-normal text-slate-400"> incl.</span>
                  </p>
                </button>
              );
            })}
          </div>

          {/* Custom size */}
          <div className="mt-3">
            <div className={`w-full rounded-2xl border-2 p-3 text-left transition ${
              useCustom ? 'border-brand-purple bg-brand-purple/5' : 'border-dashed border-slate-200'
            }`}>
              {!useCustom ? (
                <button
                  type="button"
                  onClick={() => { setUseCustom(true); if (!customSize) setCustomSize(String(batchSize || 75)); }}
                  className="flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-slate-500 transition hover:bg-slate-50"
                >
                  Ander aantal kiezen...
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCustomSize(String(Math.max(minBatchSize, (parseInt(customSize) || 0) - 10)))}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                    >
                      <MinusIcon className="h-4 w-4" />
                    </button>
                    <input type="number" min="10" value={customSize}
                      onChange={(e) => setCustomSize(e.target.value)}
                      className="h-11 w-20 rounded-xl border border-slate-200 bg-white px-2 text-center text-sm font-bold text-slate-900 outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/20" />
                    <button
                      type="button"
                      onClick={() => setCustomSize(String((parseInt(customSize) || 0) + 10))}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                    >
                      <PlusIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-brand-purple">{effectiveSize} leads</p>
                    <p className="text-[11px] text-slate-400">
                      {formatCurrency(totalInclBtw)} incl. BTW
                    </p>
                  </div>
                  <CheckCircleSolid className="h-5 w-5 shrink-0 text-brand-purple" />
                </div>
              )}
            </div>
          </div>

          {effectiveSize > 0 && effectiveSize < minBatchSize && (
            <p className="mt-2 text-center text-xs text-red-500">Minimaal {minBatchSize} leads per batch</p>
          )}

          {pricingData && pricingData.tiers.length > 0 && (
            <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Staffelprijzen</p>
              <div className="flex flex-wrap gap-1.5">
                {[...pricingData.tiers].sort((a, b) => a.min_leads - b.min_leads).map((t, i) => {
                  const sortedAsc = [...pricingData.tiers].sort((a, b) => a.min_leads - b.min_leads);
                  const isActive = effectiveSize >= t.min_leads && (i === sortedAsc.length - 1 || effectiveSize < sortedAsc[i + 1]?.min_leads);
                  return (
                    <span key={i} className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                      isActive ? 'border-brand-purple bg-brand-purple/10 text-brand-purple' : 'border-slate-200 bg-white text-slate-500'
                    }`}>
                      {t.min_leads}+ leads → €{Number(t.price_per_lead).toFixed(2)}
                    </span>
                  );
                })}
              </div>
              {pricingData.is_custom && (
                <p className="mt-1.5 text-[10px] text-amber-600 font-medium">Speciaal tarief voor je bedrijf</p>
              )}
            </div>
          )}
        </section>

        {/* Delivery speed selector */}
        {effectiveSize > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <label className="mb-3 block text-sm font-semibold text-slate-800">Leveringssnelheid</label>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button onClick={() => { setLeadsPerDay(null); setUseCustomSpeed(false); }}
                className={`relative rounded-2xl border-2 p-3 text-left transition ${
                  !useCustomSpeed && leadsPerDay === null
                    ? 'border-brand-purple bg-brand-purple/5 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                }`}>
                {!useCustomSpeed && leadsPerDay === null && (
                  <CheckCircleSolid className="absolute right-2 top-2 h-5 w-5 text-brand-purple" />
                )}
                <BoltIcon className={`mb-1 h-5 w-5 ${!useCustomSpeed && leadsPerDay === null ? 'text-brand-purple' : 'text-slate-400'}`} />
                <p className={`text-sm font-bold ${!useCustomSpeed && leadsPerDay === null ? 'text-brand-purple' : 'text-slate-900'}`}>Zo snel</p>
                <p className="text-[11px] text-slate-400">mogelijk</p>
              </button>
              {SPEED_PRESETS.map(speed => {
                const isActive = !useCustomSpeed && leadsPerDay === speed;
                const days = Math.ceil(effectiveSize / speed);
                return (
                  <button key={speed} onClick={() => { setLeadsPerDay(speed); setUseCustomSpeed(false); }}
                    className={`relative rounded-2xl border-2 p-3 text-left transition ${
                      isActive
                        ? 'border-brand-purple bg-brand-purple/5 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}>
                    {isActive && (
                      <CheckCircleSolid className="absolute right-2 top-2 h-5 w-5 text-brand-purple" />
                    )}
                    <p className={`text-2xl font-bold ${isActive ? 'text-brand-purple' : 'text-slate-900'}`}>{speed}</p>
                    <p className="text-[11px] text-slate-400">per dag</p>
                    <p className={`mt-1 text-xs font-semibold ${isActive ? 'text-brand-purple' : 'text-slate-500'}`}>
                      ~{days} {days === 1 ? 'dag' : 'dagen'}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-3">
              <div className={`w-full rounded-2xl border-2 p-3 text-left transition ${
                useCustomSpeed ? 'border-brand-purple bg-brand-purple/5' : 'border-dashed border-slate-200'
              }`}>
                {!useCustomSpeed ? (
                  <button
                    type="button"
                    onClick={() => { setUseCustomSpeed(true); if (!customSpeed) setCustomSpeed(String(leadsPerDay || SPEED_PRESETS[1] || 10)); }}
                    className="flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-slate-500 transition hover:bg-slate-50"
                  >
                    Ander aantal per dag kiezen...
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCustomSpeed(String(Math.max(1, (parseInt(customSpeed) || 0) - 1)))}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                      >
                        <MinusIcon className="h-4 w-4" />
                      </button>
                      <input type="number" min="1" value={customSpeed}
                        onChange={(e) => setCustomSpeed(e.target.value)}
                        className="h-11 w-16 rounded-xl border border-slate-200 bg-white px-2 text-center text-sm font-bold text-slate-900 outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/20" />
                      <button
                        type="button"
                        onClick={() => setCustomSpeed(String((parseInt(customSpeed) || 0) + 1))}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-brand-purple">{effectiveSpeed} leads / dag</p>
                      <p className="text-[11px] text-slate-400">
                        ~{estimatedDays} {estimatedDays === 1 ? 'dag' : 'dagen'} doorlooptijd
                      </p>
                    </div>
                    <CheckCircleSolid className="h-5 w-5 shrink-0 text-brand-purple" />
                  </div>
                )}
              </div>
            </div>

            {estimatedDays && !useCustomSpeed && leadsPerDay !== null && (
              <p className="mt-2 text-center text-xs text-slate-400">
                <ClockIcon className="mr-1 inline h-3.5 w-3.5" />
                Geschatte doorlooptijd: ~{estimatedDays} {estimatedDays === 1 ? 'dag' : 'dagen'}
              </p>
            )}
          </section>
        )}

        {/* Notes */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Opmerkingen <span className="text-slate-400">(optioneel)</span>
          </label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            placeholder="Bijv. voorkeur regio, specifieke wensen..."
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20" />
        </section>

        {/* Price summary + CTA */}
        {/* Welcome discount banner */}
        {welcomeDiscount.active && (
          <div className="flex items-center gap-3 rounded-2xl border border-brand-purple/20 bg-gradient-to-r from-brand-purple/5 to-brand-pink/5 px-5 py-3.5">
            <span className="text-xl">🎁</span>
            <div>
              <p className="text-sm font-bold text-brand-purple">20% welkomstkorting actief</p>
              <p className="text-xs text-slate-500">
                Automatisch toegepast op deze bestelling
                {welcomeDiscount.expiresAt && (
                  <> &middot; Geldig tot {new Date(welcomeDiscount.expiresAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}</>
                )}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-0 divide-y divide-slate-100 px-5 py-4">
            <div className="flex items-center justify-between pb-3">
              <span className="text-sm text-slate-500">{effectiveSize} leads &times; &euro;{pricePerLead.toFixed(2)}</span>
              <span className={`text-sm font-medium ${welcomeDiscount.active ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                &euro;{subtotalBeforeDiscount.toFixed(2)}
              </span>
            </div>
            {welcomeDiscount.active && (
              <div className="flex items-center justify-between py-3">
                <span className="text-sm font-medium text-emerald-600">Welkomstkorting -20%</span>
                <span className="text-sm font-medium text-emerald-600">-&euro;{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-500">BTW 21%</span>
              <span className="text-sm font-medium text-slate-800">&euro;{btwAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between pt-3">
              <span className="text-sm font-bold text-slate-900">Totaal</span>
              <span className="text-lg font-bold text-brand-purple">&euro;{totalInclBtw.toFixed(2)}</span>
            </div>
          </div>

          <div className="hidden border-t border-slate-100 p-4 sm:block">
            <button onClick={handleOrder} disabled={submitting || effectiveSize < minBatchSize || !sourceBatch}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink px-6 py-3.5 text-[15px] font-bold text-white shadow-lg transition hover:shadow-xl active:scale-[0.99] disabled:opacity-50 disabled:shadow-none">
              {submitting ? (
                <><ArrowPathIcon className="h-5 w-5 animate-spin" /> Wordt verwerkt...</>
              ) : (
                <><CreditCardIcon className="h-5 w-5" /> Afrekenen &middot; {formatCurrency(totalInclBtw)}</>
              )}
            </button>
            <div className="mt-3 flex items-start gap-2 px-1">
              <SparklesIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              <p className="text-[11px] leading-relaxed text-slate-400">
                Na betaling wordt je batch direct aangemaakt. Leads worden automatisch toegewezen met dezelfde instellingen als je {sourceBatch?.status === 'completed' ? 'vorige' : 'huidige'} batch.
              </p>
            </div>
          </div>
        </div>

        {/* Sticky mobile checkout bar */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_-18px_rgba(15,23,42,0.55)] backdrop-blur sm:hidden">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-slate-500">Totaal incl. BTW</p>
            <p className="text-base font-bold text-brand-purple">{formatCurrency(totalInclBtw)}</p>
          </div>
          <button
            onClick={handleOrder}
            disabled={!canCheckout}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-button-gradient px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-orange/20 transition active:scale-[0.99] disabled:opacity-50 disabled:shadow-none"
          >
            {submitting ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                Wordt verwerkt...
              </>
            ) : (
              <>
                <CreditCardIcon className="h-5 w-5" />
                Afrekenen
              </>
            )}
          </button>
        </div>

        {/* Pending orders warning */}
        {pendingOrders.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
            <div className="flex items-start gap-2.5">
              <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <p className="text-xs font-semibold text-amber-800">
                  Je hebt {pendingOrders.length} openstaande {pendingOrders.length === 1 ? 'bestelling' : 'bestellingen'}
                </p>
                <p className="mt-0.5 text-[11px] text-amber-600">
                  Bekijk of verwijder ze direct vanuit je bestellingen-overzicht.
                </p>
                {!showOrders && (
                  <button
                    onClick={() => setShowOrders(true)}
                    className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-100"
                  >
                    <DocumentTextIcon className="h-3.5 w-3.5" />
                    Open bestellingen
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quick stats */}
        {paidOrders.length > 0 && (
          <div className="mt-5 flex items-center gap-2 text-[11px] text-slate-400">
            <CheckCircleSolid className="h-3.5 w-3.5 text-emerald-400" />
            {paidOrders.length} eerdere {paidOrders.length === 1 ? 'bestelling' : 'bestellingen'} &middot;
            &euro;{(paidOrders.reduce((s, o) => s + Number(o.total_price) * 1.21, 0)).toFixed(2)} totaal incl. BTW
          </div>
        )}
      </div>

      <AnimatePresence>
        {pendingCancelOrder && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm"
              onClick={() => !cancellingOrder && setPendingCancelOrderId(null)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed inset-x-0 bottom-0 z-[60] rounded-t-2xl border border-slate-200 bg-white p-4 shadow-2xl"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
              <h3 className="text-sm font-semibold text-slate-900">Bestelling verwijderen?</h3>
              <p className="mt-1 text-xs text-slate-500">
                Je staat op het punt deze openstaande bestelling te verwijderen:
              </p>
              <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                {pendingCancelOrder.batch_size} leads - {pendingCancelOrder.branch}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setPendingCancelOrderId(null)}
                  disabled={cancellingOrder}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Annuleren
                </button>
                <button
                  onClick={confirmCancelOrder}
                  disabled={cancellingOrder}
                  className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                >
                  {cancellingOrder ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      Verwijderen...
                    </>
                  ) : (
                    <>
                      <TrashIcon className="h-4 w-4" />
                      Verwijderen
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── New customer ordering view (no existing batches) ── */
function NewCustomerOrderView({
  customer,
  welcomeDiscount,
  showToast,
  toast,
}: {
  customer: { id: string; name: string; email: string; contact_person: string; branches: string[] };
  welcomeDiscount: { active: boolean; expiresAt: string | null };
  showToast: (msg: string, type?: 'success' | 'error') => void;
  toast: { msg: string; type: 'success' | 'error' } | null;
}) {
  const [availableBranches, setAvailableBranches] = useState<{ slug: string; name: string }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [batchSize, setBatchSize] = useState(100);
  const [customSize, setCustomSize] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetch('/api/branches')
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        const customerBranches = customer.branches || [];
        const filtered = customerBranches.length > 0
          ? data.filter((b: { slug: string }) => customerBranches.includes(b.slug))
          : data;
        setAvailableBranches(filtered.length > 0 ? filtered : data);
        if (filtered.length > 0) setSelectedBranch(filtered[0].slug);
        else if (data.length > 0) setSelectedBranch(data[0].slug);
      })
      .catch(() => {});
  }, [customer.branches]);

  useEffect(() => {
    if (!selectedBranch) return;
    portalFetch(`/api/portal/pricing?branch=${selectedBranch}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPricingData(data); })
      .catch(() => {});
  }, [selectedBranch]);

  const effectiveSize = useCustom ? (parseInt(customSize) || 0) : batchSize;
  const minBatchSize = pricingData?.min_batch_size || 10;

  const dynamicPrice = useMemo(() => {
    if (!pricingData?.tiers?.length) return 0;
    const sorted = [...pricingData.tiers].sort((a, b) => b.min_leads - a.min_leads);
    const tier = sorted.find(t => effectiveSize >= t.min_leads);
    return tier ? tier.price_per_lead : 0;
  }, [pricingData, effectiveSize]);

  const subtotalBefore = effectiveSize * dynamicPrice;
  const discount = welcomeDiscount.active ? Math.round(subtotalBefore * 0.20 * 100) / 100 : 0;
  const subtotal = subtotalBefore - discount;
  const btw = Math.round(subtotal * 0.21 * 100) / 100;
  const total = subtotal + btw;

  const QUICK_SIZES = useMemo(() => {
    const min = minBatchSize;
    const defaults = [50, 100, 200, 500].filter(s => s >= min);
    if (defaults.length === 0) return [min];
    if (!defaults.includes(min) && min < defaults[0]) defaults.unshift(min);
    return defaults.slice(0, 4);
  }, [minBatchSize]);

  const handleOrder = async () => {
    if (!selectedBranch || effectiveSize < minBatchSize || dynamicPrice <= 0) return;
    setSubmitting(true);
    try {
      const res = await portalFetch('/api/portal/orders', {
        method: 'POST',
        body: JSON.stringify({
          batch_size: effectiveSize,
          branch: selectedBranch,
          price_per_lead: dynamicPrice,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Bestelling mislukt', 'error');
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch {
      showToast('Er is iets misgegaan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const branchName = availableBranches.find(b => b.slug === selectedBranch)?.name || selectedBranch;

  return (
    <div className="space-y-6 pb-28 sm:pb-0">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[100] w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-xl ${
              toast.type === 'error' ? 'bg-red-600' : 'bg-slate-900'
            }`}>
            <div className="flex items-center gap-2">
              {toast.type === 'error' ? <XCircleIcon className="h-4 w-4 text-red-200" /> : <CheckCircleIcon className="h-4 w-4 text-emerald-400" />}
              {toast.msg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Eerste batch bestellen</h1>
        <p className="mt-0.5 text-sm text-slate-500">Kies een branche en het aantal leads om te starten</p>
      </div>

      <div className="space-y-6">
        {/* Welcome discount */}
        {welcomeDiscount.active && (
          <div className="flex items-center gap-3 rounded-2xl border border-brand-purple/20 bg-gradient-to-r from-brand-purple/5 to-brand-pink/5 px-5 py-4">
            <span className="text-2xl">🎁</span>
            <div>
              <p className="text-sm font-bold text-brand-purple">20% welkomstkorting op je eerste bestelling!</p>
              <p className="text-xs text-slate-500">
                Automatisch toegepast
                {welcomeDiscount.expiresAt && (
                  <> &middot; Geldig tot {new Date(welcomeDiscount.expiresAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}</>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Branch selector */}
        {availableBranches.length > 1 && (
          <section>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">Branche</label>
            <div className="relative -mx-1 px-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-4 bg-gradient-to-r from-slate-50 to-transparent sm:hidden" />
              <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-4 bg-gradient-to-l from-slate-50 to-transparent sm:hidden" />
              <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1.5">
              {availableBranches.map(b => (
                <button key={b.slug} onClick={() => setSelectedBranch(b.slug)}
                  className={`min-h-11 shrink-0 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition ${
                    selectedBranch === b.slug
                      ? 'border-brand-purple bg-brand-purple/5 text-brand-purple'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}>
                  {b.name}
                </button>
              ))}
              </div>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 sm:hidden">Swipe om alle branches te zien</p>
          </section>
        )}

        {availableBranches.length === 1 && selectedBranch && (
          <section className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-pink">
              <BoltIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{branchName}</p>
              {dynamicPrice > 0 && <p className="text-xs text-slate-400">&euro;{dynamicPrice.toFixed(2)} per lead excl. BTW</p>}
            </div>
          </section>
        )}

        {/* Batch size */}
        {dynamicPrice > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <label className="mb-3 block text-sm font-semibold text-slate-800">Hoeveel leads wil je bestellen?</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {QUICK_SIZES.map(size => {
                const isActive = !useCustom && batchSize === size;
                let sizePrice = dynamicPrice;
                if (pricingData?.tiers?.length) {
                  const sorted = [...pricingData.tiers].sort((a, b) => b.min_leads - a.min_leads);
                  const tier = sorted.find(t => size >= t.min_leads);
                  if (tier) sizePrice = tier.price_per_lead;
                }
                const raw = size * sizePrice;
                const disc = welcomeDiscount.active ? raw * 0.20 : 0;
                const price = Math.round((raw - disc) * 1.21 * 100) / 100;
                return (
                  <button key={size} onClick={() => { setBatchSize(size); setUseCustom(false); }}
                    className={`relative rounded-2xl border-2 p-3 text-left transition ${
                      isActive ? 'border-brand-purple bg-brand-purple/5 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}>
                    {isActive && <CheckCircleSolid className="absolute right-2 top-2 h-5 w-5 text-brand-purple" />}
                    <p className={`text-2xl font-bold ${isActive ? 'text-brand-purple' : 'text-slate-900'}`}>{size}</p>
                    <p className="text-[11px] text-slate-400">leads</p>
                    <p className={`mt-1 text-xs font-semibold ${isActive ? 'text-brand-purple' : 'text-slate-500'}`}>
                      &euro;{price.toFixed(2)} <span className="font-normal text-slate-400">incl.</span>
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-3">
              <div className={`w-full rounded-2xl border-2 p-3 text-left transition ${
                useCustom ? 'border-brand-purple bg-brand-purple/5' : 'border-dashed border-slate-200'
              }`}>
                {!useCustom ? (
                  <button
                    type="button"
                    onClick={() => { setUseCustom(true); if (!customSize) setCustomSize(String(batchSize || 75)); }}
                    className="flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-slate-500 transition hover:bg-slate-50"
                  >
                    Ander aantal kiezen...
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCustomSize(String(Math.max(minBatchSize, (parseInt(customSize) || 0) - 10)))}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      >
                        <MinusIcon className="h-4 w-4" />
                      </button>
                      <input type="number" min={minBatchSize} value={customSize}
                        onChange={(e) => setCustomSize(e.target.value)}
                        className="h-11 w-20 rounded-xl border border-slate-200 bg-white px-2 text-center text-sm font-bold text-slate-900 outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/20" />
                      <button
                        type="button"
                        onClick={() => setCustomSize(String((parseInt(customSize) || 0) + 10))}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-brand-purple">{effectiveSize} leads</p>
                      <p className="text-[11px] text-slate-400">{formatCurrency(total)} incl. BTW</p>
                    </div>
                    <CheckCircleSolid className="h-5 w-5 shrink-0 text-brand-purple" />
                  </div>
                )}
              </div>
            </div>

            {effectiveSize > 0 && effectiveSize < minBatchSize && (
              <p className="mt-2 text-center text-xs text-red-500">Minimaal {minBatchSize} leads per batch</p>
            )}

            {pricingData?.tiers && pricingData.tiers.length > 0 && (
              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Staffelprijzen</p>
                <div className="flex flex-wrap gap-1.5">
                  {[...pricingData.tiers].sort((a, b) => a.min_leads - b.min_leads).map((t, i) => {
                    const sorted = [...pricingData.tiers].sort((a, b) => a.min_leads - b.min_leads);
                    const isActiveTier = effectiveSize >= t.min_leads && (i === sorted.length - 1 || effectiveSize < sorted[i + 1]?.min_leads);
                    return (
                      <span key={i} className={`rounded-lg border px-2 py-1 text-[11px] font-medium ${
                        isActiveTier ? 'border-brand-purple bg-brand-purple/10 text-brand-purple' : 'border-slate-200 bg-white text-slate-500'
                      }`}>
                        {t.min_leads}+ leads &rarr; &euro;{Number(t.price_per_lead).toFixed(2)}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Notes */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Opmerkingen <span className="text-slate-400">(optioneel)</span></label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            placeholder="Bijv. voorkeur regio, specifieke wensen..."
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20" />
        </section>

        {/* Price summary */}
        {dynamicPrice > 0 && effectiveSize >= minBatchSize && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="space-y-0 divide-y divide-slate-100 px-5 py-4">
              <div className="flex items-center justify-between pb-3">
                <span className="text-sm text-slate-500">{effectiveSize} leads &times; &euro;{dynamicPrice.toFixed(2)}</span>
                <span className={`text-sm font-medium ${welcomeDiscount.active ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                  &euro;{subtotalBefore.toFixed(2)}
                </span>
              </div>
              {welcomeDiscount.active && (
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-emerald-600">Welkomstkorting -20%</span>
                  <span className="text-sm font-medium text-emerald-600">-&euro;{discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-slate-500">BTW 21%</span>
                <span className="text-sm font-medium text-slate-800">&euro;{btw.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between pt-3">
                <span className="text-sm font-bold text-slate-900">Totaal</span>
                <span className="text-lg font-bold text-brand-purple">&euro;{total.toFixed(2)}</span>
              </div>
            </div>
            <div className="hidden border-t border-slate-100 p-4 sm:block">
              <button onClick={handleOrder} disabled={submitting || effectiveSize < minBatchSize}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink px-6 py-3.5 text-[15px] font-bold text-white shadow-lg transition hover:shadow-xl active:scale-[0.99] disabled:opacity-50 disabled:shadow-none">
                {submitting ? (
                  <><ArrowPathIcon className="h-5 w-5 animate-spin" /> Wordt verwerkt...</>
                ) : (
                  <><CreditCardIcon className="h-5 w-5" /> Afrekenen &middot; {formatCurrency(total)}</>
                )}
              </button>
            </div>
          </div>
        )}

        {dynamicPrice <= 0 && selectedBranch && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
            <p className="text-sm font-semibold text-amber-800">Neem contact op met WarmeLeads voor prijsinformatie</p>
            <p className="mt-1 text-xs text-amber-600">Wij stellen een pakket samen op maat voor je branche.</p>
            <a href="mailto:info@warmeleads.eu" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-purple hover:underline">
              info@warmeleads.eu <ArrowRightIcon className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>

      {dynamicPrice > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_-18px_rgba(15,23,42,0.55)] backdrop-blur sm:hidden">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-slate-500">Totaal incl. BTW</p>
            <p className="text-base font-bold text-brand-purple">{formatCurrency(total)}</p>
          </div>
          <button
            onClick={handleOrder}
            disabled={submitting || effectiveSize < minBatchSize}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-button-gradient px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-orange/20 transition active:scale-[0.99] disabled:opacity-50 disabled:shadow-none"
          >
            {submitting ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                Wordt verwerkt...
              </>
            ) : (
              <>
                <CreditCardIcon className="h-5 w-5" />
                Afrekenen
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
