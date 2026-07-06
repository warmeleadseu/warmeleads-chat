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
  ClockIcon,
  SparklesIcon,
  TrashIcon,
  BoltIcon,
  DocumentTextIcon,
  InboxStackIcon,
  CalendarDaysIcon,
  MagnifyingGlassCircleIcon,
} from '@heroicons/react/24/outline';
import AppointmentsOrderView from '../AppointmentsOrderView';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import { isReverseChargeRate, portalBtwRate, vatTotalSuffix, vatUnitSuffix } from '@/lib/invoiceVat';
import { roundMoney, formatCurrency, formatDateNl } from '@/lib/portalFormat';
import {
  ChoicePill,
  ChoiceTile,
  NumberStepper,
  OrderSummaryCard,
  PageHeader,
  PortalSection,
  PricingTierLegend,
  StatusBadge,
  StickyCheckoutBar,
  T,
  ToggleGroup,
  Skeleton,
  SheetModal,
  computeQuickSizes,
  computeSpeedPresets,
  findTierPrice,
  useToast,
} from '../_ui';
import NewCustomerOrderView from './NewCustomerOrderView';
import NicheResearchOrderView from './NicheResearchOrderView';
import type { Batch, Order, PricingData, WelcomeDiscountState } from './types';
import { PortalPendingBatchesCard } from '../_components/PortalPendingBatchesCard';
import {
  collectPortalBatchesAwaitingPayment,
  pickPortalReorderSourceBatch,
} from '@/lib/portalBatches';

