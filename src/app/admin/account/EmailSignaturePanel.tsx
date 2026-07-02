'use client';

import { useEffect, useRef, useState } from 'react';
import { EnvelopeIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

interface SigData {
  has_override: boolean;
  override_html: string;
  default_html: string;
}

export function EmailSignaturePanel() {
  const [data, setData] = useState<SigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const previewRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await adminFetch('/api/admin/me/email-signature');
        if (!res.ok) throw new Error('Kon handtekening niet ophalen');
        const j = (await res.json()) as SigData;
        if (active) {
          setData(j);
          setDraft(j.has_override ? j.override_html : j.default_html);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Onbekende fout');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Preview rendering
  useEffect(() => {
    const iframe = previewRef.current;
    if (!iframe || !data) return;
    const html = editing ? draft : data.has_override ? data.override_html : data.default_html;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(`<!doctype html><html><body style="margin:0;padding:24px;font-family:Inter,Arial,sans-serif">${html}</body></html>`);
    doc.close();
  }, [data, editing, draft]);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await adminFetch('/api/admin/me/email-signature', {
        method: 'PUT',
        body: JSON.stringify({ html: draft }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Opslaan mislukt');
      setData(prev => (prev ? { ...prev, has_override: true, override_html: draft } : prev));
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onbekende fout');
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!confirm('Standaard-handtekening terugzetten? Je override gaat verloren.')) return;
    setSaving(true);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/me/email-signature', {
        method: 'PUT',
        body: JSON.stringify({ clear: true }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Verwijderen mislukt');
      }
      const refreshed = await adminFetch('/api/admin/me/email-signature').then(r => r.json());
      setData(refreshed);
      setDraft(refreshed.default_html);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onbekende fout');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-500">Laden…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-rose-600">{error || 'Kon gegevens niet laden.'}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <EnvelopeIcon className="w-5 h-5 text-slate-500" />
          <h2 className="text-base font-bold text-slate-900">E-mail-handtekening</h2>
          {data.has_override && (
            <span className="text-[10px] uppercase tracking-wide font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
              Eigen versie
            </span>
          )}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Bewerken
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500 mb-4">
        Deze handtekening wordt automatisch onder elke mail die je via het CRM verstuurt geplakt.
        De standaard-versie gebruikt je naam, titel, telefoon en avatar uit je profiel.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {editing && (
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">HTML</label>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={18}
              spellCheck={false}
              className="w-full rounded-lg border border-slate-200 bg-slate-900 text-slate-100 px-3 py-2 text-xs font-mono"
            />
            <p className="mt-2 text-[11px] text-slate-400">
              Tip: gebruik inline-styles. Scripts en event-handlers worden geweigerd.
            </p>
          </div>
        )}

        <div className={editing ? '' : 'lg:col-span-2'}>
          <p className="text-xs font-semibold text-slate-700 mb-1">Voorbeeld</p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
            <iframe
              ref={previewRef}
              title="signature-preview"
              className="w-full bg-white"
              style={{ height: 320 }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700 flex items-center gap-2">
          <ExclamationCircleIcon className="w-4 h-4" /> {error}
        </div>
      )}
      {saved && (
        <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4" /> Opgeslagen
        </div>
      )}

      {editing && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-button-gradient px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-60"
          >
            {saving ? 'Opslaan…' : 'Opslaan'}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setDraft(data.has_override ? data.override_html : data.default_html);
            }}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Annuleren
          </button>
          {data.has_override && (
            <button
              type="button"
              onClick={reset}
              className="ml-auto rounded-lg border border-rose-200 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
            >
              Standaard terugzetten
            </button>
          )}
        </div>
      )}
    </div>
  );
}
