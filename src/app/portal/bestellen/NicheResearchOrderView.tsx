'use client';

import { useMemo, useState } from 'react';
import { MagnifyingGlassCircleIcon } from '@heroicons/react/24/outline';
import { portalFetch } from '@/lib/portalAuth';
import { BTW_RATE, roundMoney } from '@/lib/portalFormat';
import {
  OrderSummaryCard,
  PageHeader,
  PortalSection,
  StickyCheckoutBar,
  T,
  useToast,
} from '../_ui';

const RESEARCH_EXCL = 1000;

export default function NicheResearchOrderView() {
  const toast = useToast();
  const [nicheTitle, setNicheTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const subtotal = RESEARCH_EXCL;
  const btw = roundMoney(subtotal * BTW_RATE);
  const total = subtotal + btw;

  const canSubmit = useMemo(() => nicheTitle.trim().length >= 3, [nicheTitle]);

  const handleOrder = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await portalFetch('/api/portal/orders', {
        method: 'POST',
        body: JSON.stringify({
          batch_kind: 'niche_research',
          niche_title: nicheTitle.trim(),
          notes: notes.trim() || undefined,
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

  return (
    <div className={`space-y-6 ${T.pagePaddingForSticky}`}>
      <PageHeader
        title="Onderzoeksbatch nieuwe niche"
        subtitle="Voor branches die we nog niet standaard aanbieden. €1.000 excl. btw wordt volledig gecrediteerd in leads zodra je campagne live gaat."
      />

      <section className={`${T.card} ${T.cardPadding} border-violet-100 bg-gradient-to-br from-violet-50/80 to-white`}>
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-500/20">
            <MagnifyingGlassCircleIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">Hoe het werkt</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Je koopt hier een onderzoekstraject voor jouw maatwerk-niche. We valideren haalbaarheid en tarieven.
              Het bedrag van €1.000 komt volledig terug als tegoed op je eerste leadlevering zodra we live gaan.
            </p>
          </div>
        </div>
      </section>

      <PortalSection title="Welke niche wil je laten onderzoeken?" eyebrow="Verplicht">
        <label htmlFor="niche-title" className="sr-only">
          Niche-naam
        </label>
        <input
          id="niche-title"
          type="text"
          value={nicheTitle}
          onChange={e => setNicheTitle(e.target.value)}
          placeholder='Bijv. "Electricien gezocht?" of "Laadpalen zakelijk Gelderland"'
          className={T.input}
          maxLength={200}
          autoComplete="off"
        />
        {nicheTitle.length > 0 && nicheTitle.trim().length < 3 && (
          <p className="mt-1 text-xs text-amber-600">Minimaal 3 tekens.</p>
        )}
      </PortalSection>

      <PortalSection title="Opmerkingen" description="Optioneel: extra context voor je accountmanager.">
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Bijv. gewenste regio, doelgroep, concurrentie die je al ziet..."
          className={T.textarea}
        />
      </PortalSection>

      <OrderSummaryCard
        lines={[
          {
            label: <>Onderzoeksbatch niche-onderzoek (eenmalig)</>,
            value: <>&euro;{subtotal.toFixed(2)}</>,
            tone: 'default',
          },
          { label: 'BTW 21%', value: <>&euro;{btw.toFixed(2)}</>, tone: 'muted' },
        ]}
        total={total}
        onCheckout={handleOrder}
        submitting={submitting}
        disabled={!canSubmit}
        ctaLabel="Naar betalen"
      />

      <StickyCheckoutBar
        total={total}
        onCheckout={handleOrder}
        submitting={submitting}
        disabled={!canSubmit}
      />
    </div>
  );
}
