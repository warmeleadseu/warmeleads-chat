'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  Squares2X2Icon,
  ChevronUpIcon,
  ChevronDownIcon,
  CheckIcon,
  BoltIcon,
  UserGroupIcon,
  LinkIcon,
  SwatchIcon,
  CurrencyEuroIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

interface BranchField {
  id: string;
  branch_id: string;
  key: string;
  label: string;
  field_type: string;
  options: string[];
  is_required: boolean;
  sort_order: number;
}

interface PricingTier {
  min_leads: number;
  price_per_lead: number;
}

interface Branch {
  id: string;
  slug: string;
  name: string;
  color: string;
  description: string;
  is_active: boolean;
  is_partner_branch?: boolean;
  sort_order: number;
  branch_fields: BranchField[];
  lead_count: number;
  webhook_count: number;
  pricing_tiers: PricingTier[];
  min_batch_size: number;
  nationwide_discount: number;
  appointment_pricing_tiers?: PricingTier[];
  appointment_min_batch_size?: number;
  appointment_nationwide_discount?: number;
  default_appointment_duration?: number;
  default_travel_buffer?: number;
}

const COLORS = [
  { value: 'emerald', label: 'Groen', bg: 'bg-emerald-500' },
  { value: 'sky', label: 'Blauw', bg: 'bg-sky-500' },
  { value: 'amber', label: 'Oranje', bg: 'bg-amber-500' },
  { value: 'purple', label: 'Paars', bg: 'bg-purple-500' },
  { value: 'rose', label: 'Roze', bg: 'bg-rose-500' },
  { value: 'cyan', label: 'Cyaan', bg: 'bg-cyan-500' },
  { value: 'lime', label: 'Lime', bg: 'bg-lime-500' },
  { value: 'indigo', label: 'Indigo', bg: 'bg-indigo-500' },
  { value: 'teal', label: 'Teal', bg: 'bg-teal-500' },
  { value: 'slate', label: 'Grijs', bg: 'bg-slate-500' },
];

