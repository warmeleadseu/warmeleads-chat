'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { XMarkIcon, CheckBadgeIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import type { ProspectDetail, BranchOption } from './ProspectDrawer';

interface Props {
  open: boolean;
  onClose: () => void;
  prospect: ProspectDetail;
  branches: BranchOption[];
  onDone: (customerId: string) => void;
}

/**
 * Splits prospect.branches in (a) slugs die bestaan in de huidige branches-lijst
 * en kunnen worden voorgeselecteerd, en (b) onbekende strings die we silent
 * negeren (en als banner aan de AM tonen). Voorkomt dat oude/foute import-data
 * (bv. 'beide', 'airco leads') de "Onbekende branche(s)"-error veroorzaakt
 * bij het promoten naar klant.
 */
function partitionProspectBranches(
  prospectBranches: string[] | null | undefined,
  validBranches: BranchOption[],
): { valid: string[]; ignored: string[] } {
  const validSet = new Set(validBranches.map(b => b.slug));
  const valid: string[] = [];
  const ignored: string[] = [];
  for (const raw of prospectBranches || []) {
    if (typeof raw !== 'string') continue;
    if (validSet.has(raw)) valid.push(raw);
    else ignored.push(raw);
  }
  return { valid, ignored };
}

export function ConvertToCustomerDialog({ open, onClose, prospect, branches, onDone }: Props) {
  const [name, setName] = useState(prospect.company_name || '');
  const [contact, setContact] = useState(prospect.contact_person || '');
  const [email, setEmail] = useState(prospect.email || '');
  const [phone, setPhone] = useState(prospect.phone || '');
  const partitioned = useMemo(
    () => partitionProspectBranches(prospect.branches, branches),
    [prospect.branches, branches],
  );
  const [picked, setPicked] = useState<Set<string>>(new Set(partitioned.valid));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(prospect.company_name || '');
      setContact(prospect.contact_person || '');
      setEmail(prospect.email || '');
      setPhone(prospect.phone || '');
      setPicked(new Set(partitioned.valid));
      setError(null);
    }
  }, [open, prospect, partitioned.valid]);

  if (!open) return null;

  const toggle = (slug: string) => {
    setPicked(prev => {
      const n = new Set(prev);
      if (n.has(slug)) n.delete(slug);
      else n.add(slug);
      return n;
    });
  };

  const submit = async () => {
    if (!name.trim()) {
      setError('Bedrijfsnaam is verplicht');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await adminFetch(`/api/admin/prospects/${prospect.id}/convert`, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          contact_person: contact.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          branches: Array.from(picked),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Conversie mislukt');
      } else if (data.customer) {
        onDone(data.customer.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversie mislukt');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={e => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <CheckBadgeIcon className="h-5 w-5 text-emerald-600" />
            Promoveer naar klant
          </h2>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded text-slate-400 hover:bg-slate-100">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            Er wordt een nieuwe klant aangemaakt. De prospect krijgt status <strong>Gewonnen</strong> en blijft als
            historische referentie bestaan, gekoppeld aan de nieuwe klant.
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Bedrijfsnaam *">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Contactpersoon">
              <input
                type="text"
                value={contact}
                onChange={e => setContact(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="E-mail">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Telefoon">
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-slate-500">Branches</span>
            <div className="flex flex-wrap gap-1.5">
              {branches.map(b => {
                const active = picked.has(b.slug);
                return (
                  <button
                    key={b.slug}
                    type="button"
                    onClick={() => toggle(b.slug)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
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
            {partitioned.ignored.length > 0 && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="break-words font-medium">
                    Genegeerde interesse{partitioned.ignored.length > 1 ? 's' : ''} uit de prospect:
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {partitioned.ignored.map(s => (
                      <span
                        key={s}
                        className="break-all rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[11px] text-amber-800"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <p className="mt-0.5 text-amber-700">
                    Komt niet overeen met een bestaande branche. Kies hierboven handmatig de juiste
                    branche(s) voor deze klant.
                  </p>
                </div>
              </div>
            )}
          </div>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !name.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckBadgeIcon className="h-4 w-4" />
            {submitting ? 'Bezig...' : 'Promoveer'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-purple/50';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
