/**
 * CSV-export van reclamaties.
 *
 * Bewust in de browser opgebouwd uit de rijen die al op het scherm staan, niet
 * via een aparte serverroute. Daarmee kan het bestand per definitie niet
 * afwijken van wat je ziet: het is dezelfde lijst.
 *
 * Puntkomma als scheidingsteken en een BOM vooraan, zodat Excel het bestand in
 * een Nederlandse omgeving meteen goed in kolommen zet.
 */

export type ReclamatieRij = {
  created_at: string;
  status: string;
  reason: string;
  description: string | null;
  resolved_at: string | null;
  admin_notes: string | null;
  customers: { name: string; email: string } | null;
  leads: {
    naam_klant: string;
    telefoonnummer: string;
    email: string;
    postcode: string;
    plaatsnaam: string;
    provincie: string;
    branch: string;
  } | null;
};

const STATUS_TEKST: Record<string, string> = {
  pending: 'Openstaand',
  approved: 'Goedgekeurd',
  rejected: 'Afgewezen',
};

const REDEN_TEKST: Record<string, string> = {
  foutief_telefoonnummer: 'Foutief telefoonnummer',
  dubbele_lead: 'Dubbele lead binnen 30 dagen',
  buiten_doelgebied: 'Buiten afgesproken gebied',
};

export const RECLAMATIE_KOLOMMEN = [
  'Ingediend op',
  'Status',
  'Reden',
  'Toelichting',
  'Afgehandeld op',
  'Notitie beheerder',
  'Klant',
  'Klant e-mail',
  'Lead',
  'Telefoon',
  'Lead e-mail',
  'Postcode',
  'Plaats',
  'Provincie',
  'Branche',
] as const;

function datum(waarde: string | null): string {
  if (!waarde) return '';
  const d = new Date(waarde);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('nl-NL');
}

export function reclamatieNaarRij(r: ReclamatieRij): string[] {
  return [
    datum(r.created_at),
    STATUS_TEKST[r.status] ?? r.status,
    REDEN_TEKST[r.reason] ?? r.reason,
    r.description ?? '',
    datum(r.resolved_at),
    r.admin_notes ?? '',
    r.customers?.name ?? '',
    r.customers?.email ?? '',
    r.leads?.naam_klant ?? '',
    r.leads?.telefoonnummer ?? '',
    r.leads?.email ?? '',
    r.leads?.postcode ?? '',
    r.leads?.plaatsnaam ?? '',
    r.leads?.provincie ?? '',
    r.leads?.branch ?? '',
  ];
}

/** Ontsnapt één cel voor CSV met puntkomma's. */
function cel(waarde: string): string {
  const s = String(waarde ?? '');
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildReclamatieCsv(rijen: ReclamatieRij[]): string {
  const regels = [
    RECLAMATIE_KOLOMMEN.map(cel).join(';'),
    ...rijen.map(r => reclamatieNaarRij(r).map(cel).join(';')),
  ];
  return '﻿' + regels.join('\r\n');
}

/** Bestandsnaam met de status en de datum erin, zodat exports uit elkaar te houden zijn. */
export function reclamatieBestandsnaam(status: string): string {
  const stempel = new Date().toISOString().split('T')[0];
  const deel = status === 'all' ? 'alle' : (STATUS_TEKST[status] ?? status).toLowerCase();
  return `reclamaties-${deel}-${stempel}.csv`;
}
