interface LeadForScoring {
  telefoonnummer?: string | null;
  email?: string | null;
  postcode?: string | null;
  huisnummer?: string | null;
  plaatsnaam?: string | null;
  provincie?: string | null;
  lat?: number | null;
  lng?: number | null;
  phone_valid?: boolean | null;
  naam_klant?: string | null;
  custom_fields?: Record<string, string> | null;
}

const FAKE_NAME_PATTERNS = [
  /^test/i,
  /^asdf/i,
  /^xxx/i,
  /^aaa/i,
  /^bbb/i,
  /^123/,
  /^nee$/i,
  /^neen$/i,
  /^geen$/i,
  /^nvt$/i,
  /^n\.?v\.?t\.?$/i,
  /^onbekend$/i,
];

export function calculateQualityScore(lead: LeadForScoring): number {
  let score = 0;

  if (lead.telefoonnummer && lead.telefoonnummer.trim().length >= 8) {
    score += 20;
  }

  if (lead.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
    score += 15;
  }

  const hasFullAddress =
    !!lead.postcode?.trim() &&
    !!lead.huisnummer?.trim() &&
    !!lead.plaatsnaam?.trim() &&
    !!lead.provincie?.trim();
  if (hasFullAddress) {
    score += 20;
  }

  if (lead.lat != null && lead.lng != null && lead.lat !== 0 && lead.lng !== 0) {
    score += 10;
  }

  if (lead.phone_valid === true) {
    score += 15;
  }

  const name = lead.naam_klant?.trim() ?? '';
  if (name.length >= 3 && !FAKE_NAME_PATTERNS.some(p => p.test(name))) {
    score += 10;
  }

  if (lead.custom_fields) {
    const filled = Object.values(lead.custom_fields).filter(
      v => v != null && String(v).trim().length > 0,
    ).length;
    if (filled > 0) {
      score += 10;
    }
  }

  return Math.min(score, 100);
}

export function getQualityLabel(score: number): string {
  if (score >= 80) return 'uitstekend';
  if (score >= 60) return 'goed';
  if (score >= 40) return 'gemiddeld';
  return 'laag';
}

export function getQualityColor(score: number): string {
  if (score >= 80) return 'text-emerald-500';
  if (score >= 60) return 'text-sky-500';
  if (score >= 40) return 'text-amber-500';
  return 'text-red-500';
}
