import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { matchesAllFilters } from '@/lib/distribution';
import { effectiveMaxAssignments } from '@/lib/assignmentCap';
import { batchIsAtCapacity, isCappedDeliveryModel } from '@/lib/batchDeliveryModel';
import { getLeadLimitPeriodAnchors } from '@/lib/batchAssignmentCaps';
import { fetchActiveBatchTargetsByBatch } from '@/lib/batchTargets';
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

    const toewijzingen = await alleRijen<{ lead_id: string; customer_id: string; source: string | null; assigned_at: string }>((van, tot) =>
      supabase
        .from('lead_assignments')
        .select('lead_id, customer_id, source, assigned_at')
        .gte('assigned_at', sinds)
        .range(van, tot));

    const perLead = new Map<string, Set<string>>();
    const laatstePerLead = new Map<string, number>();
    for (const a of toewijzingen) {
      if (a.source === MIRROR) continue;
      const set = perLead.get(a.lead_id) ?? new Set<string>();
      set.add(a.customer_id);
      perLead.set(a.lead_id, set);
      const ms = new Date(a.assigned_at).getTime();
      if (ms > (laatstePerLead.get(a.lead_id) ?? 0)) laatstePerLead.set(a.lead_id, ms);
    }

    /* Leads die hier al zijn afgehandeld horen niet meer in de werklijst: een
       openstaande levering in de wachtrij, of een eerdere plaatsing vanuit dit
       scherm. Anders staan ze dubbel en kun je er nog eens op klikken. */
    const { data: afgehandeld, error: wachtrijFout } = await supabase
      .from('geplande_leadleveringen')
      .select('lead_id, customer_id, status, reden, gepland_voor, customers:customer_id(name)')
      .in('status', ['gepland', 'geleverd']);

    /* Nooit stil doorgaan als deze vraag mislukt. Zonder deze regel viel de
       lijst terug op "niets is afgehandeld" en stond álles weer in de
       linkerkolom, inclusief wat al lang bij een klant klaarstond. Liever een
       zichtbare fout dan een lijst waar je niet op kunt vertrouwen. */
    if (wachtrijFout) {
      console.error('[admin/restleads] wachtrij ophalen mislukt:', wachtrijFout.message);
      return NextResponse.json(
        { error: 'De wachtrij kon niet worden gelezen, dus de lijst zou onbetrouwbaar zijn.' },
        { status: 500 },
      );
    }

    const wachtrijPerLead = new Map<string, { klant: string; wanneer: string | null; status: string }>();
    for (const r of afgehandeld || []) {
      if (wachtrijPerLead.has(r.lead_id)) continue;
      const klant = (r as unknown as { customers?: { name?: string } | null }).customers;
      wachtrijPerLead.set(r.lead_id, {
        klant: klant?.name ?? 'onbekende klant',
        wanneer: r.gepland_voor ?? null,
        status: r.status,
      });
    }

    const uitLijst = new Set(
      (afgehandeld || [])
        .filter(r => r.status === 'gepland' || String(r.reden || '').startsWith(RESTLEAD_REDEN))
        .map(r => r.lead_id),
    );

    /* Alleen wat nog te redden valt: nul of één uitdeling, en niet al afgehandeld. */
    const onderbedeeld = leads.filter(
      l => (perLead.get(l.id)?.size ?? 0) < MAX_UITDELINGEN && !uitLijst.has(l.id),
    );

    /* Dezelfde batches als de verdeling bekijkt. Deze lijst nam ook onbetaalde
       batches, batches van een ander soort en inactieve klanten mee; die
       stonden dan als kandidaat terwijl de verdeling ze nooit zou kiezen. */
    const { data: batchRijenOngesorteerd } = await supabase
      .from('customer_batches')
      .select('id, customer_id, branch, batch_size, leads_delivered, price_per_lead, lead_filters, distribution_priority, created_at, starts_at, leads_per_day, leads_per_week, delivery_model, batch_kind, customers!inner(name, exclude_customers, is_active)')
      .eq('status', 'active')
      .eq('batch_kind', 'leads')
      .neq('is_paid', false)
      .eq('customers.is_active', true);

    /* FIFO-volgorde, zoals de verdeling: per klant de voorrangsbatch, dan de
       oudste. vindKandidaten neemt per klant de eerste batch die past. */
    const batchRijen = [...(batchRijenOngesorteerd || [])].sort((a, b) => {
      if ((a.distribution_priority === true) !== (b.distribution_priority === true)) {
        return a.distribution_priority === true ? -1 : 1;
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const klantIds = [...new Set(batchRijen.map(b => b.customer_id))];
    const batchIds = batchRijen.map(b => b.id);

    /* Dag- en weektellingen per batch, voor de uitleg waarom de verdeling een
       kandidaat nog niet zelf heeft geplaatst. Zelfde vensters als de verdeling. */
    const { dayStart, weekStart } = getLeadLimitPeriodAnchors(new Date());
    const periode = batchIds.length > 0
      ? await alleRijen<{ batch_id: string | null; assigned_at: string }>((van, tot) =>
          supabase
            .from('lead_assignments')
            .select('batch_id, assigned_at')
            .in('batch_id', batchIds)
            .gte('assigned_at', weekStart.toISOString())
            .range(van, tot))
      : [];
    const vandaagPerBatch = new Map<string, number>();
    const weekPerBatch = new Map<string, number>();
    for (const r of periode) {
      if (!r.batch_id) continue;
      weekPerBatch.set(r.batch_id, (weekPerBatch.get(r.batch_id) ?? 0) + 1);
      if (new Date(r.assigned_at) >= dayStart) {
        vandaagPerBatch.set(r.batch_id, (vandaagPerBatch.get(r.batch_id) ?? 0) + 1);
      }
    }

    /* Batches met een eigen gebied: dan telt alléén dat gebied, net als in de
       verdeling. De klantgebieden gelden voor die batch niet. */
    const batchGebieden = await fetchActiveBatchTargetsByBatch(supabase, batchIds);

    /* Uitsluitingen van álle klanten, ook zonder actieve batch: een klant die
       de lead al heeft kan een ander uitsluiten. */
    const { data: uitsluitRijen } = await supabase
      .from('customers')
      .select('id, exclude_customers')
      .not('exclude_customers', 'is', null);
    const uitsluitingenPerKlant = new Map<string, string[]>(
      (uitsluitRijen || [])
        .filter(c => Array.isArray(c.exclude_customers) && c.exclude_customers.length > 0)
        .map(c => [c.id, c.exclude_customers as string[]]),
    );

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

    const batches: KandidaatBatch[] = batchRijen.map(b => {
      const klant = b.customers as unknown as { name?: string; exclude_customers?: string[] } | null;
      const eigenGebied = batchGebieden.get(b.id);
      return {
        batch_id: b.id,
        customer_id: b.customer_id,
        klant: klant?.name ?? 'Onbekend',
        branch: b.branch,
        prijs_per_lead: Number(b.price_per_lead) || 0,
        /* Batches zonder vast aantal (doorlopend, handmatig) raken nooit vol;
           die vielen hier weg zodra het getal op nul stond. */
        ruimte: batchIsAtCapacity(b)
          ? 0
          : isCappedDeliveryModel(b.delivery_model, b.batch_kind)
            ? (b.batch_size || 0) - (b.leads_delivered || 0)
            : Number.MAX_SAFE_INTEGER,
        distribution_priority: b.distribution_priority === true,
        droog_dagen: droogDagen.get(b.customer_id) ?? null,
        doelen: eigenGebied && eigenGebied.length > 0 ? eigenGebied : (doelenPer.get(b.customer_id) ?? []),
        lead_filters: Array.isArray(b.lead_filters) ? b.lead_filters : [],
        uitsluitingen: Array.isArray(klant?.exclude_customers) ? klant!.exclude_customers! : [],
        starts_at: b.starts_at,
        leads_per_day: b.leads_per_day,
        leads_per_week: b.leads_per_week,
        vandaag: vandaagPerBatch.get(b.id) ?? 0,
        deze_week: weekPerBatch.get(b.id) ?? 0,
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
        {
          uitsluitingenPerKlant,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          maxKlanten: effectiveMaxAssignments(lead as any),
          laatsteToewijzing: laatstePerLead.has(lead.id) ? new Date(laatstePerLead.get(lead.id)!) : null,
          nu,
        },
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
        /* Staat hij al ergens klaar? Dan hoort hij hier niet te staan, en als
           dat tóch gebeurt wil je dat meteen zien in plaats van te moeten
           gissen. */
        wachtrij: wachtrijPerLead.get(lead.id) ?? null,
        kandidaten,
      };

      (lijst === 'kansrijk' ? kansrijk : verlopen).push(rij);
    }

    /* Geen caching. De browser mocht dit antwoord bewaren, en dan zie je na
       een uitdeling nog steeds de oude lijst. Dat is precies hoe het lijkt
       alsof een uitgedeelde lead blijft staan. */
    return NextResponse.json(
      {
        kansrijk,
        verlopen,
        instellingen,
        actieve_batches: batches.length,
        /* Het moment van berekenen, zichtbaar in het scherm. Zie je een oud
           tijdstip, dan kijk je naar een bewaard antwoord en niet naar de
           werkelijkheid. Dat was hier twee keer de verwarrende factor. */
        berekend_op: new Date().toISOString(),
        klanten_meegenomen: [...new Set(batches.map(b => b.klant))].sort(),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (e) {
    console.error('[admin/restleads]', e);
    return NextResponse.json({ error: 'Restleads berekenen mislukt' }, { status: 500 });
  }
}
