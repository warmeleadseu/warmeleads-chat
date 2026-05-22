'use client';

import { useCallback, useEffect, useState } from 'react';
import { portalFetch } from '@/lib/portalAuth';
import { T } from '../_ui';
import { ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { FIELD_MAP_SKIP, FIELD_MAP_SUMMARY } from '@/lib/teamleader/standardFields';
import { PORTAL_STANDARD_FIELDS } from '@/lib/teamleader/standardFields';

type TlField = { id: string; label: string; type: string };
type PortalField = { key: string; label: string; group: 'standard' | 'branch' };
type BranchMappingData = {
  slug: string;
  name: string;
  portal_fields: PortalField[];
  mapping: { contact: Record<string, string>; deal: Record<string, string> };
  mapping_source?: 'saved' | 'suggested';
};

const NATIVE_KEYS = new Set<string>(
  PORTAL_STANDARD_FIELDS.filter((f) => f.native !== 'none').map((f) => f.key),
);

export function TeamleaderFieldMapping({
  showToast,
  connected,
  onSaved,
}: {
  showToast: (msg: string, type?: 'success' | 'error') => void;
  connected: boolean;
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<BranchMappingData[]>([]);
  const [tlContact, setTlContact] = useState<TlField[]>([]);
  const [tlDeal, setTlDeal] = useState<TlField[]>([]);
  const [activeBranch, setActiveBranch] = useState('');
  const [localMapping, setLocalMapping] = useState<{
    contact: Record<string, string>;
    deal: Record<string, string>;
  }>({ contact: {}, deal: {} });
  const [hasSavedMappings, setHasSavedMappings] = useState(true);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async (opts?: { suggest?: boolean }) => {
    if (!connected) return;
    setLoading(true);
    try {
      const qs = opts?.suggest ? '?suggest=1' : '';
      const res = await portalFetch(`/api/portal/integrations/teamleader/field-mapping${qs}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(d.error || 'Velden laden mislukt', 'error');
        return;
      }
      const loaded: BranchMappingData[] = d.branches || [];
      setBranches(loaded);
      setTlContact(d.teamleader_fields?.contact || []);
      setTlDeal(d.teamleader_fields?.deal || []);
      setHasSavedMappings(d.has_saved_mappings !== false);
      const slug = activeBranch || loaded[0]?.slug || '';
      if (slug && !activeBranch) setActiveBranch(slug);
      const current = loaded.find((x) => x.slug === (activeBranch || slug));
      if (current) setLocalMapping(current.mapping);
      if (!opts?.suggest) setDirty(false);
      if (opts?.suggest) {
        setDirty(true);
        showToast('Velden automatisch gekoppeld — controleer en sla op');
      }
    } finally {
      setLoading(false);
    }
  }, [connected, showToast, activeBranch]);

  useEffect(() => {
    void load();
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps -- alleen bij connect

  const active = branches.find((b) => b.slug === activeBranch);
  const portalFields = active?.portal_fields ?? [];
  const showSuggestBanner =
    (!hasSavedMappings || active?.mapping_source === 'suggested' || dirty) &&
    (tlContact.length > 0 || tlDeal.length > 0);

  const setContactMap = (key: string, value: string) => {
    setDirty(true);
    setLocalMapping((m) => ({
      ...m,
      contact: { ...m.contact, [key]: value },
      deal: value ? { ...m.deal, [key]: m.deal[key] === value ? '' : m.deal[key] } : m.deal,
    }));
  };

  const setDealMap = (key: string, value: string) => {
    setDirty(true);
    setLocalMapping((m) => ({
      ...m,
      deal: { ...m.deal, [key]: value },
      contact:
        value && m.contact[key] === value ? { ...m.contact, [key]: '' } : m.contact,
    }));
  };

  const save = async () => {
    if (!activeBranch) return;
    setSaving(true);
    try {
      const res = await portalFetch('/api/portal/integrations/teamleader/field-mapping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch: activeBranch, mapping: localMapping }),
      });
      if (res.ok) {
        showToast('Veldkoppeling opgeslagen');
        setDirty(false);
        setHasSavedMappings(true);
        await load();
        onSaved?.();
      } else {
        const d = await res.json();
        showToast(d.error || 'Opslaan mislukt', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!connected) return null;

  return (
    <div className="mt-6 border-t border-slate-100 pt-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Veldkoppeling</h4>
          <p className="mt-0.5 max-w-prose text-xs text-slate-500">
            Koppel portaalvelden aan de velden in jouw Teamleader-account. Naam, e-mail en telefoon
            worden altijd op het contact gezet. Branche-specifieke velden kun je per branche instellen.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void load({ suggest: true })}
            disabled={loading}
            className={T.btnSecondary}
          >
            <SparklesIcon className="h-4 w-4" />
            Auto-koppelen
          </button>
          <button type="button" onClick={() => void load()} disabled={loading} className={T.btnGhost}>
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {branches.length > 1 && (
        <div className={`mb-4 ${T.pillGroup} flex-wrap`}>
          {branches.map((b) => (
            <button
              key={b.slug}
              type="button"
              onClick={() => {
                setActiveBranch(b.slug);
                setLocalMapping(b.mapping);
                setDirty(false);
              }}
              className={`${T.pillItem} ${activeBranch === b.slug ? T.pillActive : T.pillIdle}`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {showSuggestBanner && !loading && (
        <div className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-900">
          <p className="font-medium">Velden uit Teamleader geladen</p>
          <p className="mt-0.5 text-amber-800/90">
            We hebben je Teamleader-velden vergeleken met de portaalvelden
            {branches.length > 1 ? ' per branche' : ''}. Controleer de koppelingen hieronder en klik op{' '}
            <span className="font-medium">Veldkoppeling opslaan</span> om ze definitief te maken.
          </p>
        </div>
      )}

      {loading && portalFields.length === 0 ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-50" />
      ) : tlContact.length === 0 && tlDeal.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
          Geen extra velden gevonden in Teamleader. Standaardgegevens worden wel gesynchroniseerd.
        </p>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-100 md:block">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Portaalveld</th>
                  <th className="px-3 py-2.5 font-medium">Teamleader — contact</th>
                  <th className="px-3 py-2.5 font-medium">Teamleader — deal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {portalFields.map((pf) => (
                  <MappingRow
                    key={pf.key}
                    field={pf}
                    contactValue={localMapping.contact[pf.key] || ''}
                    dealValue={localMapping.deal[pf.key] || ''}
                    tlContact={tlContact}
                    tlDeal={tlDeal}
                    onContact={(v) => setContactMap(pf.key, v)}
                    onDeal={(v) => setDealMap(pf.key, v)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {portalFields.map((pf) => (
              <div key={pf.key} className="rounded-xl border border-slate-100 p-3">
                <p className="mb-2 text-sm font-medium text-slate-900">
                  {pf.label}
                  {pf.group === 'branch' && (
                    <span className="ml-1.5 text-[10px] font-normal text-slate-400">branche</span>
                  )}
                </p>
                <div className="space-y-2">
                  <FieldSelect
                    label="Contact"
                    value={localMapping.contact[pf.key] || ''}
                    options={tlContact}
                    onChange={(v) => setContactMap(pf.key, v)}
                    isNative={NATIVE_KEYS.has(pf.key)}
                  />
                  <FieldSelect
                    label="Deal"
                    value={localMapping.deal[pf.key] || ''}
                    options={tlDeal}
                    onChange={(v) => setDealMap(pf.key, v)}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !activeBranch}
            className={`${T.btnPrimary} mt-4 w-full sm:w-auto`}
          >
            {saving ? 'Opslaan…' : 'Veldkoppeling opslaan'}
          </button>
        </>
      )}
    </div>
  );
}

function MappingRow({
  field,
  contactValue,
  dealValue,
  tlContact,
  tlDeal,
  onContact,
  onDeal,
}: {
  field: PortalField;
  contactValue: string;
  dealValue: string;
  tlContact: TlField[];
  tlDeal: TlField[];
  onContact: (v: string) => void;
  onDeal: (v: string) => void;
}) {
  return (
    <tr>
      <td className="px-3 py-2.5">
        <span className="font-medium text-slate-800">{field.label}</span>
        {field.group === 'branch' && (
          <span className="ml-1 text-[10px] text-slate-400">(branche)</span>
        )}
        {NATIVE_KEYS.has(field.key) && (
          <p className="text-[10px] text-slate-400">Standaard op contact</p>
        )}
      </td>
      <td className="px-3 py-2.5">
        <FieldSelect
          value={contactValue}
          options={tlContact}
          onChange={onContact}
          isNative={NATIVE_KEYS.has(field.key)}
        />
      </td>
      <td className="px-3 py-2.5">
        <FieldSelect value={dealValue} options={tlDeal} onChange={onDeal} />
      </td>
    </tr>
  );
}

function FieldSelect({
  label,
  value,
  options,
  onChange,
  isNative,
}: {
  label?: string;
  value: string;
  options: TlField[];
  onChange: (v: string) => void;
  isNative?: boolean;
}) {
  return (
    <div>
      {label && <span className="mb-0.5 block text-[10px] text-slate-500">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-brand-purple/40 focus:ring-1 focus:ring-brand-purple/15"
      >
        <option value="">— Niet koppelen —</option>
        {isNative && <option value="_native">Standaard contactveld</option>}
        <option value={FIELD_MAP_SUMMARY}>In dealomschrijving</option>
        <option value={FIELD_MAP_SKIP}>Overslaan</option>
        <optgroup label="Teamleader-velden">
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}
