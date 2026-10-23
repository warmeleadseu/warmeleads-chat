import type { SupabaseClient } from '@supabase/supabase-js';
import { assignLeadToBatch } from './assignLeadToBatch';
import { batchIsAtCapacity } from './batchDeliveryModel';
import { effectiveMaxAssignments, recentDistinctCustomerIds } from './assignmentCap';
import { MIRROR_ASSIGNMENT_SOURCE } from './masterPortalMirror';
import { sendLeadNotification } from './email';
import { sendNewLeadPush } from './pushNotification';
import { inhaalslagWeigering } from './verdeelGrenzen';
import { vroegsteMoment } from './inhaalslagPlanning';
import { buitenDeNacht } from './leverSpreiding';
import { campagneWeigering, exclusiviteitVan, laadCampagneRegels, type CampagneRegels } from './campagneExclusiviteit';
import { getLeadLimitPeriodAnchors } from './batchAssignmentCaps';
import { assignToPortalUser } from './distribution';

/**
 * Werkt de wachtrij `geplande_leadleveringen` af: leveringen die op een
 * afgesproken moment mogen plaatsvinden in plaats van meteen.
 *
 * Waarom dit bestaat: een inhaalslag gedoseerd afleveren (bijvoorbeeld één lead
 * per dag gedurende een week) deed ik eerder met een script op een laptop. Dat
 * overleeft geen herstart. Nu staat het plan in de database en pikt een cron
 * elke minuut op wat aan de beurt is (zie /api/cron/geplande-leveringen), zodat
 * een lead aankomt op het willekeurige moment dat ervoor gekozen is.
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

/** Hoeveel rijen we per ronde maximaal afwerken; houdt de looptijd kort. */
const MAX_PER_RONDE = 25;

export type VerwerkOpties = {
  /** Alleen deze batch (bijvoorbeeld meteen na een lookback met spoed). */
  batchId?: string;
  max?: number;
  /** Na deze tijd geen nieuwe rij meer beginnen. */
  tijdBudgetMs?: number;
};

type Rij = {
  id: string;
  lead_id: string;
  customer_id: string;
  batch_id: string | null;
  pogingen: number;
  /* Restleads liggen bewust net buiten het doelgebied; zonder deze vlag zou
     assignLeadToBatch ze twaalf uur later netjes weigeren. */
  negeer_geo?: boolean | null;
  /**
   * inhaalslag: uit de terugkijkperiode van een batch; geen derde klant.
   * spreiding: door de verdeelronde verspreid (geen verse lead, of een extra
   * lead in dezelfde ronde); een tweede of derde klant mag, na de 12 uur.
   */
  soort?: string | null;
};

export async function verwerkGeplandeLeveringen(
  supabase: SupabaseClient,
  opties: VerwerkOpties = {},
): Promise<GeplandeLeveringResultaat> {
  const start = Date.now();
  const nu = new Date().toISOString();

  let query = supabase
    .from('geplande_leadleveringen')
    .select('id, lead_id, customer_id, batch_id, pogingen, negeer_geo, soort')
    .eq('status', 'gepland')
    .lte('gepland_voor', nu);
  if (opties.batchId) query = query.eq('batch_id', opties.batchId);
  const { data: rijen, error } = await query
    .order('gepland_voor', { ascending: true })
    .limit(opties.max ?? MAX_PER_RONDE);

  if (error) {
    /* Ontbreekt de tabel (migratie nog niet gedraaid), dan is dat geen reden om
       de hele cron te laten vallen. */
    console.error('[geplandeLeveringen] ophalen mislukt:', error.message);
    return { bekeken: 0, geleverd: 0, overgeslagen: 0 };
  }
  if (!rijen?.length) return { bekeken: 0, geleverd: 0, overgeslagen: 0 };

  let geleverd = 0;
  let overgeslagen = 0;

  /* Eén keer per ronde: de exclusieve en uitgesloten campagnes. Lukt dat
     niet, dan deze ronde niets leveren (een exclusieve lead mag niet bij een
     verkeerde klant belanden); de volgende minuut opnieuw. */
  let campagneRegels: CampagneRegels;
  try {
    campagneRegels = await laadCampagneRegels(supabase);
  } catch (err) {
    console.error('[geplandeLeveringen] campagneregels niet beschikbaar:', err instanceof Error ? err.message : err);
    return { bekeken: 0, geleverd: 0, overgeslagen: 0 };
  }

  let bekeken = 0;
  for (const rij of rijen as Rij[]) {
    if (opties.tijdBudgetMs && Date.now() - start > opties.tijdBudgetMs) break;
    bekeken++;
    const uitkomst = await leverEenRij(supabase, rij, campagneRegels);
    if (uitkomst === 'geleverd') geleverd++;
    else if (uitkomst === 'overgeslagen') overgeslagen++;
  }

  return { bekeken, geleverd, overgeslagen };
}

