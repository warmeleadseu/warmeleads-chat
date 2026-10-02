import type { SupabaseClient } from '@supabase/supabase-js';
import { logAudit } from '@/lib/audit';
import {
  binnenLeverperiode,
  haalPartnerConfig,
  slaPartnerConfigOp,
  verwijderPartnerConfig,
  zetMisluktTerug,
  type PartnerOpslag,
} from './repo';
import { leverReeks, PARTNER_MAX_POGINGEN } from './sync';
import { verstuurNaarPartner } from './transport';
import { verbergGeheim } from './verberg';
import type { PartnerDefinitie } from './types';

/**
 * Alles wat het portaal en de admin met een partnerkoppeling kunnen doen, op
 * één plek. Beide schermen roepen dezelfde functies aan en gedragen zich dus
 * gegarandeerd hetzelfde.
 */

/** Hoe ver terug de admin bij het koppelen mag laten nasturen. Binnen het 72-uursvenster van de retry-cron. */
export const MAX_NASTUREN_DAGEN = 3;

export type Actor = {
  soort: 'admin' | 'portaal';
  id?: string | null;
  naam?: string | null;
};

export type PartnerStatus = {
  partner: { id: string; naam: string; tagline: string; urlUitleg: string; logo: string | null };
  gekoppeld: boolean;
  aan: boolean;
  url_hint: string | null;
  branches: string[];
  beschikbare_branches: string[];
  leveren_vanaf: string | null;
  laatste_succes: string | null;
  laatste_fout: { at: string; melding: string; blijvend: boolean } | null;
  zeven_dagen: { gelukt: number; mislukt: number };
  /** Mislukt maar nog in de wachtrij, of nog bezig. */
  wachtend: number;
  /** Mislukt en opgegeven; alleen "Opnieuw proberen" of een nieuw adres helpt. */
  opgegeven: number;
  /** De laatste levering mislukte blijvend: er moet iemand naar kijken. */
  actie_nodig: boolean;
};

export async function partnerStatus(
  supabase: SupabaseClient,
  customerId: string,
  partner: PartnerDefinitie,
  beschikbareBranches: string[],
): Promise<PartnerStatus> {
  const config = await haalPartnerConfig(supabase, customerId, partner);
  const sinds = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [laatsteSucces, laatsteFout, week, open] = await Promise.all([
    supabase.from('integration_sync_log').select('updated_at')
      .eq('customer_id', customerId).eq('provider', partner.provider).eq('status', 'success')
      .order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('integration_sync_log').select('updated_at, error_message, attempts')
      .eq('customer_id', customerId).eq('provider', partner.provider).eq('status', 'failed')
      .order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('integration_sync_log').select('status')
      .eq('customer_id', customerId).eq('provider', partner.provider).gte('updated_at', sinds),
    supabase.from('integration_sync_log').select('status, attempts')
      .eq('customer_id', customerId).eq('provider', partner.provider).in('status', ['failed', 'pending']),
  ]);

  const succesAt = (laatsteSucces.data?.updated_at as string | undefined) ?? null;
  const fout = laatsteFout.data;
  const blijvend = Number(fout?.attempts) >= PARTNER_MAX_POGINGEN;
  const openRijen = open.data || [];

  return {
    partner: { id: partner.id, naam: partner.naam, tagline: partner.tagline, urlUitleg: partner.urlUitleg, logo: partner.logo },
    gekoppeld: Boolean(config?.token),
    aan: config?.settings.enabled === true && Boolean(config?.token),
    url_hint: config?.token ? partner.urlHint(config.token) : null,
    branches: config?.settings.branches ?? [],
    beschikbare_branches: beschikbareBranches,
    leveren_vanaf: config?.settings.leveren_vanaf ?? null,
    laatste_succes: succesAt,
    laatste_fout: fout
      ? { at: fout.updated_at as string, melding: verbergGeheim(fout.error_message as string | null, config?.token), blijvend }
      : null,
    zeven_dagen: {
      gelukt: (week.data || []).filter(r => r.status === 'success').length,
      mislukt: (week.data || []).filter(r => r.status === 'failed').length,
    },
    wachtend: openRijen.filter(r => r.status === 'pending' || Number(r.attempts) < PARTNER_MAX_POGINGEN).length,
    opgegeven: openRijen.filter(r => r.status === 'failed' && Number(r.attempts) >= PARTNER_MAX_POGINGEN).length,
    /* Alleen als de fout nieuwer is dan het laatste succes: één oude fout na
       tien geslaagde leveringen is geen reden voor rood. */
    actie_nodig: Boolean(fout && blijvend && (!succesAt || new Date(fout.updated_at as string) > new Date(succesAt))),
  };
}

