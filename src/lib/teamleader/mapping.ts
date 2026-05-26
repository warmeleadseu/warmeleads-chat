import { DEFAULT_DEAL_TITLE_TEMPLATE } from './config';

export function splitContactName(full: string): { firstName: string; lastName: string } {
  const trimmed = (full || '').trim();
  if (!trimmed) return { firstName: 'Onbekend', lastName: '-' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '-' };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

export function formatDealTitle(
  template: string | null | undefined,
  vars: { branch_name: string; naam_klant: string; branch: string },
): string {
  const t = (template || DEFAULT_DEAL_TITLE_TEMPLATE).trim();
  return t
    .replace(/\{branch_name\}/g, vars.branch_name)
    .replace(/\{naam_klant\}/g, vars.naam_klant)
    .replace(/\{branch\}/g, vars.branch);
}

export function buildDealSummary(
  lead: Record<string, unknown>,
  assignmentId: string,
  leadId: string,
  extraFields?: Record<string, string>,
): string {
  const lines: string[] = [
    'Lead via Warme Leads portaal',
    '',
    `Referentie: assignment ${assignmentId}, lead ${leadId}`,
  ];
  if (lead.email) lines.push(`E-mail: ${lead.email}`);
  if (lead.telefoonnummer) lines.push(`Telefoon: ${lead.telefoonnummer}`);
  if (lead.postcode || lead.plaatsnaam) {
    lines.push(`Adres: ${[lead.postcode, lead.huisnummer, lead.plaatsnaam].filter(Boolean).join(' ')}`);
  }
  if (lead.provincie) lines.push(`Provincie: ${lead.provincie}`);
  if (lead.notities) lines.push('', `Notities: ${lead.notities}`);

  const extras = extraFields && Object.keys(extraFields).length > 0 ? extraFields : null;
  if (extras) {
    lines.push('', 'Overige gegevens:');
    for (const [label, val] of Object.entries(extras)) {
      if (val.trim()) lines.push(`- ${label}: ${val}`);
    }
  } else {
    const cf = lead.custom_fields;
    if (cf && typeof cf === 'object' && Object.keys(cf as object).length > 0) {
      lines.push('', 'Extra velden:');
      for (const [k, v] of Object.entries(cf as Record<string, unknown>)) {
        if (v != null && String(v).trim()) lines.push(`- ${k}: ${v}`);
      }
    }
  }
  return lines.join('\n').slice(0, 8000);
}

export function normalizePhone(phone: string | null | undefined): string | undefined {
  const p = (phone || '').trim();
  return p.length >= 6 ? p : undefined;
}

export type TeamleaderAddressInput = {
  postcode?: string | null;
  huisnummer?: string | null;
  plaatsnaam?: string | null;
};

/** NL-postcode: 1234 AB (Teamleader accepteert ook zonder spatie). */
export function normalizeNlPostcode(postcode: string | null | undefined): string | null {
  const compact = (postcode || '').trim().replace(/\s+/g, '').toUpperCase();
  if (!compact) return null;
  const dutch = compact.match(/^(\d{4})([A-Z]{2})$/);
  if (dutch) return `${dutch[1]} ${dutch[2]}`;
  return compact;
}

/**
 * Teamleader AddressRequest vereist de keys line_1, postal_code, city en country
 * (waarden mogen null zijn, maar postal_code moet aanwezig zijn).
 */
export function buildTeamleaderContactAddresses(
  lead: TeamleaderAddressInput,
): Array<{ type: 'primary'; address: Record<string, string | null> }> | undefined {
  const postal_code = normalizeNlPostcode(lead.postcode);
  const city = (lead.plaatsnaam || '').trim() || null;
  const line_1 = (lead.huisnummer || '').trim() || null;

  if (!postal_code && !city && !line_1) return undefined;

  return [
    {
      type: 'primary',
      address: {
        line_1,
        postal_code,
        city,
        country: 'NL',
      },
    },
  ];
}

export function buildTeamleaderTelephones(
  phone: string | null | undefined,
): Array<{ type: 'phone' | 'mobile'; number: string }> | undefined {
  const normalized = normalizePhone(phone);
  if (!normalized) return undefined;
  const digits = normalized.replace(/\D/g, '');
  const isMobile =
    digits.startsWith('316') ||
    digits.startsWith('06') ||
    (digits.length === 10 && digits.startsWith('6'));
  return [{ type: isMobile ? 'mobile' : 'phone', number: normalized }];
}

/** Achtergrondinformatie op het Teamleader-contact (remarks). */
export function buildContactRemarks(
  lead: Record<string, unknown>,
  summaryExtras?: Record<string, string>,
): string | undefined {
  const lines: string[] = [];
  if (lead.notities) lines.push(String(lead.notities));

  const extras =
    summaryExtras && Object.keys(summaryExtras).length > 0 ? summaryExtras : null;
  if (extras) {
    if (lines.length) lines.push('');
    lines.push('Leadgegevens:');
    for (const [label, val] of Object.entries(extras)) {
      if (val.trim()) lines.push(`• ${label}: ${val}`);
    }
  } else {
    const cf = lead.custom_fields;
    if (cf && typeof cf === 'object') {
      const entries = Object.entries(cf as Record<string, unknown>).filter(
        ([, v]) => v != null && String(v).trim(),
      );
      if (entries.length > 0) {
        if (lines.length) lines.push('');
        lines.push('Leadgegevens:');
        for (const [k, v] of entries) lines.push(`• ${k}: ${v}`);
      }
    }
  }

  const text = lines.join('\n').trim();
  return text.length > 0 ? text.slice(0, 8000) : undefined;
}
