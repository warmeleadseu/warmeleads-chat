/** Bedrag zoals een mens het typt: 8500, 8.500, 8500,50 of 8.500,50 (Nederlands), of 8500.50. */
export function leesBedrag(invoer: unknown): number {
  if (typeof invoer === 'number') return invoer;
  let t = String(invoer ?? '').trim().replace(/[€\s]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  return t === '' ? NaN : Number(t);
}
