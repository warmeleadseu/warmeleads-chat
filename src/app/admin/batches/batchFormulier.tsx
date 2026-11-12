'use client';

import { useState, useEffect } from 'react';
import ExterneFactuurKeuze, { naarVelden, type ExterneFactuurStand } from '@/components/admin/ExterneFactuurKeuze';
import { directHerkomst, type DirectStand } from '@/lib/directLeveren';
import { motion } from 'framer-motion';
import {
  PlusIcon,
  XMarkIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
  ClockIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import SearchableSelect from '@/components/ui/SearchableSelect';
import BatchTargetsDraftEditor, { type BatchTargetDraft } from '@/components/admin/BatchTargetsDraftEditor';
import { useAdmin } from '../adminContext';
import { mergeCustomTiers } from '@/lib/pricing';
import { isMetaCampaignSyncBatchKind, isPipelineBatchKind } from '@/lib/batchKind';
import { isSellableLeadBranch } from '@/lib/branchPolicy';
import { coerceCustomerBatchMetaCampaignIds, type MetaCampaignPick } from '@/lib/metaCampaignIds';
import { MetaCampaignLinkerFields } from './MetaCampaignLinkerFields';
import type { CustomerTargetRow } from '@/lib/batchTargetAreas';

export function metaFieldsFromPicks(picks: MetaCampaignPick[], uitgesloten?: MetaCampaignPick[], alleenEigen?: boolean) {
  const meta_campaign_ids = picks.map(p => p.id).slice(0, 10);
  const linked = new Set(meta_campaign_ids);
  const meta_campaign_paused_ids = picks
    .filter(p => p.paused && linked.has(p.id))
    .map(p => p.id);
  /* Alleen meesturen als het blok de campagneregels toont (leadbatches); de
     API negeert ze voor andere batchsoorten en voor accountmanagers. */
  if (!uitgesloten) return { meta_campaign_ids, meta_campaign_paused_ids };
  const meta_campagne_exclusief = Object.fromEntries(
    picks.filter(p => p.exclusief && linked.has(p.id)).map(p => [p.id, p.exclusief as string]),
  );
  return {
    meta_campaign_ids,
    meta_campaign_paused_ids,
    meta_campagne_exclusief,
    meta_campagne_uitgesloten: uitgesloten.map(p => p.id).filter(id => !linked.has(id)),
    ...(alleenEigen !== undefined ? { alleen_eigen_campagne: alleenEigen } : {}),
  };
}

/** Uitgesloten campagnes van een batch, als picks (namen vult het koppelblok aan). */
export function uitgeslotenVanBatch(batch: { meta_campagne_uitgesloten?: unknown }): MetaCampaignPick[] {
  return coerceCustomerBatchMetaCampaignIds(batch.meta_campagne_uitgesloten).map(id => ({ id, name: id }));
}

/** Krijgt deze batch alleen leads uit zijn eigen campagne? Voor het label in lijst en detail. */
export function alleenEigenCampagneLabel(b: { alleen_eigen_campagne?: boolean | null; status?: string }): string | null {
  if (b.status === 'completed' || b.alleen_eigen_campagne !== true) return null;
  return 'Alleen eigen campagne';
}

/** Heeft deze batch een exclusieve campagne? Voor het label in lijst en detail. */
export function exclusieveCampagneLabel(b: { meta_campagne_exclusief?: unknown; status?: string }): string | null {
  if (b.status === 'completed') return null;
  const raw = b.meta_campagne_exclusief;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const standen = Object.values(raw as Record<string, unknown>);
  if (standen.length === 0) return null;
  return standen.includes('altijd') ? 'Exclusieve campagne (altijd)' : 'Exclusieve campagne (24 uur)';
}

export function picksFromBatchMeta(batch: {
  meta_campaign_ids?: unknown;
  meta_campaign_paused_ids?: unknown;
  meta_campagne_exclusief?: unknown;
}): MetaCampaignPick[] {
  const ids = coerceCustomerBatchMetaCampaignIds(batch.meta_campaign_ids);
  const paused = new Set(coerceCustomerBatchMetaCampaignIds(batch.meta_campaign_paused_ids));
  const excl = (batch.meta_campagne_exclusief && typeof batch.meta_campagne_exclusief === 'object' ? batch.meta_campagne_exclusief : {}) as Record<string, unknown>;
  return ids.map(id => ({
    id,
    name: id,
    ...(paused.has(id) ? { paused: true as const } : {}),
    ...(excl[id] === '24u' || excl[id] === 'altijd' ? { exclusief: excl[id] as '24u' | 'altijd' } : {}),
  }));
}


export interface LeadFilter { field: string; operator: string; value: string; values?: string[] }
export interface Compensation { amount: number; reason: string; date: string }
export interface Batch {
  id: string; customer_id: string; branch: string; batch_size: number;
  /** Doorlopend op factuur: levert al voor de betaling. */
  op_factuur?: boolean | null;
  gepauzeerd_reden?: string | null;
  price_per_lead: number | null; total_price: number | null;
  leads_per_week: number | null; leads_per_day: number | null;
  /** Dagmaximum gelijkmatig over 08:00-16:00 (standaard aan). */
  dagdosering?: boolean | null;
  leads_delivered: number; leads_delivered_external: number; status: string;
  is_paid: boolean; lookback_days: number | null; notes: string | null; lead_filters: LeadFilter[];
  /** gefaseerd (standaard) of spoed: hoe de eerstvolgende lookback wordt geleverd. */
  lookback_levering?: string | null;
  compensations: Compensation[];
  starts_at: string | null;
  account_manager_id: string | null;
  created_at: string; completed_at: string | null;
  batch_kind?: string | null;
  delivery_model?: string | null;
  niche_title?: string | null;
  lead_branch_slug?: string | null;
  meta_campaign_ids?: string[] | null;
  meta_campaign_paused_ids?: string[] | null;
  meta_campaign_sync_enabled?: boolean | null;
  meta_sync_last_attempt_at?: string | null;
  meta_sync_last_success_at?: string | null;
  meta_sync_last_error?: string | null;
  distribution_priority?: boolean | null;
  mollie_payment_id?: string | null;
  extern_factuurnummer?: string | null;
  extern_bedrag_excl?: number | string | null;
  /** aan / uit / null (volgt klantkaart). */
  direct_leveren?: string | null;
  /** Automatische betaalherinneringen (onbetaalde batch). */
  betaalherinneringen?: boolean | null;
  betaalherinnering_stap?: number | null;
  betaalherinnering_op?: string | null;
  herinnering_vanaf?: string | null;
  expired_at?: string | null;
  /** Per gekoppelde campagne: 24u of altijd exclusief voor deze batch. */
  meta_campagne_exclusief?: Record<string, string> | null;
  /** Campagnes waarvan deze batch nooit leads krijgt. */
  meta_campagne_uitgesloten?: string[] | null;
  /** Batch krijgt uitsluitend leads uit zijn eigen gekoppelde campagnes. */
  alleen_eigen_campagne?: boolean | null;
  batch_targets?: CustomerTargetRow[] | null;
  customers?: {
    id?: string;
    name: string;
    direct_leveren?: boolean | null;
    contact_person?: string | null;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    postcode?: string | null;
    country?: string | null;
    customer_targets?: CustomerTargetRow[] | null;
  } | null;
}

export function isBulkLeadsBatch(b: Pick<Batch, 'batch_kind'>): boolean {
  return (b.batch_kind || 'leads') === 'bulk_leads';
}

export function isNicheResearchBatch(b: Pick<Batch, 'batch_kind'>): boolean {
  return (b.batch_kind || '') === 'niche_research';
}

export function supportsBatchMetaCampaigns(batchKind: string | null | undefined): boolean {
  return isMetaCampaignSyncBatchKind(batchKind);
}

export function hasDistributionPriority(b: Pick<Batch, 'distribution_priority'>): boolean {
  return b.distribution_priority === true;
}

export function showDistributionPriorityBadge(
  b: Pick<Batch, 'distribution_priority' | 'batch_kind' | 'status'>,
): boolean {
  return isPipelineBatchKind(b.batch_kind) && hasDistributionPriority(b) && b.status !== 'completed';
}

export function DistributionPriorityField({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/60 p-3.5 ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 disabled:cursor-not-allowed"
      />
      <div>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
          <BoltIcon className="h-4 w-4 shrink-0" aria-hidden />
          Voorrang bij leadverdeling
        </span>
        <p className="mt-0.5 text-xs leading-relaxed text-amber-900/80">
          Nieuwe leads gaan eerst naar deze batch, ook als er een oudere open batch van dezelfde klant en branche is.
          Handig bij spoed. Tussen klanten telt voorrang mee in de matchvolgorde.
        </p>
      </div>
    </label>
  );
}

/** Effectieve stand van direct leveren voor een label, of null als het niet van toepassing is. */
export function directLabel(b: Pick<Batch, 'direct_leveren' | 'batch_kind' | 'status' | 'customers'>): string | null {
  if (!isPipelineBatchKind(b.batch_kind) || b.status === 'completed') return null;
  const h = directHerkomst(b.direct_leveren as DirectStand, b.customers?.direct_leveren);
  return h.direct ? h.label : null;
}

/**
 * Direct leveren per batch: volgt de klantkaart (standaard), altijd direct of
 * nooit direct. Alleen superadmin en admin wijzigen.
 */
export function DirectLeverenField({
  stand,
  onChange,
  klantDirect,
  disabled,
}: {
  stand: DirectStand;
  onChange: (s: DirectStand) => void;
  klantDirect: boolean | null | undefined;
  disabled?: boolean;
}) {
  const opties: { waarde: DirectStand; titel: string; uitleg: string }[] = [
    { waarde: null, titel: 'Volgt klantkaart', uitleg: klantDirect ? 'Nu: direct (staat aan op de klantkaart)' : 'Nu: gewone verdeling' },
    { waarde: 'aan', titel: 'Altijd direct', uitleg: 'Passende leads als eerste, binnen een minuut' },
    { waarde: 'uit', titel: 'Nooit direct', uitleg: 'Altijd de gewone verdeling' },
  ];
  return (
    <div className={`rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3.5 ${disabled ? 'opacity-60' : ''}`}>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
        <BoltIcon className="h-4 w-4 shrink-0" aria-hidden />
        Direct leveren
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-emerald-900/80">
        Past een nieuwe lead bij deze batch, dan krijgt de klant hem als eerste, binnen een minuut. Weegt zwaarder dan voorrang. Dag- en weekmaximum, gebied en filters blijven gelden. Geldt alleen voor deze batch: een nieuwe batch volgt weer de klantkaart.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {opties.map(o => (
          <label key={String(o.waarde)} className={`flex items-start gap-2 rounded-lg border p-2 ${stand === o.waarde ? 'border-emerald-400 bg-white' : 'border-emerald-100 bg-white/60'} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
            <input type="radio" checked={stand === o.waarde} disabled={disabled} onChange={() => onChange(o.waarde)} className="mt-0.5 accent-emerald-600" />
            <span>
              <span className="block text-xs font-semibold text-slate-700">{o.titel}</span>
              <span className="block text-[11px] text-slate-500">{o.uitleg}</span>
            </span>
          </label>
        ))}
      </div>
      {disabled && <p className="mt-1.5 text-[11px] text-slate-500">Alleen een admin of superadmin kan dit wijzigen.</p>}
    </div>
  );
}

/**
 * Hoe de lookback wordt geleverd: gefaseerd (standaard, willekeurig verspreid
 * over 8 uur met weinig leads 's nachts) of met spoed (alles meteen).
 */
export function LookbackLeveringField({
  spoed,
  onChange,
  magKiezen,
  moment,
}: {
  spoed: boolean;
  onChange: (spoed: boolean) => void;
  magKiezen: boolean;
  /** Wanneer de lookback loopt: nu, bij de betaling, of op de startdatum. */
  moment: 'nu' | 'betaling' | 'start';
}) {
  const kiesbaar = magKiezen;
  const actief = spoed && kiesbaar;
  const opties = [
    { waarde: false, titel: 'Gefaseerd', uitleg: 'Standaard. Verspreid over 8 uur op willekeurige momenten, weinig tussen 23:00 en 06:00.' },
    { waarde: true, titel: 'Met spoed', uitleg: 'Alles meteen in het portaal, voor een klant die haast heeft.' },
  ];
  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      <p className="text-xs font-medium text-slate-600">Levering van de lookback</p>
      <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
        {opties.map(o => (
          <label key={String(o.waarde)} className={`flex items-start gap-2 rounded-lg border p-2 ${actief === o.waarde ? 'border-brand-purple/60 bg-white' : 'border-slate-200 bg-white/60'} ${kiesbaar ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
            <input type="radio" checked={actief === o.waarde} disabled={!kiesbaar} onChange={() => onChange(o.waarde)} className="mt-0.5 accent-brand-purple" />
            <span>
              <span className="block text-xs font-semibold text-slate-700">{o.titel}</span>
              <span className="block text-[11px] text-slate-500">{o.uitleg}</span>
            </span>
          </label>
        ))}
      </div>
      {!magKiezen && <p className="mt-1.5 text-[11px] text-slate-500">Alleen een admin of superadmin kan met spoed leveren.</p>}
      {magKiezen && actief && moment !== 'nu' && (
        <p className="mt-1.5 text-[11px] text-slate-500">
          De lookback loopt {moment === 'betaling' ? 'zodra de batch betaald is' : 'op de startdatum'}; dan gaat alles meteen.
        </p>
      )}
    </div>
  );
}

/**
 * Bij het dagmaximum: gelijkmatig over de dag (standaard) of zodra ze
 * binnenkomen. Zie src/lib/dagDosering.ts.
 */
export function DagdoseringKeuze({ aan, onChange }: { aan: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mt-1.5 flex cursor-pointer items-start gap-1.5 text-[11px] leading-snug text-slate-600" title="Aan: het dagmaximum wordt gelijkmatig verdeeld tussen 08:00 en 16:00, en leads die langer dan 18 uur op een klant wachten gaan naar Restleads. Uit: leads komen zodra ze binnenkomen, tot het dagmaximum op is.">
      <input type="checkbox" checked={aan} onChange={e => onChange(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#7c3aed]" />
      <span>Gelijkmatig over de dag (08:00-16:00)</span>
    </label>
  );
}

export function batchProgressProps(b: Pick<Batch, 'delivery_model' | 'batch_kind' | 'batch_size' | 'leads_delivered'>) {
  return {
    delivery_model: b.delivery_model,
    batch_kind: b.batch_kind,
    batch_size: b.batch_size,
    leads_delivered: b.leads_delivered,
  };
}
export interface BranchOption { slug: string; name: string; color: string; is_active: boolean; is_partner_branch?: boolean }
export interface Customer { id: string; name: string; is_active: boolean; direct_leveren?: boolean | null }
export interface BranchField { id: string; key: string; label: string; field_type: string; options: string[] }

export function getNLOffset(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Amsterdam', hour: 'numeric', timeZoneName: 'shortOffset' });
  const parts = formatter.formatToParts(date);
  const tzPart = parts.find(p => p.type === 'timeZoneName');
  if (tzPart?.value) {
    const m = tzPart.value.match(/GMT([+-]\d+)/);
    if (m) {
      const h = parseInt(m[1]);
      return `${h >= 0 ? '+' : '-'}${String(Math.abs(h)).padStart(2, '0')}:00`;
    }
  }
  return '+01:00';
}

export function formatStartsAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function startsAtInFuture(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso) > new Date();
}

export const STATUS_OPTS = [
  { value: 'all', label: 'Alle' },
  { value: 'active', label: 'Actief' },
  { value: 'pending_payment', label: 'Betaling' },
  { value: 'paused', label: 'Gepauzeerd' },
  { value: 'completed', label: 'Afgerond' },
  { value: 'expired', label: 'Verlopen' },
];

export const SORT_OPTS = [
  { value: 'date', label: 'Datum' },
  { value: 'progress', label: 'Voortgang' },
  { value: 'customer', label: 'Klant' },
  { value: 'branch', label: 'Branche' },
];

export const COLOR_MAP: Record<string, { light: string; text: string; bar: string }> = {
  emerald: { light: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-500' },
  sky: { light: 'bg-sky-50', text: 'text-sky-600', bar: 'bg-sky-500' },
  amber: { light: 'bg-amber-50', text: 'text-amber-600', bar: 'bg-amber-500' },
  purple: { light: 'bg-purple-50', text: 'text-purple-600', bar: 'bg-purple-500' },
  rose: { light: 'bg-rose-50', text: 'text-rose-600', bar: 'bg-rose-500' },
  cyan: { light: 'bg-cyan-50', text: 'text-cyan-600', bar: 'bg-cyan-500' },
  lime: { light: 'bg-lime-50', text: 'text-lime-600', bar: 'bg-lime-500' },
  indigo: { light: 'bg-indigo-50', text: 'text-indigo-600', bar: 'bg-indigo-500' },
  teal: { light: 'bg-teal-50', text: 'text-teal-600', bar: 'bg-teal-500' },
  slate: { light: 'bg-slate-50', text: 'text-slate-600', bar: 'bg-slate-500' },
};

export const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  pending_payment: 'bg-orange-100 text-orange-800',
  paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  expired: 'bg-slate-100 text-slate-500',
};

export const STATUS_LABELS: Record<string, string> = {
  active: 'Actief',
  pending_payment: 'Wacht op betaling',
  paused: 'Gepauzeerd',
  completed: 'Afgerond',
  cancelled: 'Geannuleerd',
  expired: 'Verlopen',
};

/** Doorlopend op factuur: herkenbaar naast de status. */

/* ─── Create Panel ────────────────────────────────────────── */
export interface PricingTierData { min_leads: number; price_per_lead: number }
export interface PricingInfo {
  tiers: PricingTierData[];
  nationwide_discount: number;
  min_batch_size: number;
  is_custom: boolean;
  computed_price?: number | null;
  product: 'leads' | 'appointments';
}

export function CreateBatchPanel({ branches, customers, onClose, onCreated, vasteKlantId }: {
  branches: BranchOption[]; customers: Customer[];
  onClose: () => void; onCreated: () => void;
  /** Geopend vanuit een klant: die klant staat vast en is niet te wijzigen. */
  vasteKlantId?: string;
}) {
  const [form, setForm] = useState({
    customer_id: vasteKlantId ?? '', branch: '', batch_size: 100, is_paid: false,
    batch_product: 'leads' as 'leads' | 'appointments',
    price_per_lead: '', price_per_appointment: '', appointments_per_day: '', appointments_per_week: '',
    leads_per_day: '', dagdosering: true, leads_per_week: '', lookback_days: '3', notes: '', lead_filters: [] as LeadFilter[],
    batch_delivery: 'pipeline' as 'pipeline' | 'bulk' | 'niche_research',
    niche_title: '',
    lead_branch_slug: '',
    // Standaard verstuurt het systeem direct een betaallink-mail naar de klant bij
    // een open factuur. Admin/AM kan dit hier uitvinken om alleen de factuur +
    // Mollie-checkout aan te maken zonder mail.
    send_payment_email: true,
  });
  const [externeFactuur, setExterneFactuur] = useState<ExterneFactuurStand>({ extern: false, nummer: '', bedrag: '' });
  const [saving, setSaving] = useState(false);
  const [branchFields, setBranchFields] = useState<BranchField[]>([]);
  const [pricingInfo, setPricingInfo] = useState<PricingInfo | null>(null);
  const [priceOverride, setPriceOverride] = useState(false);
  const [scheduledStart, setScheduledStart] = useState(false);
  const [startsAtDate, setStartsAtDate] = useState('');
  const [startsAtTime, setStartsAtTime] = useState('09:00');
  const [metaCampaignPicks, setMetaCampaignPicks] = useState<MetaCampaignPick[]>([]);
  const [campagneUitgesloten, setCampagneUitgesloten] = useState<MetaCampaignPick[]>([]);
  const [alleenEigen, setAlleenEigen] = useState(false);
  const [metaSyncEnabled, setMetaSyncEnabled] = useState(true);
  const [distributionPriority, setDistributionPriority] = useState(false);
  const [directStand, setDirectStand] = useState<DirectStand>(null);
  /* Lookback met spoed (alles meteen) in plaats van gefaseerd. Alleen
     superadmin en admin, en alleen als de lookback nu meteen loopt. */
  const [lookbackSpoed, setLookbackSpoed] = useState(false);
  const { user: aanmaker } = useAdmin();
  // Defaults uit `customer_branch_meta_defaults` worden automatisch geladen
  // wanneer (klant + branche) of (klant + niche-onderzoek + lead-branche)
  // bekend zijn. We onthouden welke combinatie geladen is om dubbel
  // overschrijven te voorkomen wanneer de admin handmatig picks aanpast.
  const [metaDefaultLoadedKey, setMetaDefaultLoadedKey] = useState('');
  const [metaDefaultLoadedFromDb, setMetaDefaultLoadedFromDb] = useState(false);
  const [draftTargets, setDraftTargets] = useState<BatchTargetDraft[]>([]);

  useEffect(() => {
    if (form.batch_delivery !== 'pipeline') { setDistributionPriority(false); setDirectStand(null); }
  }, [form.batch_delivery]);

  // Welke (customer + branche-of-niche) is relevant voor defaults?
  const metaDefaultsKey = (() => {
    if (form.batch_product !== 'leads') return '';
    if (!form.customer_id) return '';
    if (form.batch_delivery === 'pipeline') {
      return form.branch ? `pipeline|${form.customer_id}|${form.branch}` : '';
    }
    if (form.batch_delivery === 'niche_research') {
      return form.lead_branch_slug
        ? `niche|${form.customer_id}|${form.lead_branch_slug}`
        : '';
    }
    return '';
  })();

  useEffect(() => {
    if (!metaDefaultsKey) return;
    if (metaDefaultsKey === metaDefaultLoadedKey) return;

    // Andere (klant + branche)-combinatie dan vorige load: fresh start.
    // Reset de picks zodat oude defaults van een andere combo niet blijven
    // hangen, en zet de banner-vlag uit tot de nieuwe fetch resolved.
    setMetaCampaignPicks([]);
    setCampagneUitgesloten([]);
    setMetaSyncEnabled(true);
    setMetaDefaultLoadedFromDb(false);

    let cancelled = false;
    const params = new URLSearchParams({ customer_id: form.customer_id });
    if (form.batch_delivery === 'pipeline') {
      params.set('branch', form.branch);
      params.set('batch_kind', 'leads');
    } else {
      // niche-research: server gebruikt lead_branch_slug als branche-sleutel
      params.set('branch', form.lead_branch_slug);
      params.set('batch_kind', 'niche_research');
      params.set('lead_branch_slug', form.lead_branch_slug);
    }
    adminFetch(`/api/admin/customer-branch-meta-defaults?${params.toString()}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled || !d) return;
        const ids: string[] = Array.isArray(d.meta_campaign_ids) ? d.meta_campaign_ids : [];
        const paused = new Set<string>(
          Array.isArray(d.meta_campaign_paused_ids) ? d.meta_campaign_paused_ids : [],
        );
        if (d.exists && ids.length > 0) {
          // Race-veilig: alleen pre-fillen als de admin in de tussentijd
          // nog niets handmatig heeft getypt. Functionele setter leest de
          // actuele staat (na de reset hierboven) i.p.v. closure-waarde.
          let didPrefill = false;
          setMetaCampaignPicks(prev => {
            if (prev.length > 0) return prev;
            didPrefill = true;
            const excl = (d.meta_campagne_exclusief && typeof d.meta_campagne_exclusief === 'object' ? d.meta_campagne_exclusief : {}) as Record<string, unknown>;
            return ids.map(id => ({
              id,
              name: id,
              ...(paused.has(id) ? { paused: true as const } : {}),
              ...(excl[id] === '24u' || excl[id] === 'altijd' ? { exclusief: excl[id] as '24u' | 'altijd' } : {}),
            }));
          });
          if (didPrefill) {
            setCampagneUitgesloten(uitgeslotenVanBatch(d));
            setMetaSyncEnabled(d.meta_campaign_sync_enabled !== false);
            setMetaDefaultLoadedFromDb(true);
          }
        }
        setMetaDefaultLoadedKey(metaDefaultsKey);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [metaDefaultsKey, metaDefaultLoadedKey, form.customer_id, form.branch, form.lead_branch_slug, form.batch_delivery]);

  useEffect(() => {
    if ((form.batch_product === 'leads' && form.batch_delivery === 'niche_research') || !form.branch) {
      setBranchFields([]);
      return;
    }
    adminFetch(`/api/admin/branches/fields?branch=${form.branch}`)
      .then(r => r.ok ? r.json() : { fields: [] })
      .then(d => setBranchFields(d.fields || []))
      .catch(() => {});
  }, [form.branch, form.batch_delivery, form.batch_product]);

  useEffect(() => {
    setPriceOverride(false);
  }, [form.batch_product]);

  useEffect(() => {
    if (form.batch_product === 'appointments') {
      if (!form.branch) {
        setPricingInfo(null);
        return;
      }
      const fetchPricing = async () => {
        const branchRes = await adminFetch('/api/admin/branches');
        if (!branchRes.ok) return;
        const branchData = await branchRes.json();
        const br = (branchData.branches || []).find((b: { slug: string }) => b.slug === form.branch);
        if (!br) return;

        const branchTiers: PricingTierData[] = br.appointment_pricing_tiers || [];
        let tiers: PricingTierData[] = branchTiers;
        let nationwideDiscount = Number(br.appointment_nationwide_discount) || 0;
        let isCustom = false;

        if (form.customer_id) {
          const cpRes = await adminFetch(
            `/api/admin/customer-pricing?customer_id=${form.customer_id}&product=appointments`,
          );
          if (cpRes.ok) {
            const cpData = await cpRes.json();
            const custom = (cpData.pricing || []).find((p: { branch_slug: string }) => p.branch_slug === form.branch);
            if (custom && custom.pricing_tiers && custom.pricing_tiers.length > 0) {
              tiers = mergeCustomTiers(branchTiers, custom.pricing_tiers);
              if (custom.nationwide_discount != null) nationwideDiscount = Number(custom.nationwide_discount);
              isCustom = true;
            }
          }
        }

        const sorted = [...tiers].sort((a: PricingTierData, b: PricingTierData) => b.min_leads - a.min_leads);
        const tier = sorted.find((t: PricingTierData) => form.batch_size >= t.min_leads);
        const computedPrice = tier ? tier.price_per_lead : null;

        setPricingInfo({
          tiers,
          nationwide_discount: nationwideDiscount,
          min_batch_size: Number(br.appointment_min_batch_size) || 5,
          is_custom: isCustom,
          computed_price: computedPrice,
          product: 'appointments',
        });

        if (!priceOverride && computedPrice !== null) {
          setForm(f => ({ ...f, price_per_appointment: String(computedPrice) }));
        }
      };
      fetchPricing();
      return;
    }

    if (form.batch_delivery === 'niche_research') {
      setPricingInfo(null);
      return;
    }
    if (!form.branch) { setPricingInfo(null); return; }
    const fetchPricing = async () => {
      const branchRes = await adminFetch('/api/admin/branches');
      if (!branchRes.ok) return;
      const branchData = await branchRes.json();
      const br = (branchData.branches || []).find((b: { slug: string }) => b.slug === form.branch);
      if (!br) return;

      const branchTiers: PricingTierData[] = br.pricing_tiers || [];
      let tiers: PricingTierData[] = branchTiers;
      let nationwideDiscount = Number(br.nationwide_discount) || 0;
      let isCustom = false;

      if (form.customer_id) {
        const cpRes = await adminFetch(`/api/admin/customer-pricing?customer_id=${form.customer_id}`);
        if (cpRes.ok) {
          const cpData = await cpRes.json();
          const custom = (cpData.pricing || []).find((p: { branch_slug: string }) => p.branch_slug === form.branch);
          if (custom && custom.pricing_tiers && custom.pricing_tiers.length > 0) {
            tiers = mergeCustomTiers(branchTiers, custom.pricing_tiers);
            if (custom.nationwide_discount != null) nationwideDiscount = Number(custom.nationwide_discount);
            isCustom = true;
          }
        }
      }

      const sorted = [...tiers].sort((a: PricingTierData, b: PricingTierData) => b.min_leads - a.min_leads);
      const tier = sorted.find((t: PricingTierData) => form.batch_size >= t.min_leads);
      const computedPrice = tier ? tier.price_per_lead : null;

      setPricingInfo({
        tiers,
        nationwide_discount: nationwideDiscount,
        min_batch_size: br.min_batch_size || 10,
        is_custom: isCustom,
        computed_price: computedPrice,
        product: 'leads',
      });

      if (!priceOverride && computedPrice !== null) {
        setForm(f => ({ ...f, price_per_lead: String(computedPrice) }));
      }
    };
    fetchPricing();
  }, [form.branch, form.customer_id, form.batch_size, priceOverride, form.batch_delivery, form.batch_product]);

  const create = async () => {
    if (form.batch_product === 'appointments') {
      if (!form.customer_id || !form.branch || !form.batch_size) {
        alert('Vul klant, branche en batchgrootte in.');
        return;
      }
      const ppa = form.price_per_appointment ? parseFloat(form.price_per_appointment) : NaN;
      if (!Number.isFinite(ppa) || ppa <= 0) {
        alert('Vul een geldige prijs per afspraak in (groter dan 0).');
        return;
      }
      setSaving(true);
      try {
        let startsAtISO: string | null = null;
        if (scheduledStart && startsAtDate) {
          const nlDateTime = `${startsAtDate}T${startsAtTime || '09:00'}:00`;
          const nlOffset = getNLOffset(new Date(nlDateTime));
          startsAtISO = `${nlDateTime}${nlOffset}`;
        }
        const res = await adminFetch('/api/admin/appointment-batches', {
          method: 'POST',
          body: JSON.stringify({
            customer_id: form.customer_id,
            branch: form.branch,
            batch_size: form.batch_size,
            price_per_appointment: ppa,
            appointments_per_day: form.appointments_per_day ? parseInt(form.appointments_per_day, 10) : null,
            appointments_per_week: form.appointments_per_week ? parseInt(form.appointments_per_week, 10) : null,
            notes: form.notes || null,
            lead_filters: form.lead_filters.filter(f => f.field && (f.values?.length || 0) > 0),
            is_paid: form.is_paid,
            ...(startsAtISO ? { starts_at: startsAtISO } : {}),
            ...(form.is_paid ? {} : { send_payment_email: form.send_payment_email }),
          }),
        });
        if (res.ok) onCreated();
        else {
          const d = await res.json();
          alert(d.error || 'Aanmaken mislukt');
        }
      } catch {
        alert('Er ging iets mis');
      }
      setSaving(false);
      return;
    }

    if (form.batch_delivery === 'niche_research') {
      if (!form.customer_id || form.niche_title.trim().length < 3 || !form.lead_branch_slug) {
        alert('Kies een klant, inbound branche en vul een duidelijke nichenaam in (minimaal 3 tekens).');
        return;
      }
    } else if (!form.customer_id || !form.branch || !form.batch_size) {
      return;
    }
    setSaving(true);
    try {
      let startsAtISO: string | null = null;
      if (scheduledStart && startsAtDate) {
        const nlDateTime = `${startsAtDate}T${startsAtTime || '09:00'}:00`;
        const nlOffset = getNLOffset(new Date(nlDateTime));
        startsAtISO = `${nlDateTime}${nlOffset}`;
      }
      // Race-veilig: als de defaults-fetch voor de huidige (klant + branche)
      // nog niet is afgerond, sturen we `meta_campaign_ids` bewust NIET mee.
      // De API past dan zelf inheritance toe via
      // `resolveMetaCampaignFieldsForNewLeadBatch`. Zodra defaults geladen
      // zijn, sturen we de IDs uit de picker mee (ook leeg = bewust leeg).
      const metaFetchPending = metaDefaultsKey !== '' && metaDefaultLoadedKey !== metaDefaultsKey;
      const metaPayload = metaFetchPending
        ? { meta_campaign_sync_enabled: metaSyncEnabled }
        : {
            ...metaFieldsFromPicks(
              metaCampaignPicks,
              form.batch_delivery === 'pipeline' && form.batch_product === 'leads' ? campagneUitgesloten : undefined,
              form.batch_delivery === 'pipeline' && form.batch_product === 'leads' ? alleenEigen : undefined,
            ),
            meta_campaign_sync_enabled: metaSyncEnabled,
          };

      if (form.batch_delivery === 'niche_research') {
        const res = await adminFetch('/api/admin/batches', {
          method: 'POST',
          body: JSON.stringify({
            customer_id: form.customer_id,
            batch_kind: 'niche_research',
            niche_title: form.niche_title.trim(),
            lead_branch_slug: form.lead_branch_slug,
            is_paid: form.is_paid,
            notes: form.notes || null,
            ...(startsAtISO ? { starts_at: startsAtISO } : {}),
            ...(form.is_paid ? {} : { send_payment_email: form.send_payment_email }),
            ...metaPayload,
          }),
        });
        if (res.ok) onCreated();
        else { const d = await res.json(); alert(d.error || 'Aanmaken mislukt'); }
        setSaving(false);
        return;
      }
      const res = await adminFetch('/api/admin/batches', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: form.customer_id,
          branch: form.branch,
          batch_size: form.batch_size,
          is_paid: form.is_paid,
          price_per_lead: form.price_per_lead ? parseFloat(form.price_per_lead) : null,
          leads_per_day: form.leads_per_day ? parseInt(form.leads_per_day) : null,
          dagdosering: form.dagdosering,
          leads_per_week: form.leads_per_week ? parseInt(form.leads_per_week) : null,
          lookback_days: parseInt(form.lookback_days) || 0,
          ...(lookbackSpoed && aanmaker.role !== 'accountmanager' && (parseInt(form.lookback_days) || 0) > 0
            ? { lookback_spoed: true }
            : {}),
          notes: form.notes || null,
          lead_filters: form.lead_filters.filter(f => f.field && (f.values?.length || 0) > 0),
          starts_at: startsAtISO,
          batch_kind: form.batch_delivery === 'bulk' ? 'bulk_leads' : 'leads',
          ...(form.is_paid ? {} : { send_payment_email: form.send_payment_email }),
          ...(form.is_paid && externeFactuur.extern ? { extern_gefactureerd: true, ...naarVelden(externeFactuur) } : {}),
          ...(form.batch_delivery === 'pipeline'
            ? {
                ...metaPayload,
                distribution_priority: distributionPriority,
                ...(directStand !== null && aanmaker.role !== 'accountmanager' ? { direct_leveren: directStand } : {}),
                ...(draftTargets.length > 0
                  ? {
                      batch_targets: draftTargets.map(({ _key, ...t }) => t),
                    }
                  : {}),
              }
            : {}),
        }),
      });
      if (res.ok) onCreated();
      else { const d = await res.json(); alert(d.error || 'Aanmaken mislukt'); }
    } catch { alert('Er ging iets mis'); }
    setSaving(false);
  };

  const isNicheDelivery = form.batch_product === 'leads' && form.batch_delivery === 'niche_research';
  const isAppointments = form.batch_product === 'appointments';
  const activeCustomers = customers.filter(c => c.is_active);
  const activeBranches = branches.filter(isSellableLeadBranch);

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="shrink-0 border-b border-slate-100">
          <div className="h-[3px] bg-warmeleads-gradient" />
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Nieuwe batch</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {isAppointments ? 'Afspraak-batch voor een klant (parallel aan lead-batches)' : 'Lead-batch voor een klant'}
              </p>
            </div>
            <button onClick={onClose} className="rounded-lg p-2.5 min-h-11 min-w-11 text-slate-400 hover:bg-slate-100"><XMarkIcon className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Klant *</label>
            {vasteKlantId ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800">
                {customers.find(c => c.id === vasteKlantId)?.name ?? 'Deze klant'}
              </p>
            ) : (
            <SearchableSelect
              value={form.customer_id}
              onChange={v => setForm(f => ({ ...f, customer_id: v }))}
              options={activeCustomers.map(c => ({ value: c.id, label: c.name }))}
              placeholder="Selecteer klant..."
              searchPlaceholder="Zoek klant…"
              ariaLabel="Klant"
              className="py-2.5"
            />
            )}
          </div>

          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, batch_product: 'leads' }))}
              className={`flex-1 rounded-md py-2 text-xs font-semibold transition ${
                form.batch_product === 'leads'
                  ? 'bg-brand-purple text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white/80'
              }`}
            >
              Leads
            </button>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, batch_product: 'appointments' }))}
              className={`flex-1 rounded-md py-2 text-xs font-semibold transition ${
                form.batch_product === 'appointments'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white/80'
              }`}
            >
              Afspraken
            </button>
          </div>

          {form.batch_product === 'leads' && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-medium text-slate-700">Levering</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, batch_delivery: 'pipeline' }))}
                className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                  form.batch_delivery === 'pipeline'
                    ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Verse leads
                <span className="mt-0.5 block font-normal text-[10px] text-slate-500">Automatische pijplijn + backfill</span>
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, batch_delivery: 'bulk' }))}
                className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                  form.batch_delivery === 'bulk'
                    ? 'border-violet-500 bg-violet-50 text-violet-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Bulk (CRM)
                <span className="mt-0.5 block font-normal text-[10px] text-slate-500">Factuur/anker; export naar portaal</span>
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, batch_delivery: 'niche_research' }))}
                className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                  form.batch_delivery === 'niche_research'
                    ? 'border-fuchsia-600 bg-fuchsia-50 text-fuchsia-950'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Niche-onderzoek
                <span className="mt-0.5 block font-normal text-[10px] text-slate-600">€1.000 excl. btw · validatie + voorbereiding</span>
              </button>
            </div>
          </div>
          )}

          {isAppointments && (
            <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3 text-[11px] text-teal-900">
              <p className="font-semibold text-teal-950">Afspraak-batch</p>
              <p className="mt-0.5 text-teal-900/90">
                Zelfde product als in het klantportaal: aparte facturatie, minimum batchgrootte per branche, filters optioneel.
              </p>
            </div>
          )}

          {!isNicheDelivery ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Branche *</label>
            <select value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value, lead_filters: [] }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-purple/50">
              <option value="">Selecteer branche...</option>
              {activeBranches.map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}
            </select>
          </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Niche / onderwerp *</label>
                <input
                  type="text"
                  value={form.niche_title}
                  onChange={e => setForm(f => ({ ...f, niche_title: e.target.value }))}
                  placeholder="Bijv. elektriciens in regio X"
                  maxLength={200}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-fuchsia-500/50"
                />
                <p className="mt-1 text-[10px] text-slate-500">Minimaal 3 tekens. Zelfde product als in het klantportaal (€1.000 excl. btw, 100% te crediteren in leads).</p>
              </div>
              <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/50 px-3 py-2 text-[11px] text-fuchsia-950">
                <p className="font-semibold">Vast pakket</p>
                <p className="mt-0.5 text-fuchsia-900/90">1 × €1.000 excl. btw · facturatie op systeem-branche <span className="font-mono text-[10px]">niche_research</span>.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Inbound lead-branche (Zapier) *</label>
                <select
                  value={form.lead_branch_slug}
                  onChange={e => setForm(f => ({ ...f, lead_branch_slug: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-fuchsia-500/50"
                >
                  <option value="">Kies branche…</option>
                  {activeBranches.map(b => (
                    <option key={b.slug} value={b.slug}>{b.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-slate-500">
                  Leads op deze branche worden automatisch aan de onderzoeksbatch gekoppeld zodra de batch actief en betaald is.
                </p>
              </div>
            </div>
          )}

          {!isNicheDelivery && (
          <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Batch grootte *</label>
              <input type="number" value={form.batch_size} onChange={e => setForm(f => ({ ...f, batch_size: Number(e.target.value) }))} min={1}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none ${
                  isAppointments && pricingInfo?.product === 'appointments' && form.batch_size > 0 && form.batch_size < pricingInfo.min_batch_size
                    ? 'border-amber-400 bg-amber-50/40 focus:border-amber-500'
                    : 'border-slate-200 focus:border-brand-purple/50'
                }`} />
              {isAppointments && pricingInfo?.product === 'appointments' && (
                <p className="mt-0.5 text-[10px] text-slate-500">Minimum in deze branche: {pricingInfo.min_batch_size}</p>
              )}
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-500">
                {isAppointments ? '€/afspraak' : '€/lead'}
                {pricingInfo?.computed_price != null && !priceOverride && pricingInfo.product === (isAppointments ? 'appointments' : 'leads') && (
                  <span className="rounded bg-emerald-50 px-1 py-0.5 text-[9px] font-bold text-emerald-600">AUTO</span>
                )}
              </label>
              {isAppointments ? (
                <>
                  <input type="number" step="0.01" value={form.price_per_appointment}
                    onChange={e => { setPriceOverride(true); setForm(f => ({ ...f, price_per_appointment: e.target.value })); }}
                    placeholder="-"
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-600/50 ${
                      pricingInfo?.computed_price != null && !priceOverride && pricingInfo.product === 'appointments' ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'
                    }`} />
                  {priceOverride && pricingInfo?.computed_price != null && pricingInfo.product === 'appointments' && (
                    <button type="button" onClick={() => { setPriceOverride(false); setForm(f => ({ ...f, price_per_appointment: String(pricingInfo.computed_price) })); }}
                      className="mt-0.5 text-[10px] text-teal-700 hover:underline">
                      Reset naar staffelprijs (€{pricingInfo.computed_price.toFixed(2)})
                    </button>
                  )}
                </>
              ) : (
                <>
                  <input type="number" step="0.01" value={form.price_per_lead}
                    onChange={e => { setPriceOverride(true); setForm(f => ({ ...f, price_per_lead: e.target.value })); }}
                    placeholder="-"
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50 ${
                      pricingInfo?.computed_price != null && !priceOverride && pricingInfo.product === 'leads' ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'
                    }`} />
                  {priceOverride && pricingInfo?.computed_price != null && pricingInfo.product === 'leads' && (
                    <button type="button" onClick={() => { setPriceOverride(false); setForm(f => ({ ...f, price_per_lead: String(pricingInfo.computed_price) })); }}
                      className="mt-0.5 text-[10px] text-brand-purple hover:underline">
                      Reset naar staffelprijs (€{pricingInfo.computed_price.toFixed(2)})
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {pricingInfo && pricingInfo.tiers.length > 0 && (
            <div className={`rounded-lg border p-3 ${isAppointments ? 'border-teal-200 bg-teal-50/40' : 'border-slate-200 bg-slate-50/50'}`}>
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {isAppointments ? 'Staffel (€/afspraak)' : 'Staffelprijzen'} {pricingInfo.is_custom && <span className="rounded bg-amber-100 px-1 py-0.5 text-amber-700 normal-case">Klantspecifiek</span>}
              </div>
              <div className="flex flex-wrap gap-1">
                {[...pricingInfo.tiers].sort((a, b) => a.min_leads - b.min_leads).map((t, i) => {
                  const sortedAsc = [...pricingInfo.tiers].sort((a, b) => a.min_leads - b.min_leads);
                  const active =
                    form.batch_size >= t.min_leads &&
                    (i === sortedAsc.length - 1 || form.batch_size < sortedAsc[i + 1]?.min_leads);
                  const activeCls =
                    isAppointments
                      ? 'border-teal-600 bg-teal-100/80 text-teal-900'
                      : 'border-brand-purple bg-brand-purple/10 text-brand-purple';
                  return (
                  <span key={i} className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium shadow-sm ${
                    active ? activeCls : 'border-slate-100 bg-white text-slate-600'
                  }`}>
                    {t.min_leads}+ → €{Number(t.price_per_lead).toFixed(2)}
                  </span>
                );
                })}
              </div>
              {Number(pricingInfo.nationwide_discount) > 0 && (
                <p className="mt-1 text-[10px] text-emerald-600">
                  Landelijke korting: -€{pricingInfo.nationwide_discount.toFixed(2)}{isAppointments ? '/afspraak' : '/lead'}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Max per dag</label>
              {isAppointments ? (
                <input type="number" value={form.appointments_per_day} onChange={e => setForm(f => ({ ...f, appointments_per_day: e.target.value }))}
                  placeholder="∞" min={1}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-600/50" />
              ) : (
                <>
                  <input type="number" value={form.leads_per_day} onChange={e => setForm(f => ({ ...f, leads_per_day: e.target.value }))}
                    placeholder="∞" min={1}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
                  {form.leads_per_day && form.batch_delivery === 'pipeline' && (
                    <DagdoseringKeuze aan={form.dagdosering} onChange={v => setForm(f => ({ ...f, dagdosering: v }))} />
                  )}
                </>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Max per week</label>
              {isAppointments ? (
                <input type="number" value={form.appointments_per_week} onChange={e => setForm(f => ({ ...f, appointments_per_week: e.target.value }))}
                  placeholder="∞" min={1}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-600/50" />
              ) : (
                <input type="number" value={form.leads_per_week} onChange={e => setForm(f => ({ ...f, leads_per_week: e.target.value }))}
                  placeholder="∞" min={1}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
              )}
            </div>
          </div>
          </>
          )}

          {form.batch_product === 'leads' && form.batch_delivery === 'pipeline' && (
            <DistributionPriorityField
              checked={distributionPriority}
              onChange={setDistributionPriority}
            />
          )}

          {form.batch_product === 'leads' && form.batch_delivery === 'pipeline' && (
            <DirectLeverenField
              stand={directStand}
              onChange={setDirectStand}
              klantDirect={customers.find(c => c.id === form.customer_id)?.direct_leveren}
              disabled={aanmaker.role === 'accountmanager'}
            />
          )}

          {/* Lookback — alleen zinvol voor lead pijplijn-batches */}
          {isAppointments ? (
            <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-3 text-[11px] text-teal-900">
              Lookback geldt niet voor afspraak-batches. Startmoment hieronder bepaalt wanneer de batch actief wordt (na betaling).
            </div>
          ) : form.batch_delivery === 'pipeline' ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Lookback dagen</p>
                  <p className="text-[11px] text-slate-400">
                    {form.lookback_days === '0'
                      ? 'Alleen nieuwe leads, geen bestaande leads laden'
                      : `Bestaande leads van de afgelopen ${form.lookback_days || 3} dag(en) toewijzen`}
                  </p>
                </div>
                <input
                  type="number"
                  value={form.lookback_days}
                  onChange={e => setForm(f => ({ ...f, lookback_days: e.target.value }))}
                  min={0}
                  max={30}
                  className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-sm font-semibold text-slate-900 outline-none focus:border-brand-purple/50"
                />
              </div>
              <div className="flex gap-1">
                {[0, 1, 3, 7, 14].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, lookback_days: String(d) }))}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                      form.lookback_days === String(d)
                        ? 'bg-brand-purple text-white'
                        : 'bg-white text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {d === 0 ? 'Geen' : `${d}d`}
                  </button>
                ))}
              </div>
              {(parseInt(form.lookback_days) || 0) > 0 && (
                <LookbackLeveringField
                  spoed={lookbackSpoed}
                  onChange={setLookbackSpoed}
                  magKiezen={aanmaker.role !== 'accountmanager'}
                  moment={scheduledStart ? 'start' : form.is_paid ? 'nu' : 'betaling'}
                />
              )}
            </div>
          ) : form.batch_delivery === 'bulk' ? (
            <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3 text-[11px] text-violet-900">
              Lookback en automatische backfill gelden niet voor bulk-batches. Leads koppel je later via <span className="font-semibold">Admin → Leads → Bulk export</span> met portaaltoewijzing.
            </div>
          ) : (
            <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/40 p-3 text-[11px] text-fuchsia-950">
              Lookback en automatische lead-toewijzing gelden niet voor onderzoeksbatches. Eenmalig pakket à €1.000 excl. btw (zelfde als portaal).
            </div>
          )}

          {form.batch_product === 'leads' && form.batch_delivery === 'pipeline' && (
            <BatchTargetsDraftEditor targets={draftTargets} onChange={setDraftTargets} />
          )}

          {!isAppointments && (form.batch_delivery === 'pipeline' || form.batch_delivery === 'niche_research') && (
            <div>
              {metaDefaultLoadedFromDb && metaDefaultsKey === metaDefaultLoadedKey && metaCampaignPicks.length > 0 && (
                <div className="mb-2 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-900">
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    <strong>Standaard meta-koppeling geladen</strong> voor deze klant + branche. Je kunt deze hier
                    overschrijven of aanvullen.
                  </span>
                </div>
              )}
              <MetaCampaignLinkerFields
                title="Meta campagnes (optioneel)"
                helpText={
                  form.batch_delivery === 'niche_research' ? (
                    <>
                      Koppel campagnes voor het onderzoek. Actief + betaald + sync aan → <strong>ACTIVE</strong> in Meta. Later
                      altijd aanpasbaar in batchdetail.
                    </>
                  ) : (
                    <>
                      Koppel één of <strong>meerdere</strong> Meta-campagnes. Ze worden samen op <strong>ACTIVE</strong> of{' '}
                      <strong>PAUSED</strong> gezet volgens deze batch (zoals bij bewerken). Leeg laten kan; je kunt later altijd
                      alsnog koppelen.
                    </>
                  )
                }
                picks={metaCampaignPicks}
                setPicks={setMetaCampaignPicks}
                syncEnabled={metaSyncEnabled}
                setSyncEnabled={setMetaSyncEnabled}
                campagneRegels={form.batch_delivery === 'pipeline' && form.batch_product === 'leads'
                  ? { magWijzigen: aanmaker.role !== 'accountmanager', uitgesloten: campagneUitgesloten, setUitgesloten: setCampagneUitgesloten, alleenEigen, setAlleenEigen }
                  : undefined}
              />
            </div>
          )}

          {/* Startdatum */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Startdatum</p>
                <p className="text-[11px] text-slate-400">
                  {isAppointments
                    ? (scheduledStart
                      ? 'Afspraak-batch wordt actief op het ingestelde tijdstip (na betaling).'
                      : 'Batch start direct na aanmaken (na betaling).')
                    : form.batch_delivery === 'bulk'
                    ? (scheduledStart ? 'Batch wordt actief op het ingestelde tijdstip (zonder automatische lead-toewijzing).' : 'Batch start direct na aanmaken.')
                    : form.batch_delivery === 'niche_research'
                      ? (scheduledStart ? 'Batch-record actief vanaf dit tijdstip (geen automatische lead-flow).' : 'Batch start direct na aanmaken.')
                      : (scheduledStart ? 'Batch start op het ingestelde tijdstip' : 'Batch start direct na aanmaken')}
                </p>
              </div>
              <button type="button" onClick={() => {
                const next = !scheduledStart;
                setScheduledStart(next);
                if (next && !startsAtDate) {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  setStartsAtDate(tomorrow.toISOString().slice(0, 10));
                }
              }}
                role="switch" aria-checked={scheduledStart}
                className={`relative inline-flex h-[26px] w-[48px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
                  scheduledStart ? 'bg-brand-purple' : 'bg-slate-300'
                }`}>
                <span className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                  scheduledStart ? 'translate-x-[24px]' : 'translate-x-[2px]'
                }`} />
              </button>
            </div>
            {scheduledStart && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Datum</label>
                  <div className="relative">
                    <CalendarDaysIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input type="date" value={startsAtDate} onChange={e => setStartsAtDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 10)}
                      className="w-full rounded-lg border border-brand-purple/20 bg-white py-2 pl-8 pr-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Tijd (NL)</label>
                  <div className="relative">
                    <ClockIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input type="time" value={startsAtTime} onChange={e => setStartsAtTime(e.target.value)}
                      className="w-full rounded-lg border border-brand-purple/20 bg-white py-2 pl-8 pr-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20" />
                  </div>
                </div>
                <p className="col-span-2 text-[10px] text-slate-400">
                  {isAppointments
                    ? 'Batch is direct betaalbaar; afspraken worden volgens jullie proces toegewezen. Geen lead-lookback.'
                    : form.batch_delivery === 'bulk'
                    ? 'Batch is direct betaalbaar; bulk-leads worden handmatig via export aan het portaal gekoppeld.'
                    : form.batch_delivery === 'niche_research'
                      ? 'Onderzoeksbatch: facturatie en opvolging volgens afspraak met de klant (zelfde product als portaal).'
                      : 'Batch is direct betaalbaar, maar leads worden pas toegewezen vanaf dit moment. De lookback telt dan ook terug vanaf de startdatum.'}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Notities</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
          </div>

          {/* Payment status */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Betaalstatus</p>
              <p className="text-[11px] text-slate-400">
                {form.is_paid
                  ? 'Batch wordt als betaald gemarkeerd'
                  : isAppointments
                    ? 'Klant kan via portaal betalen (afspraken-factuur)'
                    : form.batch_delivery === 'bulk'
                    ? 'Open factuur / betaallink voor het bulk-pakket'
                    : form.batch_delivery === 'niche_research'
                      ? 'Open factuur / betaallink voor het onderzoekspakket (€1.000 excl. btw)'
                      : 'Klant kan via portaal betalen'}
              </p>
            </div>
            <button type="button" onClick={() => setForm(f => ({ ...f, is_paid: !f.is_paid }))}
              role="switch" aria-checked={form.is_paid}
              className={`relative inline-flex h-[26px] w-[48px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
                form.is_paid ? 'bg-emerald-500' : 'bg-red-400'
              }`}>
              <span className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                form.is_paid ? 'translate-x-[24px]' : 'translate-x-[2px]'
              }`} />
            </button>
          </div>

          {form.is_paid && !isAppointments && form.batch_delivery !== 'niche_research' && (
            <ExterneFactuurKeuze stand={externeFactuur} onChange={setExterneFactuur} modus="aanmaken" />
          )}

          {!form.is_paid && (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div>
                <p className="text-sm font-medium text-slate-700">Stuur betaallink-mail naar klant</p>
                <p className="text-[11px] text-slate-400">
                  {form.send_payment_email
                    ? 'Klant ontvangt direct de open factuur met Mollie-betaallink'
                    : 'Factuur wordt aangemaakt zonder mail — verstuur later via de batchdetails'}
                </p>
              </div>
              <button type="button" onClick={() => setForm(f => ({ ...f, send_payment_email: !f.send_payment_email }))}
                role="switch" aria-checked={form.send_payment_email}
                aria-label={form.send_payment_email ? 'Betaallink-mail uitschakelen' : 'Betaallink-mail inschakelen'}
                className={`relative inline-flex h-[26px] w-[48px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
                  form.send_payment_email ? 'bg-emerald-500' : 'bg-slate-300'
                }`}>
                <span className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                  form.send_payment_email ? 'translate-x-[24px]' : 'translate-x-[2px]'
                }`} />
              </button>
            </div>
          )}

          {!isNicheDelivery && form.branch && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                {isAppointments ? 'Filters (optioneel, zelfde als bij lead-batches)' : 'Lead vereisten (filters)'}
              </label>
              <FilterEditor
                filters={form.lead_filters}
                onChange={filters => setForm(f => ({ ...f, lead_filters: filters }))}
                branchSlug={form.branch}
                branchFields={branchFields}
              />
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={create}
            disabled={
              saving ||
              !form.customer_id ||
              (isNicheDelivery
                ? form.niche_title.trim().length < 3
                : !form.branch ||
                  form.batch_size < 1 ||
                  (isAppointments &&
                    (!form.price_per_appointment.trim() ||
                      !Number.isFinite(parseFloat(form.price_per_appointment)) ||
                      parseFloat(form.price_per_appointment) <= 0)))
            }
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-button-gradient py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Aanmaken...</> : <><PlusIcon className="h-4 w-4" /> Batch aanmaken</>}
          </button>
        </div>
      </motion.div>
    </>
  );
}

/* ─── Filter Editor (multi-select per field) ──────────────── */
export function FilterEditor({ filters, onChange, branchSlug, branchFields }: {
  filters: LeadFilter[]; onChange: (f: LeadFilter[]) => void;
  branchSlug: string; branchFields: BranchField[];
}) {
  const [addingField, setAddingField] = useState('');

  const allFields = [
    ...branchFields.map(f => ({ key: f.key, label: f.label })),
    { key: 'quality_score', label: 'Kwaliteitsscore' },
    { key: 'phone_valid', label: 'Telefoon geldig' },
  ];

  const usedFields = new Set(filters.map(f => f.field));
  const availableFields = allFields.filter(f => !usedFields.has(f.key));

  const addFilter = () => {
    if (!addingField) return;
    onChange([...filters, { field: addingField, operator: 'in', value: '', values: [] }]);
    setAddingField('');
  };

  const removeFilter = (idx: number) => {
    onChange(filters.filter((_, i) => i !== idx));
  };

  const updateValues = (idx: number, values: string[]) => {
    const updated = [...filters];
    updated[idx] = { ...updated[idx], values };
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {filters.map((f, i) => {
        const fieldLabel = allFields.find(af => af.key === f.field)?.label || f.field;
        return (
          <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">{fieldLabel}</span>
              <button onClick={() => removeFilter(i)} className="text-xs text-red-500 hover:text-red-600">Verwijderen</button>
            </div>
            <FilterValuesSelect branchSlug={branchSlug} fieldKey={f.field} selected={f.values || []} onChange={vals => updateValues(i, vals)} />
          </div>
        );
      })}

      {availableFields.length > 0 && (
        <div className="flex items-center gap-2">
          <select value={addingField} onChange={e => setAddingField(e.target.value)}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none">
            <option value="">Filter toevoegen...</option>
            {availableFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          {addingField && (
            <button onClick={addFilter} className="rounded-lg bg-brand-purple px-3 py-2 text-sm font-medium text-white">
              <PlusIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Filter Values Multi-Select ──────────────────────────── */
export function FilterValuesSelect({ branchSlug, fieldKey, selected, onChange }: {
  branchSlug: string; fieldKey: string; selected: string[]; onChange: (v: string[]) => void;
}) {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminFetch(`/api/admin/leads/field-values?branch=${branchSlug}&field=${fieldKey}`)
      .then(r => r.ok ? r.json() : { values: [] })
      .then(d => setOptions(d.values || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [branchSlug, fieldKey]);

  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };

  if (loading) return <div className="h-8 animate-pulse rounded bg-slate-100" />;
  if (options.length === 0) return <p className="text-xs text-slate-400">Geen waarden gevonden</p>;

  return (
    <div className="max-h-40 space-y-1 overflow-y-auto">
      {options.map(opt => (
        <label key={opt} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-white">
          <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)}
            className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-brand-purple focus:ring-brand-purple/30" />
          <span className="min-w-0 break-words text-slate-700">{opt}</span>
        </label>
      ))}
    </div>
  );
}
