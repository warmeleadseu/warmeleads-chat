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

export function buildDealSummary(lead: Record<string, unknown>, assignmentId: string, leadId: string): string {
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
  const cf = lead.custom_fields;
  if (cf && typeof cf === 'object' && Object.keys(cf as object).length > 0) {
    lines.push('', 'Extra velden:');
    for (const [k, v] of Object.entries(cf as Record<string, unknown>)) {
      if (v != null && String(v).trim()) lines.push(`- ${k}: ${v}`);
    }
  }
  return lines.join('\n').slice(0, 8000);
}

export function normalizePhone(phone: string | null | undefined): string | undefined {
  const p = (phone || '').trim();
  return p.length >= 6 ? p : undefined;
}
