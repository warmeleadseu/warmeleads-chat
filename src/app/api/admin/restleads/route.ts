import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { matchesAllFilters } from '@/lib/distribution';
import {
  vindKandidaten,
  lijstVoor,
  STANDAARD_INSTELLINGEN,
  MAX_UITDELINGEN,
  RESTLEAD_REDEN,
  type RestLead,
  type KandidaatBatch,
  type RestleadInstellingen,
} from '@/lib/restleads';

/**
 * Leads die tussen wal en schip vielen, met per lead de klanten die hem alsnog
 * kunnen krijgen.
 *
 * Live berekend, niet uit een tabel: een klant die vanmiddag is aangemaakt of
 * een doelgebied dat zojuist is verruimd telt zo meteen mee.
 */

export const dynamic = 'force-dynamic';

const MIRROR = 'mirror';
const VENSTER_DAGEN = 90;

async function alleRijen<T>(bouw: (van: number, tot: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const uit: T[] = [];
  for (let p = 0; p < 40; p++) {
    const { data, error } = await bouw(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    uit.push(...data);
    if (data.length < 1000) break;
  }
  return uit;
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const q = request.nextUrl.searchParams;
  const instellingen: RestleadInstellingen = {
    marge_km: Number(q.get('marge') ?? STANDAARD_INSTELLINGEN.marge_km) || STANDAARD_INSTELLINGEN.marge_km,
    ruime_marge_km: Number(q.get('ruime_marge') ?? STANDAARD_INSTELLINGEN.ruime_marge_km) || STANDAARD_INSTELLINGEN.ruime_marge_km,
    droog_na_dagen: Number(q.get('droog_na') ?? STANDAARD_INSTELLINGEN.droog_na_dagen) || STANDAARD_INSTELLINGEN.droog_na_dagen,
  };

  const supabase = createServerClient();
  const sinds = new Date(Date.now() - VENSTER_DAGEN * 86_400_000).toISOString();

  try {
    const leads = await alleRijen<RestLead>((van, tot) =>
      supabase
        .from('leads')
        .select('id, naam_klant, plaatsnaam, provincie, postcode, land, branch, lat, lng, phone_valid, wervingsdatum, created_at, custom_fields')
        .gte('created_at', sinds)
        .neq('bron', 'excel_import')
        .neq('bron', 'demo')
        .order('created_at', { ascending: false })
        .range(van, tot));

    const toewijzingen = await alleRijen<{ lead_id: string; customer_id: string; source: string | null }>((van, tot) =>
      supabase
        .from('lead_assignments')
        .select('lead_id, customer_id, source')
        .gte('assigned_at', sinds)
        .range(van, tot));

    const perLead = new Map<string, Set<string>>();
    for (const a of toewijzingen) {
      if (a.source === MIRROR) continue;
      const set = perLead.get(a.lead_id) ?? new Set<string>();
      set.add(a.customer_id);
      perLead.set(a.lead_id, set);
    }

    /* Leads die hier al zijn afgehandeld horen niet meer in de werklijst: een
       openstaande levering in de wachtrij, of een eerdere plaatsing vanuit dit
       scherm. Anders staan ze dubbel en kun je er nog eens op klikken. */
    const { data: afgehandeld } = await supabase
      .from('geplande_leadleveringen')
      .select('lead_id, status, reden')
      .in('status', ['gepland', 'geleverd']);

    const uitLijst = new Set(
      (afgehandeld || [])
        .filter(r => r.status === 'gepland' || String(r.reden || '').startsWith(RESTLEAD_REDEN))
        .map(r => r.lead_id),
    );

    /* Alleen wat nog te redden valt: nul of één uitdeling, en niet al afgehandeld. */
    const onderbedeeld = leads.filter(
      l => (perLead.get(l.id)?.size ?? 0) < MAX_UITDELINGEN && !uitLijst.has(l.id),
    );

    const { data: batchRijen } = await supabase
      .from('customer_batches')
      .select('id, customer_id, branch, batch_size, leads_delivered, price_per_lead, lead_filters, distribution_priority, customers(name, exclude_customers)')
      .eq('status', 'active');

    const klantIds = [...new Set((batchRijen || []).map(b => b.customer_id))];

    /* Droogstand: wanneer kreeg deze klant voor het laatst een lead?
       Eén gerichte vraag per klant in plaats van alle toewijzingen ophalen. Dat
       laatste haalde er 4.165 op terwijl de database er maximaal 1.000 per
       aanvraag teruggeeft: klanten wier laatste lead buiten die nieuwste
       duizend viel, golden onterecht als "kreeg nog nooit een lead" en kregen
       daardoor de ruime marge. Met tien actieve klanten zijn tien kleine
       vragen bovendien goedkoper. */
    const droogDagen = new Map<string, number | null>();
    await Promise.all(
      klantIds.map(async id => {
        const { data } = await supabase
          .from('lead_assignments')
          .select('assigned_at')
          .eq('customer_id', id)
          .order('assigned_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        droogDagen.set(
          id,
          data?.assigned_at
            ? (Date.now() - new Date(data.assigned_at).getTime()) / 86_400_000
            : null,
        );
      }),
    );

    const { data: doelen } = await supabase
      .from('customer_targets')
      .select('customer_id, target_type, lat, lng, radius_km, provinces, country, marge_km')
      .in('customer_id', klantIds)
      .eq('is_active', true);

    const doelenPer = new Map<string, NonNullable<typeof doelen>>();
    for (const d of doelen || []) {
      const lijst = doelenPer.get(d.customer_id) ?? [];
      lijst.push(d);
      doelenPer.set(d.customer_id, lijst);
    }

    const batches: KandidaatBatch[] = (batchRijen || []).map(b => {
      const klant = b.customers as unknown as { name?: string; exclude_customers?: string[] } | null;
      return {
        batch_id: b.id,
        customer_id: b.customer_id,
        klant: klant?.name ?? 'Onbekend',
        branch: b.branch,
        prijs_per_lead: Number(b.price_per_lead) || 0,
        ruimte: (b.batch_size || 0) - (b.leads_delivered || 0),
        distribution_priority: b.distribution_priority === true,
        droog_dagen: droogDagen.get(b.customer_id) ?? null,
        doelen: doelenPer.get(b.customer_id) ?? [],
        lead_filters: Array.isArray(b.lead_filters) ? b.lead_filters : [],
        uitsluitingen: Array.isArray(klant?.exclude_customers) ? klant!.exclude_customers! : [],
      };
    });

    const nu = new Date();
    const kansrijk: unknown[] = [];
    const verlopen: unknown[] = [];

    for (const lead of onderbedeeld) {
      const lijst = lijstVoor(lead, nu);
      if (!lijst) continue;

      const al = perLead.get(lead.id) ?? new Set<string>();
      const kandidaten = vindKandidaten(
        lead,
        batches,
        al,
        instellingen,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (l, filters) => matchesAllFilters(l as any, filters as any),
      );

      const rij = {
        id: lead.id,
        naam_klant: lead.naam_klant,
        plaatsnaam: lead.plaatsnaam,
        provincie: lead.provincie,
        postcode: lead.postcode,
        branch: lead.branch,
        wervingsdatum: lead.wervingsdatum,
        created_at: lead.created_at,
        dagen_oud: Math.floor((nu.getTime() - new Date(lead.created_at).getTime()) / 86_400_000),
        uitgedeeld: al.size,
        phone_valid: lead.phone_valid,
        kandidaten,
      };

      (lijst === 'kansrijk' ? kansrijk : verlopen).push(rij);
    }

    return NextResponse.json({
      kansrijk,
      verlopen,
      instellingen,
      actieve_batches: batches.length,
    });
  } catch (e) {
    console.error('[admin/restleads]', e);
    return NextResponse.json({ error: 'Restleads berekenen mislukt' }, { status: 500 });
  }
}
