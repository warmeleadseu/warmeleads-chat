'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { portalFetch } from '@/lib/portalAuth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowPathIcon,
  CreditCardIcon,
  CalendarDaysIcon,
  BoltIcon,
  CheckCircleIcon,
  MinusIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

interface ApptBatch {
  id: string;
  branch: string;
  batch_size: number;
  appointments_delivered: number;
  price_per_appointment: number;
  total_price: number;
  appointments_per_week: number | null;
  appointments_per_day: number | null;
  lead_filters: unknown[];
  status: string;
  is_paid: boolean;
  created_at: string;
}

interface ApptOrder {
  id: string;
  branch: string;
  batch_size: number;
  price_per_appointment: number;
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
  default_duration: number;
  default_travel_buffer: number;
  branch_name: string;
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

export default function AppointmentsOrderView({
  customerBranches,
  onToast,
}: {
  customerBranches: string[];
  onToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [batches, setBatches] = useState<ApptBatch[]>([]);
  const [orders, setOrders] = useState<ApptOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchNames, setBranchNames] = useState<Record<string, string>>({});

  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [batchSize, setBatchSize] = useState<number>(10);
  const [customSize, setCustomSize] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [apptsPerWeek, setApptsPerWeek] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [pricingData, setPricingData] = useState<PricingData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [batchesRes, ordersRes, branchesRes] = await Promise.all([
        portalFetch('/api/portal/appointment-batches'),
        portalFetch('/api/portal/appointment-orders'),
        portalFetch('/api/portal/branches'),
      ]);
      if (batchesRes.ok) setBatches(await batchesRes.json());
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (branchesRes.ok) {
        const data = await branchesRes.json();
        const map: Record<string, string> = {};
        (data.branches || data || []).forEach((b: { slug: string; name: string }) => { map[b.slug] = b.name; });
        setBranchNames(map);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selectedBranch && customerBranches.length > 0) {
      setSelectedBranch(customerBranches[0]);
    }
  }, [customerBranches, selectedBranch]);

  useEffect(() => {
    if (!selectedBranch) return;
    portalFetch(`/api/portal/appointment-pricing?branch=${encodeURIComponent(selectedBranch)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setPricingData({
          tiers: data.tiers || [],
          min_batch_size: data.min_batch_size,
          nationwide_discount: data.nationwide_discount,
          is_custom: data.is_custom,
          default_duration: data.default_duration,
          default_travel_buffer: data.default_travel_buffer,
          branch_name: data.branch_name,
        });
        setBatchSize(prev => Math.max(prev, data.min_batch_size));
      })
      .catch(() => {});
  }, [selectedBranch]);

  const effectiveSize = useCustom ? (parseInt(customSize) || 0) : batchSize;
  const minBatchSize = pricingData?.min_batch_size || 5;

  const dynamicPrice = useMemo(() => {
    if (!pricingData || pricingData.tiers.length === 0) return 0;
    const sorted = [...pricingData.tiers].sort((a, b) => b.min_leads - a.min_leads);
    const tier = sorted.find(t => effectiveSize >= t.min_leads);
    return tier ? tier.price_per_lead : 0;
  }, [pricingData, effectiveSize]);

  const subtotal = dynamicPrice * effectiveSize;
  const btw = subtotal * BTW_RATE;
  const total = subtotal + btw;

  const handleOrder = async () => {
    if (!selectedBranch || effectiveSize < minBatchSize || dynamicPrice <= 0) return;
    setSubmitting(true);
    try {
      const res = await portalFetch('/api/portal/appointment-orders', {
        method: 'POST',
        body: JSON.stringify({
          batch_size: effectiveSize,
          branch: selectedBranch,
          appointments_per_week: apptsPerWeek,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast(data.error || 'Bestelling mislukt', 'error');
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch {
      onToast('Er is iets misgegaan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        ))}
      </div>
    );
  }

  const activeBatches = batches.filter(b => b.status === 'active' && b.is_paid);
  const presetSizes = pricingData
    ? Array.from(new Set([
        minBatchSize,
        ...pricingData.tiers.map(t => t.min_leads).filter(n => n >= minBatchSize),
        Math.max(minBatchSize, 20),
      ])).sort((a, b) => a - b).slice(0, 5)
    : [5, 10, 15, 20, 30];

  return (
    <div className="space-y-6">
      {activeBatches.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Actieve afspraken-batches</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {activeBatches.map(b => {
              const pct = b.batch_size > 0 ? Math.round((b.appointments_delivered / b.batch_size) * 100) : 0;
              return (
                <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-900">{branchNames[b.branch] || b.branch}</p>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Actief</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{b.appointments_delivered} van {b.batch_size} geleverd</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-brand-purple" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {customerBranches.length > 1 && (
        <section>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">Branche</label>
          <div className="flex flex-wrap gap-2">
            {customerBranches.map(b => (
              <button
                key={b}
                onClick={() => setSelectedBranch(b)}
                className={`min-h-11 rounded-xl border-2 px-4 py-2 text-sm font-semibold transition ${
                  selectedBranch === b
                    ? 'border-brand-purple bg-brand-purple/5 text-brand-purple'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {branchNames[b] || b}
              </button>
            ))}
          </div>
        </section>
      )}

      {pricingData && dynamicPrice > 0 ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Hoeveel afspraken?</h3>
            <p className="mt-0.5 text-xs text-slate-500">Vanaf {minBatchSize} afspraken</p>

            <div className="mt-3 flex flex-wrap gap-2">
              {presetSizes.map(size => (
                <button
                  key={size}
                  onClick={() => { setBatchSize(size); setUseCustom(false); }}
                  className={`min-h-10 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                    !useCustom && batchSize === size
                      ? 'border-brand-purple bg-brand-purple text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {size}
                </button>
              ))}
              <button
                onClick={() => setUseCustom(true)}
                className={`min-h-10 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  useCustom
                    ? 'border-brand-purple bg-brand-purple text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                Custom
              </button>
            </div>

            {useCustom && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => setCustomSize(String(Math.max(minBatchSize, (parseInt(customSize) || minBatchSize) - 1)))}
                  className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                >
                  <MinusIcon className="mx-auto h-4 w-4" />
                </button>
                <input
                  type="number"
                  min={minBatchSize}
                  value={customSize}
                  onChange={e => setCustomSize(e.target.value)}
                  className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-center text-sm font-semibold text-slate-900 outline-none focus:border-brand-purple/50"
                  placeholder={`${minBatchSize}+`}
                />
                <button
                  onClick={() => setCustomSize(String((parseInt(customSize) || minBatchSize) + 1))}
                  className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                >
                  <PlusIcon className="mx-auto h-4 w-4" />
                </button>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Planningssnelheid (optioneel)</h3>
            <p className="mt-0.5 text-xs text-slate-500">Hoeveel afspraken maximaal per week?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[null, 2, 5, 10, 20].map((n, i) => (
                <button
                  key={i}
                  onClick={() => setApptsPerWeek(n)}
                  className={`min-h-10 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                    apptsPerWeek === n
                      ? 'border-brand-purple bg-brand-purple text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {n === null ? 'Zo snel mogelijk' : `${n}/week`}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Opmerkingen (optioneel)</h3>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Specifieke wensen, doelgroep-voorkeuren..."
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
            />
          </section>

          <section className="rounded-2xl border border-brand-purple/20 bg-gradient-to-br from-brand-purple/5 to-brand-pink/5 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Prijs per afspraak</p>
                <p className="text-lg font-bold text-slate-900">{formatCurrency(dynamicPrice)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Totaal incl. BTW</p>
                <p className="text-2xl font-bold text-brand-purple">{formatCurrency(total)}</p>
              </div>
            </div>
            <div className="mt-3 space-y-1 border-t border-slate-200/60 pt-3 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>{effectiveSize} afspraken × {formatCurrency(dynamicPrice)}</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>21% BTW</span>
                <span>{formatCurrency(btw)}</span>
              </div>
            </div>
            <button
              onClick={handleOrder}
              disabled={submitting || effectiveSize < minBatchSize}
              className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink px-6 py-3.5 text-[15px] font-bold text-white shadow-lg transition hover:shadow-xl disabled:opacity-50 disabled:shadow-none"
            >
              {submitting ? (
                <><ArrowPathIcon className="h-5 w-5 animate-spin" /> Wordt verwerkt...</>
              ) : (
                <><CreditCardIcon className="h-5 w-5" /> Afrekenen · {formatCurrency(total)}</>
              )}
            </button>
          </section>

          <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <CalendarDaysIcon className="h-4 w-4 text-brand-purple" />
              <span className="font-semibold text-slate-700">Default duur: {pricingData.default_duration} min</span>
              <span>·</span>
              <span>Reistijd-buffer: {pricingData.default_travel_buffer} min</span>
            </div>
            <p className="mt-1">Na betaling kunnen afspraken ingepland worden via je agenda.</p>
          </div>
        </>
      ) : selectedBranch && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
          <p className="text-sm font-semibold text-amber-800">Neem contact op met WarmeLeads voor afspraken-prijsinformatie</p>
          <a href="mailto:info@warmeleads.eu" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-purple hover:underline">
            info@warmeleads.eu
          </a>
        </div>
      )}

      {orders.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Afspraken-bestellingen</h2>
          <div className="space-y-2">
            {orders.slice(0, 5).map(o => (
              <div key={o.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-800">{o.batch_size} afspraken · {branchNames[o.branch] || o.branch}</p>
                  <p className="text-xs text-slate-400">{new Date(o.created_at).toLocaleDateString('nl-NL')}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  o.status === 'paid' ? 'bg-emerald-50 text-emerald-700' :
                  o.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {o.status === 'paid' ? 'Betaald' : o.status === 'pending' ? 'In behandeling' : o.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
