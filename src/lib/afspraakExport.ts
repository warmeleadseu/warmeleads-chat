import { STATUS_LABELS, OUTCOME_LABELS, NO_DEAL_REASONS, CANCELLED_BY } from './appointmentOutcome';

/**
 * CSV-export van afspraken.
 *
 * Opgebouwd uit de lijst die op het scherm staat, dus het aantal in het bestand
 * kan niet afwijken van wat je ziet. Puntkomma's en een BOM voor Excel in een
 * Nederlandse omgeving.
 */

export interface AfspraakRij {
  starts_at: string;
  duration_minutes: number;
  status: string;
  branch: string;
  contact_name: string;
  contact_phone?: string | null;
  contact_email?: string | null;
  street?: string | null;
  house_number?: string | null;
  postcode?: string | null;
  city?: string | null;
  notes?: string | null;
  outcome?: string | null;
  outcome_reason?: string | null;
  outcome_notes?: string | null;
  deal_value?: number | null;
  cancelled_by?: string | null;
  cancelled_reason?: string | null;
}

export const AFSPRAAK_KOLOMMEN = [
  'Datum', 'Tijd', 'Duur (min)', 'Status', 'Branche',
  'Naam', 'Telefoon', 'E-mail', 'Straat', 'Huisnr.', 'Postcode', 'Plaats',
  'Uitkomst', 'Dealbedrag', 'Reden geen deal', 'Afgezegd door', 'Reden afzegging',
  'Opmerkingen', 'Toelichting afboeking',
] as const;

function cel(waarde: unknown): string {
  const s = waarde == null ? '' : String(waarde);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function afspraakNaarRij(a: AfspraakRij, brancheNamen: Record<string, string> = {}): string[] {
  const d = new Date(a.starts_at);
  const geldig = !Number.isNaN(d.getTime());
  return [
    geldig ? d.toLocaleDateString('nl-NL') : '',
    geldig ? d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '',
    String(a.duration_minutes ?? ''),
    STATUS_LABELS[a.status as keyof typeof STATUS_LABELS] ?? a.status,
    brancheNamen[a.branch] ?? a.branch ?? '',
    a.contact_name ?? '',
    a.contact_phone ?? '',
    a.contact_email ?? '',
    a.street ?? '',
    a.house_number ?? '',
    a.postcode ?? '',
    a.city ?? '',
    a.outcome ? (OUTCOME_LABELS[a.outcome as keyof typeof OUTCOME_LABELS] ?? a.outcome) : '',
    /* Zonder duizendtalscheiding: Excel moet dit als getal kunnen lezen. */
    a.deal_value != null ? String(a.deal_value).replace('.', ',') : '',
    a.outcome_reason ? (NO_DEAL_REASONS.find(r => r.value === a.outcome_reason)?.label ?? a.outcome_reason) : '',
    a.cancelled_by ? (CANCELLED_BY.find(c => c.value === a.cancelled_by)?.label ?? a.cancelled_by) : '',
    a.cancelled_reason ?? '',
    a.notes ?? '',
    a.outcome_notes ?? '',
  ];
}

export function buildAfspraakCsv(
  rijen: AfspraakRij[],
  brancheNamen: Record<string, string> = {},
): string {
  const regels = [
    AFSPRAAK_KOLOMMEN.map(cel).join(';'),
    ...rijen.map(r => afspraakNaarRij(r, brancheNamen).map(cel).join(';')),
  ];
  return '﻿' + regels.join('\r\n');
}

export function afspraakBestandsnaam(): string {
  return `afspraken-${new Date().toISOString().split('T')[0]}.csv`;
}
