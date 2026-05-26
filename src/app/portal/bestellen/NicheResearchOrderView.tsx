'use client';

import { useEffect, useMemo, useState } from 'react';
import { MagnifyingGlassCircleIcon, SignalIcon } from '@heroicons/react/24/outline';
import { portalFetch } from '@/lib/portalAuth';
import { usePortal } from '../portalContext';
import { portalBtwRate } from '@/lib/invoiceVat';
import { roundMoney } from '@/lib/portalFormat';
import {
  OrderSummaryCard,
  PageHeader,
  PortalSection,
  StickyCheckoutBar,
  T,
  useToast,
} from '../_ui';

const RESEARCH_EXCL = 1000;

type BranchOption = { slug: string; name: string; color: string };

export default function NicheResearchOrderView() {
  const toast = useToast();
  const { customer } = usePortal();
  const [nicheTitle, setNicheTitle] = useState('');
  const [leadBranchSlug, setLeadBranchSlug] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    portalFetch('/api/portal/branches')
      .then(r => (r.ok ? r.json() : { branches: [] }))
      .then(d => {
        if (cancelled) return;
        const list = (d.branches || []) as BranchOption[];
        setBranches(list.filter(b => b.slug !== 'niche_research'));
      })
      .catch(() => {
        if (!cancelled) setBranches([]);
      })
      .finally(() => {
        if (!cancelled) setBranchesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const subtotal = RESEARCH_EXCL;
  const btwRate = useMemo(
    () => portalBtwRate({ country: customer.country, vat_id: customer.vat_id, reverse_charge: customer.reverse_charge }),
    [customer.country, customer.vat_id, customer.reverse_charge],
  );
  const btw = roundMoney(subtotal * btwRate);
  const total = subtotal + btw;
  const btwSummaryLabel = btwRate === 0 ? 'BTW (verlegd)' : 'BTW 21%';

  const selectedBranch = branches.find(b => b.slug === leadBranchSlug);

  const canSubmit = useMemo(
    () => nicheTitle.trim().length >= 3 && leadBranchSlug.length > 0,
    [nicheTitle, leadBranchSlug],
  );

  const handleOrder = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await portalFetch('/api/portal/orders', {
        method: 'POST',
        body: JSON.stringify({
          batch_kind: 'niche_research',
          niche_title: nicheTitle.trim(),
          lead_branch_slug: leadBranchSlug,
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
              Je koopt een onderzoekstraject voor jouw maatwerk-niche. Zodra de batch actief is en we leads op jouw
              branche binnenhalen (Zapier/Meta), verschijnen die automatisch in je portaal op deze onderzoeksbatch.
              Het bedrag van €1.000 komt volledig terug als tegoed op je eerste leadlevering zodra we live gaan.
            </p>
          </div>
        </div>
      </section>

      <PortalSection
        title="Inbound lead-branche"
        description="Kies de branche waar nieuwe leads op binnenkomen. Deze moet overeenkomen met de Zapier-koppeling die we voor je activeren."
        eyebrow="Verplicht"
      >
        {branchesLoading ? (
          <p className="text-sm text-slate-500">Branches laden…</p>
        ) : branches.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Er zijn nog geen branches beschikbaar. Neem contact op met je accountmanager.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {branches.map(b => {
              const selected = leadBranchSlug === b.slug;
              return (
                <button
                  key={b.slug}
                  type="button"
                  onClick={() => setLeadBranchSlug(b.slug)}
                  className={`flex items-start gap-2 rounded-xl border px-3 py-3 text-left text-sm transition ${
                    selected
                      ? 'border-fuchsia-400 bg-fuchsia-50 ring-2 ring-fuchsia-200'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <SignalIcon className={`mt-0.5 h-5 w-5 shrink-0 ${selected ? 'text-fuchsia-600' : 'text-slate-400'}`} />
                  <span>
                    <span className="block font-semibold text-slate-900">{b.name}</span>
                    <span className="mt-0.5 block font-mono text-[10px] text-slate-500">{b.slug}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {selectedBranch && (
          <p className="mt-2 text-xs text-fuchsia-800">
            Geselecteerd: <span className="font-semibold">{selectedBranch.name}</span> — inbound leads op deze branche
            worden aan je onderzoeksbatch gekoppeld zodra die actief en betaald is.
          </p>
        )}
      </PortalSection>

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
          ...(selectedBranch
            ? [
                {
                  label: <>Inbound branche</>,
                  value: <>{selectedBranch.name}</>,
                  tone: 'muted' as const,
                },
              ]
            : []),
          { label: btwSummaryLabel, value: <>&euro;{btw.toFixed(2)}</>, tone: 'muted' },
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
