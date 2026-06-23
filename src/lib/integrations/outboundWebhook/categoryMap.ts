/**
 * Vertaalt onze (rommelige, soms meervoudige) lead-gegevens naar de
 * categorie(en) die de klant in z'n webhook verwacht.
 *
 * De isolatie-mapping is gebaseerd op de waarden die nu in
 * `custom_fields.interesse` voorkomen. Onbekende/lege waarden vallen terug
 * op de generieke categorie "Isolatie". Deze tabel is bewust 1 plek zodat we
 * 'm makkelijk kunnen bijstellen zodra de klant een exacte mapping aanlevert.
 */

const ISOLATIE_TOKEN_MAP: Record<string, string> = {
  dak: 'Dakisolatie',
  dakisolatie: 'Dakisolatie',
  vloer: 'Vloerisolatie',
  vloerisolatie: 'Vloerisolatie',
  bodem: 'Bodemisolatie',
  bodemisolatie: 'Bodemisolatie',
  '(spouw) muur': 'Spouwmuurisolatie',
  'spouw muur': 'Spouwmuurisolatie',
  spouwmuur: 'Spouwmuurisolatie',
  spouwmuurisolatie: 'Spouwmuurisolatie',
  muur: 'Spouwmuurisolatie',
  muurisolatie: 'Spouwmuurisolatie',
};

function normalizeToken(token: string): string {
  return token.trim().toLowerCase().replace(/\s+/g, ' ');
}

function titleCase(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Geeft de categorie(en) voor een lead. Altijd minstens 1 element.
 */
export function resolveCategorieen(
  branch: string | null,
  customFields: Record<string, unknown> | null,
): string[] {
  if (branch === 'thuisbatterij') return ['Thuisbatterij'];

  if (branch === 'isolatie') {
    const raw = customFields?.['interesse'];
    const rawStr = typeof raw === 'string' ? raw : '';
    const mapped: string[] = [];
    for (const part of rawStr.split(',')) {
      const token = normalizeToken(part);
      if (!token) continue;
      const category = ISOLATIE_TOKEN_MAP[token];
      if (category && !mapped.includes(category)) mapped.push(category);
    }
    return mapped.length > 0 ? mapped : ['Isolatie'];
  }

  return [branch ? titleCase(branch) : 'Onbekend'];
}
