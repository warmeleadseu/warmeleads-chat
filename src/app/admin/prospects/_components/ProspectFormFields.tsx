'use client';

import { KvkLookupButton, type KvkApply } from './KvkLookupButton';

export interface ProspectFormState {
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  website: string;
  kvk_nummer: string;
  vat_id: string;
  address: string;
  postcode: string;
  city: string;
  country: string;
  branches: string[];
  company_size: string;
  notes: string;
}

export const EMPTY_PROSPECT: ProspectFormState = {
  company_name: '',
  contact_person: '',
  email: '',
  phone: '',
  website: '',
  kvk_nummer: '',
  vat_id: '',
  address: '',
  postcode: '',
  city: '',
  country: 'NL',
  branches: [],
  company_size: '',
  notes: '',
};

interface BranchOption {
  slug: string;
  name: string;
}

interface Props {
  value: ProspectFormState;
  onChange: (next: ProspectFormState) => void;
  branches?: BranchOption[];
  disabled?: boolean;
}

const SIZE_OPTIONS = [
  { value: '', label: 'Onbekend' },
  { value: 'klein', label: 'Klein (<10 fte)' },
  { value: 'middel', label: 'Middel (10-50 fte)' },
  { value: 'groot', label: 'Groot (50+ fte)' },
];

export function ProspectFormFields({ value, onChange, branches = [], disabled }: Props) {
  const set = <K extends keyof ProspectFormState>(key: K, v: ProspectFormState[K]) => {
    onChange({ ...value, [key]: v });
  };

  const onKvkApply = (data: KvkApply) => {
    onChange({
      ...value,
      company_name: data.company_name || value.company_name,
      kvk_nummer: data.kvk_nummer || value.kvk_nummer,
      vat_id: data.vat_id || value.vat_id,
      address: data.address || value.address,
      postcode: data.postcode || value.postcode,
      city: data.city || value.city,
    });
  };

  const toggleBranch = (slug: string) => {
    const set = new Set(value.branches || []);
    if (set.has(slug)) set.delete(slug);
    else set.add(slug);
    onChange({ ...value, branches: Array.from(set) });
  };

  return (
    <div className="space-y-5">
      <Section title="Bedrijf" right={<KvkLookupButton onApply={onKvkApply} />}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Bedrijfsnaam *" required>
            <input
              type="text"
              value={value.company_name}
              onChange={e => set('company_name', e.target.value)}
              disabled={disabled}
              className={inputCls}
              placeholder="Bedrijf BV"
            />
          </Field>
          <Field label="Contactpersoon">
            <input
              type="text"
              value={value.contact_person}
              onChange={e => set('contact_person', e.target.value)}
              disabled={disabled}
              className={inputCls}
              placeholder="Voornaam Achternaam"
            />
          </Field>
          <Field label="E-mail">
            <input
              type="email"
              value={value.email}
              onChange={e => set('email', e.target.value)}
              disabled={disabled}
              className={inputCls}
              placeholder="info@bedrijf.nl"
            />
          </Field>
          <Field label="Telefoon">
            <input
              type="tel"
              value={value.phone}
              onChange={e => set('phone', e.target.value)}
              disabled={disabled}
              className={inputCls}
              placeholder="06 1234 5678"
            />
          </Field>
          <Field label="Website">
            <input
              type="url"
              value={value.website}
              onChange={e => set('website', e.target.value)}
              disabled={disabled}
              className={inputCls}
              placeholder="https://"
            />
          </Field>
          <Field label="KVK-nummer">
            <input
              type="text"
              value={value.kvk_nummer}
              onChange={e => set('kvk_nummer', e.target.value)}
              disabled={disabled}
              className={inputCls}
              placeholder="12345678"
            />
          </Field>
          <Field label="BTW / RSIN">
            <input
              type="text"
              value={value.vat_id}
              onChange={e => set('vat_id', e.target.value)}
              disabled={disabled}
              className={inputCls}
              placeholder="NL000000000B01"
            />
          </Field>
          <Field label="Bedrijfsgrootte">
            <select
              value={value.company_size}
              onChange={e => set('company_size', e.target.value)}
              disabled={disabled}
              className={inputCls}
            >
              {SIZE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Adres">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Straat + huisnummer" className="md:col-span-2">
            <input
              type="text"
              value={value.address}
              onChange={e => set('address', e.target.value)}
              disabled={disabled}
              className={inputCls}
              placeholder="Straatnaam 12"
            />
          </Field>
          <Field label="Postcode">
            <input
              type="text"
              value={value.postcode}
              onChange={e => set('postcode', e.target.value)}
              disabled={disabled}
              className={inputCls}
              placeholder="1234 AB"
            />
          </Field>
          <Field label="Plaats" className="md:col-span-2">
            <input
              type="text"
              value={value.city}
              onChange={e => set('city', e.target.value)}
              disabled={disabled}
              className={inputCls}
              placeholder="Amsterdam"
            />
          </Field>
          <Field label="Land">
            <input
              type="text"
              value={value.country}
              onChange={e => set('country', e.target.value)}
              disabled={disabled}
              className={inputCls}
              placeholder="NL"
            />
          </Field>
        </div>
      </Section>

      {branches.length > 0 && (
        <Section title="Interesse in branches">
          <div className="flex flex-wrap gap-2">
            {branches.map(b => {
              const active = (value.branches || []).includes(b.slug);
              return (
                <button
                  key={b.slug}
                  type="button"
                  onClick={() => toggleBranch(b.slug)}
                  disabled={disabled}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors ${
                    active
                      ? 'bg-brand-purple/10 text-brand-purple ring-brand-purple/30'
                      : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {b.name}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Notities">
        <textarea
          value={value.notes}
          onChange={e => set('notes', e.target.value)}
          disabled={disabled}
          rows={4}
          className={`${inputCls} resize-y`}
          placeholder="Korte aantekeningen over deze prospect..."
        />
      </Section>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-brand-purple/50 disabled:bg-slate-50 disabled:text-slate-400';

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className || ''}`}>
      <span className="mb-1 block text-xs font-medium text-slate-500">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}
