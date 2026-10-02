import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase';
import { resolveStreetName } from '@/lib/pdok';
import { getWebhookDynamicFields } from '../outboundWebhook/branchFields';
import { INTERNAL_CF_KEYS } from '@/lib/leadExportTable';
import { partnerOpProvider, PARTNERS } from './registry';
import { binnenLeverperiode, brancheToegestaan, haalPartnerConfig, partnerKlaar } from './repo';
import { verstuurNaarPartner } from './transport';
import { verbergGeheim } from './verberg';
import type { PartnerDefinitie, PartnerLead, PartnerUitslag } from './types';

/** Gelijk aan het maximum van de retry-cron: daarna wordt een levering niet meer geprobeerd. */
export const PARTNER_MAX_POGINGEN = 8;

/**
 * Tijdelijke fout bij een partner. De retry-cron probeert het later opnieuw;
 * `wachtSeconden` (bij 429) laat de cron de rest van de ronde met rust.
 */
export class PartnerTijdelijkFout extends Error {
  constructor(message: string, public readonly wachtSeconden: number | null = null) {
    super(message);
    this.name = 'PartnerTijdelijkFout';
  }
}

export type PartnerSyncUitkomst = 'gelukt' | 'overgeslagen' | 'blijvend' | 'tijdelijk';

type Args = {
  partner: PartnerDefinitie;
  customerId: string;
  leadId: string;
  assignmentId: string;
  supabase?: SupabaseClient;
};

/**
 * Levert één toewijzing af bij een partner.
 *
 * Idempotent per (toewijzing, partner) via integration_sync_log. Een tijdelijke
 * fout gooit, zodat de retry-cron hem oppakt; een blijvende fout (verkeerd
 * adres, geweigerde inhoud) wordt vastgelegd met het maximum aantal pogingen,
 * zodat we niet blijven aankloppen tot iemand het adres herstelt.
 */
export async function leverAanPartner(args: Args): Promise<PartnerSyncUitkomst> {
  const supabase = args.supabase ?? createServerClient();
  const { partner, customerId, leadId, assignmentId } = args;

  const config = await haalPartnerConfig(supabase, customerId, partner);
  if (!partnerKlaar(config)) return 'overgeslagen';

  const { data: toewijzing } = await supabase
    .from('lead_assignments')
    .select('id, customer_id, lead_id, assigned_at')
    .eq('id', assignmentId)
    .maybeSingle();
  if (!toewijzing || toewijzing.customer_id !== customerId || toewijzing.lead_id !== leadId) return 'overgeslagen';

  const { data: bestaandLog } = await supabase
    .from('integration_sync_log')
    .select('id, status, attempts')
    .eq('assignment_id', assignmentId)
    .eq('provider', partner.provider)
    .maybeSingle();
  if (bestaandLog?.status === 'success') return 'overgeslagen';

  /* Van vóór de leverperiode (pauze) of te oud voor opvolging: bewust niet
     versturen. Een
     openstaande logregel ruimen we op; anders bleef hij voor altijd in de
     wachtrij staan en pakte de cron hem elke ronde opnieuw op. */
  const teOud = toewijzing.assigned_at
    && Date.now() - new Date(toewijzing.assigned_at).getTime() > partner.maxLeeftijdUren * 3_600_000;
  if (teOud || !binnenLeverperiode(config.settings, toewijzing.assigned_at)) {
    if (bestaandLog?.id) await supabase.from('integration_sync_log').delete().eq('id', bestaandLog.id);
    return 'overgeslagen';
  }

  const { data: leadRij } = await supabase.from('leads').select('*').eq('id', leadId).maybeSingle();
  const lead = leadRij as (PartnerLead & { bron?: string | null }) | null;
  if (!lead || lead.bron === 'demo') return 'overgeslagen';
  if (!brancheToegestaan(config.settings, lead.branch)) return 'overgeslagen';

  const nu = new Date().toISOString();
  const pogingen = (Number(bestaandLog?.attempts) || 0) + 1;
  const logBasis = {
    customer_id: customerId,
    lead_id: leadId,
    assignment_id: assignmentId,
    provider: partner.provider,
    status: 'pending' as const,
    attempts: pogingen,
    updated_at: nu,
  };
  if (bestaandLog?.id) {
    /* Claimen: alleen doorgaan als niemand anders deze regel net oppakt (een
       gelijktijdige directe levering, cronronde of "opnieuw proberen"). Een
       regel die al twee minuten op pending staat is blijven hangen en mag
       worden overgenomen. */
    const grens = new Date(Date.now() - 2 * 60_000).toISOString();
    const { data: geclaimd } = await supabase
      .from('integration_sync_log')
      .update(logBasis)
      .eq('id', bestaandLog.id)
      .or(`status.neq.pending,updated_at.lt.${grens}`)
      .select('id');
    if (!geclaimd || geclaimd.length === 0) return 'overgeslagen';
  } else {
    const { error } = await supabase.from('integration_sync_log').insert(logBasis);
    /* Een gelijktijdige poging heeft de rij net aangemaakt: die gaat voor. */
    if (error?.code === '23505') return 'overgeslagen';
  }

  const schrijf = (status: 'success' | 'failed', melding: string | null, extra: Record<string, unknown> = {}) =>
    supabase
      .from('integration_sync_log')
      .update({
        status,
        error_message: melding ? verbergGeheim(melding, config.token).slice(0, 1000) : null,
        updated_at: new Date().toISOString(),
        ...extra,
      })
      .eq('assignment_id', assignmentId)
      .eq('provider', partner.provider);

  let uitslag: PartnerUitslag;
  try {
    const payload = partner.bouwPayload(lead, await payloadContext(supabase, lead));
    const antwoord = await verstuurNaarPartner(partner.bouwUrl(config.token), payload, {
      timeoutMs: partner.timeoutMs,
      idempotencyKey: assignmentId,
    });
    uitslag = partner.beoordeel(antwoord);
  } catch (err) {
    uitslag = { soort: 'tijdelijk', melding: err instanceof Error ? err.message : 'Levering mislukt' };
  }

  if (uitslag.soort === 'gelukt') {
    await schrijf('success', null);
    return 'gelukt';
  }
  if (uitslag.soort === 'blijvend') {
    await schrijf('failed', uitslag.melding, { attempts: PARTNER_MAX_POGINGEN });
    console.warn(`[partner:${partner.id}] blijvende fout, geen nieuwe pogingen`, { customerId, assignmentId });
    return 'blijvend';
  }
  await schrijf('failed', uitslag.melding);
  throw new PartnerTijdelijkFout(uitslag.melding, uitslag.wachtSeconden ?? null);
}

