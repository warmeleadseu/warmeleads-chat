'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePortal } from '../portalContext';
import { portalFetch } from '@/lib/portalAuth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCartIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  MinusIcon,
  PlusIcon,
  CubeIcon,
  CreditCardIcon,
  ClockIcon,
  SparklesIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

interface Batch {
  id: string;
  branch: string;
  branch_name?: string;
  batch_size: number;
  leads_delivered: number;
  price_per_lead: number;
  total_price: number;
  leads_per_week: number | null;
  lead_filters: unknown[];
  status: string;
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

const BATCH_SIZES = [25, 50, 100, 150, 200, 250, 500];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { text: string; cls: string }> = {
    paid: { text: 'Betaald', cls: 'bg-emerald-50 text-emerald-600' },
    pending: { text: 'In behandeling', cls: 'bg-amber-50 text-amber-600' },
    failed: { text: 'Mislukt', cls: 'bg-red-50 text-red-600' },
    expired: { text: 'Verlopen', cls: 'bg-slate-100 text-slate-500' },
    cancelled: { text: 'Geannuleerd', cls: 'bg-slate-100 text-slate-500' },
  };
  const s = map[status] || { text: status, cls: 'bg-slate-100 text-slate-500' };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.text}</span>;
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
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [batchSize, setBatchSize] = useState(100);
  const [customSize, setCustomSize] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [redirectOrder, setRedirectOrder] = useState<Order | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const fetchData = useCallback(async () => {
    if (!customer) return;
    const [batchRes, orderRes] = await Promise.all([
      portalFetch('/api/portal/batches').then(r => r.json()),
      portalFetch('/api/portal/orders').then(r => r.json()),
    ]);
    setBatches({ active: batchRes.active || [], completed: batchRes.completed || [] });
    setOrders(Array.isArray(orderRes) ? orderRes : []);
    return { batches: batchRes, orders: Array.isArray(orderRes) ? orderRes : [] };
  }, [customer]);

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
              } catch { /* ignore polling errors */ }
            }, 3000);
          }
        }
      }

      if (sourceBatchId && !orderRedirectId) {
        const match = allBatches.find((b: Batch) => b.id === sourceBatchId);
        if (match) {
          setSelectedBatch(match);
          setBatchSize(match.batch_size);
        }
      }
    }).finally(() => setLoading(false));

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [customer, sourceBatchId, orderRedirectId, redirectStatus, fetchData]);

  const BTW_RATE = 0.21;
  const effectiveSize = useCustom ? (parseInt(customSize) || 0) : batchSize;
  const pricePerLead = selectedBatch?.price_per_lead || 0;
  const subtotal = effectiveSize * pricePerLead;
  const btwAmount = Math.round(subtotal * BTW_RATE * 100) / 100;
  const totalInclBtw = subtotal + btwAmount;

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Weet u zeker dat u deze bestelling wilt verwijderen?')) return;
    try {
      const res = await portalFetch('/api/portal/orders', {
        method: 'DELETE',
        body: JSON.stringify({ order_id: orderId }),
      });
      if (res.ok) {
        setOrders(prev => prev.filter(o => o.id !== orderId));
        showToast('Bestelling verwijderd');
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || 'Verwijderen mislukt', 'error');
      }
    } catch {
      showToast('Verwijderen mislukt', 'error');
    }
  };

  const handleOrder = async () => {
    if (!selectedBatch || effectiveSize < 10) return;
    setSubmitting(true);
    try {
      const res = await portalFetch('/api/portal/orders', {
        method: 'POST',
        body: JSON.stringify({
          batch_size: effectiveSize,
          source_batch_id: selectedBatch.id,
          branch: selectedBatch.branch,
          price_per_lead: selectedBatch.price_per_lead,
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

  if (loading) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <div className="h-7 w-52 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-4 w-72 animate-pulse rounded bg-slate-50" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map(i => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
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
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className={`mb-6 flex h-20 w-20 items-center justify-center rounded-2xl shadow-lg ${
            isPaid ? 'bg-emerald-500' : isPending ? 'bg-amber-400' : 'bg-red-500'
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

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-xl font-bold text-slate-900 sm:text-2xl"
        >
          {isPaid ? 'Betaling gelukt!' : isPending ? 'Betaling wordt verwerkt...' : isExpired ? 'Betaling verlopen' : isCancelled ? 'Betaling geannuleerd' : 'Betaling niet gelukt'}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-3 max-w-md text-sm leading-relaxed text-slate-500"
        >
          {isPaid
            ? 'Uw nieuwe batch is aangemaakt en leads worden automatisch toegewezen. U ontvangt een bevestiging per e-mail.'
            : isPending
            ? 'De betaling wordt verwerkt door Mollie. Dit duurt meestal een paar seconden. Deze pagina wordt automatisch bijgewerkt.'
            : 'De betaling is helaas niet gelukt. U kunt het opnieuw proberen of contact opnemen met ons.'}
        </motion.p>

        {isPending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-4 flex items-center gap-2 text-xs text-amber-600"
          >
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
            <span>Status wordt automatisch bijgewerkt...</span>
          </motion.div>
        )}

        {isPaid && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-3 text-left"
          >
            <p className="text-sm font-medium text-emerald-800">
              {redirectOrder.batch_size} leads &middot; &euro;{(Number(redirectOrder.total_price) * 1.21).toFixed(2)} incl. BTW
            </p>
            <p className="mt-0.5 text-xs text-emerald-600">Batch is direct actief</p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mt-8 flex flex-col gap-3 sm:flex-row"
        >
          <button
            onClick={() => router.push('/portal')}
            className="rounded-xl bg-brand-purple px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-purple/90"
          >
            Terug naar leads
          </button>
          {isFailed && (
            <button
              onClick={() => { setRedirectOrder(null); router.replace('/portal/bestellen'); }}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Opnieuw proberen
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  /* ── No batches available ── */
  const allBatches = [...batches.active, ...batches.completed];

  if (!selectedBatch && allBatches.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
          <CubeIcon className="h-8 w-8 text-slate-400" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Nog geen batches</h2>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          Er zijn nog geen batches beschikbaar om te herbestellen. Neem contact op met WarmeLeads.
        </p>
        <a
          href="mailto:info@warmeleads.eu"
          className="mt-4 text-sm font-medium text-brand-purple hover:underline"
        >
          info@warmeleads.eu
        </a>
      </div>
    );
  }

  /* ── Batch selection overview ── */
  if (!selectedBatch) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Nieuwe batch bestellen</h1>
          <p className="mt-0.5 text-sm text-slate-500">Kies een branche om een vervolg batch te bestellen</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {allBatches.map(b => {
            const pct = b.batch_size > 0 ? Math.round((b.leads_delivered / b.batch_size) * 100) : 0;
            const isActive = b.status === 'active';
            return (
              <motion.button
                key={b.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => { setSelectedBatch(b); setBatchSize(b.batch_size); }}
                className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-purple/30 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${isActive ? 'bg-brand-purple/10 text-brand-purple' : 'bg-emerald-50 text-emerald-600'}`}>
                    {b.branch_name || b.branch}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">{isActive ? `${pct}% voltooid` : 'Voltooid'}</span>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <p className="text-sm text-slate-600">{b.leads_delivered} / {b.batch_size} leads</p>
                  <p className="text-sm font-bold text-slate-900">&euro;{Number(b.price_per_lead).toFixed(2)}<span className="text-xs font-normal text-slate-400"> /lead excl. BTW</span></p>
                </div>
                {isActive && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-pink transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                )}
                <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-brand-purple opacity-60 transition group-hover:opacity-100">
                  <ShoppingCartIcon className="h-3.5 w-3.5" />
                  Nieuwe batch bestellen
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Previous orders */}
        {orders.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Eerdere bestellingen</h2>
            <div className="space-y-2">
              {orders.slice(0, 5).map(o => (
                <div key={o.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{o.batch_size} leads &middot; {o.branch}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(o.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <StatusBadge status={o.status} />
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">&euro;{(Number(o.total_price) * 1.21).toFixed(2)} <span className="font-normal text-slate-400">incl. BTW</span></p>
                    </div>
                    {o.status !== 'paid' && (
                      <button
                        onClick={() => handleCancelOrder(o.id)}
                        className="shrink-0 rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                        title="Bestelling verwijderen"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {orders.length > 5 && (
                <Link href="/portal/account" className="block text-center text-xs font-medium text-brand-purple hover:underline">
                  Alle {orders.length} bestellingen bekijken
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Order configuration ── */
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium shadow-lg ${
              toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setSelectedBatch(null)}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-slate-700"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Terug naar overzicht
      </button>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-pink shadow-sm">
              <ShoppingCartIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Nieuwe batch bestellen</h1>
              <p className="text-sm text-slate-500">{selectedBatch.branch_name || selectedBatch.branch}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          {/* Batch size selector */}
          <div>
            <label className="mb-2.5 block text-sm font-semibold text-slate-700">Hoeveel leads wilt u?</label>
            <div className="flex flex-wrap gap-2">
              {BATCH_SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => { setBatchSize(size); setUseCustom(false); }}
                  className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition ${
                    !useCustom && batchSize === size
                      ? 'border-brand-purple bg-brand-purple text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {size}
                </button>
              ))}
              <button
                onClick={() => { setUseCustom(true); if (!customSize) setCustomSize('75'); }}
                className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition ${
                  useCustom
                    ? 'border-brand-purple bg-brand-purple text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                Anders
              </button>
            </div>
            {useCustom && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-3 flex items-center gap-2"
              >
                <button
                  onClick={() => setCustomSize(String(Math.max(10, (parseInt(customSize) || 0) - 10)))}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                >
                  <MinusIcon className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  min="10"
                  value={customSize}
                  onChange={(e) => setCustomSize(e.target.value)}
                  placeholder="Aantal"
                  className="h-10 w-28 rounded-lg border border-slate-200 px-3 text-center text-sm font-medium text-slate-900 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
                />
                <button
                  onClick={() => setCustomSize(String((parseInt(customSize) || 0) + 10))}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
                <span className="text-sm text-slate-500">leads</span>
              </motion.div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Opmerkingen <span className="text-slate-400">(optioneel)</span></label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Bijv. voorkeur regio, specifieke wensen..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
            />
          </div>

          {/* Price summary */}
          <div className="rounded-xl bg-slate-50 p-4 sm:p-5">
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Branche</span>
                <span className="font-medium text-slate-900">{selectedBatch.branch_name || selectedBatch.branch}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Aantal leads</span>
                <span className="font-medium text-slate-900">{effectiveSize}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Prijs per lead <span className="text-slate-400">(excl. BTW)</span></span>
                <span className="font-medium text-slate-900">&euro;{pricePerLead.toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-200 pt-2.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotaal excl. BTW</span>
                  <span className="font-medium text-slate-900">&euro;{subtotal.toFixed(2)}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-slate-500">BTW 21%</span>
                  <span className="font-medium text-slate-900">&euro;{btwAmount.toFixed(2)}</span>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-2.5">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold text-slate-700">Totaal incl. BTW</span>
                  <span className="text-xl font-bold text-brand-purple">&euro;{totalInclBtw.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Info box */}
          <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/50 p-3.5">
            <SparklesIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            <div className="text-xs leading-relaxed text-blue-700">
              <p>Na betaling wordt uw nieuwe batch direct aangemaakt. Leads worden automatisch toegewezen zodra ze beschikbaar zijn.</p>
              <p className="mt-1">De instellingen (regio, filters) worden overgenomen van uw huidige batch.</p>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handleOrder}
            disabled={submitting || effectiveSize < 10}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink px-6 py-4 text-[15px] font-bold text-white shadow-lg transition hover:shadow-xl active:scale-[0.99] disabled:opacity-50 disabled:shadow-none"
          >
            {submitting ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                Wordt verwerkt...
              </>
            ) : (
              <>
                <CreditCardIcon className="h-5 w-5" />
                Betaal &euro;{totalInclBtw.toFixed(2)} incl. BTW
              </>
            )}
          </button>

          {effectiveSize > 0 && effectiveSize < 10 && (
            <p className="text-center text-xs text-red-500">Minimaal 10 leads per batch</p>
          )}
        </div>
      </div>
    </div>
  );
}
