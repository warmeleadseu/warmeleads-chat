import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { planMomenten, dagSleutel } from '@/lib/restleadPlanning';
import { RESTLEAD_REDEN } from '@/lib/restleads';
import { herverdeelRestleadWachtrij } from '@/lib/restleadWachtrij';

/**
 * Alle restleads in één keer uitdelen aan de klanten die ervoor in aanmerking
 * komen, met een maximum van drie klanten per lead.
 *
 * REGELS DIE HIER AFWIJKEN VAN HANDMATIG UITDELEN
 * -----------------------------------------------
 * 1. Leads die alleen dankzij de ruime marge een kandidaat hebben, blijven
 *    liggen. Dat zijn de gevallen waarover Rick zelf wil beslissen; ze staan
 *    verder buiten het gebied dan normaal en verdienen een blik.
 * 2. Klanten die niets per lead betalen doen niet mee. Die krijgen leads op
 *    andere voorwaarden en horen niet automatisch mee te snoepen.
 * 3. Zijn er meer kandidaten dan plekken, dan gaan de goedkoopste voor. De
 *    dure klanten worden door de normale verdeling toch wel bediend; de
 *    goedkope zijn juist degenen die droog komen te staan.
 *
 * Er wordt niet meteen geleverd maar gespreid volgens de cooldown van twaalf
 * uur, via dezelfde wachtrij als handmatig uitdelen.
 */

export const maxDuration = 60;

/**
 * Wat er per dag al bij deze klant terechtkomt: geleverd plus gepland.
 *
 * Nodig om het dagplafond te respecteren. Alleen naar geleverde toewijzingen
 * kijken is niet genoeg: dan plan je over je eigen wachtrij heen.
 */
async function bezettingPerDag(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string,
): Promise<Record<string, number>> {
  const vanaf = new Date();
  vanaf.setHours(0, 0, 0, 0);
  const tot = new Date(vanaf);
  tot.setDate(tot.getDate() + 60);

  const [geleverd, gepland] = await Promise.all([
    supabase
      .from('lead_assignments')
      .select('assigned_at')
      .eq('customer_id', customerId)
      .gte('assigned_at', vanaf.toISOString()),
    supabase
      .from('geplande_leadleveringen')
      .select('gepland_voor')
      .eq('customer_id', customerId)
      .eq('status', 'gepland')
      .gte('gepland_voor', vanaf.toISOString())
      .lte('gepland_voor', tot.toISOString()),
  ]);

  const perDag: Record<string, number> = {};
  for (const r of geleverd.data || []) {
    const s = dagSleutel(new Date(r.assigned_at));
    perDag[s] = (perDag[s] ?? 0) + 1;
  }
  for (const r of gepland.data || []) {
    const s = dagSleutel(new Date(r.gepland_voor));
    perDag[s] = (perDag[s] ?? 0) + 1;
  }
  return perDag;
}

interface Kandidaat {
  customer_id: string;
  batch_id: string;
  klant: string;
  prijs_per_lead: number;
  km_buiten: number;
}

interface LeadOpdracht {
  lead_id: string;
  kandidaten: Kandidaat[];
  uitgedeeld: number;
}

