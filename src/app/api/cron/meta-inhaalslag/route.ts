import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyCronAuth } from '@/lib/cronAuth';
import { getMetaCredentials } from '@/lib/meta';
import { enrichLeadAddress } from '@/lib/pdok';
import { isPhoneValid } from '@/lib/phoneValidation';
import { checkLeadProfanity } from '@/lib/profanityFilter';
import { quarantaineReden, zetInQuarantaine } from '@/lib/leadQuarantaine';
import { calculateQualityScore } from '@/lib/leadQuality';
import { neemCronSlot, geefCronSlotTerug } from '@/lib/cronSlot';
import { LEK_INHAAL_DAGEN, antwoordenUitFormulier, lekAdvertenties, type SpendRegel } from '@/lib/metaLekInhaal';

/**
 * Leads die Meta wél heeft en wij niet, alsnog inladen.
 *
 * Het formulier "Jens oud formulier - Final Final" hangt onder vijf
 * thuisbatterij-campagnes maar is nooit aangesloten in Zapier. Sinds 24 juli
 * zijn er daardoor 182 leads verloren gegaan waar wel advertentiegeld voor is
 * betaald.
 *
 * Bewust gedoseerd: een dagportie in plaats van alles ineens, zodat klanten
 * een drukke week zien en geen stortvloed. De verdeling zelf laten we aan de
 * gewone cron, die alle normale regels toepast: doelgebied, branche,
 * batchruimte, dagplafond, twaalf uur tussen twee klanten en maximaal drie
 * klanten per lead.
 *
 * Zelfcorrigerend: elke ronde kijkt opnieuw wat er ontbreekt. Een lead die al
 * binnen is wordt nooit opnieuw ingeladen, en als het lek terugkeert pakt deze
 * ronde het vanzelf op.
 *
 * Sinds 26 november ook voor elke advertentie die volgens Meta leads oplevert
 * terwijl er bij ons nooit een lead van binnenkwam (metaLekInhaal.ts), zoals
 * "Thuisbatterij | Energiekompas - Enschede - Kopie". Die leads halen we per
 * advertentie op, met de branche uit de campagnenaam.
 *
 * Twee bewuste afwijkingen van de normale intake: geen Meta-conversie-event
 * (dat zou bij Meta als van vandaag tellen en de campagnecijfers vervuilen) en
 * geen directe verdeling.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Het formulier dat nooit is aangesloten. */
const FORMULIER = '961423323120969';
/** Niets ouder dan dit ophalen; daarvoor liep de koppeling nog wel. */
const VANAF = '2026-07-24';
/** Het uur (UTC) waarin het oude formulier wordt bijgewerkt. */
const FORMULIER_UUR_UTC = 7;
/** Hoeveel er per ronde maximaal ingeladen worden. */
const DAGPORTIE = 61;

/** Meta-veldnaam naar ons branche-veld. */
const VELDEN: Record<string, string> = {
  'heb_je_zonnepanelen?': 'zonnepanelen',
  'heb_je_een_dynamisch_energiecontract?': 'dynamisch_contract',
  'hoeveel_kwh_stroom_verbruik_je_per_jaar_ongeveer?': 'stroomverbruik',
  'wat_is_je_budget_voor_een_thuisbatterij?': 'budget',
  'voornaamste_reden_voor_je_interesse_in_een_thuisbatterij?': 'reden_thuisbatterij',
};

type MetaVeld = { name: string; values?: string[] };
type MetaLead = {
  id: string; created_time: string; campaign_id?: string; adset_id?: string; ad_id?: string; field_data?: MetaVeld[];
  /** Alleen bij leads van een lekkende advertentie: de branche uit de campagnenaam. */
  branch?: string;
};

const veld = (l: MetaLead, re: RegExp) =>
  l.field_data?.find((f) => re.test(f.name))?.values?.[0] ?? null;

/** Laatste negen cijfers: genoeg om hetzelfde nummer te herkennen los van de notatie. */
const staart = (t: string | null) => {
  const d = String(t ?? '').replace(/\D/g, '');
  return d.length >= 9 ? d.slice(-9) : null;
};

export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;

  const supabase = createServerClient();
  const slot = 'cron:meta-inhaalslag';
  if (!(await neemCronSlot(supabase, slot, 10))) {
    return NextResponse.json({ ok: true, overgeslagen: 'vorige ronde loopt nog' });
  }

  try {
    return await ronde(supabase);
  } finally {
    await geefCronSlotTerug(supabase, slot);
  }
}

