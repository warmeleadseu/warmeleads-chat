'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import { portalFetch } from '@/lib/portalAuth';
import { BTW_RATE, formatCurrency, formatDateNl, roundMoney } from '@/lib/portalFormat';
import {
  ChoicePill,
  ChoiceTile,
  NumberStepper,
  OrderSummaryCard,
  PageHeader,
  PortalSection,
  PricingTierLegend,
  StickyCheckoutBar,
  T,
  computeQuickSizes,
  findTierPrice,
  useToast,
} from '../_ui';
import type { PricingData, WelcomeDiscountState } from './types';

export default function NewCustomerOrderView({
  customer,
  welcomeDiscount,
  embedded = false,
}: {
  customer: { id: string; name: string; email: string; contact_person: string; branches: string[] };
  welcomeDiscount: WelcomeDiscountState;
  /** Gezet vanuit bestellen/page wanneer PageHeader + tabs al buiten staat */
  embedded?: boolean;
}) {
  const toast = useToast();

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
    return findTierPrice(pricingData?.tiers, effectiveSize, 0);
  }, [pricingData, effectiveSize]);

  const subtotalBefore = effectiveSize * dynamicPrice;
  const discount = welcomeDiscount.active ? roundMoney(subtotalBefore * 0.20) : 0;
  const subtotal = subtotalBefore - discount;
  const btw = roundMoney(subtotal * BTW_RATE);
  const total = subtotal + btw;

  const QUICK_SIZES = useMemo(() => computeQuickSizes(minBatchSize), [minBatchSize]);

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

  const branchName = availableBranches.find(b => b.slug === selectedBranch)?.name || selectedBranch;
  const canCheckout = !submitting && effectiveSize >= minBatchSize && dynamicPrice > 0;

  return (
    <div className={`space-y-6 ${embedded ? '' : T.pagePaddingForSticky}`}>
      {!embedded && (
        <PageHeader
          title="Eerste batch bestellen"
          subtitle="Kies een branche en het aantal leads om te starten"
        />
      )}

      {welcomeDiscount.active && (
        <div className="flex items-center gap-3 rounded-2xl border border-brand-purple/20 bg-gradient-to-r from-brand-purple/5 to-brand-pink/5 px-5 py-4">
          <span className="text-2xl">🎁</span>
          <div>
            <p className="text-sm font-bold text-brand-purple">20% welkomstkorting op je eerste bestelling!</p>
            <p className="text-xs text-slate-500">
              Automatisch toegepast
              {welcomeDiscount.expiresAt && (
                <> · Geldig tot {formatDateNl(welcomeDiscount.expiresAt, { day: 'numeric', month: 'long' })}</>
              )}
            </p>
          </div>
        </div>
      )}

      {availableBranches.length > 1 && (
        <PortalSection eyebrow="Branche" bare>
          <div className="relative -mx-1 px-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-4 bg-gradient-to-r from-slate-50 to-transparent sm:hidden" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-4 bg-gradient-to-l from-slate-50 to-transparent sm:hidden" />
            <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1.5">
              {availableBranches.map(b => (
                <ChoicePill
                  key={b.slug}
                  selected={selectedBranch === b.slug}
                  onClick={() => setSelectedBranch(b.slug)}
                >
                  {b.name}
                </ChoicePill>
              ))}
            </div>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 sm:hidden">Swipe om alle branches te zien</p>
        </PortalSection>
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

      {dynamicPrice > 0 && (
        <PortalSection title="Hoeveel leads wil je bestellen?">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {QUICK_SIZES.map(size => {
              const isActive = !useCustom && batchSize === size;
              const sizePrice = findTierPrice(pricingData?.tiers, size, dynamicPrice);
              const raw = size * sizePrice;
              const disc = welcomeDiscount.active ? raw * 0.20 : 0;
              const price = roundMoney((raw - disc) * (1 + BTW_RATE));
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
              previewSubtitle={`${formatCurrency(total)} incl. BTW`}
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

      {dynamicPrice > 0 && effectiveSize >= minBatchSize && (
        <OrderSummaryCard
          lines={[
            {
              label: <>{effectiveSize} leads &times; &euro;{dynamicPrice.toFixed(2)}</>,
              value: <>&euro;{subtotalBefore.toFixed(2)}</>,
              tone: welcomeDiscount.active ? 'strike' : 'default',
            },
            ...(welcomeDiscount.active
              ? [{ label: 'Welkomstkorting -20%', value: <>-&euro;{discount.toFixed(2)}</>, tone: 'positive' as const }]
              : []),
            { label: 'BTW 21%', value: <>&euro;{btw.toFixed(2)}</>, tone: 'muted' },
          ]}
          total={total}
          onCheckout={handleOrder}
          submitting={submitting}
          disabled={!canCheckout}
        />
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

      {dynamicPrice > 0 && effectiveSize >= minBatchSize && (
        <StickyCheckoutBar
          total={total}
          onCheckout={handleOrder}
          submitting={submitting}
          disabled={!canCheckout}
        />
      )}
    </div>
  );
}
