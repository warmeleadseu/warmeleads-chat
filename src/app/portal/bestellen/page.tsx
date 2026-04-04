'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { usePortal } from '../portalContext';
import { portalFetch } from '@/lib/portalAuth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCartIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  InformationCircleIcon,
  MinusIcon,
  PlusIcon,
  CubeIcon,
  CreditCardIcon,
  ClockIcon,
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

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    if (!customer) return;
    Promise.all([
      portalFetch('/api/portal/batches').then(r => r.json()),
      portalFetch('/api/portal/orders').then(r => r.json()),
    ]).then(([batchData, orderData]) => {
      setBatches({ active: batchData.active || [], completed: batchData.completed || [] });
      setOrders(Array.isArray(orderData) ? orderData : []);

      const allBatches = [...(batchData.active || []), ...(batchData.completed || [])];

      if (orderRedirectId && redirectStatus === 'redirect') {
        const found = (Array.isArray(orderData) ? orderData : []).find((o: Order) => o.id === orderRedirectId);
        if (found) setRedirectOrder(found);
      }

      if (sourceBatchId) {
        const match = allBatches.find((b: Batch) => b.id === sourceBatchId);
        if (match) {
          setSelectedBatch(match);
          setBatchSize(match.batch_size);
        }
      }
    }).finally(() => setLoading(false));
  }, [customer, sourceBatchId, orderRedirectId, redirectStatus]);

  const effectiveSize = useCustom ? (parseInt(customSize) || 0) : batchSize;
  const pricePerLead = selectedBatch?.price_per_lead || 0;
  const totalPrice = effectiveSize * pricePerLead;

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
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-100" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      </div>
    );
  }

  if (redirectOrder) {
    const isPaid = redirectOrder.status === 'paid';
    return (
      <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`mb-6 flex h-20 w-20 items-center justify-center rounded-full ${isPaid ? 'bg-emerald-50' : 'bg-amber-50'}`}
        >
          {isPaid ? (
            <CheckCircleIcon className="h-10 w-10 text-emerald-500" />
          ) : redirectOrder.status === 'failed' || redirectOrder.status === 'expired' || redirectOrder.status === 'cancelled' ? (
            <XCircleIcon className="h-10 w-10 text-red-500" />
          ) : (
            <ClockIcon className="h-10 w-10 text-amber-500" />
          )}
        </motion.div>
        <h2 className="text-xl font-bold text-slate-900">
          {isPaid ? 'Betaling gelukt!' : redirectOrder.status === 'pending' ? 'Betaling wordt verwerkt...' : 'Betaling niet gelukt'}
        </h2>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          {isPaid
            ? 'Uw nieuwe batch is aangemaakt en leads worden automatisch toegewezen. U ontvangt een bevestiging per e-mail.'
            : redirectOrder.status === 'pending'
            ? 'De betaling wordt verwerkt. Zodra de betaling bevestigd is, wordt uw batch automatisch aangemaakt.'
            : 'De betaling is helaas niet gelukt. Probeer het opnieuw of neem contact op.'}
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => router.push('/portal')}
            className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-purple/90"
          >
            Terug naar leads
          </button>
          {!isPaid && redirectOrder.status !== 'pending' && (
            <button
              onClick={() => { setRedirectOrder(null); router.replace('/portal/bestellen'); }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Opnieuw proberen
            </button>
          )}
        </div>
      </div>
    );
  }

  const allBatches = [...batches.active, ...batches.completed];

  if (!selectedBatch && allBatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
        <CubeIcon className="mb-4 h-12 w-12 text-slate-300" />
        <h2 className="text-lg font-bold text-slate-900">Nog geen batches</h2>
        <p className="mt-1 text-sm text-slate-500">
          Er zijn nog geen batches beschikbaar om te herbestellen. Neem contact op met WarmeLeads.
        </p>
      </div>
    );
  }

  if (!selectedBatch) {
    return (
      <div className="space-y-5 p-4 sm:p-6">
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
                  <span className="text-xs font-semibold text-slate-400">{isActive ? `${pct}%` : 'Voltooid'}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{b.leads_delivered} / {b.batch_size} leads</p>
                <p className="mt-1 text-xs text-slate-400">&euro;{Number(b.price_per_lead).toFixed(2)} per lead</p>
                <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-brand-purple opacity-0 transition group-hover:opacity-100">
                  <ShoppingCartIcon className="h-3.5 w-3.5" />
                  Bestellen
                </div>
              </motion.button>
            );
          })}
        </div>

        {orders.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Eerdere bestellingen</h2>
            <div className="space-y-2">
              {orders.map(o => (
                <div key={o.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{o.batch_size} leads &middot; {o.branch}</p>
                    <p className="text-xs text-slate-400">{new Date(o.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    o.status === 'paid' ? 'bg-emerald-50 text-emerald-600'
                    : o.status === 'pending' ? 'bg-amber-50 text-amber-600'
                    : 'bg-red-50 text-red-600'
                  }`}>
                    {o.status === 'paid' ? 'Betaald' : o.status === 'pending' ? 'In behandeling' : o.status === 'failed' ? 'Mislukt' : o.status === 'expired' ? 'Verlopen' : 'Geannuleerd'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

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

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-purple/10">
            <ShoppingCartIcon className="h-5 w-5 text-brand-purple" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Nieuwe batch bestellen</h1>
            <p className="text-sm text-slate-500">{selectedBatch.branch_name || selectedBatch.branch}</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Batch grootte</label>
            <div className="flex flex-wrap gap-2">
              {BATCH_SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => { setBatchSize(size); setUseCustom(false); }}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    !useCustom && batchSize === size
                      ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {size} leads
                </button>
              ))}
              <button
                onClick={() => setUseCustom(true)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  useCustom
                    ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                Anders
              </button>
            </div>
            {useCustom && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => setCustomSize(String(Math.max(10, (parseInt(customSize) || 0) - 10)))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                >
                  <MinusIcon className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  min="10"
                  value={customSize}
                  onChange={(e) => setCustomSize(e.target.value)}
                  placeholder="Aantal"
                  className="h-9 w-24 rounded-lg border border-slate-200 px-3 text-center text-sm text-slate-900 outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple"
                />
                <button
                  onClick={() => setCustomSize(String((parseInt(customSize) || 0) + 10))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
                <span className="text-sm text-slate-500">leads</span>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Opmerkingen (optioneel)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Bijv. voorkeur regio, specifieke wensen..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple"
            />
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Overzicht</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Branche</span>
                <span className="font-medium text-slate-900">{selectedBatch.branch_name || selectedBatch.branch}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Aantal leads</span>
                <span className="font-medium text-slate-900">{effectiveSize}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Prijs per lead</span>
                <span className="font-medium text-slate-900">&euro;{pricePerLead.toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-200 pt-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-700">Totaalprijs</span>
                  <span className="text-lg font-bold text-brand-purple">&euro;{totalPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3">
            <InformationCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            <p className="text-xs text-blue-700">
              Na betaling wordt uw nieuwe batch direct aangemaakt. Leads worden automatisch toegewezen zodra ze beschikbaar zijn.
              De instellingen (regio, filters) worden overgenomen van uw huidige batch.
            </p>
          </div>

          <button
            onClick={handleOrder}
            disabled={submitting || effectiveSize < 10}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink px-6 py-3.5 text-sm font-bold text-white shadow-lg transition hover:shadow-xl disabled:opacity-50"
          >
            {submitting ? (
              <ArrowPathIcon className="h-5 w-5 animate-spin" />
            ) : (
              <CreditCardIcon className="h-5 w-5" />
            )}
            {submitting ? 'Bezig...' : `Betaal €${totalPrice.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
