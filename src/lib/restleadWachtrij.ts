import type { SupabaseClient } from '@supabase/supabase-js';
import { COOLDOWN_UREN, herverdeel, type WachtrijItem } from './restleadPlanning';
import { RESTLEAD_REDEN } from './restleads';

/**
 * Smeert de openstaande Restleads-leveringen per klant per dag opnieuw uit.
 *
 * Draait na elke uitdeling vanaf de Restleads-pagina, omdat pas dan bekend is
 * hoeveel leveringen er die dag bij een klant samenkomen. Bewust niet in de
 * cron: die zou de rijen van vandaag elk kwartier opnieuw vooruit schuiven, en
 * dan wordt de eerste nooit bereikt.
 *
 * Alleen rijen uit dit scherm (reden begint met "Restleads:"). De wachtrij
 * wordt ook gebruikt voor gedoseerde inhaalslagen, en die hebben hun eigen,
 * bewust gekozen tijden.
 */
export async function herverdeelRestleadWachtrij(
  supabase: SupabaseClient,
  klantIds?: string[],
  nu: Date = new Date(),
): Promise<{ bekeken: number; verplaatst: number }> {
  /* Wat binnen een kwartier aan de beurt is laten we staan: de cron kan het
     al aan het oppakken zijn. */
  const vanaf = new Date(nu.getTime() + 15 * 60_000).toISOString();

  let q = supabase
    .from('geplande_leadleveringen')
    .select('id, lead_id, customer_id, gepland_voor')
    .eq('status', 'gepland')
    .like('reden', `${RESTLEAD_REDEN}%`)
    .gt('gepland_voor', vanaf)
    .limit(2000);
  if (klantIds && klantIds.length > 0) q = q.in('customer_id', klantIds);

  const { data: rijen, error } = await q;
  if (error) {
    console.error('[restleadWachtrij] ophalen mislukt:', error.message);
    return { bekeken: 0, verplaatst: 0 };
  }
  if (!rijen?.length) return { bekeken: 0, verplaatst: 0 };

  /* De cooldown per lead: twaalf uur na zijn laatste echte toewijzing. */
  const leadIds = [...new Set(rijen.map(r => r.lead_id))];
  const laatstePerLead = new Map<string, number>();
  for (let i = 0; i < leadIds.length; i += 200) {
    const { data: toewijzingen } = await supabase
      .from('lead_assignments')
      .select('lead_id, assigned_at, source')
      .in('lead_id', leadIds.slice(i, i + 200));
    for (const t of toewijzingen || []) {
      if (t.source === 'mirror') continue;
      const ms = new Date(t.assigned_at).getTime();
      if (ms > (laatstePerLead.get(t.lead_id) ?? 0)) laatstePerLead.set(t.lead_id, ms);
    }
  }

  /* Staan er voor één lead meerdere klanten in de wachtrij, dan telt de
     eerdere geplande levering ook als "vorige klant" voor de latere. */
  const perLead = new Map<string, typeof rijen>();
  for (const r of rijen) {
    const lijst = perLead.get(r.lead_id) ?? [];
    lijst.push(r);
    perLead.set(r.lead_id, lijst);
  }

  const items: WachtrijItem[] = [];
  for (const [leadId, lijst] of perLead) {
    lijst.sort((a, b) => new Date(a.gepland_voor).getTime() - new Date(b.gepland_voor).getTime());
    let vorige = laatstePerLead.get(leadId) ?? null;
    for (const r of lijst) {
      const vroegst = vorige === null ? nu.getTime() : vorige + COOLDOWN_UREN * 3600_000;
      items.push({
        id: r.id,
        customer_id: r.customer_id,
        gepland: new Date(r.gepland_voor),
        vroegst: new Date(vroegst),
      });
      vorige = new Date(r.gepland_voor).getTime();
    }
  }

  const nieuw = herverdeel(items, nu);

  let verplaatst = 0;
  for (const [id, moment] of nieuw) {
    const { error: fout } = await supabase
      .from('geplande_leadleveringen')
      .update({ gepland_voor: moment.toISOString() })
      .eq('id', id)
      .eq('status', 'gepland');
    if (fout) console.error('[restleadWachtrij] verplaatsen mislukt:', fout.message);
    else verplaatst++;
  }

  return { bekeken: rijen.length, verplaatst };
}
