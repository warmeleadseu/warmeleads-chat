import { resolveCategorieen } from './categoryMap';
import {
  CUSTOM_FIELD_PREFIX,
  buildSourceFieldCatalog,
  defaultFieldMappings,
  resolveFieldMappings,
} from './fields';
import type { LeadForWebhook, OutboundWebhookFieldMapping } from './types';

/** Realistische voorbeeld-custom_fields per branche (zelfde set als Teamleader-test). */
const BRANCH_SAMPLE_CUSTOM_FIELDS: Record<string, Record<string, string>> = {
  thuisbatterij: {
    zonnepanelen: 'Ja, 12 panelen sinds 2022',
    dynamisch_contract: 'Ja',
    stroomverbruik: '4500 kWh/jaar',
    budget: '€8.000 - €12.000',
    reden_thuisbatterij: 'Zelfconsumptie verhogen en dynamisch tarief benutten',
  },
  airco: {
    type_airco: 'Split-unit',
    koelen_verwarmen: 'Koelen en verwarmen',
    hoeveel_ruimtes: '3 ruimtes',
    zakelijk: 'Nee, particulier',
    koop_of_huur: 'Koop',
    boorwerkzaamheden_toegestaan: 'Ja',
  },
  zonnepanelen: {
    daktype: 'Schuin dak, pannen',
    stroomverbruik: '5200 kWh/jaar',
    budget: '€6.500 - €9.000',
  },
  warmtepomp: {
    woningtype: 'Tussenwoning',
    bouwjaar: '1998',
    huidige_verwarming: 'CV-ketel op gas',
  },
  isolatie: {
    interesse: '(Spouw) muur',
    kennis_subsidies: 'Ja',
  },
};

