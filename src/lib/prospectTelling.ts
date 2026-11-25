import { PROSPECT_STATUSES } from './prospects';

/** De database geeft per verzoek hooguit 1000 rijen terug. */
const PER_KEER = 1000;

type Antwoord<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/**
 * Haalt alle rijen op, in delen van 1000. Zonder dit bleef de teller boven de
 * prospectlijst op precies 1000 staan terwijl er meer waren (nov 2026). De
 * query moet een vaste volgorde hebben, anders vallen er rijen tussen de delen.
 */
export async function alleProspectRijen<T>(maak: (van: number, tot: number) => Antwoord<T>): Promise<T[]> {
  const uit: T[] = [];
  for (let van = 0; ; van += PER_KEER) {
    const { data, error } = await maak(van, van + PER_KEER - 1);
    if (error) throw new Error(error.message);
    uit.push(...(data ?? []));
    if (!data || data.length < PER_KEER) return uit;
  }
}

/** Aantal prospects per status; elke bekende status staat erin, ook met 0. */
export function telPerStatus(rijen: { status: string }[]): Record<string, number> {
  const telling: Record<string, number> = {};
  for (const s of PROSPECT_STATUSES) telling[s] = 0;
  for (const r of rijen) if (r.status in telling) telling[r.status] += 1;
  return telling;
}