/** Straat, branchenaam en de branchevragen die mee mogen. */
async function payloadContext(supabase: SupabaseClient, lead: PartnerLead) {
  const cf = lead.custom_fields ?? {};
  const opgeslagen = cf.straat ?? cf.street ?? cf.adres;
  let straat = typeof opgeslagen === 'string' && opgeslagen.trim() ? opgeslagen.trim() : null;
  if (!straat && lead.postcode && lead.huisnummer) {
    straat = await resolveStreetName(lead.postcode, lead.huisnummer, {
      land: (lead.land as 'NL' | 'BE' | null) ?? null,
    }).catch(() => null);
  }

  let brancheNaam: string | null = null;
  let toegestaneVelden: { key: string; label: string }[] = [];
  if (lead.branch) {
    const { data: b } = await supabase.from('branches').select('name').eq('slug', lead.branch).maybeSingle();
    brancheNaam = (b?.name as string | undefined) ?? null;
    toegestaneVelden = (await getWebhookDynamicFields(supabase, [lead.branch]))
      .filter(v => !INTERNAL_CF_KEYS.has(v.key) && !['straat', 'street', 'adres'].includes(v.key));
  }
  return { straat, brancheNaam, toegestaneVelden };
}

/**
 * Direct na toewijzing: lever af bij elke partner die voor deze klant aanstaat.
 *
 * Bij een tijdelijke fout één snelle herkansing na enkele seconden. Een partner
 * als Snelraak stuurt binnen een minuut een WhatsApp-bericht; wachten tot de
 * retry-cron (elke twee uur) maakt de opvolging waardeloos.
 */
export async function leverAanAllePartners(args: { customerId: string; leadId: string; assignmentId: string }): Promise<void> {
  const supabase = createServerClient();
  const { data: rijen } = await supabase
    .from('customer_integrations')
    .select('provider')
    .eq('customer_id', args.customerId)
    .in('provider', PARTNERS.map(p => p.provider));

  for (const r of rijen || []) {
    const partner = partnerOpProvider(r.provider as string);
    if (!partner) continue;
    try {
      await leverAanPartner({ ...args, partner, supabase });
    } catch (err) {
      if (err instanceof PartnerTijdelijkFout) {
        /* Bij 429 de gevraagde wachttijd, hooguit 30 seconden. */
        const wacht = err.wachtSeconden != null ? Math.min(30, err.wachtSeconden) * 1000 : 3_000;
        await new Promise(klaar => setTimeout(klaar, wacht));
        await leverAanPartner({ ...args, partner, supabase }).catch(() => {
          /* de retry-cron neemt het over; de fout staat al in het synclog */
        });
      }
    }
  }
}

/**
 * Een reeks toewijzingen direct afleveren, met een pauze ertussen voor de
 * limiet van de partner. Voor "opnieuw proberen" en nasturen; stopt bij een
 * 429 of als de tijd op is. Wat overblijft pakt de retry-cron op.
 */
export async function leverReeks(
  supabase: SupabaseClient,
  partner: PartnerDefinitie,
  customerId: string,
  toewijzingen: { id: string; lead_id: string }[],
  maxMs = 40_000,
): Promise<{ gelukt: number; mislukt: number; resterend: number }> {
  const start = Date.now();
  let gelukt = 0;
  let mislukt = 0;
  let i = 0;
  for (; i < toewijzingen.length; i++) {
    if (Date.now() - start > maxMs) break;
    if (i > 0) await new Promise(klaar => setTimeout(klaar, partner.pauzeMs));
    const t = toewijzingen[i];
    try {
      const u = await leverAanPartner({ partner, customerId, leadId: t.lead_id, assignmentId: t.id, supabase });
      if (u === 'gelukt') gelukt++;
      else if (u === 'blijvend') mislukt++;
    } catch (err) {
      mislukt++;
      if (err instanceof PartnerTijdelijkFout && err.wachtSeconden != null) { i++; break; }
    }
  }
  return { gelukt, mislukt, resterend: toewijzingen.length - i };
}