export type OpslaanInvoer = {
  url?: string;
  enabled?: boolean;
  branches?: string[];
  /** Alleen bij het (her)koppelen door een admin: hoeveel dagen terug nasturen. */
  nasturen_dagen?: number;
};

export type OpslaanUitkomst =
  | { ok: true; nagestuurd: { gelukt: number; mislukt: number; resterend: number } | null }
  | { ok: false; fout: string };

export async function partnerOpslaan(
  supabase: SupabaseClient,
  customerId: string,
  partner: PartnerDefinitie,
  invoer: OpslaanInvoer,
  beschikbareBranches: string[],
  actor: Actor,
): Promise<OpslaanUitkomst> {
  const bestaand = await haalPartnerConfig(supabase, customerId, partner);
  const opslag: PartnerOpslag = {};

  if (invoer.url !== undefined) {
    const token = partner.leesToken(invoer.url);
    if (!token) return { ok: false, fout: `Dit is geen geldig ${partner.naam}-adres. ${partner.urlUitleg}` };
    opslag.token = token;
  }
  if (!bestaand?.token && opslag.token === undefined) {
    return { ok: false, fout: `Vul eerst het afleveradres van ${partner.naam} in.` };
  }
  if (invoer.branches !== undefined) {
    const toegestaan = new Set(beschikbareBranches);
    opslag.branches = invoer.branches.filter(b => typeof b === 'string' && toegestaan.has(b));
  }
  if (invoer.enabled !== undefined) opslag.enabled = invoer.enabled;

  /* Leveren vanaf: bij de eerste koppeling en bij hervatten na een pauze is
     dat "nu" (wat tijdens een pauze binnenkwam gaat niet alsnog). Een nieuw
     adres verschuift het níet: leads die mislukten omdat het oude adres stuk
     was, moeten na het herstel alsnog mee. Alleen een admin mag bij het
     koppelen een paar dagen terug laten nasturen. */
  const dagen = actor.soort === 'admin'
    ? Math.max(0, Math.min(MAX_NASTUREN_DAGEN, Math.floor(Number(invoer.nasturen_dagen) || 0)))
    : 0;
  const nieuwAdres = opslag.token !== undefined && opslag.token !== bestaand?.token;
  const hervat = invoer.enabled === true && bestaand?.settings.enabled !== true;
  if (!bestaand || hervat) {
    opslag.leveren_vanaf = new Date(Date.now() - dagen * 86_400_000).toISOString();
  }

  await slaPartnerConfigOp(supabase, customerId, partner, opslag);

  await logAudit({
    adminId: actor.soort === 'admin' ? actor.id ?? null : null,
    adminName: actor.naam ?? null,
    action: 'update_integration',
    entityType: 'customer_integration',
    entityId: customerId,
    details: {
      partner: partner.id,
      door: actor.soort,
      nieuw_adres: nieuwAdres,
      aan: opslag.enabled,
      branches: opslag.branches,
      nasturen_dagen: dagen || undefined,
      /* Nooit het adres zelf: dat is het geheim. */
      url_hint: opslag.token ? partner.urlHint(opslag.token) : undefined,
    },
  });

  let nagestuurd = null;
  if (dagen > 0 && (opslag.enabled ?? bestaand?.settings.enabled) === true) {
    nagestuurd = await stuurNa(supabase, customerId, partner);
  }
  return { ok: true, nagestuurd };
}

/** Toewijzingen binnen de leverperiode die nog niet bij de partner zijn. */
async function nogTeLeveren(supabase: SupabaseClient, customerId: string, partner: PartnerDefinitie) {
  const config = await haalPartnerConfig(supabase, customerId, partner);
  if (!config?.settings.leveren_vanaf) return [];
  const { data: toew } = await supabase
    .from('lead_assignments')
    .select('id, lead_id, assigned_at')
    .eq('customer_id', customerId)
    .neq('source', 'mirror')
    .gte('assigned_at', config.settings.leveren_vanaf)
    .order('assigned_at', { ascending: true })
    .limit(500);
  const rijen = (toew || []).filter(t => binnenLeverperiode(config.settings, t.assigned_at));
  if (rijen.length === 0) return [];
  const { data: klaar } = await supabase
    .from('integration_sync_log')
    .select('assignment_id')
    .eq('provider', partner.provider)
    .eq('status', 'success')
    .in('assignment_id', rijen.map(r => r.id));
  const al = new Set((klaar || []).map(k => k.assignment_id));
  return rijen.filter(r => !al.has(r.id));
}