async function leverEenRij(supabase: SupabaseClient, rij: Rij, campagneRegels: CampagneRegels): Promise<'geleverd' | 'overgeslagen' | 'uitgesteld'> {
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

  /* Exclusieve of uitgesloten campagne, op het moment van leveren. Is de
     lead nog maar tijdelijk exclusief voor een andere batch, dan schuift de
     levering door tot daarna; anders overslaan. */
  if (rij.batch_id) {
    const weigering = campagneWeigering(rij.batch_id, lead, campagneRegels);
    if (weigering) {
      const excl = exclusiviteitVan(lead, campagneRegels);
      const verbodenDoorUitsluiting = campagneRegels.uitgesloten.get(rij.batch_id)?.has(String(lead.meta_campaign_id));
      if (excl?.tot && !verbodenDoorUitsluiting) {
        const later = buitenDeNacht(new Date(excl.tot.getTime() + Math.floor(Math.random() * 20 * 60_000)));
        await supabase.from('geplande_leadleveringen')
          .update({ gepland_voor: later.toISOString(), laatste_reden: 'uitgesteld: lead is nog exclusief voor een andere batch' })
          .eq('id', rij.id);
        return 'uitgesteld';
      }
      await markeer('overgeslagen', weigering);
      return 'overgeslagen';
    }
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

  /* Inhaalslag: dezelfde regels als bij het inplannen, opnieuw getoetst. Een
     andere klant kan de lead intussen hebben gekregen. Geen derde klant; en
     binnen 12 uur na een andere klant schuift de levering door naar het
     eerste moment dat het mag. */
  if (rij.soort === 'inhaalslag' || rij.soort === 'spreiding') {
    const nu = new Date();
    const weigering = inhaalslagWeigering(bestaand || [], rij.customer_id, nu);
    /* Alleen een inhaalslag maakt nooit een derde klant; een verspreide
       levering uit de verdeelronde mag dat wel (die koos de ronde zelf). */
    if (weigering === 'derde_klant' && rij.soort === 'inhaalslag') {
      await markeer('overgeslagen', 'lead heeft intussen al twee andere klanten');
      return 'overgeslagen';
    }
    if (weigering === 'pauze') {
      const vrij = vroegsteMoment(bestaand || [], rij.customer_id, nu);
      if (vrij) {
        /* Kort na het einde van de wachttijd, op een willekeurige minuut, en
           niet midden in de nacht. */
        const later = buitenDeNacht(new Date(vrij.getTime() + Math.floor(Math.random() * 15 * 60_000)));
        await supabase.from('geplande_leadleveringen')
          .update({ gepland_voor: later.toISOString(), laatste_reden: 'uitgesteld: 12 uur na de vorige klant' })
          .eq('id', rij.id);
        return 'uitgesteld';
      }
    }
  }

  /* Ruimte in de batch, op het moment van leveren. Tussen inplannen en leveren
     kan er een halve dag zitten en kan de batch zijn volgelopen; zonder deze
     controle levert de wachtrij er stilletjes overheen. assignLeadToBatch kijkt
     hier niet naar, want die wordt ook gebruikt door paden die bewust mogen
     overvullen. */
  if (rij.batch_id) {
    const { data: batch } = await supabase
      .from('customer_batches')
      .select('delivery_model, batch_kind, batch_size, leads_delivered, status, leads_per_day, leads_per_week')
      .eq('id', rij.batch_id)
      .maybeSingle();

    if (batch && batch.status !== 'active') {
      await markeer('overgeslagen', `batch is niet meer actief (${batch.status})`);
      return 'overgeslagen';
    }
    if (batch && batchIsAtCapacity(batch)) {
      await markeer('overgeslagen', 'batch is intussen vol');
      return 'overgeslagen';
    }
    /* Ingeplande inhaalslag-leads tellen mee voor het dagmaximum: is dat
       vandaag al bereikt (de gewone verdeling kan het hebben opgemaakt), dan
       deze niet meer. */
    const max = Number((batch as { leads_per_day?: number | null } | null)?.leads_per_day) || 0;
    const maxWeek = Number((batch as { leads_per_week?: number | null } | null)?.leads_per_week) || 0;
    const metRegels = rij.soort === 'inhaalslag' || rij.soort === 'spreiding';
    if (metRegels && (max > 0 || maxWeek > 0)) {
      const { dayStart, weekStart } = getLeadLimitPeriodAnchors(new Date());
      if (max > 0) {
        const { count } = await supabase
          .from('lead_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('batch_id', rij.batch_id)
          .gte('assigned_at', dayStart.toISOString());
        if ((count ?? 0) >= max) {
          await markeer('overgeslagen', `dagmaximum van ${max} bereikt`);
          return 'overgeslagen';
        }
      }
      if (maxWeek > 0) {
        const { count } = await supabase
          .from('lead_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('batch_id', rij.batch_id)
          .gte('assigned_at', weekStart.toISOString());
        if ((count ?? 0) >= maxWeek) {
          await markeer('overgeslagen', `weekmaximum van ${maxWeek} bereikt`);
          return 'overgeslagen';
        }
      }
    }
  }

  const resultaat = await assignLeadToBatch({
    supabase,
    lead,
    customer: { id: klant.id, branches: (klant.branches as string[] | null) ?? null },
    batchId: rij.batch_id,
    source: 'distribution',
    negeerGeo: rij.negeer_geo === true,
  });

  if (!resultaat.ok) {
    await markeer('overgeslagen', `${resultaat.code}: ${resultaat.reason}`);
    return 'overgeslagen';
  }

  await markeer('geleverd', null, {
    geleverd_op: new Date().toISOString(),
    assignment_id: resultaat.assignmentId,
  });

  /* Net als bij een gewone levering: volgens de toewijsregels van de klant
     meteen bij een medewerker. Dat ontbrak hier, waardoor een lead uit de
     wachtrij bij een team zonder eigenaar bleef staan. */
  assignToPortalUser(supabase as never, klant.id, lead as never).catch(() => {});

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