export default function BestellenPage() {
  const { customer } = usePortal();
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();

  const sourceBatchId = searchParams.get('batch');
  const orderRedirectId = searchParams.get('order');
  const redirectStatus = searchParams.get('status');
  const productParam = searchParams.get('product');
  const product: 'leads' | 'appointments' | 'research' =
    productParam === 'appointments'
      ? 'appointments'
      : productParam === 'research'
        ? 'research'
        : 'leads';

  const [batches, setBatches] = useState<{
    active: Batch[];
    pending_payment: Batch[];
    completed: Batch[];
  }>({ active: [], pending_payment: [], completed: [] });
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
  const [showOrders, setShowOrders] = useState(false);
  const [pendingCancelOrderId, setPendingCancelOrderId] = useState<string | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [welcomeDiscount, setWelcomeDiscount] = useState<WelcomeDiscountState>({ active: false, expiresAt: null });
  const [payingBatchId, setPayingBatchId] = useState<string | null>(null);

  const [redirectOrder, setRedirectOrder] = useState<Order | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    if (!customer) return;
    try {
      const guessBranch = customer.branches?.[0] || null;
      const [batchRaw, orderRaw, welcomeRaw, pricingRaw] = await Promise.all([
        portalFetch('/api/portal/batches'),
        portalFetch('/api/portal/orders'),
        portalFetch('/api/portal/welcome-offer').catch(() => null),
        guessBranch
          ? portalFetch(`/api/portal/pricing?branch=${guessBranch}`).catch(() => null)
          : Promise.resolve(null),
      ]);
      const batchRes = batchRaw.ok ? await batchRaw.json() : { active: [], pending_payment: [], completed: [] };
      const orderRes = orderRaw.ok ? await orderRaw.json() : [];
      if (!batchRaw.ok || !orderRaw.ok) toast.error('Gegevens konden niet volledig geladen worden');
    setBatches({
      active: batchRes.active || [],
      pending_payment: batchRes.pending_payment || [],
      completed: batchRes.completed || [],
    });
    setOrders(Array.isArray(orderRes) ? orderRes : []);

      if (welcomeRaw && 'ok' in welcomeRaw && welcomeRaw.ok) {
        try {
          const welcome = await welcomeRaw.json();
          if (welcome) setWelcomeDiscount({ active: welcome.active, expiresAt: welcome.expires_at });
        } catch { /* ignore */ }
      }

      if (pricingRaw && 'ok' in pricingRaw && pricingRaw.ok) {
        try {
          const pricing = await pricingRaw.json();
          if (pricing) setPricingData(pricing);
        } catch { /* ignore */ }
      }

    return { batches: batchRes, orders: Array.isArray(orderRes) ? orderRes : [] };
    } catch {
      toast.error('Gegevens konden niet geladen worden');
      return undefined;
    }
  }, [customer, toast]);

  useEffect(() => {
    if (!customer) return;
    fetchData().then((result) => {
      if (!result) return;
      const allBatches = [
        ...(result.batches.pending_payment || []),
        ...(result.batches.active || []),
        ...(result.batches.completed || []),
      ];

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
          if (match.status !== 'pending_payment') {
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
      }

      if (!sourceBatchId && !orderRedirectId && allBatches.length > 0) {
        const firstReorder = pickPortalReorderSourceBatch(allBatches, allBatches[0].branch) || allBatches[0];
        setSelectedBranch(firstReorder.branch);
      }
    }).finally(() => setLoading(false));

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [customer, sourceBatchId, orderRedirectId, redirectStatus, fetchData]);

  // Terugkeer van een directe afspraken-batchbetaling (pay-batch → ?paid=1). We
  // tonen geen blinde "gelukt": de status wordt door de Mollie-webhook gezet, dus
  // we melden dat de betaling wordt verwerkt en verversen de gegevens.
  useEffect(() => {
    if (searchParams.get('paid') !== '1') return;
    toast.success('Betaling wordt verwerkt. Je afsprakenbatch wordt zo geactiveerd.');
    fetchData();
    router.replace('/portal/bestellen?product=appointments');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (product === 'appointments' || product === 'research') { setPricingData(null); return; }
    if (!selectedBranch) return;
    if (pricingData && pricingData.branch === selectedBranch) return;
    portalFetch(`/api/portal/pricing?branch=${selectedBranch}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPricingData(data); })
      .catch(() => {});
  }, [selectedBranch, product, pricingData]);

  const allBatches = useMemo(
    () => [...(batches.pending_payment || []), ...batches.active, ...batches.completed],
    [batches],
  );

  const branchGroups = useMemo(() => {
    const map = new Map<string, { branch: string; name: string; batches: Batch[] }>();
    allBatches.forEach(b => {
      const key = b.branch;
      if (!map.has(key)) map.set(key, { branch: key, name: b.branch_name || b.branch, batches: [] });
      map.get(key)!.batches.push(b);
    });
    const statusOrder = (s: string) =>
      s === 'active' ? 0 : s === 'paused' ? 1 : s === 'pending_payment' ? 2 : s === 'completed' ? 3 : 4;
    return Array.from(map.values()).map(g => ({
      ...g,
      batches: [...g.batches].sort((a, b) => statusOrder(a.status) - statusOrder(b.status)),
    }));
  }, [allBatches]);

  const activeBranch = useMemo(() => branchGroups.find(g => g.branch === selectedBranch), [branchGroups, selectedBranch]);
  const unpaidBatches = useMemo(
    () => collectPortalBatchesAwaitingPayment(batches),
    [batches],
  );
  const sourceBatch = useMemo((): Batch | null => {
    if (!selectedBranch) return null;
    return pickPortalReorderSourceBatch(allBatches, selectedBranch, sourceBatchId) as Batch | null;
  }, [allBatches, selectedBranch, sourceBatchId]);

  const effectiveSize = useCustom ? (parseInt(customSize) || 0) : batchSize;
  const effectiveSpeed = useCustomSpeed ? (parseInt(customSpeed) || 0) : leadsPerDay;

  const SPEED_PRESETS = useMemo(() => computeSpeedPresets(effectiveSize), [effectiveSize]);

  const estimatedDays = effectiveSpeed && effectiveSpeed > 0
    ? Math.ceil(effectiveSize / effectiveSpeed)
    : null;

  const dynamicPricePerLead = useMemo(() => {
    return findTierPrice(pricingData?.tiers, effectiveSize, sourceBatch?.price_per_lead || 0);
  }, [pricingData, effectiveSize, sourceBatch]);

  const pricePerLead = dynamicPricePerLead;
  const subtotalBeforeDiscount = effectiveSize * pricePerLead;
  const discountAmount = welcomeDiscount.active ? roundMoney(subtotalBeforeDiscount * 0.20) : 0;
  const subtotal = subtotalBeforeDiscount - discountAmount;
  const btwRate = useMemo(
    () => portalBtwRate({ country: customer.country, vat_id: customer.vat_id, reverse_charge: customer.reverse_charge }),
    [customer.country, customer.vat_id, customer.reverse_charge],
  );
  const btwAmount = roundMoney(subtotal * btwRate);
  const totalInclBtw = subtotal + btwAmount;
  const reverseCharge = isReverseChargeRate(btwRate);
  const btwSummaryLabel = reverseCharge ? 'BTW (verlegd)' : 'BTW 21%';
  const unitSuffix = vatUnitSuffix({ reverseCharge });
  const totalSuffix = vatTotalSuffix({ reverseCharge });
  const minBatchSize = pricingData?.min_batch_size || 10;
  const QUICK_SIZES = useMemo(() => computeQuickSizes(minBatchSize), [minBatchSize]);
  const pricingReady = !!pricingData && (!selectedBranch || pricingData.branch === selectedBranch);

  const pendingCancelOrder = pendingCancelOrderId
    ? orders.find(o => o.id === pendingCancelOrderId) || null
    : null;

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
        toast.success('Bestelling verwijderd');
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || 'Verwijderen mislukt');
      }
    } catch {
      toast.error('Verwijderen mislukt');
    } finally {
      setCancellingOrder(false);
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

  if (!customer) return null;

  if (loading) {
    return <Skeleton.Page />;
  }

  if (redirectOrder) {
    return (
      <RedirectResultView
        redirectOrder={redirectOrder}
        btwRate={btwRate}
        onContinue={() => router.push('/portal')}
        onRetry={() => { setRedirectOrder(null); router.replace('/portal/bestellen'); }}
      />
    );
  }

  const productTabs = (
    <ToggleGroup
      value={product}
      onChange={(v: 'leads' | 'appointments' | 'research') => {
        if (v === 'appointments') router.push('/portal/bestellen?product=appointments');
        else if (v === 'research') router.push('/portal/bestellen?product=research');
        else router.push('/portal/bestellen');
      }}
      fullWidth
      options={[
        { value: 'leads', label: 'Leads', icon: <InboxStackIcon className="h-4 w-4" /> },
        { value: 'research', label: 'Onderzoek', icon: <MagnifyingGlassCircleIcon className="h-4 w-4" /> },
        { value: 'appointments', label: 'Afspraken', icon: <CalendarDaysIcon className="h-4 w-4" /> },
      ]}
      ariaLabel="Product"
    />
  );

  if (product === 'research') {
    return (
      <div className={`space-y-6 ${T.pagePaddingForSticky}`}>
        <PageHeader
          title="Bestellen"
          subtitle="Onderzoeksbatch voor een maatwerk-niche buiten ons standaardaanbod"
        />
        {productTabs}
        <NicheResearchOrderView />
      </div>
    );
  }

  if (product === 'appointments') {
    return (
      <div className={`space-y-6 ${T.pagePaddingForSticky}`}>
        <PageHeader title="Bestellen" subtitle="Bestel afspraken en vul je agenda" />
        {productTabs}
        <AppointmentsOrderView customerBranches={customer.branches || []} customer={customer} />
      </div>
    );
  }

  if (allBatches.length === 0) {
    return (
      <div className={`space-y-6 ${T.pagePaddingForSticky}`}>
        <PageHeader
          title="Bestellen"
          subtitle="Kies leads voor je eerste batch, een onderzoeksbatch voor een nieuwe niche, of afspraken"
        />
        {productTabs}
        <NewCustomerOrderView customer={customer} welcomeDiscount={welcomeDiscount} embedded />
      </div>
    );
  }

  const pendingOrders = orders.filter(o => o.status !== 'paid');
  const paidOrders = orders.filter(o => o.status === 'paid');
  const canCheckout = !submitting && pricingReady && effectiveSize >= minBatchSize && !!sourceBatch;

  return (
    <div className={`space-y-6 ${T.pagePaddingForSticky}`}>
      <PageHeader
        title="Bestellen"
        subtitle="Bestel een nieuwe batch leads voor je bedrijf"
        action={
          orders.length > 0 && (
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
          )
        }
      />

      {productTabs}

      {unpaidBatches.length > 0 && (
        <PortalPendingBatchesCard
          batches={unpaidBatches}
          btwRate={btwRate}
          payingBatchId={payingBatchId}
          onPay={payPendingBatch}
        />
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
            <OrdersPanel
              orders={orders}
              btwRate={btwRate}
              onCancel={(id) => setPendingCancelOrderId(id)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {branchGroups.length > 1 && (
        <PortalSection eyebrow="Branche" bare>
          <div className="relative -mx-1 px-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-4 bg-gradient-to-r from-slate-50 to-transparent sm:hidden" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-4 bg-gradient-to-l from-slate-50 to-transparent sm:hidden" />
            <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1.5">
              {branchGroups.map(g => {
                const isSelected = selectedBranch === g.branch;
                const activeBatch =
                  g.batches.find(b => b.status === 'active') ??
                  g.batches.find(b => b.status === 'pending_payment');
                const pct = activeBatch && activeBatch.batch_size > 0 ? Math.round((activeBatch.leads_delivered / activeBatch.batch_size) * 100) : null;
                return (
                  <ChoicePill
                    key={g.branch}
                    selected={isSelected}
                    onClick={() => setSelectedBranch(g.branch)}
                    className="flex-col items-start !py-3"
                  >
                    <span>{g.name}</span>
                    {pct !== null && (
                      <span className="block text-[11px] font-normal text-slate-400">Huidige batch: {pct}%</span>
                    )}
                  </ChoicePill>
                );
              })}
            </div>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 sm:hidden">Swipe om alle branches te zien</p>
        </PortalSection>
      )}

      {branchGroups.length === 1 && activeBranch && (
        <section className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-pink">
            <BoltIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{activeBranch.name}</p>
            <p className="text-xs text-slate-400">&euro;{pricePerLead.toFixed(2)} per lead{unitSuffix}</p>
          </div>
        </section>
      )}

      {sourceBatch && (sourceBatch.status === 'active' || sourceBatch.status === 'pending_payment') && (
        <section className={`${T.card} ${T.cardPadding}`}>
          <div className="mb-2 flex items-center justify-between">
            <span className={T.eyebrow}>
              {sourceBatch.status === 'pending_payment' ? 'Batch (betaling open)' : 'Huidige batch'}
            </span>
            <span className="text-xs font-bold text-slate-600">
              {sourceBatch.leads_delivered}/{sourceBatch.batch_size} leads
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-pink transition-all duration-700"
              style={{
                width: `${Math.min(
                  100,
                  Number(sourceBatch.batch_size) > 0
                    ? (Number(sourceBatch.leads_delivered) / Number(sourceBatch.batch_size)) * 100
                    : 0,
                )}%`,
              }}
            />
          </div>
          {sourceBatch.status === 'pending_payment' && (
            <p className="mt-2 text-xs font-medium text-amber-700">
              Betaling nog open — automatische lead-toewijzing start na betaling.
            </p>
          )}
          {sourceBatch.status === 'active' &&
            Number(sourceBatch.leads_delivered) >= Number(sourceBatch.batch_size) * 0.8 && (
            <p className="mt-2 text-xs font-medium text-amber-600">
              <SparklesIcon className="mr-1 inline h-3.5 w-3.5" />
              Bijna vol! Bestel nu een vervolg batch zodat je geen leads mist.
            </p>
          )}
        </section>
      )}

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

      <PortalSection title="Hoeveel leads wil je bestellen?">
        {pricingReady ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {QUICK_SIZES.map(size => {
                const isActive = !useCustom && batchSize === size;
                const sizePrice = findTierPrice(pricingData?.tiers, size, pricePerLead);
                const price = roundMoney(size * sizePrice * (1 + btwRate));
                return (
                  <ChoiceTile
                    key={size}
                    selected={isActive}
                    onClick={() => { setBatchSize(size); setUseCustom(false); }}
                    title={size}
                    meta="leads"
                    footer={<>&euro;{price.toFixed(2)} <span className="font-normal text-slate-400">incl.</span></>}
                  />
                );
              })}
            </div>

            <div className="mt-3">
              <NumberStepper
                active={useCustom}
                onActivate={() => { setUseCustom(true); if (!customSize) setCustomSize(String(batchSize || 75)); }}
                value={customSize}
                onChange={setCustomSize}
                min={minBatchSize}
                step={10}
                prompt="Ander aantal kiezen..."
                previewTitle={`${effectiveSize} leads`}
                previewSubtitle={`${formatCurrency(totalInclBtw)} ${totalSuffix}`}
              />
            </div>

            {effectiveSize > 0 && effectiveSize < minBatchSize && (
              <p className="mt-2 text-center text-xs text-red-500">Minimaal {minBatchSize} leads per batch</p>
            )}

            {pricingData?.tiers && (
              <PricingTierLegend
                tiers={pricingData.tiers}
                effectiveSize={effectiveSize}
                unitLabel="leads"
                isCustom={pricingData.is_custom}
              />
            )}
          </>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="h-[86px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
              ))}
            </div>
            <div className="mt-3 h-[46px] animate-pulse rounded-2xl border border-dashed border-slate-200 bg-white" />
          </div>
        )}
      </PortalSection>

      {effectiveSize > 0 && (
        <PortalSection title="Leveringssnelheid" description="Hoeveel leads maximaal per dag?">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ChoiceTile
              selected={!useCustomSpeed && leadsPerDay === null}
              onClick={() => { setLeadsPerDay(null); setUseCustomSpeed(false); }}
              icon={<BoltIcon className={`h-5 w-5 ${!useCustomSpeed && leadsPerDay === null ? 'text-brand-purple' : 'text-slate-400'}`} />}
              title={<span className="text-sm">Zo snel</span>}
              meta="mogelijk"
            />
            {SPEED_PRESETS.map(speed => {
              const isActive = !useCustomSpeed && leadsPerDay === speed;
              const days = Math.ceil(effectiveSize / speed);
              return (
                <ChoiceTile
                  key={speed}
                  selected={isActive}
                  onClick={() => { setLeadsPerDay(speed); setUseCustomSpeed(false); }}
                  title={speed}
                  meta="per dag"
                  footer={<>~{days} {days === 1 ? 'dag' : 'dagen'}</>}
                />
              );
            })}
          </div>

          <div className="mt-3">
            <NumberStepper
              active={useCustomSpeed}
              onActivate={() => { setUseCustomSpeed(true); if (!customSpeed) setCustomSpeed(String(leadsPerDay || SPEED_PRESETS[1] || 10)); }}
              value={customSpeed}
              onChange={setCustomSpeed}
              min={1}
              step={1}
              prompt="Ander aantal per dag kiezen..."
              previewTitle={`${effectiveSpeed} leads / dag`}
              previewSubtitle={estimatedDays ? `~${estimatedDays} ${estimatedDays === 1 ? 'dag' : 'dagen'} doorlooptijd` : undefined}
              inputWidth="w-16"
            />
          </div>

          {estimatedDays && !useCustomSpeed && leadsPerDay !== null && (
            <p className="mt-2 text-center text-xs text-slate-400">
              <ClockIcon className="mr-1 inline h-3.5 w-3.5" />
              Geschatte doorlooptijd: ~{estimatedDays} {estimatedDays === 1 ? 'dag' : 'dagen'}
            </p>
          )}
        </PortalSection>
      )}

      <PortalSection title="Opmerkingen" description="Optioneel: bijv. voorkeur regio of specifieke wensen.">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Bijv. voorkeur regio, specifieke wensen..."
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
            label: <>{effectiveSize} leads &times; &euro;{pricePerLead.toFixed(2)}</>,
            value: <>&euro;{subtotalBeforeDiscount.toFixed(2)}</>,
            tone: welcomeDiscount.active ? 'strike' : 'default',
          },
          ...(welcomeDiscount.active
            ? [{ label: 'Welkomstkorting -20%', value: <>-&euro;{discountAmount.toFixed(2)}</>, tone: 'positive' as const }]
            : []),
          { label: btwSummaryLabel, value: <>&euro;{btwAmount.toFixed(2)}</>, tone: 'muted' },
        ]}
        total={totalInclBtw}
        onCheckout={handleOrder}
        submitting={submitting}
        disabled={!canCheckout}
        helper={
          <div className="flex items-start gap-2">
            <SparklesIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <p className="text-[11px] leading-relaxed text-slate-400">
              Na betaling wordt je batch direct aangemaakt. Leads worden automatisch toegewezen met dezelfde instellingen als je {sourceBatch?.status === 'completed' ? 'vorige' : 'huidige'} batch.
            </p>
          </div>
        }
      />

      <StickyCheckoutBar
        total={totalInclBtw}
        onCheckout={handleOrder}
        submitting={submitting}
        disabled={!canCheckout}
        totalLabel={`Totaal ${totalSuffix}`}
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

      {paidOrders.length > 0 && (
        <div className="mt-5 flex items-center gap-2 text-[11px] text-slate-400">
          <CheckCircleSolid className="h-3.5 w-3.5 text-emerald-400" />
          {paidOrders.length} eerdere {paidOrders.length === 1 ? 'bestelling' : 'bestellingen'} &middot;
          &euro;{(paidOrders.reduce((s, o) => s + Number(o.total_price) * (1 + btwRate), 0)).toFixed(2)} totaal{reverseCharge ? ' (BTW verlegd)' : ' incl. BTW'}
        </div>
      )}

      <SheetModal
        open={!!pendingCancelOrder}
        onClose={() => !cancellingOrder && setPendingCancelOrderId(null)}
        title="Bestelling verwijderen?"
        description="Je staat op het punt deze openstaande bestelling te verwijderen:"
        size="sm"
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => setPendingCancelOrderId(null)}
              disabled={cancellingOrder}
              className={`flex-1 ${T.btnSecondary}`}
            >
              Annuleren
            </button>
            <button
              onClick={confirmCancelOrder}
              disabled={cancellingOrder}
              className={`flex-1 ${T.btnDanger}`}
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
        }
      >
        {pendingCancelOrder && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
            {pendingCancelOrder.batch_size} leads · {pendingCancelOrder.branch}
          </p>
        )}
      </SheetModal>
    </div>
  );
}

function OrdersPanel({ orders, btwRate, onCancel }: { orders: Order[]; btwRate: number; onCancel: (id: string) => void }) {
  return (
    <div className={`${T.card} p-3 sm:p-4`}>
      <div className="space-y-2">
        {orders.slice(0, 8).map(o => (
          <div key={o.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium text-slate-800">
                  {o.batch_kind === 'niche_research' ? (
                    <>Onderzoeksbatch{o.niche_title ? ` &middot; ${o.niche_title}` : ''} &middot; {o.branch}</>
                  ) : (
                    <>{o.batch_size} leads &middot; {o.branch}</>
                  )}
                </p>
                <StatusBadge status={o.status} scope="order" />
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {formatDateNl(o.created_at)}
                {o.status === 'paid' && <> &middot; &euro;{(Number(o.total_price) * (1 + btwRate)).toFixed(2)} {btwRate === 0 ? '(BTW verlegd)' : 'incl. BTW'}</>}
              </p>
            </div>
            {o.status !== 'paid' && (
              <button onClick={() => onCancel(o.id)}
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
  );
}

function RedirectResultView({
  redirectOrder,
  btwRate,
  onContinue,
  onRetry,
}: {
  redirectOrder: Order;
  btwRate: number;
  onContinue: () => void;
  onRetry: () => void;
}) {
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
          ? (redirectOrder.batch_kind === 'niche_research'
            ? 'Je onderzoeksbatch is bevestigd. Je accountmanager neemt contact op over de vervolgstappen. Je ontvangt een bevestiging per e-mail.'
            : 'Je nieuwe batch is aangemaakt en leads worden automatisch toegewezen. Je ontvangt een bevestiging per e-mail.')
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
              {redirectOrder.batch_size} leads &middot; {formatCurrency(Number(redirectOrder.total_price) * (1 + btwRate))} {btwRate === 0 ? '(BTW verlegd)' : 'incl. BTW'}
              </p>
            </div>
          <p className="mt-1 text-xs text-emerald-600">Je batch is direct actief en leads worden automatisch toegewezen</p>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button onClick={onContinue}
            className="rounded-xl bg-brand-purple px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-purple/90">
            Naar mijn leads
          </button>
          {isFailed && (
          <button onClick={onRetry} className={T.btnSecondary}>
              Opnieuw proberen
            </button>
          )}
        </motion.div>
    </div>
  );
}
