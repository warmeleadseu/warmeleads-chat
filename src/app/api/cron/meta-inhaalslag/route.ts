import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyCronAuth } from '@/lib/cronAuth';
import { getMetaCredentials } from '@/lib/meta';
import { enrichLeadAddress } from '@/lib/pdok';
import { isPhoneValid } from '@/lib/phoneValidation';
import { checkLeadProfanity } from '@/lib/profanityFilter';
import { calculateQualityScore } from '@/lib/leadQuality';
import { neemCronSlot, geefCronSlotTerug } from '@/lib/cronSlot';

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
type MetaLead = { id: string; created_time: string; campaign_id?: string; field_data?: MetaVeld[] };

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
  const metaLeads: MetaLead[] = [];
  let url: string | null =
    `https://graph.facebook.com/v21.0/${FORMULIER}/leads` +
    `?fields=id,created_time,field_data,campaign_id&limit=200&access_token=${cred.accessToken}`;
  for (let p = 0; p < 15 && url; p++) {
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

  const ontbreekt = metaLeads.filter((l) => {
    const em = (veld(l, /email/i) ?? '').toLowerCase().trim();
    const tl = staart(veld(l, /phone|telefoon/i));
    return !((em && mails.has(em)) || (tl && tels.has(tl)));
  });

  if (ontbreekt.length === 0) {
    return NextResponse.json({ ok: true, ontbreekt: 0, ingeladen: 0, klaar: true });
  }

  const vandaag = new Date().toISOString().split('T')[0];
  const portie = ontbreekt.slice(0, DAGPORTIE);
  let ingeladen = 0;
  const overgeslagen: Record<string, number> = {};
  const sla = (reden: string) => { overgeslagen[reden] = (overgeslagen[reden] ?? 0) + 1; };

  for (const m of portie) {
    const naam = veld(m, /full_name|^name$/i);
    if (!naam) { sla('geen naam'); continue; }

    const customFields: Record<string, string> = {};
    for (const [metaKey, onsKey] of Object.entries(VELDEN)) {
      const v = m.field_data?.find((f) => f.name === metaKey)?.values?.[0];
      if (v) customFields[onsKey] = String(v);
    }

    const telefoon = veld(m, /phone|telefoon/i) ?? '';
    const lead = await enrichLeadAddress({
      branch: 'thuisbatterij',
      naam_klant: naam,
      email: veld(m, /email/i) ?? '',
      telefoonnummer: telefoon,
      phone_valid: isPhoneValid(telefoon),
      postcode: veld(m, /post_?code/i) ?? '',
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
      meta_leadgen_id: String(m.id),
    });

    if (checkLeadProfanity(lead as Record<string, unknown>).blocked) { sla('ongepaste inhoud'); continue; }

    const quality_score = calculateQualityScore(lead);
    const { error } = await supabase.from('leads').insert({ ...lead, quality_score });
    if (error) { console.error('[cron/meta-inhaalslag] inserten mislukt:', error.message); sla('inserten mislukt'); continue; }
    ingeladen++;
  }

  return NextResponse.json({
    ok: true,
    ontbrak: ontbreekt.length,
    ingeladen,
    resterend: Math.max(0, ontbreekt.length - portie.length),
    overgeslagen,
    timestamp: new Date().toISOString(),
  });
}
