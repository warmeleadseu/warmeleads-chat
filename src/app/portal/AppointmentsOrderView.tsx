'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BoltIcon,
  CalendarDaysIcon,
  ClockIcon,
  SparklesIcon,
  TrashIcon,
  DocumentTextIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { portalFetch } from '@/lib/portalAuth';
import type { PortalCustomer } from './portalContext';
import { portalBtwRate } from '@/lib/invoiceVat';
import { formatCurrency, formatDateNl, roundMoney } from '@/lib/portalFormat';
import { PortalPendingBatchesCard } from './_components/PortalPendingBatchesCard';
import { collectPortalBatchesAwaitingPayment } from '@/lib/portalBatches';
import {
  ChoicePill,
  ChoiceTile,
  NumberStepper,
  OrderSummaryCard,
  PortalSection,
  PricingTierLegend,
  SheetModal,
  Skeleton,
  StatusBadge,
  StickyCheckoutBar,
  T,
  computeQuickSizes,
  findTierPrice,
  useToast,
} from './_ui';

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

interface PricingData {
  branch: string;
  tiers: { min_leads: number; price_per_lead: number }[];
  min_batch_size: number;
  nationwide_discount: number;
  is_custom: boolean;
  default_duration: number;
  default_travel_buffer: number;
  branch_name: string;
}

const SPEED_OPTIONS: { value: number | null; label: string; days: string }[] = [
  { value: null, label: 'Zo snel', days: 'mogelijk' },
  { value: 2, label: '2', days: 'per week' },
  { value: 5, label: '5', days: 'per week' },
  { value: 10, label: '10', days: 'per week' },
  { value: 20, label: '20', days: 'per week' },
];

