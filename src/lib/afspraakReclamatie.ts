/**
 * Reclamaties op geleverde afspraken.
 *
 * Gespiegeld aan het leadproces: een klant meldt een probleem, jullie
 * beoordelen, en bij goedkeuring krijgt hij er een afspraak bij in zijn batch.
 * Hier staan de regels die portaal, API en admin allemaal gebruiken.
 */

export const AFSPRAAK_RECLAMATIE_REDENEN = [
  { value: 'niet_verschenen', label: 'Klant was niet thuis' },
  { value: 'buiten_gebied', label: 'Buiten mijn afgesproken gebied' },
  { value: 'geen_interesse', label: 'Klant wist van niets / geen interesse' },
  { value: 'verkeerde_gegevens', label: 'Gegevens kloppen niet' },
  { value: 'dubbele_afspraak', label: 'Dubbele afspraak' },
  { value: 'anders', label: 'Anders' },
] as const;

export type AfspraakReclamatieReden = (typeof AFSPRAAK_RECLAMATIE_REDENEN)[number]['value'];

export const AFSPRAAK_RECLAMATIE_STATUS: Record<string, string> = {
  pending: 'In behandeling',
  approved: 'Goedgekeurd',
  rejected: 'Afgewezen',
};

/** Hoeveel dagen na de afspraak er nog gereclameerd kan worden. */
export const RECLAMATIE_TERMIJN_DAGEN = 14;

export function isGeldigeReden(waarde: unknown): waarde is AfspraakReclamatieReden {
  return typeof waarde === 'string'
    && AFSPRAAK_RECLAMATIE_REDENEN.some(r => r.value === waarde);
}

export function redenLabel(reden: string): string {
  return AFSPRAAK_RECLAMATIE_REDENEN.find(r => r.value === reden)?.label ?? reden;
}

export type Geschiktheid = { mag: true } | { mag: false; reden: string };

/**
 * Of er op deze afspraak nog gereclameerd mag worden.
 *
 * Pas na afloop, want voor het bezoek valt er niets te melden. En binnen een
 * termijn, zodat er niet maanden later nog claims binnenkomen op afspraken die
 * allang zijn afgerekend.
 */
export function magReclameren(
  afspraak: { starts_at: string; status: string; batch_id?: string | null },
  bestaande: { id: string; status: string } | null,
  nu: Date = new Date(),
): Geschiktheid {
  if (bestaande) {
    return {
      mag: false,
      reden: bestaande.status === 'pending'
        ? 'Je hebt al een reclamatie ingediend voor deze afspraak'
        : `Deze afspraak is al beoordeeld (${AFSPRAAK_RECLAMATIE_STATUS[bestaande.status] ?? bestaande.status})`,
    };
  }

  if (afspraak.status === 'cancelled') {
    return { mag: false, reden: 'Deze afspraak is geannuleerd en telt niet als geleverd' };
  }
  if (afspraak.status === 'rescheduled') {
    return { mag: false, reden: 'Deze afspraak is verzet. Reclameer op de nieuwe afspraak.' };
  }

  const start = new Date(afspraak.starts_at);
  if (Number.isNaN(start.getTime())) {
    return { mag: false, reden: 'Onbekende datum' };
  }
  if (start.getTime() > nu.getTime()) {
    return { mag: false, reden: 'Deze afspraak moet nog plaatsvinden' };
  }

  const dagenGeleden = (nu.getTime() - start.getTime()) / 86_400_000;
  if (dagenGeleden > RECLAMATIE_TERMIJN_DAGEN) {
    return {
      mag: false,
      reden: `Reclameren kan tot ${RECLAMATIE_TERMIJN_DAGEN} dagen na de afspraak`,
    };
  }

  return { mag: true };
}
