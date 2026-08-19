/** Datum-helpers voor kalenderselectie in de browser. */

/**
 * Zet een Date die een gekozen kalenderdag voorstelt om naar YYYY-MM-DD,
 * in de tijdzone van de bezoeker zelf.
 *
 * Gebruik hiervoor NOOIT `toISOString().split('T')[0]`. Een kalenderraster
 * bouwt zijn dagen met `new Date(jaar, maand, dag)`, wat lokale middernacht
 * oplevert. `toISOString()` rekent dat om naar UTC, en in Nederland (UTC+1 in
 * de winter, UTC+2 in de zomer) valt lokale middernacht op de vórige dag in
 * UTC. Een bezoeker die dinsdag aanklikt, verstuurt dan maandag.
 */
export function toDateKey(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}
