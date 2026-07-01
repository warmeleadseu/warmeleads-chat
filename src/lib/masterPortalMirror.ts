import type { createServerClient } from './supabase';

type SupabaseClient = ReturnType<typeof createServerClient>;

/**
 * Bron-label voor "mirror"-toewijzingen: een kopie van een lead die in een
 * master-portaal zichtbaar moet zijn, náást de normale distributie.
 *
 * BELANGRIJK: `distribution.ts` sluit `source='mirror'` expliciet uit bij het
 * tellen van de verdeel-cap / cooldown, zodat een mirror-toewijzing nooit een
 * "echte" klantslot van een lead opsnoept. Wijzig dit label dus alleen samen
 * met die filters mee.
 */
export const MIRROR_ASSIGNMENT_SOURCE = 'mirror';

/**
 * Master-portalen die automatisch álle leads van een branche in hun portaal
 * moeten zien (bovenop de gewone distributie naar echte klanten).
 *
 * Deze mirror-toewijzingen:
 *   - tellen NIET mee voor de verdeel-cap / 30-dagen cooldown;
 *   - hebben geen batch en beïnvloeden geen batch-progressie;
 *   - zijn idempotent (max. één toewijzing per lead per master-klant).
 *
 * Key = `leads.branch`, value = `customers.id` van het master-portaal.
 */
export const MASTER_PORTAL_MIRROR_BY_BRANCH: Record<string, string> = {
  // Alle kozijnen-leads spiegelen naar het WarmeLeads.eu-portaal.
  kozijnen: 'c427431f-ac33-43cd-be22-43b46cb7b0bd',
};

/** Master-klant-id voor deze branche, of null als er geen mirror is ingesteld. */
export function getMirrorCustomerIdForBranch(branch: string | null | undefined): string | null {
  if (!branch) return null;
  return MASTER_PORTAL_MIRROR_BY_BRANCH[branch] ?? null;
}

/**
 * Zorgt dat de lead (idempotent) als mirror-toewijzing in het bijbehorende
 * master-portaal staat. Doet niets voor demo-leads of branches zonder mirror.
 * Faalt stil (logt alleen) zodat het nooit de distributie blokkeert.
 */
export async function mirrorLeadToMasterPortal(
  supabase: SupabaseClient,
  lead: { id: string; branch?: string | null; bron?: string | null },
): Promise<void> {
  if (!lead?.id) return;
  if (lead.bron === 'demo') return;

  const customerId = getMirrorCustomerIdForBranch(lead.branch);
  if (!customerId) return;

  // Idempotent: nooit dubbel toewijzen aan hetzelfde master-portaal (ongeacht
  // de bron, zodat een eerdere handmatige/bulk-toewijzing ook telt).
  const { data: existing } = await supabase
    .from('lead_assignments')
    .select('id')
    .eq('lead_id', lead.id)
    .eq('customer_id', customerId)
    .limit(1)
    .maybeSingle();
  if (existing) return;

  const { error } = await supabase.from('lead_assignments').insert({
    lead_id: lead.id,
    customer_id: customerId,
    source: MIRROR_ASSIGNMENT_SOURCE,
    status: 'nieuw',
  });
  if (error) {
    console.error('[masterPortalMirror] insert mislukt:', error.message, {
      leadId: lead.id,
      customerId,
    });
  }
}
