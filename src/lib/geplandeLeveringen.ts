import type { SupabaseClient } from '@supabase/supabase-js';
import { assignLeadToBatch } from './assignLeadToBatch';
import { effectiveMaxAssignments, recentDistinctCustomerIds } from './assignmentCap';
import { MIRROR_ASSIGNMENT_SOURCE } from './masterPortalMirror';
import { sendLeadNotification } from './email';
import { sendNewLeadPush } from './pushNotification';

/**
 * Werkt de wachtrij `geplande_leadleveringen` af: leveringen die op een
 * afgesproken moment mogen plaatsvinden in plaats van meteen.
 *
 * Waarom dit bestaat: een inhaalslag gedoseerd afleveren (bijvoorbeeld één lead
 * per dag gedurende een week) deed ik eerder met een script op een laptop. Dat
 * overleeft geen herstart. Nu staat het plan in de database en pikt de cron elke
 * kwartier op wat aan de beurt is.
 *
 * De gewone verdeelregels gelden op het moment van leveren, niet op het moment
 * van plannen. Een lead die intussen zijn derde klant heeft gekregen, gaat dus
 * niet alsnog; die rij wordt overgeslagen met de reden erbij. Beter een
 * zichtbaar overgeslagen levering dan een stilzwijgende regelovertreding.
 */

export type GeplandeLeveringResultaat = {
  bekeken: number;
  geleverd: number;
  overgeslagen: number;
};

/** Hoeveel rijen we per cronronde maximaal afwerken; houdt de looptijd kort. */
const MAX_PER_RONDE = 25;

type Rij = {
  id: string;
  lead_id: string;
  customer_id: string;
  batch_id: string | null;
  pogingen: number;
};

export async function verwerkGeplandeLeveringen(
  supabase: SupabaseClient,
): Promise<GeplandeLeveringResultaat> {
  const nu = new Date().toISOString();

  const { data: rijen, error } = await supabase
    .from('geplande_leadleveringen')
    .select('id, lead_id, customer_id, batch_id, pogingen')
    .eq('status', 'gepland')
    .lte('gepland_voor', nu)
    .order('gepland_voor', { ascending: true })
    .limit(MAX_PER_RONDE);

  if (error) {
    /* Ontbreekt de tabel (migratie nog niet gedraaid), dan is dat geen reden om
       de hele cron te laten vallen. */
    console.error('[geplandeLeveringen] ophalen mislukt:', error.message);
    return { bekeken: 0, geleverd: 0, overgeslagen: 0 };
  }
  if (!rijen?.length) return { bekeken: 0, geleverd: 0, overgeslagen: 0 };

  let geleverd = 0;
  let overgeslagen = 0;

  for (const rij of rijen as Rij[]) {
    const uitkomst = await leverEenRij(supabase, rij);
    if (uitkomst === 'geleverd') geleverd++;
    else overgeslagen++;
  }

  return { bekeken: rijen.length, geleverd, overgeslagen };
}

async function leverEenRij(supabase: SupabaseClient, rij: Rij): Promise<'geleverd' | 'overgeslagen'> {
  const markeer = async (status: string, reden: string | null, extra?: Record<string, unknown>) => {
    await supabase
      .from('geplande_leadleveringen')
      .update({ status, laatste_reden: reden, pogingen: rij.pogingen + 1, ...(extra || {}) })
      .eq('id', rij.id);
  };

  const { data: lead } = await supabase.from('leads').select('*').eq('id', rij.lead_id).maybeSingle();
  if (!lead) {
    await markeer('overgeslagen', 'lead bestaat niet meer');
    return 'overgeslagen';
  }

  const { data: klant } = await supabase
    .from('customers')
    .select('id, name, email, branches, is_active, email_notifications')
    .eq('id', rij.customer_id)
    .maybeSingle();
  if (!klant || klant.is_active === false) {
    await markeer('overgeslagen', 'klant bestaat niet of is inactief');
    return 'overgeslagen';
  }

  /* Plafond van drie klanten per lead: geldt op het moment van leveren. Tussen
     plannen en leveren kan een andere klant de lead hebben gekregen. */
  const { data: bestaand } = await supabase
    .from('lead_assignments')
    .select('customer_id, assigned_at')
    .neq('source', MIRROR_ASSIGNMENT_SOURCE)
    .eq('lead_id', rij.lead_id);

  const distinct = recentDistinctCustomerIds(bestaand || []);
  if (distinct.has(rij.customer_id)) {
    await markeer('overgeslagen', 'lead was al aan deze klant toegewezen');
    return 'overgeslagen';
  }
  if (distinct.size >= effectiveMaxAssignments(lead)) {
    await markeer('overgeslagen', `plafond bereikt: lead staat al bij ${distinct.size} klanten`);
    return 'overgeslagen';
  }

  const resultaat = await assignLeadToBatch({
    supabase,
    lead,
    customer: { id: klant.id, branches: (klant.branches as string[] | null) ?? null },
    batchId: rij.batch_id,
    source: 'distribution',
  });

  if (!resultaat.ok) {
    await markeer('overgeslagen', `${resultaat.code}: ${resultaat.reason}`);
    return 'overgeslagen';
  }

  await markeer('geleverd', null, {
    geleverd_op: new Date().toISOString(),
    assignment_id: resultaat.assignmentId,
  });

  /* Zelfde melding als bij een gewone levering: de klant moet niet hoeven
     ontdekken dat er een lead in zijn portaal staat. */
  try {
    if (klant.email && klant.email_notifications) {
      sendLeadNotification(klant as never, lead as never);
    }
    sendNewLeadPush(klant.id, lead as never).catch(() => {});
  } catch {
    /* een mislukte melding mag de levering niet ongedaan maken */
  }

  return 'geleverd';
}