async function stuurNa(supabase: SupabaseClient, customerId: string, partner: PartnerDefinitie) {
  const lijst = await nogTeLeveren(supabase, customerId, partner);
  return leverReeks(supabase, partner, customerId, lijst);
}

export type TestUitkomst = { ok: boolean; melding: string; ms: number };

/** 06-nummer of +316-nummer naar +316…; anders null. */
export function normaliseerTestnummer(invoer: string): string | null {
  const kaal = invoer.replace(/[\s()-]/g, '');
  const m = /^(?:\+31|0031|0)(6\d{8})$/.exec(kaal);
  return m ? `+31${m[1]}` : null;
}

/**
 * Een testlevering met vaste nepgegevens. Met een nieuw adres testen kan vóór
 * het opslaan; anders het opgeslagen adres.
 */
export async function partnerTest(
  supabase: SupabaseClient,
  customerId: string,
  partner: PartnerDefinitie,
  url: string | undefined,
  actor: Actor,
  telefoon?: string | null,
): Promise<TestUitkomst> {
  /* Eigen testnummer alleen voor een admin, en alleen een geldig NL-mobiel nummer. */
  let testTelefoon: string | null = null;
  if (telefoon && actor.soort === 'admin') {
    testTelefoon = normaliseerTestnummer(telefoon);
    if (!testTelefoon) return { ok: false, melding: 'Vul een geldig Nederlands mobiel nummer in, bijvoorbeeld 0612345678.', ms: 0 };
  }
  let token: string | null = null;
  if (url) {
    token = partner.leesToken(url);
    if (!token) return { ok: false, melding: `Dit is geen geldig ${partner.naam}-adres. ${partner.urlUitleg}`, ms: 0 };
  } else {
    token = (await haalPartnerConfig(supabase, customerId, partner))?.token ?? null;
    if (!token) return { ok: false, melding: `Vul eerst het afleveradres van ${partner.naam} in.`, ms: 0 };
  }

  const start = Date.now();
  const antwoord = await verstuurNaarPartner(partner.bouwUrl(token), partner.bouwTestPayload({ telefoon: testTelefoon }), {
    timeoutMs: partner.timeoutMs,
    idempotencyKey: `test-${customerId}-${start}`,
  });
  const ms = Date.now() - start;
  const uitslag = partner.beoordeel(antwoord);

  await logAudit({
    adminId: actor.soort === 'admin' ? actor.id ?? null : null,
    adminName: actor.naam ?? null,
    action: 'test_integration',
    entityType: 'customer_integration',
    entityId: customerId,
    details: { partner: partner.id, door: actor.soort, gelukt: uitslag.soort === 'gelukt', status: antwoord.status },
  });

  if (uitslag.soort === 'gelukt') {
    return { ok: true, melding: `Testlead afgeleverd bij ${partner.naam}. Er is geen echte klant benaderd.`, ms };
  }
  return { ok: false, melding: verbergGeheim(uitslag.melding, token), ms };
}

/** Mislukte leveringen opnieuw: teller terug op nul en meteen proberen. */
export async function partnerOpnieuw(
  supabase: SupabaseClient,
  customerId: string,
  partner: PartnerDefinitie,
  actor: Actor,
) {
  const teruggezet = await zetMisluktTerug(supabase, customerId, partner);
  const { data: open } = await supabase
    .from('integration_sync_log')
    .select('assignment_id, lead_id')
    .eq('customer_id', customerId)
    .eq('provider', partner.provider)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(200);
  const resultaat = await leverReeks(
    supabase, partner, customerId,
    (open || []).map(r => ({ id: r.assignment_id as string, lead_id: r.lead_id as string })),
  );
  await logAudit({
    adminId: actor.soort === 'admin' ? actor.id ?? null : null,
    adminName: actor.naam ?? null,
    action: 'retry_integration',
    entityType: 'customer_integration',
    entityId: customerId,
    details: { partner: partner.id, door: actor.soort, teruggezet, ...resultaat },
  });
  return { teruggezet, ...resultaat };
}

export async function partnerOntkoppelen(
  supabase: SupabaseClient,
  customerId: string,
  partner: PartnerDefinitie,
  actor: Actor,
): Promise<void> {
  await verwijderPartnerConfig(supabase, customerId, partner);
  await logAudit({
    adminId: actor.soort === 'admin' ? actor.id ?? null : null,
    adminName: actor.naam ?? null,
    action: 'delete_integration',
    entityType: 'customer_integration',
    entityId: customerId,
    details: { partner: partner.id, door: actor.soort },
  });
}