/** Ruim boven een normale ronde, krap genoeg om binnen de looptijd te blijven. */
const MAX_LEADS_PER_RONDE = 150;

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role === 'accountmanager') {
    return NextResponse.json({ error: 'Alleen superadmin/admin kan restleads uitdelen' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const opdrachten: LeadOpdracht[] = Array.isArray(body.leads) ? body.leads : [];
  const margeGrens: number = Number(body.marge_grens) || 5;

  if (opdrachten.length === 0) {
    return NextResponse.json({ error: 'Geen leads meegegeven' }, { status: 400 });
  }
  if (opdrachten.length > MAX_LEADS_PER_RONDE) {
    return NextResponse.json(
      { error: `Maximaal ${MAX_LEADS_PER_RONDE} leads per keer` },
      { status: 400 },
    );
  }

  const supabase = createServerClient();

  const plafondCache = new Map<string, { plafond: number; bezet: Record<string, number> }>();

  let leadsGeraakt = 0;
  let leveringen = 0;
  let overgeslagenRuimeMarge = 0;
  let overgeslagenGeenKandidaat = 0;

  /* De massaknop hoort alleen bij "Nog kansrijk". Op Verlopen zou één klik
     honderden leads weggeven aan de goedkoopste klanten, terwijl die voorraad
     juist bedoeld is om als exclusieve bulk te verkopen. Het scherm verbergt de
     knop daar al; deze controle zorgt dat de regel niet alleen in het scherm
     bestaat. */
  const { data: verseLeads } = await supabase
    .from('leads')
    .select('id')
    .in('id', opdrachten.map(o => o.lead_id))
    .gte('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString());
  const vers = new Set((verseLeads || []).map(l => l.id));
  let overgeslagenTeOud = 0;

  for (const opdracht of opdrachten) {
    if (!vers.has(opdracht.lead_id)) { overgeslagenTeOud++; continue; }
    /* Regel 1 en 2: alles buiten de normale marge en alle gratis klanten eruit,
       vóór er ook maar iets wordt ingepland. */
    const bruikbaar = opdracht.kandidaten
      .filter(k => k.km_buiten <= margeGrens)
      .filter(k => k.prijs_per_lead > 0);

    if (opdracht.kandidaten.length > 0 && bruikbaar.length === 0) {
      const alleenRuim = opdracht.kandidaten.some(k => k.km_buiten > margeGrens);
      if (alleenRuim) overgeslagenRuimeMarge++;
      else overgeslagenGeenKandidaat++;
      continue;
    }
    if (bruikbaar.length === 0) { overgeslagenGeenKandidaat++; continue; }

    /* Regel 3: goedkoopste eerst. Bij gelijke prijs de dichtstbijzijnde. */
    const gesorteerd = [...bruikbaar].sort((a, b) => {
      if (a.prijs_per_lead !== b.prijs_per_lead) return a.prijs_per_lead - b.prijs_per_lead;
      return a.km_buiten - b.km_buiten;
    });

    const { data: bestaand } = await supabase
      .from('lead_assignments')
      .select('customer_id, source, assigned_at')
      .eq('lead_id', opdracht.lead_id);

    const echte = (bestaand || []).filter(a => a.source !== 'mirror');
    const bezet = new Set(echte.map(a => a.customer_id));

    const { data: gepland } = await supabase
      .from('geplande_leadleveringen')
      .select('customer_id')
      .eq('lead_id', opdracht.lead_id)
      .eq('status', 'gepland');
    for (const g of gepland || []) bezet.add(g.customer_id);

    const ruimte = 3 - bezet.size;
    if (ruimte <= 0) continue;

    const kiezen = gesorteerd.filter(k => !bezet.has(k.customer_id)).slice(0, ruimte);
    if (kiezen.length === 0) continue;

    const laatste = echte.length > 0
      ? new Date(Math.max(...echte.map(a => new Date(a.assigned_at).getTime())))
      : null;

    /* Per klant het dagplafond aanhouden. De bezetting wordt per ronde
       onthouden zodat honderd leads niet honderd keer dezelfde vraag stellen,
       en zodat wat we deze ronde inplannen meetelt voor de volgende lead. */
    const momenten: Date[] = [];
    for (let i = 0; i < kiezen.length; i++) {
      const k = kiezen[i];
      if (!plafondCache.has(k.customer_id)) {
        const { data: b } = await supabase
          .from('customer_batches').select('leads_per_day').eq('id', k.batch_id).maybeSingle();
        plafondCache.set(k.customer_id, {
          plafond: Number(b?.leads_per_day) || 0,
          bezet: await bezettingPerDag(supabase, k.customer_id),
        });
      }
      const p = plafondCache.get(k.customer_id)!;
      const [moment] = planMomenten({
        laatsteToewijzing: i === 0 ? laatste : momenten[i - 1],
        aantal: 1,
        dagplafond: p.plafond,
        alGepland: p.bezet,
      });
      momenten.push(moment);
      const sleutel = dagSleutel(moment);
      p.bezet[sleutel] = (p.bezet[sleutel] ?? 0) + 1;
    }

    const rijen = kiezen.map((k, i) => ({
      lead_id: opdracht.lead_id,
      customer_id: k.customer_id,
      batch_id: k.batch_id,
      gepland_voor: momenten[i].toISOString(),
      status: 'gepland',
      pogingen: 0,
      negeer_geo: true,
      reden: `${RESTLEAD_REDEN} massaal uitgedeeld, goedkoopste klant eerst, gespreid over 12 uur.`,
      aangemaakt_door: admin.id,
    }));

    const { error } = await supabase.from('geplande_leadleveringen').insert(rijen);
    if (error) {
      console.error('[restleads/alles-uitdelen] inplannen mislukt:', error.message);
      continue;
    }

    leadsGeraakt++;
    leveringen += rijen.length;
  }

  /* Hierboven is per lead alleen de dag bepaald. Nu alles er staat weten we
     hoeveel het er per klant per dag zijn, en smeren we ze uit over de werkdag
     in plaats van ze allemaal op het begin van het venster te laten staan. */
  if (leveringen > 0) {
    await herverdeelRestleadWachtrij(supabase, [...plafondCache.keys()]);
  }

  return NextResponse.json({
    leads: leadsGeraakt,
    leveringen,
    overgeslagen_ruime_marge: overgeslagenRuimeMarge,
    overgeslagen_te_oud: overgeslagenTeOud,
    overgeslagen_geen_kandidaat: overgeslagenGeenKandidaat,
  });
}
