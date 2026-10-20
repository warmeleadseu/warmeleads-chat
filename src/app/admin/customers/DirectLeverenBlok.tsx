'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BoltIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { useAdmin } from '../adminContext';
import { useAdminConfirm } from '@/components/admin/ui/AdminConfirmProvider';

/**
 * Direct leveren in de klantkaart: krijgt deze klant een passende lead bij
 * binnenkomst altijd als eerste, binnen een minuut. Per batch te
 * overschrijven (batchformulier). Alleen superadmin en admin schakelen;
 * accountmanagers zien de stand.
 */

type Batch = { id: string; branch: string; status: string; direct_leveren?: string | null; batch_kind?: string | null };

function datum(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

export default function DirectLeverenBlok({
  customerId,
  klantNaam,
  aan,
  sinds,
  onGewijzigd,
}: {
  customerId: string;
  klantNaam: string;
  aan: boolean;
  sinds: string | null;
  onGewijzigd: () => void;
}) {
  const { user } = useAdmin();
  const { confirm } = useAdminConfirm();
  const magWijzigen = user.role === 'superadmin' || user.role === 'admin';
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [afwijkend, setAfwijkend] = useState<Batch[]>([]);

  const laadBatches = useCallback(async () => {
    const res = await adminFetch(`/api/admin/batches?customer_id=${customerId}`, { cache: 'no-store' });
    if (!res.ok) return;
    const lijst = ((await res.json().catch(() => [])) as Batch[]) || [];
    setAfwijkend(lijst.filter(b => (b.batch_kind ?? 'leads') === 'leads' && ['active', 'paused'].includes(b.status) && (b.direct_leveren === 'aan' || b.direct_leveren === 'uit')));
  }, [customerId]);
  useEffect(() => { void laadBatches(); }, [laadBatches]);

  const wissel = async () => {
    const nieuw = !aan;
    const zeker = await confirm({
      title: nieuw ? `${klantNaam} direct leveren?` : 'Direct leveren uitzetten?',
      message: nieuw
        ? 'Past een nieuwe lead bij deze klant, dan krijgt hij hem altijd als eerste, binnen een minuut. Andere klanten volgen zoals altijd pas na 12 uur. Dagmaximum, gebied en filters blijven gelden.'
        : 'Nieuwe leads gaan weer via de gewone verdeling. Batches die zelf op "altijd direct" staan, blijven direct.',
      confirmLabel: nieuw ? 'Aanzetten' : 'Uitzetten',
      destructive: !nieuw,
    });
    if (!zeker) return;
    setBezig(true);
    setFout(null);
    try {
      const res = await adminFetch('/api/admin/customers', { method: 'PUT', body: JSON.stringify({ id: customerId, direct_leveren: nieuw }) });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setFout(d.error || 'Opslaan mislukt');
        return;
      }
      onGewijzigd();
    } catch {
      setFout('Netwerkfout bij opslaan');
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className={`rounded-lg border p-4 ${aan ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-100 bg-slate-50/70'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${aan ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
            <BoltIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-700">Direct leveren</p>
            <p className="text-[11px] text-slate-400">
              {aan ? `Aan${sinds ? ` sinds ${datum(sinds)}` : ''}: krijgt passende leads als eerste, binnen een minuut` : 'Uit: gewone verdeling'}
            </p>
          </div>
        </div>
        {magWijzigen ? (
          <button
            type="button"
            role="switch"
            aria-checked={aan}
            aria-label={aan ? 'Direct leveren uitzetten' : 'Direct leveren aanzetten'}
            onClick={() => void wissel()}
            disabled={bezig}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${aan ? 'bg-emerald-500' : 'bg-slate-300'}`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${aan ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </button>
        ) : (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${aan ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{aan ? 'Aan' : 'Uit'}</span>
        )}
      </div>

      {afwijkend.length > 0 && (
        <div className="mt-3 space-y-1 text-xs text-slate-600">
          <p className="text-[11px] font-medium text-slate-500">Batches die afwijken van de klantkaart:</p>
          {afwijkend.map(b => (
            <p key={b.id}>
              <span className="font-medium">{b.branch}</span> ({b.status === 'paused' ? 'gepauzeerd' : 'actief'}):{' '}
              {b.direct_leveren === 'aan' ? <span className="text-emerald-700">altijd direct</span> : <span className="text-slate-500">nooit direct</span>}
            </p>
          ))}
        </div>
      )}

      {fout && <p className="mt-2 text-xs text-red-600">{fout}</p>}

      <Link href="/admin/direct-leveren" className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-600">
        Resultaten vergelijken <ArrowTopRightOnSquareIcon className="h-3 w-3" />
      </Link>
    </div>
  );
}