const COLOR_MAP: Record<string, { bg: string; light: string; text: string }> = {
  emerald: { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700' },
  sky: { bg: 'bg-sky-500', light: 'bg-sky-50', text: 'text-sky-700' },
  amber: { bg: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-700' },
  purple: { bg: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-700' },
  rose: { bg: 'bg-rose-500', light: 'bg-rose-50', text: 'text-rose-700' },
  cyan: { bg: 'bg-cyan-500', light: 'bg-cyan-50', text: 'text-cyan-700' },
  lime: { bg: 'bg-lime-500', light: 'bg-lime-50', text: 'text-lime-700' },
  indigo: { bg: 'bg-indigo-500', light: 'bg-indigo-50', text: 'text-indigo-700' },
  teal: { bg: 'bg-teal-500', light: 'bg-teal-50', text: 'text-teal-700' },
  slate: { bg: 'bg-slate-500', light: 'bg-slate-50', text: 'text-slate-700' },
};

const FIELD_TYPES = [
  { value: 'text', label: 'Tekst' },
  { value: 'textarea', label: 'Lang tekstveld' },
  { value: 'number', label: 'Nummer' },
  { value: 'select', label: 'Dropdown (keuze)' },
  { value: 'boolean', label: 'Ja/Nee' },
];

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [managingFields, setManagingFields] = useState<Branch | null>(null);

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch('/api/admin/branches');
    if (res.ok) {
      const d = await res.json();
      setBranches(d.branches || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  const handleDelete = async (b: Branch) => {
    if (
      !confirm(
        `Branche "${b.name}" verwijderen? Alle leads, webhooks, pricing en batches voor deze branche worden permanent verwijderd.`,
      )
    )
      return;
    const res = await adminFetch('/api/admin/branches', { method: 'DELETE', body: JSON.stringify({ id: b.id }) });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || 'Verwijderen mislukt');
      return;
    }
    fetchBranches();
  };

  const handleToggleActive = async (b: Branch) => {
    await adminFetch('/api/admin/branches', {
      method: 'PUT',
      body: JSON.stringify({ id: b.id, is_active: !b.is_active }),
    });
    fetchBranches();
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Branches</h1>
          <p className="mt-0.5 text-sm text-slate-500">Beheer je productlijnen en configureer custom velden per branche</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-button-gradient px-3.5 py-2 text-sm font-bold text-white shadow-sm"
        >
          <PlusIcon className="h-4 w-4" /> Nieuwe branche
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-100" />
                  <div>
                    <div className="h-5 w-28 animate-pulse rounded bg-slate-100" />
                    <div className="mt-1.5 h-3 w-16 animate-pulse rounded bg-slate-50" />
                  </div>
                </div>
              </div>
              <div className="mt-4 h-3 w-full animate-pulse rounded bg-slate-50" />
              <div className="mt-4 flex gap-3">
                <div className="h-8 flex-1 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-8 flex-1 animate-pulse rounded-lg bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : branches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center shadow-sm">
          <Squares2X2Icon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-600">Nog geen branches</p>
          <p className="mt-1 text-sm text-slate-400">Maak je eerste branche aan.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {branches.map(b => {
            const c = COLOR_MAP[b.color] || COLOR_MAP.slate;
            return (
              <div key={b.id} className="rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                <div className="p-5">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.light}`}>
                        <BoltIcon className={`h-5 w-5 ${c.text}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{b.name}</h3>
                        <p className="text-xs font-mono text-slate-400">{b.slug}</p>
                        {b.is_partner_branch && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                            Partner-branche · prospects-pijplijn
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleActive(b)}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                        b.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {b.is_active ? 'Actief' : 'Inactief'}
                    </button>
                  </div>

                  {b.description && (
                    <p className="mb-3 text-sm text-slate-500">{b.description}</p>
                  )}

                  <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <UserGroupIcon className="h-3.5 w-3.5" />
                      {b.lead_count} leads
                    </span>
                    <span className="flex items-center gap-1">
                      <LinkIcon className="h-3.5 w-3.5" />
                      {b.webhook_count} koppelingen
                    </span>
                    <span className="flex items-center gap-1">
                      <SwatchIcon className="h-3.5 w-3.5" />
                      {b.branch_fields.length} velden
                    </span>
                  </div>

                  {b.pricing_tiers && b.pricing_tiers.length > 0 && (
                    <div className="mb-3 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                      <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        <CurrencyEuroIcon className="h-3 w-3" /> Staffels
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {[...b.pricing_tiers].sort((a: PricingTier, b: PricingTier) => a.min_leads - b.min_leads).map((t: PricingTier, i: number) => (
                          <span key={i} className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm border border-slate-100">
                            {t.min_leads}+ → €{Number(t.price_per_lead).toFixed(2)}
                          </span>
                        ))}
                      </div>
                      {Number(b.nationwide_discount) > 0 && (
                        <p className="mt-1 text-[10px] text-emerald-600">-€{Number(b.nationwide_discount).toFixed(2)} landelijke korting</p>
                      )}
                    </div>
                  )}

                  {b.branch_fields.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {b.branch_fields.map(f => (
                        <span key={f.id} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.light} ${c.text}`}>
                          {f.label}
                          {f.is_required && <span className="ml-0.5 text-red-400">*</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center border-t border-slate-100">
                  <button
                    onClick={() => setEditing(b)}
                    className="flex flex-1 items-center justify-center gap-1.5 py-3.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-brand-purple"
                  >
                    <PencilSquareIcon className="h-4 w-4" /> Bewerken
                  </button>
                  <div className="h-8 w-px bg-slate-100" />
                  <button
                    onClick={() => setManagingFields(b)}
                    className="flex flex-1 items-center justify-center gap-1.5 py-3.5 text-sm font-medium text-brand-purple transition hover:bg-brand-purple/5"
                  >
                    <SwatchIcon className="h-4 w-4" /> Velden
                  </button>
                  <div className="h-8 w-px bg-slate-100" />
                  <button
                    onClick={() => handleDelete(b)}
                    className="flex items-center justify-center px-5 py-3.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {(editing || showNew) && (
          <BranchForm
            branch={editing}
            onClose={() => { setEditing(null); setShowNew(false); }}
            onSaved={() => { setEditing(null); setShowNew(false); fetchBranches(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {managingFields && (
          <FieldsManager
            branch={managingFields}
            onClose={() => setManagingFields(null)}
            onSaved={() => { setManagingFields(null); fetchBranches(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function BranchForm({ branch, onClose, onSaved }: { branch: Branch | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!branch;
  const [form, setForm] = useState({
    name: branch?.name || '',
    slug: branch?.slug || '',
    color: branch?.color || 'slate',
    description: branch?.description || '',
    is_active: branch?.is_active ?? true,
    is_partner_branch: branch?.is_partner_branch ?? false,
    min_batch_size: branch?.min_batch_size ?? 10,
    nationwide_discount: branch?.nationwide_discount ?? 0,
    appointment_min_batch_size: branch?.appointment_min_batch_size ?? 5,
    appointment_nationwide_discount: branch?.appointment_nationwide_discount ?? 0,
    default_appointment_duration: branch?.default_appointment_duration ?? 60,
    default_travel_buffer: branch?.default_travel_buffer ?? 30,
  });
  const [pricingProduct, setPricingProduct] = useState<'leads' | 'appointments'>('leads');
  const [tiers, setTiers] = useState<PricingTier[]>(
    branch?.pricing_tiers && Array.isArray(branch.pricing_tiers)
      ? [...branch.pricing_tiers].sort((a, b) => a.min_leads - b.min_leads)
      : []
  );
  const [apptTiers, setApptTiers] = useState<PricingTier[]>(
    branch?.appointment_pricing_tiers && Array.isArray(branch.appointment_pricing_tiers)
      ? [...branch.appointment_pricing_tiers].sort((a, b) => a.min_leads - b.min_leads)
      : []
  );
  const [newTierLeads, setNewTierLeads] = useState('');
  const [newTierPrice, setNewTierPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  const handleNameChange = (name: string) => {
    setForm(f => ({
      ...f,
      name,
      slug: isEdit ? f.slug : autoSlug(name),
    }));
  };

  const currentTiers = pricingProduct === 'leads' ? tiers : apptTiers;
  const setCurrentTiers = pricingProduct === 'leads' ? setTiers : setApptTiers;

  const addTier = () => {
    const leads = parseInt(newTierLeads);
    const price = parseFloat(newTierPrice);
    if (!leads || leads <= 0 || isNaN(price) || price < 0) return;
    if (currentTiers.some(t => t.min_leads === leads)) {
      setError(`Staffel voor ${leads} ${pricingProduct === 'leads' ? 'leads' : 'afspraken'} bestaat al`);
      return;
    }
    setCurrentTiers(prev => [...prev, { min_leads: leads, price_per_lead: price }].sort((a, b) => a.min_leads - b.min_leads));
    setNewTierLeads('');
    setNewTierPrice('');
    setError('');
  };

  const removeTier = (idx: number) => {
    setCurrentTiers(prev => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!form.name) { setError('Naam is verplicht'); return; }
    if (!form.slug) { setError('Slug is verplicht'); return; }
    setSaving(true);
    setError('');

    const finalTiers = [...tiers];
    const finalApptTiers = [...apptTiers];
    if (newTierLeads && newTierPrice) {
      const leads = parseInt(newTierLeads);
      const price = parseFloat(newTierPrice);
      const target = pricingProduct === 'leads' ? finalTiers : finalApptTiers;
      if (leads > 0 && !isNaN(price) && price >= 0 && !target.some(t => t.min_leads === leads)) {
        target.push({ min_leads: leads, price_per_lead: price });
        target.sort((a, b) => a.min_leads - b.min_leads);
      }
    }

    try {
      const payload = isEdit
        ? { id: branch!.id, ...form, pricing_tiers: finalTiers, appointment_pricing_tiers: finalApptTiers }
        : { ...form, pricing_tiers: finalTiers, appointment_pricing_tiers: finalApptTiers };
      const res = await adminFetch('/api/admin/branches', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Opslaan mislukt');
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-[60] w-full max-w-md overflow-y-auto bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Branche bewerken' : 'Nieuwe branche'}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><XMarkIcon className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-5">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Naam *</label>
            <input
              value={form.name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="Bijv. Warmtepompen"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Slug {isEdit && '(niet wijzigbaar)'}</label>
            <input
              value={form.slug}
              onChange={e => !isEdit && setForm(f => ({ ...f, slug: autoSlug(e.target.value) }))}
              disabled={isEdit}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-mono text-sm text-slate-900 outline-none focus:border-brand-purple/50 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Kleur</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setForm(f => ({ ...f, color: c.value }))}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border-2 transition ${
                    form.color === c.value ? 'border-slate-900 scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  title={c.label}
                >
                  <span className={`h-6 w-6 rounded-md ${c.bg}`} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Beschrijving</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="Korte omschrijving van deze branche"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="branch-active"
              checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              className="rounded border-slate-300"
            />
            <label htmlFor="branch-active" className="text-sm text-slate-700">Actief</label>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="branch-partner"
                checked={form.is_partner_branch}
                onChange={e => setForm(f => ({ ...f, is_partner_branch: e.target.checked }))}
                className="mt-0.5 rounded border-slate-300"
              />
              <div className="flex-1">
                <label htmlFor="branch-partner" className="block text-sm font-medium text-amber-900">
                  Partner-branche (prospects-pijplijn)
                </label>
                <p className="mt-0.5 text-xs text-amber-800/80">
                  Aan: leads op deze branche gaan naar de prospects-pijplijn (partner-acquisitie).
                  Deze branche is dan niet selecteerbaar bij batch-creatie of klant-branches.
                </p>
              </div>
            </div>
          </div>

          {/* Pricing section */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                <CurrencyEuroIcon className="h-4 w-4 text-brand-purple" />
                Prijzen &amp; staffels
              </h3>
              <div className="inline-flex items-center gap-0.5 rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-slate-200">
                <button
                  type="button"
                  onClick={() => setPricingProduct('leads')}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${pricingProduct === 'leads' ? 'bg-brand-purple text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Leads
                </button>
                <button
                  type="button"
                  onClick={() => setPricingProduct('appointments')}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${pricingProduct === 'appointments' ? 'bg-brand-purple text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Afspraken
                </button>
              </div>
            </div>

            {pricingProduct === 'leads' ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Min. afname (leads)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.min_batch_size}
                    onChange={e => setForm(f => ({ ...f, min_batch_size: parseInt(e.target.value) || 10 }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Korting landelijk (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.50"
                    value={form.nationwide_discount}
                    onChange={e => setForm(f => ({ ...f, nationwide_discount: parseFloat(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                  />
                  <p className="mt-0.5 text-[10px] text-slate-400">Korting per lead bij heel NL/BE</p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Min. afname (afspraken)</label>
                    <input
                      type="number"
                      min="1"
                      value={form.appointment_min_batch_size}
                      onChange={e => setForm(f => ({ ...f, appointment_min_batch_size: parseInt(e.target.value) || 5 }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Korting landelijk (€)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.50"
                      value={form.appointment_nationwide_discount}
                      onChange={e => setForm(f => ({ ...f, appointment_nationwide_discount: parseFloat(e.target.value) || 0 }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                    />
                    <p className="mt-0.5 text-[10px] text-slate-400">Korting per afspraak bij heel NL/BE</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Default duur (min)</label>
                    <input
                      type="number"
                      min="15"
                      step="15"
                      value={form.default_appointment_duration}
                      onChange={e => setForm(f => ({ ...f, default_appointment_duration: parseInt(e.target.value) || 60 }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Default reistijd-buffer (min)</label>
                    <input
                      type="number"
                      min="0"
                      step="15"
                      value={form.default_travel_buffer}
                      onChange={e => setForm(f => ({ ...f, default_travel_buffer: parseInt(e.target.value) || 0 }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Prijsstaffels</label>
              {currentTiers.length > 0 ? (
                <div className="space-y-1.5 mb-2.5">
                  {currentTiers.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <span className="flex-1 text-sm text-slate-700">
                        Vanaf <span className="font-semibold">{t.min_leads}</span> {pricingProduct === 'leads' ? 'leads' : 'afspraken'}
                      </span>
                      <span className="text-sm font-bold text-slate-900">€{Number(t.price_per_lead).toFixed(2)}</span>
                      <button onClick={() => removeTier(i)} className="ml-1 rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500">
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mb-2.5 text-xs text-slate-400 italic">Nog geen staffels ingesteld</p>
              )}

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-0.5 block text-[10px] text-slate-400">Vanaf ({pricingProduct === 'leads' ? 'leads' : 'afspraken'})</label>
                  <input
                    type="number"
                    min="1"
                    value={newTierLeads}
                    onChange={e => setNewTierLeads(e.target.value)}
                    placeholder={pricingProduct === 'leads' ? '30' : '10'}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-0.5 block text-[10px] text-slate-400">€ per {pricingProduct === 'leads' ? 'lead' : 'afspraak'}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.50"
                    value={newTierPrice}
                    onChange={e => setNewTierPrice(e.target.value)}
                    placeholder="37.50"
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                  />
                </div>
                <button
                  type="button"
                  onClick={addTier}
                  disabled={!newTierLeads || !newTierPrice}
                  className="rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-slate-100 bg-white px-5 py-4">
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Annuleren</button>
            <button onClick={save} disabled={saving} className="flex-1 rounded-lg bg-button-gradient py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {saving ? 'Opslaan...' : isEdit ? 'Bijwerken' : 'Aanmaken'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

function FieldsManager({ branch, onClose, onSaved }: { branch: Branch; onClose: () => void; onSaved: () => void }) {
  const [fields, setFields] = useState<BranchField[]>([...branch.branch_fields]);
  const [saving, setSaving] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [newField, setNewField] = useState({ label: '', key: '', field_type: 'text', is_required: false, options: '' });

  const c = COLOR_MAP[branch.color] || COLOR_MAP.slate;

  const autoKey = (label: string) =>
    label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  const moveField = (idx: number, dir: -1 | 1) => {
    const next = [...fields];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    next.forEach((f, i) => f.sort_order = i);
    setFields(next);
  };

  const addField = async () => {
    if (!newField.label || !newField.key) return;
    setSaving(true);
    const res = await adminFetch('/api/admin/branches/fields', {
      method: 'POST',
      body: JSON.stringify({
        branch_id: branch.id,
        key: newField.key,
        label: newField.label,
        field_type: newField.field_type,
        is_required: newField.is_required,
        options: newField.field_type === 'select' ? newField.options.split(',').map(o => o.trim()).filter(Boolean) : [],
        sort_order: fields.length,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      setFields(prev => [...prev, d.field]);
      setNewField({ label: '', key: '', field_type: 'text', is_required: false, options: '' });
      setAddingNew(false);
    }
    setSaving(false);
  };

  const deleteField = async (fieldId: string) => {
    if (!confirm('Dit veld verwijderen? Bestaande data in leads blijft bewaard in custom_fields.')) return;
    const res = await adminFetch('/api/admin/branches/fields', {
      method: 'DELETE',
      body: JSON.stringify({ id: fieldId }),
    });
    if (res.ok) {
      setFields(prev => prev.filter(f => f.id !== fieldId));
    }
  };

  const updateField = async (field: BranchField) => {
    await adminFetch('/api/admin/branches/fields', {
      method: 'PUT',
      body: JSON.stringify(field),
    });
    setEditingField(null);
  };

  const saveOrder = async () => {
    setSaving(true);
    await adminFetch('/api/admin/branches/fields', {
      method: 'PUT',
      body: JSON.stringify({
        fields: fields.map((f, i) => ({ id: f.id, sort_order: i })),
      }),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-lg flex-col bg-white shadow-2xl"
      >
        <div className="shrink-0 border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Velden beheren</h2>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${c.bg}`} />
                <span className="font-medium">{branch.name}</span>
                <span className="text-slate-300">&middot;</span>
                <span>{fields.length} velden</span>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><XMarkIcon className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {fields.length === 0 && !addingNew && (
            <div className="rounded-xl border border-dashed border-slate-300 py-8 text-center">
              <SwatchIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">Nog geen custom velden voor deze branche.</p>
            </div>
          )}

          <div className="space-y-2">
            {fields.map((f, idx) => (
              <div key={f.id} className="rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <div className="flex shrink-0 flex-col">
                    <button
                      onClick={() => moveField(idx, -1)}
                      disabled={idx === 0}
                      className="rounded p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-30"
                    >
                      <ChevronUpIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => moveField(idx, 1)}
                      disabled={idx === fields.length - 1}
                      className="rounded p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-30"
                    >
                      <ChevronDownIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 text-sm">{f.label}</span>
                      {f.is_required && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-500">Verplicht</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <code className="font-mono">{f.key}</code>
                      <span>&middot;</span>
                      <span>{FIELD_TYPES.find(t => t.value === f.field_type)?.label || f.field_type}</span>
                      {f.field_type === 'select' && f.options.length > 0 && (
                        <span className="text-slate-300">({f.options.length} opties)</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => setEditingField(editingField === f.id ? null : f.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteField(f.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {editingField === f.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-slate-100 p-3 space-y-2.5">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div>
                            <label className="mb-0.5 block text-[11px] font-medium text-slate-400">Label</label>
                            <input
                              value={f.label}
                              onChange={e => setFields(prev => prev.map(x => x.id === f.id ? { ...x, label: e.target.value } : x))}
                              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                            />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[11px] font-medium text-slate-400">Type</label>
                            <select
                              value={f.field_type}
                              onChange={e => setFields(prev => prev.map(x => x.id === f.id ? { ...x, field_type: e.target.value } : x))}
                              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900"
                            >
                              {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          </div>
                        </div>
                        {f.field_type === 'select' && (
                          <div>
                            <label className="mb-0.5 block text-[11px] font-medium text-slate-400">Opties (comma-gescheiden)</label>
                            <input
                              value={f.options.join(', ')}
                              onChange={e => setFields(prev => prev.map(x => x.id === f.id ? { ...x, options: e.target.value.split(',').map(o => o.trim()).filter(Boolean) } : x))}
                              placeholder="Optie 1, Optie 2, Optie 3"
                              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={f.is_required}
                              onChange={e => setFields(prev => prev.map(x => x.id === f.id ? { ...x, is_required: e.target.checked } : x))}
                              className="rounded border-slate-300"
                            />
                            <span className="text-xs text-slate-600">Verplicht</span>
                          </div>
                          <button
                            onClick={() => updateField(f)}
                            className="inline-flex items-center gap-1 rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-medium text-white"
                          >
                            <CheckIcon className="h-3.5 w-3.5" /> Opslaan
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          {/* Add new field */}
          {addingNew ? (
            <div className="mt-3 rounded-lg border-2 border-dashed border-brand-purple/30 bg-brand-purple/[0.02] p-4">
              <p className="mb-3 text-sm font-semibold text-slate-900">Nieuw veld toevoegen</p>
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-slate-400">Label *</label>
                    <input
                      value={newField.label}
                      onChange={e => setNewField(f => ({ ...f, label: e.target.value, key: autoKey(e.target.value) }))}
                      placeholder="Bijv. Vermogen"
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-slate-400">Key (auto)</label>
                    <input
                      value={newField.key}
                      onChange={e => setNewField(f => ({ ...f, key: autoKey(e.target.value) }))}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-2 font-mono text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-slate-400">Type</label>
                    <select
                      value={newField.field_type}
                      onChange={e => setNewField(f => ({ ...f, field_type: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-900"
                    >
                      {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end pb-0.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newField.is_required}
                        onChange={e => setNewField(f => ({ ...f, is_required: e.target.checked }))}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-600">Verplicht</span>
                    </div>
                  </div>
                </div>
                {newField.field_type === 'select' && (
                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-slate-400">Opties (comma-gescheiden)</label>
                    <input
                      value={newField.options}
                      onChange={e => setNewField(f => ({ ...f, options: e.target.value }))}
                      placeholder="Optie 1, Optie 2, Optie 3"
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setAddingNew(false)} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Annuleren</button>
                  <button onClick={addField} disabled={saving || !newField.label || !newField.key} className="flex-1 rounded-lg bg-button-gradient py-2 text-sm font-bold text-white disabled:opacity-50">
                    {saving ? 'Toevoegen...' : 'Toevoegen'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingNew(true)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-slate-200 py-3 text-sm font-medium text-slate-400 transition hover:border-brand-purple/30 hover:text-brand-purple"
            >
              <PlusIcon className="h-4 w-4" /> Veld toevoegen
            </button>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4">
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Sluiten</button>
            <button onClick={saveOrder} disabled={saving} className="flex-1 rounded-lg bg-button-gradient py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {saving ? 'Opslaan...' : 'Volgorde opslaan'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
