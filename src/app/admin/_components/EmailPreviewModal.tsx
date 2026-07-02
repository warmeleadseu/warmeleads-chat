'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  XMarkIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  EnvelopeIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

type PreviewSummary = {
  invoice_number?: string;
  total_incl_btw?: number;
  vat_mode?: 'reverse_charge_be' | 'domestic_nl' | string;
  payment_method_copy?: string;
  has_payment_link?: boolean;
  branch_label?: string;
  batch_size?: number;
  is_simulated?: boolean;
};

type PreviewResponse = {
  subject: string;
  html: string;
  to: { email: string; name: string };
  summary: PreviewSummary;
};

interface Props {
  open: boolean;
  onClose: () => void;
  /** Korte titel boven de modal, bv. 'Stuur factuur + betaallink'. */
  title: string;
  /** GET-route die `{ subject, html, to, summary }` teruggeeft zonder te versturen. */
  previewUrl: string;
  /** POST-route die de mail daadwerkelijk verstuurt. */
  sendUrl: string;
  /** Tekst voor de bevestigingsknop (default 'Nu verzenden'). */
  confirmLabel?: string;
  /** Callback met succesmelding ná verzenden. */
  onSent: (message: string) => void;
  /** Succesbericht dat aan `onSent` doorgegeven wordt. */
  successMessage: string;
  /** Welk icoon links bovenin tonen. */
  variant?: 'invoice' | 'reminder';
}

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);

export function EmailPreviewModal({
  open,
  onClose,
  title,
  previewUrl,
  sendUrl,
  confirmLabel = 'Nu verzenden',
  onSent,
  successMessage,
  variant = 'invoice',
}: Props) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setPreviewError(null);
      setSendError(null);
      setLoading(false);
      setSending(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setPreviewError(null);
    (async () => {
      try {
        const res = await adminFetch(previewUrl);
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setPreviewError(body.error || 'Preview laden mislukt');
        } else {
          setPreview(body as PreviewResponse);
        }
      } catch (err) {
        if (cancelled) return;
        setPreviewError(err instanceof Error ? err.message : 'Preview laden mislukt');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, previewUrl]);

  useEffect(() => {
    if (!preview || !iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(preview.html);
    doc.close();
  }, [preview]);

  const handleSend = async () => {
    setSending(true);
    setSendError(null);
    try {
      const res = await adminFetch(sendUrl, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Versturen mislukt');
      }
      onSent(successMessage);
      onClose();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Versturen mislukt');
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const Icon = variant === 'reminder' ? EnvelopeIcon : DocumentTextIcon;
  const isReverse = preview?.summary?.vat_mode === 'reverse_charge_be';
  const summary = preview?.summary;
  const totalLabel = isReverse ? 'BTW verlegd' : 'incl. 21% BTW';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
      onClick={() => !sending && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={e => e.stopPropagation()}
        className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-purple/10 text-brand-purple">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{title}</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Controleer de inhoud voordat je verstuurt. De mail gaat pas weg na klikken op &quot;{confirmLabel}&quot;.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded p-1 text-slate-400 transition hover:bg-slate-100 disabled:opacity-50"
            aria-label="Sluiten"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex h-48 items-center justify-center text-sm text-slate-500">
              <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" />
              Preview laden...
            </div>
          )}

          {previewError && (
            <div className="m-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{previewError}</span>
            </div>
          )}

          {preview && (
            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[120px_1fr]">
                  <span className="text-slate-500">Aan</span>
                  <span className="font-medium text-slate-900 break-all">
                    {preview.to.name} &lt;{preview.to.email}&gt;
                  </span>
                  <span className="text-slate-500">Onderwerp</span>
                  <span className="font-medium text-slate-900">{preview.subject}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {summary?.invoice_number && (
                    <Chip label={`Factuurnr. ${summary.invoice_number}`} tone="purple" />
                  )}
                  {summary?.branch_label && (
                    <Chip label={summary.branch_label} tone="purple" />
                  )}
                  {typeof summary?.batch_size === 'number' && (
                    <Chip label={`${summary.batch_size} leads`} tone="slate" />
                  )}
                  {typeof summary?.total_incl_btw === 'number' && (
                    <Chip
                      label={`${fmtEuro(summary.total_incl_btw)} (${totalLabel})`}
                      tone={isReverse ? 'emerald' : 'slate'}
                    />
                  )}
                  {summary?.payment_method_copy && (
                    <Chip
                      label={`Betaalmethode: ${summary.payment_method_copy}`}
                      tone="amber"
                    />
                  )}
                  {summary?.has_payment_link === false && (
                    <Chip label="Zonder Mollie-betaallink" tone="red" />
                  )}
                  {summary?.is_simulated && (
                    <Chip label="Concept — factuur wordt aangemaakt bij verzenden" tone="amber" />
                  )}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  E-mail preview
                </p>
                <iframe
                  ref={iframeRef}
                  title="Email preview"
                  sandbox="allow-same-origin"
                  className="h-[min(480px,50vh)] w-full rounded-xl border border-slate-200 bg-white"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4">
          {sendError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <ExclamationTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{sendError}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
            >
              Annuleren
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !preview}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-brand-purple to-brand-pink px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
            >
              {sending ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  Verzenden...
                </>
              ) : (
                <>
                  <PaperAirplaneIcon className="h-4 w-4" />
                  {confirmLabel}
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone: 'purple' | 'slate' | 'emerald' | 'amber' | 'red' }) {
  const cls = {
    purple: 'bg-brand-purple/10 text-brand-purple border-brand-purple/20',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  }[tone];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}