export default function AppointmentsOrderView({
  customerBranches,
  customer,
}: {
  customerBranches: string[];
  customer: PortalCustomer;
}) {
  const toast = useToast();

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
  const [showOrders, setShowOrders] = useState(false);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [payingBatchId, setPayingBatchId] = useState<string | null>(null);
  const [welcomeDiscount, setWelcomeDiscount] = useState<{ active: boolean; expiresAt: string | null }>({
    active: false,
    expiresAt: null,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const guessBranch = customerBranches[0] || null;
      const [batchesRes, ordersRes, branchesRes, pricingRes, welcomeRes] = await Promise.all([
        portalFetch('/api/portal/appointment-batches'),
        portalFetch('/api/portal/appointment-orders'),
        portalFetch('/api/portal/branches'),
        guessBranch
          ? portalFetch(`/api/portal/appointment-pricing?branch=${encodeURIComponent(guessBranch)}`).catch(() => null)
          : Promise.resolve(null),
        portalFetch('/api/portal/welcome-offer').catch(() => null),
      ]);
      if (batchesRes.ok) setBatches(await batchesRes.json());
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (branchesRes.ok) {
        const data = await branchesRes.json();
        const map: Record<string, string> = {};
        (data.branches || data || []).forEach((b: { slug: string; name: string }) => { map[b.slug] = b.name; });
        setBranchNames(map);
      }
      if (welcomeRes && 'ok' in welcomeRes && welcomeRes.ok) {
        try {
          const data = await welcomeRes.json();
          if (data) setWelcomeDiscount({ active: !!data.active, expiresAt: data.expires_at || null });
        } catch { /* ignore */ }
      }
      if (pricingRes && 'ok' in pricingRes && pricingRes.ok && guessBranch) {
        try {
          const data = await pricingRes.json();
          if (data) {
            setPricingData({
              branch: guessBranch,
              tiers: data.tiers || [],
              min_batch_size: data.min_batch_size,
              nationwide_discount: data.nationwide_discount,
              is_custom: data.is_custom,
              default_duration: data.default_duration,
              default_travel_buffer: data.default_travel_buffer,
              branch_name: data.branch_name,
            });
            setBatchSize(prev => Math.max(prev, data.min_batch_size));
          }
        } catch { /* ignore */ }
      }
    } finally {
      setLoading(false);
    }
  }, [customerBranches]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selectedBranch && customerBranches.length > 0) {
      setSelectedBranch(customerBranches[0]);
    }
  }, [customerBranches, selectedBranch]);

  useEffect(() => {
    if (!selectedBranch) return;
    if (pricingData && pricingData.branch === selectedBranch) return;
    portalFetch(`/api/portal/appointment-pricing?branch=${encodeURIComponent(selectedBranch)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setPricingData({
          branch: selectedBranch,
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
  }, [selectedBranch, pricingData]);

  const effectiveSize = useCustom ? (parseInt(customSize) || 0) : batchSize;
  const minBatchSize = pricingData?.min_batch_size || 5;

  const dynamicPrice = useMemo(() => {
    return findTierPrice(pricingData?.tiers, effectiveSize, 0);
  }, [pricingData, effectiveSize]);

  const btwRate = useMemo(
    () => portalBtwRate({ country: customer.country, vat_id: customer.vat_id, reverse_charge: customer.reverse_charge }),
    [customer.country, customer.vat_id, customer.reverse_charge],
  );
  const subtotalBeforeDiscount = roundMoney(dynamicPrice * effectiveSize);
  const discountAmount = welcomeDiscount.active ? roundMoney(subtotalBeforeDiscount * 0.20) : 0;
  const subtotal = roundMoney(subtotalBeforeDiscount - discountAmount);
  const btw = roundMoney(subtotal * btwRate);
  const total = subtotal + btw;
  const btwSummaryLabel = btwRate === 0 ? 'BTW (verlegd)' : 'BTW 21%';

  const QUICK_SIZES = useMemo(() => computeQuickSizes(minBatchSize, [5, 10, 20, 50]), [minBatchSize]);

  const pendingPaymentBatches = useMemo(
    () =>
      collectPortalBatchesAwaitingPayment({
        pending_payment: batches.filter(b => b.status === 'pending_payment' && !b.is_paid),
      }),
    [batches],
  );

  const activeBatches = useMemo(() => batches.filter(b => b.status === 'active' && b.is_paid), [batches]);
  const sourceBatch = activeBatches.find(b => b.branch === selectedBranch) || activeBatches[0] || null;

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
        toast.error(data.error || 'Bestelling mislukt');
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch {
      toast.error('Er is iets misgegaan');
    } finally {
      setSubmitting(false);
    }
  };

  const payPendingBatch = async (batchId: string) => {
    setPayingBatchId(batchId);
    try {
      const res = await portalFetch('/api/portal/pay-batch', {
        method: 'POST',
        body: JSON.stringify({ batch_id: batchId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'Betaling starten mislukt');
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch {
      toast.error('Er is iets misgegaan');
    } finally {
      setPayingBatchId(null);
    }
  };

  const confirmCancel = async () => {
    if (!pendingCancelId) return;
    setCancelling(true);
    try {
      const res = await portalFetch('/api/portal/appointment-orders', {
        method: 'DELETE',
        body: JSON.stringify({ order_id: pendingCancelId }),
      });
      if (res.ok) {
        setOrders(prev => prev.filter(o => o.id !== pendingCancelId));
        setPendingCancelId(null);
        toast.success('Bestelling verwijderd');
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || 'Verwijderen mislukt');
      }
    } catch {
      toast.error('Verwijderen mislukt');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return <Skeleton.Cards count={3} />;
  }

  const pendingOrders = orders.filter(o => o.status !== 'paid');
  const pendingCancel = pendingCancelId ? orders.find(o => o.id === pendingCancelId) || null : null;

  const canCheckout = !submitting && effectiveSize >= minBatchSize && dynamicPrice > 0;
  const branchName = pricingData?.branch_name || branchNames[selectedBranch || ''] || selectedBranch || '';

  return (
    <div className="space-y-6">
      {pendingPaymentBatches.length > 0 && (
        <PortalPendingBatchesCard
          batches={pendingPaymentBatches.map(b => ({
            ...b,
            branch_name: branchNames[b.branch || ''] || b.branch || '',
            batch_product: 'appointments' as const,
          }))}
          btwRate={btwRate}
          payingBatchId={payingBatchId}
          onPay={payPendingBatch}
          intro={
            pendingPaymentBatches.length === 1
              ? 'Je accountmanager heeft een afspraak-batch voor je klaargezet. Betaal hieronder om te starten.'
              : `Je accountmanager heeft ${pendingPaymentBatches.length} afspraak-batches voor je klaargezet. Betaal per batch om te starten.`
          }
        />
      )}

      {orders.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowOrders(!showOrders)}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
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
        </div>
      )}

      <AnimatePresence initial={false}>
        {showOrders && orders.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`${T.card} p-3 sm:p-4`}>
              <div className="space-y-2">
                {orders.slice(0, 8).map(o => (
                  <div key={o.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-800">{o.batch_size} afspraken &middot; {branchNames[o.branch] || o.branch}</p>
                        <StatusBadge status={o.status} scope="order" />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {formatDateNl(o.created_at)}
                        {o.status === 'paid' && <> &middot; {formatCurrency(Number(o.total_price) * (1 + btwRate))} {btwRate === 0 ? '(BTW verlegd)' : 'incl. BTW'}</>}
                      </p>
                    </div>
                    {o.status !== 'paid' && (
                      <button onClick={() => setPendingCancelId(o.id)}
                        className="ml-3 shrink-0 rounded-lg p-2 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                        title="Verwijderen">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {customerBranches.length > 1 && (
        <PortalSection eyebrow="Branche" bare>
          <div className="relative -mx-1 px-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-4 bg-gradient-to-r from-slate-50 to-transparent sm:hidden" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-4 bg-gradient-to-l from-slate-50 to-transparent sm:hidden" />
            <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1.5">
              {customerBranches.map(b => (
                <ChoicePill
                  key={b}
                  selected={selectedBranch === b}
                  onClick={() => setSelectedBranch(b)}
                >
                  {branchNames[b] || b}
                </ChoicePill>
              ))}
            </div>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 sm:hidden">Swipe om alle branches te zien</p>
        </PortalSection>
      )}

      {customerBranches.length === 1 && selectedBranch && (
        <section className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-pink">
            <CalendarDaysIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{branchName}</p>
            {dynamicPrice > 0 && <p className="text-xs text-slate-400">{formatCurrency(dynamicPrice)} per afspraak excl. BTW</p>}
          </div>
        </section>
      )}

      {sourceBatch && (
        <section className={`${T.card} ${T.cardPadding}`}>
          <div className="mb-2 flex items-center justify-between">
            <span className={T.eyebrow}>Huidige batch</span>
            <span className="text-xs font-bold text-slate-600">
              {sourceBatch.appointments_delivered}/{sourceBatch.batch_size} afspraken
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-pink transition-all duration-700"
              style={{ width: `${Math.min(100, sourceBatch.batch_size > 0 ? (sourceBatch.appointments_delivered / sourceBatch.batch_size) * 100 : 0)}%` }}
            />
          </div>
          {sourceBatch.appointments_delivered >= sourceBatch.batch_size * 0.8 && (
            <p className="mt-2 text-xs font-medium text-amber-600">
              <SparklesIcon className="mr-1 inline h-3.5 w-3.5" />
              Bijna vol! Bestel nu een vervolg batch zodat je agenda doorloopt.
            </p>
          )}
        </section>
      )}

      {pricingData && dynamicPrice > 0 ? (
        <>
          <PortalSection
            title="Hoeveel afspraken wil je bestellen?"
            description={`Vanaf ${minBatchSize} afspraken`}
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {QUICK_SIZES.map(size => {
                const isActive = !useCustom && batchSize === size;
                const sizePrice = findTierPrice(pricingData.tiers, size, dynamicPrice);
                const price = roundMoney(size * sizePrice * (1 + btwRate));
                return (
                  <ChoiceTile
                    key={size}
                    selected={isActive}
                    onClick={() => { setBatchSize(size); setUseCustom(false); }}
                    title={size}
                    meta="afspraken"
                    footer={<>{formatCurrency(price)} <span className="font-normal text-slate-400">incl.</span></>}
                  />
                );
              })}
            </div>

            <div className="mt-3">
              <NumberStepper
                active={useCustom}
                onActivate={() => { setUseCustom(true); if (!customSize) setCustomSize(String(batchSize || minBatchSize)); }}
                value={customSize}
                onChange={setCustomSize}
                min={minBatchSize}
                step={1}
                prompt="Ander aantal kiezen..."
                previewTitle={`${effectiveSize} afspraken`}
                previewSubtitle={`${formatCurrency(total)} incl. BTW`}
              />
            </div>

            {effectiveSize > 0 && effectiveSize < minBatchSize && (
              <p className="mt-2 text-center text-xs text-red-500">Minimaal {minBatchSize} afspraken per batch</p>
            )}

            <PricingTierLegend
              tiers={pricingData.tiers}
              effectiveSize={effectiveSize}
              unitLabel="afspraken"
              isCustom={pricingData.is_custom}
            />
          </PortalSection>

          <PortalSection
            title="Planningssnelheid"
            description="Hoeveel afspraken maximaal per week?"
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {SPEED_OPTIONS.map((opt, i) => {
                const isActive = apptsPerWeek === opt.value;
                const isAsap = opt.value === null;
                return (
                  <ChoiceTile
                    key={i}
                    selected={isActive}
                    onClick={() => setApptsPerWeek(opt.value)}
                    icon={isAsap ? <BoltIcon className={`h-5 w-5 ${isActive ? 'text-brand-purple' : 'text-slate-400'}`} /> : undefined}
                    title={<span className={isAsap ? 'text-sm' : undefined}>{opt.label}</span>}
                    meta={opt.days}
                  />
                );
              })}
            </div>
          </PortalSection>

          <PortalSection title="Opmerkingen" description="Optioneel: specifieke wensen of doelgroep-voorkeuren.">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Bijv. specifieke wensen, doelgroep-voorkeuren..."
              className={T.textarea}
            />
          </PortalSection>

          {welcomeDiscount.active && (
            <div className="flex items-center gap-3 rounded-2xl border border-brand-purple/20 bg-gradient-to-r from-brand-purple/5 to-brand-pink/5 px-5 py-3.5">
              <span className="text-xl">🎁</span>
              <div>
                <p className="text-sm font-bold text-brand-purple">20% welkomstkorting actief</p>
                <p className="text-xs text-slate-500">
                  Automatisch toegepast op deze bestelling
                  {welcomeDiscount.expiresAt && (
                    <> &middot; Geldig tot {formatDateNl(welcomeDiscount.expiresAt, { day: 'numeric', month: 'long' })}</>
                  )}
                </p>
              </div>
            </div>
          )}

          <OrderSummaryCard
            lines={[
              {
                label: <>{effectiveSize} afspraken &times; {formatCurrency(dynamicPrice)}</>,
                value: <>{formatCurrency(subtotalBeforeDiscount)}</>,
                tone: welcomeDiscount.active ? 'strike' : 'default',
              },
              ...(welcomeDiscount.active
                ? [{ label: 'Welkomstkorting -20%', value: <>-{formatCurrency(discountAmount)}</>, tone: 'positive' as const }]
                : []),
              { label: btwSummaryLabel, value: <>{formatCurrency(btw)}</>, tone: 'muted' },
            ]}
            total={total}
            onCheckout={handleOrder}
            submitting={submitting}
            disabled={!canCheckout}
            ctaLabel="Afrekenen"
            helper={
              <div className="flex items-start gap-2">
                <CalendarDaysIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Default duur: {pricingData.default_duration} min &middot; Reistijd-buffer: {pricingData.default_travel_buffer} min. Na betaling kunnen afspraken ingepland worden via je agenda.
                </p>
              </div>
            }
          />

          <StickyCheckoutBar
            total={total}
            onCheckout={handleOrder}
            submitting={submitting}
            disabled={!canCheckout}
          />

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
        </>
      ) : selectedBranch ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
          <p className="text-sm font-semibold text-amber-800">Neem contact op met WarmeLeads voor afspraken-prijsinformatie</p>
          <a href="mailto:info@warmeleads.eu" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-purple hover:underline">
            info@warmeleads.eu
          </a>
        </div>
      ) : null}

      <SheetModal
        open={!!pendingCancel}
        onClose={() => !cancelling && setPendingCancelId(null)}
        title="Bestelling verwijderen?"
        description="Je staat op het punt deze openstaande bestelling te verwijderen:"
        size="sm"
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => setPendingCancelId(null)}
              disabled={cancelling}
              className={`flex-1 ${T.btnSecondary}`}
            >
              Annuleren
            </button>
            <button
              onClick={confirmCancel}
              disabled={cancelling}
              className={`flex-1 ${T.btnDanger}`}
            >
              {cancelling ? (
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
        }
      >
        {pendingCancel && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
            {pendingCancel.batch_size} afspraken · {branchNames[pendingCancel.branch] || pendingCancel.branch}
          </p>
        )}
      </SheetModal>
    </div>
  );
}
