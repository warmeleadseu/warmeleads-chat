/**
 * Een volledige naam splitsen in voornaam en achternaam.
 *
 * Wij slaan één veld `naam_klant` op, maar sommige ontvangende systemen willen
 * de naam gesplitst. Dat naïef doen met "eerste woord en de rest" gaat in het
 * Nederlands geregeld mis: "Ron van Wielink" wordt dan achternaam "Wielink",
 * en zo spreek je iemand niet aan. Tussenvoegsels horen bij de achternaam.
 *
 * Splitsen blijft een gok zodra er meer dan twee woorden staan. Daarom is de
 * regel bewust simpel en voorspelbaar: het eerste woord is de voornaam, al het
 * overige is de achternaam. Tussenvoegsels worden alleen gebruikt om te
 * herkennen dat een tweede voornaam géén tussenvoegsel is.
 */

/** Tussenvoegsels die bij de achternaam horen, niet bij de voornaam. */
const TUSSENVOEGSELS = new Set([
  'van', 'de', 'den', 'der', 'het', "'t", 'ten', 'ter', 'te',
  'op', 'in', 'aan', 'bij', 'onder', 'over', 'uit', 'voor',
  'du', 'des', 'del', 'della', 'di', 'da', 'dos', 'das',
  'la', 'le', 'les', 'el', 'al', 'ibn', 'bin', 'bint',
  'von', 'zu', 'zur', 'vom', 'af', 'av',
  "'s", 'st', 'ver',
]);

export type GesplitsteNaam = { voornaam: string | null; achternaam: string | null };

/** Is dit woord een tussenvoegsel? Hoofdletters doen er niet toe. */
export function isTussenvoegsel(woord: string): boolean {
  return TUSSENVOEGSELS.has(woord.toLowerCase().replace(/[.,]/g, ''));
}

export function splitsNaam(volledig: string | null | undefined): GesplitsteNaam {
  const schoon = (volledig ?? '').replace(/\s+/g, ' ').trim();
  if (!schoon) return { voornaam: null, achternaam: null };

  /* "Jansen, Jan" komt voor in geïmporteerde bestanden: achternaam eerst, dan
     een komma. Die volgorde is eenduidig, dus die volgen we gewoon. */
  const komma = schoon.indexOf(',');
  if (komma > 0) {
    const achternaam = schoon.slice(0, komma).trim();
    const voornaam = schoon.slice(komma + 1).trim();
    return {
      voornaam: voornaam || null,
      achternaam: achternaam || null,
    };
  }

  const delen = schoon.split(' ');
  if (delen.length === 1) {
    /* Eén woord. Dat is vaker een voornaam dan een achternaam, en een lege
       achternaam meesturen is eerlijker dan er een verzinnen. */
    return { voornaam: delen[0], achternaam: null };
  }

  /* Begint de naam met een tussenvoegsel, dan ontbreekt de voornaam
     vermoedelijk ("van Wielink"). Alles is dan achternaam. */
  if (isTussenvoegsel(delen[0])) {
    return { voornaam: null, achternaam: delen.join(' ') };
  }

  return { voornaam: delen[0], achternaam: delen.slice(1).join(' ') };
}