async function ronde(supabase: ReturnType<typeof createServerClient>) {
  const cred = await getMetaCredentials();
  if (!cred) {
    return NextResponse.json({ error: 'Geen Meta-gegevens beschikbaar' }, { status: 500 });
  }

  /* Alles wat Meta voor dit formulier heeft sinds de startdatum. De lijst is
     eindig en klein; we stoppen zodra we bij oudere leads uitkomen. */
  /* De cron draait elk uur voor de lekkende advertenties; het oude formulier
     blijft één ronde per dag (07:00 UTC), dan houdt de dagportie zijn betekenis. */
  const formulierRonde = new Date().getUTCHours() === FORMULIER_UUR_UTC;
  const metaLeads: MetaLead[] = [];
  let url: string | null =
    `https://graph.facebook.com/v21.0/${FORMULIER}/leads` +
    `?fields=id,created_time,field_data,campaign_id&limit=200&access_token=${cred.accessToken}`;
  for (let p = 0; p < 15 && url && formulierRonde; p++) {
    const res: Response = await fetch(url);
    const json = (await res.json()) as { data?: MetaLead[]; paging?: { next?: string }; error?: { message?: string } };
    if (json.error) {
      console.error('[cron/meta-inhaalslag] Meta gaf een fout:', json.error.message);
      break;
    }
    let ouder = false;
    for (const l of json.data ?? []) {
      if (l.created_time < VANAF) { ouder = true; continue; }
      metaLeads.push(l);
    }
    url = !ouder && json.paging?.next ? json.paging.next : null;
  }

  /* Wat wij al hebben. Hoofdletterongevoelig op e-mail én op telefoonnummer:
     ergens in de keten wordt de eerste letter van een e-mailadres een
     hoofdletter, en daardoor leken 129 leads te ontbreken die er gewoon in
     stonden. */
  const mails = new Set<string>();
  const tels = new Set<string>();
  for (let p = 0; p < 40; p++) {
    const { data } = await supabase
      .from('leads')
      .select('email, telefoonnummer, created_at')
      .gte('created_at', '2026-07-01T00:00:00Z')
      .order('created_at')
      .range(p * 1000, p * 1000 + 999);
    if (!data?.length) break;
    for (const r of data) {
      if (r.email) mails.add(String(r.email).toLowerCase().trim());
      const s = staart(r.telefoonnummer);
      if (s) tels.add(s);
    }
    if (data.length < 1000) break;
  }

  /* Wat in quarantaine staat (open, vrijgegeven of afgewezen), is al
     beoordeeld of wacht op een beheerder; niet opnieuw als ontbrekend tellen. */
  const inQuarantaine = new Set<string>();
  const metaIds = metaLeads.map((l) => String(l.id));
  for (let i = 0; i < metaIds.length; i += 150) {
    const { data } = await supabase
      .from('leads_quarantaine')
      .select('meta_leadgen_id')
      .in('meta_leadgen_id', metaIds.slice(i, i + 150));
    for (const r of data || []) if (r.meta_leadgen_id) inQuarantaine.add(String(r.meta_leadgen_id));
  }

  /* Het tijdstip bij Meta vastleggen voor wat de inhaalslag eerder al
     inlaadde: created_at is daar het moment van inladen, soms weken later.
     De leadkosten horen bij de week waarin Meta de lead binnenkreeg
     (migratie 200). Daarna die weken opnieuw doorrekenen. */
  const metaMoment = await legMetaMomentVast(supabase, metaLeads);

  const isBinnen = (l: MetaLead) => {
    if (inQuarantaine.has(String(l.id))) return true;
    const em = (veld(l, /email/i) ?? '').toLowerCase().trim();
    const tl = staart(veld(l, /phone|telefoon/i));
    return !!((em && mails.has(em)) || (tl && tels.has(tl)));
  };
  const ontbreekt = metaLeads.filter((l) => !isBinnen(l));

  /* Daarnaast: advertenties die volgens Meta leads opleveren terwijl er bij
     ons nooit iets van binnenkwam (formulier niet in Zapier). Die lezen we
     zelf uit, zodat zo'n lek de leads niet meer kost. */
  const lekken = await haalLekLeads(supabase, cred.accessToken);
  const lekLeads = lekken.leads.filter((l) => !isBinnen(l) && !ontbreekt.some((o) => o.id === l.id));

  if (ontbreekt.length === 0 && lekLeads.length === 0) {
    return NextResponse.json({ ok: true, ontbreekt: 0, ingeladen: 0, klaar: true, metaMoment, lekken: lekken.advertenties });
  }

  const vandaag = new Date().toISOString().split('T')[0];
  /* Lekleads eerst: die zijn vers en een klant wacht erop. */
  const portie = [...lekLeads, ...ontbreekt].slice(0, DAGPORTIE);
  let ingeladen = 0;
  let lekIngeladen = 0;
  const overgeslagen: Record<string, number> = {};
  const sla = (reden: string) => { overgeslagen[reden] = (overgeslagen[reden] ?? 0) + 1; };

  for (const m of portie) {
    const naam = veld(m, /full_name|^name$/i);
    if (!naam) { sla('geen naam'); continue; }

    const branch = m.branch ?? 'thuisbatterij';
    const customFields = antwoordenUitFormulier(m.field_data, branch === 'thuisbatterij' ? VELDEN : {});

    const telefoon = veld(m, /phone|telefoon/i) ?? '';
    const lead = await enrichLeadAddress({
      branch,
      naam_klant: naam,
      email: veld(m, /email/i) ?? '',
      telefoonnummer: telefoon,
      phone_valid: isPhoneValid(telefoon),
      postcode: veld(m, /post_?code|zip/i) ?? '',
      huisnummer: veld(m, /huisnummer/i) ?? '',
      plaatsnaam: '',
      provincie: '',
      land: '',
      wervingsdatum: vandaag,
      status: 'nieuw',
      bron: 'zapier',
      notities: '',
      custom_fields: customFields,
      ...(m.campaign_id && { meta_campaign_id: m.campaign_id }),
      ...(m.adset_id && { meta_adset_id: m.adset_id }),
      ...(m.ad_id && { meta_ad_id: m.ad_id }),
      meta_leadgen_id: String(m.id),
    });

    const profanity = checkLeadProfanity(lead as Record<string, unknown>);
    if (profanity.blocked) {
      const q = await zetInQuarantaine(supabase, {
        route: 'meta_inhaalslag',
        reden: quarantaineReden(profanity),
        lead: lead as Record<string, unknown>,
        metaLeadgenId: String(m.id),
      });
      sla(q.ok ? 'in quarantaine (ongepaste inhoud)' : 'quarantaine mislukt');
      continue;
    }

    const quality_score = calculateQualityScore(lead);
    const { error } = await supabase.from('leads').insert({ ...lead, quality_score, meta_aangemaakt_op: m.created_time });
    if (error) { console.error('[cron/meta-inhaalslag] inserten mislukt:', error.message); sla('inserten mislukt'); continue; }
    /* Zo komen ze ook niet dubbel binnen als Meta dezelfde lead onder twee advertenties toont. */
    const em = (veld(m, /email/i) ?? '').toLowerCase().trim();
    if (em) mails.add(em);
    const tl = staart(telefoon);
    if (tl) tels.add(tl);
    ingeladen++;
    if (m.branch) lekIngeladen++;
  }

  return NextResponse.json({
    ok: true,
    ontbrak: ontbreekt.length + lekLeads.length,
    ingeladen,
    uit_lekken: { advertenties: lekken.advertenties, ontbrak: lekLeads.length, ingeladen: lekIngeladen },
    resterend: Math.max(0, ontbreekt.length + lekLeads.length - portie.length),
    overgeslagen,
    metaMoment,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Leads van lekkende advertenties (metaLekInhaal.ts), rechtstreeks per
 * advertentie bij Meta opgehaald. Een fout bij één advertentie slaat alleen
 * die over.
 */
async function haalLekLeads(
  supabase: ReturnType<typeof createServerClient>,
  token: string,
): Promise<{ leads: MetaLead[]; advertenties: { ad_id: string; campagne: string; meta_leads: number; opgehaald: number; fout?: string }[] }> {
  const vanaf = new Date(Date.now() - LEK_INHAAL_DAGEN * 86_400_000).toISOString().slice(0, 10);
  const spend = await alleSpendRegels(supabase, vanaf);
  const adIds = [...new Set(spend.filter((r) => (Number(r.leads_count) || 0) > 0 && r.ad_id).map((r) => r.ad_id as string))];
  const binnenPerAd = new Map<string, number>();
  for (let i = 0; i < adIds.length; i += 150) {
    const { data } = await supabase.from('leads').select('meta_ad_id').in('meta_ad_id', adIds.slice(i, i + 150));
    for (const r of data ?? []) binnenPerAd.set(String(r.meta_ad_id), (binnenPerAd.get(String(r.meta_ad_id)) ?? 0) + 1);
  }
  const lekken = lekAdvertenties(spend, binnenPerAd).slice(0, 20);

  const leads: MetaLead[] = [];
  const advertenties: { ad_id: string; campagne: string; meta_leads: number; opgehaald: number; fout?: string }[] = [];
  for (const ad of lekken) {
    let url: string | null =
      `https://graph.facebook.com/v21.0/${ad.ad_id}/leads` +
      `?fields=id,created_time,field_data,campaign_id,adset_id,ad_id&limit=100&access_token=${token}`;
    let opgehaald = 0;
    let fout: string | undefined;
    for (let p = 0; p < 5 && url; p++) {
      const res: Response = await fetch(url);
      const json = (await res.json().catch(() => ({}))) as { data?: MetaLead[]; paging?: { next?: string }; error?: { message?: string } };
      if (json.error) { fout = json.error.message ?? 'Meta gaf een fout'; break; }
      let ouder = false;
      for (const l of json.data ?? []) {
        if (l.created_time.slice(0, 10) < vanaf) { ouder = true; continue; }
        leads.push({ ...l, ad_id: l.ad_id ?? ad.ad_id, campaign_id: l.campaign_id ?? ad.campaign_id ?? undefined, branch: ad.branch });
        opgehaald++;
      }
      url = !ouder && json.paging?.next ? json.paging.next : null;
    }
    if (fout) console.error(`[cron/meta-inhaalslag] advertentie ${ad.ad_id}:`, fout);
    advertenties.push({ ad_id: ad.ad_id, campagne: ad.campaign_name, meta_leads: ad.metaLeads, opgehaald, ...(fout && { fout }) });
  }
  return { leads, advertenties };
}

async function alleSpendRegels(supabase: ReturnType<typeof createServerClient>, vanaf: string): Promise<SpendRegel[]> {
  const uit: SpendRegel[] = [];
  for (let p = 0; p < 20; p++) {
    const { data, error } = await supabase
      .from('meta_ad_spend')
      .select('ad_id, campaign_id, campaign_name, leads_count')
      .gte('date', vanaf)
      .order('date')
      .order('ad_id')
      .range(p * 1000, p * 1000 + 999);
    if (error || !data?.length) break;
    uit.push(...(data as SpendRegel[]));
    if (data.length < 1000) break;
  }
  return uit;
}

/**
 * Vult leads.meta_aangemaakt_op voor ingeladen leads waarvan het moment van
 * inladen meer dan een uur afwijkt van het moment bij Meta, en rekent daarna
 * de leadkosten opnieuw door vanaf de vroegste week.
 */
async function legMetaMomentVast(
  supabase: ReturnType<typeof createServerClient>,
  metaLeads: MetaLead[],
): Promise<{ bijgewerkt: number; herberekendVanaf: string | null; fout?: string }> {
  const perId = new Map(metaLeads.map((l) => [String(l.id), l.created_time]));
  const ids = [...perId.keys()];
  let bijgewerkt = 0;
  let vroegst: string | null = null;
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase
      .from('leads')
      .select('id, meta_leadgen_id, created_at')
      .in('meta_leadgen_id', ids.slice(i, i + 150))
      .is('meta_aangemaakt_op', null);
    if (error) return { bijgewerkt, herberekendVanaf: null, fout: error.message };
    for (const r of data ?? []) {
      const moment = perId.get(String(r.meta_leadgen_id));
      if (!moment) continue;
      const verschil = Math.abs(new Date(r.created_at as string).getTime() - new Date(moment).getTime());
      if (!(verschil > 3_600_000)) continue;
      const { error: fout } = await supabase.from('leads').update({ meta_aangemaakt_op: moment }).eq('id', r.id);
      if (fout) continue;
      bijgewerkt++;
      const dag = new Date(moment).toISOString().slice(0, 10);
      if (!vroegst || dag < vroegst) vroegst = dag;
    }
  }
  if (bijgewerkt === 0 || !vroegst) return { bijgewerkt, herberekendVanaf: null };
  const { error } = await supabase.rpc('herbereken_lead_kosten', { p_vanaf: vroegst });
  if (error) return { bijgewerkt, herberekendVanaf: null, fout: `herberekenen: ${error.message}` };
  return { bijgewerkt, herberekendVanaf: vroegst };
}
