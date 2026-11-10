/**
 * Bij elke betaling of bestelling vermelden dat de algemene voorwaarden van
 * toepassing zijn (afgesproken 10 nov 2026). Klanten die door een
 * accountmanager zijn aangemaakt, kregen die voorwaarden nergens te zien;
 * tussen bedrijven gelden ze alleen als de klant ze vóór of bij het sluiten
 * van de overeenkomst kon inzien. Eén tekst voor mails, portaal en factuur.
 */

export const VOORWAARDEN_PAD = '/algemene-voorwaarden';

const basis = () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu').replace(/\/$/, '');

export const voorwaardenUrl = () => `${basis()}${VOORWAARDEN_PAD}`;

/** Regel voor in een mail, direct boven de betaal- of bestelknop. */
export function voorwaardenMailRegel(soort: 'betalen' | 'bestellen' | 'doorlopen' = 'betalen'): string {
  const link = `<a href="${voorwaardenUrl()}" target="_blank" style="color:#7c3aed;text-decoration:underline">algemene voorwaarden</a>`;
  const zin = soort === 'doorlopen'
    ? `Op de nieuwe batch zijn onze ${link} van toepassing.`
    : `Door te ${soort} ga je akkoord met onze ${link}.`;
  return `<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#64748b">${zin}</p>`;
}

/** Regel onderaan de factuur-pdf. */
export function voorwaardenFactuurRegel(): string {
  return `Op al onze leveringen zijn de algemene voorwaarden van toepassing: ${basis().replace(/^https?:\/\/(www\.)?/, '')}${VOORWAARDEN_PAD}`;
}
