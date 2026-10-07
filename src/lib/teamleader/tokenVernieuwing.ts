/**
 * Eén vernieuwing tegelijk per Teamleader-koppeling.
 *
 * Teamleader geeft bij elke vernieuwing een nieuwe vernieuwingssleutel en de
 * oude vervalt. Vernieuwen twee verzoeken tegelijk met dezelfde sleutel (het
 * portaal haalt bijvoorbeeld pipelines, velden en instellingen tegelijk op,
 * of een directe levering loopt samen met de herhaalronde), dan kan de
 * sleutel die als laatste wordt opgeslagen al ongeldig zijn. Vanaf dat moment
 * weigert Teamleader elke vernieuwing en levert de koppeling niets meer af.
 *
 * Daarom: wie vernieuwt, neemt eerst een slot. Wie het slot niet krijgt,
 * wacht tot de ander klaar is en gebruikt diens nieuwe sleutel.
 */

export type TokenStand = { accessToken: string; refreshToken: string; verlooptOp: Date };

export type VernieuwStappen = {
  /** Leest de actuele stand uit de database (niet uit het geheugen). */
  lees: () => Promise<TokenStand | null>;
  neemSlot: () => Promise<boolean>;
  geefSlotTerug: () => Promise<void>;
  /** Vraagt een nieuwe sleutel aan bij Teamleader en slaat hem op. */
  vernieuw: (refreshToken: string) => Promise<string>;
  wacht?: (ms: number) => Promise<void>;
  nu?: () => number;
};

export const MARGE_MS = 2 * 60 * 1000;
const MAX_WACHTEN_MS = 20_000;
const POLL_MS = 750;

export function isVers(stand: TokenStand, nu: number): boolean {
  return stand.verlooptOp.getTime() > nu + MARGE_MS;
}

export async function geldigeSleutelMetSlot(stappen: VernieuwStappen): Promise<string> {
  const wacht = stappen.wacht ?? (ms => new Promise<void>(r => setTimeout(r, ms)));
  const nu = stappen.nu ?? Date.now;
  const grens = nu() + MAX_WACHTEN_MS;

  for (;;) {
    const stand = await stappen.lees();
    if (!stand) throw new Error('Teamleader-koppeling is niet (meer) leesbaar; opnieuw koppelen nodig.');
    if (isVers(stand, nu())) return stand.accessToken;

    if (await stappen.neemSlot()) {
      try {
        /* Opnieuw lezen ná het slot: misschien vernieuwde een ander verzoek
           net, tussen onze vorige lezing en het slot. Dan die sleutel. */
        const actueel = (await stappen.lees()) ?? stand;
        if (isVers(actueel, nu())) return actueel.accessToken;
        return await stappen.vernieuw(actueel.refreshToken);
      } finally {
        await stappen.geefSlotTerug();
      }
    }

    if (nu() > grens) {
      throw new Error('Teamleader-toegang wordt al vernieuwd door een ander verzoek; volgende poging pakt het op.');
    }
    await wacht(POLL_MS);
  }
}
