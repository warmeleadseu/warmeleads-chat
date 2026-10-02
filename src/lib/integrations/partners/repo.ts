import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from '@/lib/integrations/tokenEncrypt';
import type { PartnerDefinitie, PartnerSettings } from './types';

export type PartnerConfig = {
  id: string;
  customer_id: string;
  /** Ontsleuteld geheim deel van de URL; null als niet ingesteld of onleesbaar. */
  token: string | null;
  settings: PartnerSettings;
  connected_at: string | null;
};

type Rij = {
  id: string;
  customer_id: string;
  access_token_enc: string | null;
  settings: PartnerSettings | null;
  connected_at: string | null;
};

function ontsleutel(rij: Rij): string | null {
  if (!rij.access_token_enc) return null;
  try {
    return decryptSecret(rij.access_token_enc);
  } catch {
    /* Geen details loggen: de fout zegt niets zinnigs en het geheim mag er niet in. */
    console.error('[partners] geheim kon niet worden ontsleuteld', { customerId: rij.customer_id });
    return null;
  }
}

export async function haalPartnerConfig(
  supabase: SupabaseClient,
  customerId: string,
  partner: PartnerDefinitie,
): Promise<PartnerConfig | null> {
  const { data } = await supabase
    .from('customer_integrations')
    .select('id, customer_id, access_token_enc, settings, connected_at')
    .eq('customer_id', customerId)
    .eq('provider', partner.provider)
    .maybeSingle();
  if (!data) return null;
  const rij = data as Rij;
  return {
    id: rij.id,
    customer_id: rij.customer_id,
    token: ontsleutel(rij),
    settings: rij.settings ?? {},
    connected_at: rij.connected_at,
  };
}

/** Klaar om te leveren: aangezet en een leesbaar adres. */
export function partnerKlaar(config: PartnerConfig | null): config is PartnerConfig & { token: string } {
  return Boolean(config && config.settings.enabled === true && config.token);
}

export function brancheToegestaan(settings: PartnerSettings, branch: string | null): boolean {
  const lijst = settings.branches ?? [];
  if (lijst.length === 0) return true;
  return branch != null && lijst.includes(branch);
}

/** Valt deze toewijzing binnen de periode waarvoor de koppeling levert? */
export function binnenLeverperiode(settings: PartnerSettings, assignedAt: string | null | undefined): boolean {
  if (!settings.leveren_vanaf) return true;
  if (!assignedAt) return true;
  return new Date(assignedAt).getTime() >= new Date(settings.leveren_vanaf).getTime();
}

export type PartnerOpslag = {
  /** Nieuw geheim; undefined = ongewijzigd. */
  token?: string;
  enabled?: boolean;
  branches?: string[];
  leveren_vanaf?: string | null;
};

export async function slaPartnerConfigOp(
  supabase: SupabaseClient,
  customerId: string,
  partner: PartnerDefinitie,
  invoer: PartnerOpslag,
): Promise<void> {
  const bestaand = await haalPartnerConfig(supabase, customerId, partner);
  const nu = new Date().toISOString();

  const settings: PartnerSettings = { ...(bestaand?.settings ?? {}) };
  if (invoer.enabled !== undefined) settings.enabled = invoer.enabled;
  if (invoer.branches !== undefined) settings.branches = invoer.branches;
  if (invoer.leveren_vanaf !== undefined) settings.leveren_vanaf = invoer.leveren_vanaf;

  const rij: Record<string, unknown> = {
    customer_id: customerId,
    provider: partner.provider,
    settings,
    updated_at: nu,
  };
  if (invoer.token !== undefined) {
    const versleuteld = encryptSecret(invoer.token);
    if (decryptSecret(versleuteld) !== invoer.token) throw new Error('Versleutelen van het adres mislukte');
    rij.access_token_enc = versleuteld;
  }
  const heeftToken = invoer.token !== undefined || Boolean(bestaand?.token);
  rij.connected_at = heeftToken ? bestaand?.connected_at ?? nu : null;

  const { error } = await supabase
    .from('customer_integrations')
    .upsert(rij, { onConflict: 'customer_id,provider' });
  if (error) throw new Error(error.message);

  /* Na een nieuw adres: wat mislukte gaat opnieuw in de wachtrij, met een
     schone teller. Zonder die reset bleef alles wat al acht keer was mislukt
     voor altijd liggen, ook als de oorzaak (het adres) verholpen was. Bij
     hervatten na een pauze niet: dan zou iemand dagen later alsnog een
     WhatsApp-bericht krijgen. Daarvoor is de knop "Opnieuw proberen". */
  if (invoer.token !== undefined) {
    await zetMisluktTerug(supabase, customerId, partner);
  }
  /* Gepauzeerd: wat nog openstond gaat ook later niet meer. Opruimen, anders
     blijven die regels in de wachtrij van de retry-cron staan en verdringen
     ze daar de herkansingen van andere koppelingen. */
  if (invoer.enabled === false) await ruimOpenstaandOp(supabase, customerId, partner);
}

export async function ruimOpenstaandOp(
  supabase: SupabaseClient,
  customerId: string,
  partner: PartnerDefinitie,
): Promise<void> {
  await supabase
    .from('integration_sync_log')
    .delete()
    .eq('customer_id', customerId)
    .eq('provider', partner.provider)
    .in('status', ['pending', 'failed']);
}

export async function zetMisluktTerug(
  supabase: SupabaseClient,
  customerId: string,
  partner: PartnerDefinitie,
): Promise<number> {
  const { data } = await supabase
    .from('integration_sync_log')
    .update({ status: 'pending', attempts: 0, error_message: null, updated_at: new Date().toISOString() })
    .eq('customer_id', customerId)
    .eq('provider', partner.provider)
    .eq('status', 'failed')
    .select('assignment_id');
  return data?.length ?? 0;
}

export async function verwijderPartnerConfig(
  supabase: SupabaseClient,
  customerId: string,
  partner: PartnerDefinitie,
): Promise<void> {
  const { error } = await supabase
    .from('customer_integrations')
    .delete()
    .eq('customer_id', customerId)
    .eq('provider', partner.provider);
  if (error) throw new Error(error.message);
  await ruimOpenstaandOp(supabase, customerId, partner);
}
