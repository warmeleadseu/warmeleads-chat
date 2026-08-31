import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

/**
 * Keuzelijst met Meta-campagnes voor het filter in Leads CRM.
 *
 * De campagnenaam staat niet op de lead zelf, alleen op de kostenregels in
 * `meta_ad_spend`. Dit endpoint bouwt daaruit een lijst van id + naam, zodat
 * de interface op naam kan laten zoeken en op id kan filteren.
 *
 * Alleen campagnes waar ook daadwerkelijk leads van binnengekomen zijn, met
 * het aantal erbij; een lijst van honderden lege campagnes helpt niemand.
 */

export const runtime = 'nodejs';

const PAGE = 1000;
/** Ruim boven de huidige omvang; voorkomt de stille afkapping op 1000 rijen. */
const MAX_PAGES = 200;

async function paginate<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  for (let p = 0; p < MAX_PAGES; p++) {
    const { data, error } = await fetchPage(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return rows;
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();

  try {
    const [spendRows, leadRows] = await Promise.all([
      paginate<{ campaign_id: string; campaign_name: string | null; date: string }>(
        async (from, to) => {
          const { data, error } = await supabase
            .from('meta_ad_spend')
            .select('campaign_id, campaign_name, date')
            .order('date', { ascending: false })
            .range(from, to);
          return { data, error };
        },
      ),
      paginate<{ meta_campaign_id: string | null }>(async (from, to) => {
        const { data, error } = await supabase
          .from('leads')
          .select('meta_campaign_id')
          .not('meta_campaign_id', 'is', null)
          .range(from, to);
        return { data, error };
      }),
    ]);

    /* Nieuwste naam per campagne: campagnes worden hernoemd en gekopieerd,
       dus de meest recente kostenregel geeft de herkenbaarste naam. */
    const naamPerId = new Map<string, string>();
    for (const r of spendRows) {
      if (!r.campaign_name) continue;
      if (!naamPerId.has(r.campaign_id)) naamPerId.set(r.campaign_id, r.campaign_name);
    }

    const aantalPerId = new Map<string, number>();
    for (const l of leadRows) {
      if (!l.meta_campaign_id) continue;
      aantalPerId.set(l.meta_campaign_id, (aantalPerId.get(l.meta_campaign_id) || 0) + 1);
    }

    const campagnes = [...aantalPerId.entries()]
      .map(([id, leads]) => ({
        id,
        // Campagnes zonder kostenregel (bv. verwijderd bij Meta) tonen we op id,
        // zodat hun leads toch vindbaar blijven.
        name: naamPerId.get(id) || `Onbekende campagne (${id})`,
        leads,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'nl'));

    return NextResponse.json({ campaigns: campagnes });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Onbekende fout';
    console.error('[admin/meta-campaign-options] ophalen mislukt', message);
    return NextResponse.json(
      { error: `Campagnes ophalen mislukt: ${message}` },
      { status: 500 },
    );
  }
}
