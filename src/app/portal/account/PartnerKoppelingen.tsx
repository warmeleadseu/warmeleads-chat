'use client';

import { useCallback, useEffect, useState } from 'react';
import { portalFetch } from '@/lib/portalAuth';
import { PARTNERS } from '@/lib/integrations/partners/registry';
import PartnerKoppelingKaart, { type PartnerApi, type PartnerStatusData } from '@/components/integrations/PartnerKoppelingKaart';
import { PortalSection } from '../_ui';

/**
 * Partnerkoppelingen in het klantportaal, zoals Snelraak (automatische
 * leadopvolging via WhatsApp). Alleen voor de accounteigenaar, net als de
 * andere koppelingen.
 */

async function lees<T>(res: Response): Promise<T & { error?: string }> {
  return (await res.json().catch(() => ({}))) as T & { error?: string };
}

function apiVoor(id: string): PartnerApi {
  const basis = `/api/portal/integrations/partners/${id}`;
  return {
    opslaan: async body => {
      const res = await portalFetch(basis, { method: 'PUT', body: JSON.stringify(body) });
      const d = await lees<PartnerStatusData>(res);
      return res.ok ? { ok: true, status: d } : { ok: false, fout: d.error };
    },
    testen: async body => {
      const res = await portalFetch(`${basis}/test`, { method: 'POST', body: JSON.stringify(body) });
      const d = await lees<{ ok: boolean; melding: string; ms: number }>(res);
      return res.ok ? d : { ok: false, melding: d.error ?? 'Testen mislukt', ms: 0 };
    },
    opnieuw: async () => {
      const res = await portalFetch(`${basis}/opnieuw`, { method: 'POST' });
      const d = await lees<{ gelukt: number; mislukt: number; resterend: number }>(res);
      return res.ok ? { ok: true, ...d } : { ok: false, fout: d.error };
    },
    ontkoppelen: async () => {
      const res = await portalFetch(basis, { method: 'DELETE' });
      const d = await lees<object>(res);
      return res.ok ? { ok: true } : { ok: false, fout: d.error };
    },
  };
}

export function PartnerKoppelingen({ isOwner }: { isOwner: boolean }) {
  const [statussen, setStatussen] = useState<Record<string, PartnerStatusData | null>>({});
  const [laden, setLaden] = useState(true);

  const laad = useCallback(async (id?: string) => {
    const ids = id ? [id] : PARTNERS.map(p => p.id);
    const nieuw: Record<string, PartnerStatusData | null> = {};
    await Promise.all(ids.map(async pid => {
      const res = await portalFetch(`/api/portal/integrations/partners/${pid}`, { cache: 'no-store' });
      nieuw[pid] = res.ok ? await res.json() : null;
    }));
    setStatussen(s => ({ ...s, ...nieuw }));
    setLaden(false);
  }, []);

  useEffect(() => { if (isOwner) void laad(); }, [isOwner, laad]);

  if (!isOwner) return null;

  return (
    <PortalSection
      eyebrow="Partnerkoppelingen"
      title="Automatische opvolging"
      description="Laat elke nieuwe lead direct doorgaan naar een partner die de opvolging voor je start."
    >
      {laden ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      ) : (
        <div className="space-y-4">
          {PARTNERS.map(p => {
            const s = statussen[p.id];
            if (!s) return null;
            return (
              <PartnerKoppelingKaart
                key={p.id}
                status={s}
                api={apiVoor(p.id)}
                onBijgewerkt={nieuw => (nieuw ? setStatussen(x => ({ ...x, [p.id]: nieuw })) : void laad(p.id))}
              />
            );
          })}
        </div>
      )}
    </PortalSection>
  );
}
