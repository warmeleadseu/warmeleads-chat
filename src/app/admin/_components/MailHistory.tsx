'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  EnvelopeOpenIcon,
  CursorArrowRippleIcon,
  CheckBadgeIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  XMarkIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

interface SentItem {
  id: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  status: string;
  error: string | null;
  type: string;
  template_key: string | null;
  created_at: string;
  opens_count: number;
  clicks_count: number;
  last_opened_at: string | null;
  last_clicked_at: string | null;
  from_admin: { id: string; name: string; email: string } | null;
  cc_emails: string[] | null;
  bcc_emails: string[] | null;
}

interface DetailEmail extends SentItem {
  html: string;
  body_text: string | null;
  template_options: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  reply_to: string | null;
}

interface Props {
  prospectId?: string;
  customerId?: string;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  sent: { label: 'Verstuurd', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  failed: { label: 'Mislukt', className: 'bg-rose-100 text-rose-700 border-rose-200' },
  bounced: { label: 'Gebounced', className: 'bg-rose-100 text-rose-700 border-rose-200' },
  queued: { label: 'In wachtrij', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  opt_out: { label: 'Uitgeschr.', className: 'bg-amber-100 text-amber-700 border-amber-200' },
};

function timeFmt(s: string) {
  return new Date(s).toLocaleString('nl-NL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MailHistory({ prospectId, customerId }: Props) {
  const [items, setItems] = useState<SentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<DetailEmail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ only_am: '1', limit: '50' });
      if (prospectId) params.set('prospect_id', prospectId);
      if (customerId) params.set('customer_id', customerId);
      const res = await adminFetch(`/api/admin/emails/sent?${params}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Mail-historie kon niet geladen worden');
      setItems(j.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onbekende fout');
    } finally {
      setLoading(false);
    }
  }, [prospectId, customerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function loadDetail(id: string) {
    setActiveId(id);
    setActiveDetail(null);
    setDetailLoading(true);
    try {
      const res = await adminFetch(`/api/admin/emails/sent/${id}`);
      const j = await res.json().catch(() => ({}));
      if (res.ok) setActiveDetail(j.email);
    } finally {
      setDetailLoading(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-500 p-4">Laden…</div>;
  }
  if (error) {
    return (
      <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700">
        {error}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-slate-500">
        <EnvelopeOpenIcon className="mx-auto h-8 w-8 text-slate-300 mb-2" />
        Nog geen mail verstuurd vanuit het CRM.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {items.length} mail{items.length === 1 ? '' : 's'} via WarmeLeads
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
        >
          <ArrowPathIcon className="h-3.5 w-3.5" />
          Verversen
        </button>
      </div>

      <ul className="space-y-2">
        {items.map(m => {
          const status = STATUS_LABELS[m.status] || {
            label: m.status,
            className: 'bg-slate-100 text-slate-600 border-slate-200',
          };
          return (
            <li
              key={m.id}
              className="rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-300"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => loadDetail(m.id)}
                  className="text-left flex-1 min-w-0"
                >
                  <p className="font-semibold text-sm text-slate-900 truncate">{m.subject}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                    <span>{timeFmt(m.created_at)}</span>
                    {m.from_admin && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span>door {m.from_admin.name.split(' ')[0]}</span>
                      </>
                    )}
                  </div>
                </button>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${status.className}`}
                >
                  {status.label}
                </span>
              </div>
              {(m.cc_emails?.length || m.bcc_emails?.length) ? (
                <p className="mt-1 text-[11px] text-slate-500 line-clamp-2 break-all">
                  {(m.cc_emails?.length ?? 0) > 0 && (
                    <span>
                      <span className="font-semibold uppercase tracking-wide text-[10px] mr-1">Cc</span>
                      {m.cc_emails!.join(', ')}
                    </span>
                  )}
                  {(m.cc_emails?.length ?? 0) > 0 && (m.bcc_emails?.length ?? 0) > 0 && (
                    <span className="text-slate-300 mx-1">·</span>
                  )}
                  {(m.bcc_emails?.length ?? 0) > 0 && (
                    <span>
                      <span className="font-semibold uppercase tracking-wide text-[10px] mr-1">Bcc</span>
                      {m.bcc_emails!.join(', ')}
                    </span>
                  )}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                {m.opens_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <EnvelopeOpenIcon className="h-3.5 w-3.5" />
                    {m.opens_count}× geopend
                  </span>
                )}
                {m.clicks_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-sky-600">
                    <CursorArrowRippleIcon className="h-3.5 w-3.5" />
                    {m.clicks_count}× klik
                  </span>
                )}
                {m.opens_count === 0 && m.clicks_count === 0 && m.status === 'sent' && (
                  <span className="text-slate-400">Nog niet geopend</span>
                )}
                {m.status === 'failed' && m.error && (
                  <span className="inline-flex min-w-0 items-center gap-1 text-rose-600">
                    <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 truncate">{m.error}</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => loadDetail(m.id)}
                  className="ml-auto inline-flex shrink-0 items-center gap-1 text-slate-500 hover:text-slate-900"
                >
                  <EyeIcon className="h-3.5 w-3.5" /> Bekijk
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {activeId && (
        <DetailModal
          loading={detailLoading}
          email={activeDetail}
          onClose={() => {
            setActiveId(null);
            setActiveDetail(null);
          }}
        />
      )}
    </div>
  );
}

function DetailModal({
  loading,
  email,
  onClose,
}: {
  loading: boolean;
  email: DetailEmail | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex h-[min(90vh,56rem)] w-full max-w-3xl max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div className="min-w-0 flex-1">
            {loading || !email ? (
              <div className="h-5 w-2/3 animate-pulse rounded bg-slate-100" />
            ) : (
              <>
                <h3 className="font-bold text-slate-900 truncate">{email.subject}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Naar {email.to_email}
                  {email.from_admin && ` · van ${email.from_admin.name}`} ·{' '}
                  {timeFmt(email.created_at)}
                </p>
                {(email.cc_emails?.length ?? 0) > 0 && (
                  <p className="text-[11px] text-slate-500 mt-1 break-all">
                    <span className="font-semibold uppercase tracking-wide text-[10px] mr-1">Cc</span>
                    {email.cc_emails!.join(', ')}
                  </p>
                )}
                {(email.bcc_emails?.length ?? 0) > 0 && (
                  <p className="text-[11px] text-slate-500 mt-1 break-all">
                    <span className="font-semibold uppercase tracking-wide text-[10px] mr-1">Bcc</span>
                    {email.bcc_emails!.join(', ')}
                  </p>
                )}
                {email.opens_count > 0 || email.clicks_count > 0 ? (
                  <p className="text-[11px] text-slate-500 mt-1 inline-flex items-center gap-3">
                    {email.opens_count > 0 && (
                      <span className="text-emerald-600 inline-flex items-center gap-1">
                        <EnvelopeOpenIcon className="h-3.5 w-3.5" />
                        {email.opens_count}× geopend
                        {email.last_opened_at && ` · laatst ${timeFmt(email.last_opened_at)}`}
                      </span>
                    )}
                    {email.clicks_count > 0 && (
                      <span className="text-sky-600 inline-flex items-center gap-1">
                        <CheckBadgeIcon className="h-3.5 w-3.5" />
                        {email.clicks_count}× geklikt
                      </span>
                    )}
                  </p>
                ) : null}
              </>
            )}
          </div>
          <button onClick={onClose} className="inline-flex items-center justify-center p-2.5 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-100">
            <XMarkIcon className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <div className="min-h-0 flex-1 bg-slate-100 p-3">
          {loading || !email ? (
            <div className="p-8 text-sm text-slate-500">Laden…</div>
          ) : (
            <iframe
              title="email-html"
              className="h-full min-h-[50vh] w-full rounded-xl border border-slate-200 bg-white"
              srcDoc={email.html}
              sandbox="allow-same-origin"
            />
          )}
        </div>
      </div>
    </div>
  );
}