function nullable(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

/**
 * Alle beschikbare bronwaarden voor een lead, gekeyd op de interne veldsleutel
 * (zie fields.ts). De mapping bepaalt vervolgens welke hiervan, onder welke
 * JSON-key, daadwerkelijk verstuurd worden.
 *
 * Straatnaam slaan we zelf niet op; die wordt bij aflevering afgeleid uit
 * postcode + huisnummer (PDOK/Nominatim) en hier als `straat` meegegeven.
 * `adres` = straat + huisnummer; lukt de straat-lookup niet, dan valt `adres`
 * terug op postcode + huisnummer.
 */
export function buildLeadSourceValues(
  lead: LeadForWebhook,
  assignmentId: string,
  straat?: string | null,
): Record<string, unknown> {
  const categorieen = resolveCategorieen(lead.branch, lead.custom_fields ?? null);
  const straatnaam = nullable(straat);
  const huisnummer = nullable(lead.huisnummer);
  const adres = straatnaam
    ? [straatnaam, huisnummer].filter(Boolean).join(' ').trim()
    : [nullable(lead.postcode), huisnummer].filter(Boolean).join(' ').trim();

  const values: Record<string, unknown> = {
    categorie: categorieen[0] ?? null,
    categorieen,
    aanhef: null,
    naam: nullable(lead.naam_klant),
    email: nullable(lead.email),
    telefoonnummer: nullable(lead.telefoonnummer),
    adres: adres.length > 0 ? adres : null,
    straat: straatnaam,
    huisnummer,
    postcode: nullable(lead.postcode),
    plaats: nullable(lead.plaatsnaam),
    provincie: nullable(lead.provincie),
    land: nullable(lead.land) ?? 'NL',
    branch: nullable(lead.branch),
    lead_id: lead.id,
    assignment_id: assignmentId,
    aangemaakt_op: nullable(lead.created_at),
  };

  // Branche-specifieke antwoorden uit custom_fields beschikbaar maken onder
  // het 'custom:'-prefix, zodat de mapping ze per veld kan doorsturen.
  const cf = lead.custom_fields ?? {};
  for (const [k, v] of Object.entries(cf)) {
    values[`${CUSTOM_FIELD_PREFIX}${k}`] = typeof v === 'string' ? v.trim() || null : v ?? null;
  }

  return values;
}

/** Past de veld-mapping toe op een set bronwaarden. */
export function applyFieldMappings(
  values: Record<string, unknown>,
  mappings: OutboundWebhookFieldMapping[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const m of mappings) {
    if (m.enabled === false) continue;
    const target = m.target?.trim();
    if (!target) continue;
    out[target] = values[m.source] ?? null;
  }
  return out;
}

/** Bouwt de uiteindelijke payload voor een lead volgens de (opgeslagen) mapping. */
export function buildWebhookPayload(
  lead: LeadForWebhook,
  assignmentId: string,
  mappings?: OutboundWebhookFieldMapping[] | null,
  straat?: string | null,
): Record<string, unknown> {
  const values = buildLeadSourceValues(lead, assignmentId, straat);
  // Opgeslagen mapping bevat al de juiste bronvelden (incl. custom:); pas die
  // direct toe. Zonder mapping vallen we terug op de basisvelden.
  const effective = mappings && mappings.length > 0 ? mappings : defaultFieldMappings();
  return applyFieldMappings(values, effective);
}

/**
 * Kiest een branche voor de test-payload: expliciete keuze wint, anders
 * eerste gefilterde webhook-branche, anders eerste klantbranche.
 */
export function pickWebhookSampleBranch(input?: {
  preferred?: string | null;
  webhookBranches?: string[] | null;
  customerBranches?: string[] | null;
}): string {
  const preferred = input?.preferred?.trim();
  if (preferred) return preferred;
  const fromWebhook = (input?.webhookBranches || []).filter(Boolean);
  if (fromWebhook.length > 0) return fromWebhook[0];
  const fromCustomer = (input?.customerBranches || []).filter(Boolean);
  if (fromCustomer.length > 0) return fromCustomer[0];
  return 'warmtepomp';
}

function sampleSourceValues(branch: string): Record<string, unknown> {
  const custom = BRANCH_SAMPLE_CUSTOM_FIELDS[branch] ?? {};
  const categorieen = resolveCategorieen(branch, custom);
  const values: Record<string, unknown> = {
    categorie: categorieen[0] ?? null,
    categorieen,
    aanhef: null,
    naam: 'Warme Leads Test',
    email: 'test+webhook@warmeleads.test',
    telefoonnummer: '+31612345678',
    adres: 'Dorpsstraat 10',
    straat: 'Dorpsstraat',
    huisnummer: '10',
    postcode: '1234 AB',
    plaats: 'Amsterdam',
    provincie: 'Noord-Holland',
    land: 'NL',
    branch,
    lead_id: '00000000-0000-4000-8000-000000000001',
    assignment_id: '00000000-0000-4000-8000-000000000002',
    aangemaakt_op: new Date().toISOString(),
  };
  for (const [k, v] of Object.entries(custom)) {
    values[`${CUSTOM_FIELD_PREFIX}${k}`] = v;
  }
  return values;
}

export type BuildSampleWebhookPayloadOptions = {
  /** Branche voor voorbeelddata (custom fields + categorie). Default: warmtepomp. */
  branch?: string | null;
};

/**
 * Voorbeeld-payload voor de "test"-knop.
 * Zonder opgeslagen mapping: basisvelden + branche-custom fields (alles aan).
 * Met opgeslagen mapping: die mapping t.o.v. dezelfde catalogus.
 */
export function buildSampleWebhookPayload(
  mappings?: OutboundWebhookFieldMapping[] | null,
  options?: BuildSampleWebhookPayloadOptions,
): Record<string, unknown> {
  const branch = pickWebhookSampleBranch({ preferred: options?.branch });
  const values = sampleSourceValues(branch);
  const dynamic = Object.keys(values)
    .filter((k) => k.startsWith(CUSTOM_FIELD_PREFIX))
    .map((k) => {
      const key = k.slice(CUSTOM_FIELD_PREFIX.length);
      return { key, label: key };
    });
  const catalog = buildSourceFieldCatalog(dynamic);
  const effective =
    mappings && mappings.length > 0
      ? resolveFieldMappings(mappings, catalog)
      : defaultFieldMappings(catalog);
  return applyFieldMappings(values, effective);
}
