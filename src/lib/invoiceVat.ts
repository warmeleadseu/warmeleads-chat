/**
 * BTW op facturen en portal-betalingen.
 * Belgische zakelijke klanten met geldig BE-BTW-nummer: intracommunautaire levering,
 * geen Nederlandse BTW op de factuur (verlegd naar de Belgische afnemer).
 */

export type BillingCountry = 'NL' | 'BE';

export type InvoiceVatMode = 'domestic_nl' | 'reverse_charge_be';

/** BE + precies 10 cijfers (Belgisch BTW-nummer). */
export function isValidBelgianVatFormat(vat: string | null | undefined): boolean {
  if (!vat) return false;
  const s = vat.replace(/[\s.]/g, '').toUpperCase();
  if (!s.startsWith('BE')) return false;
  const digits = s.slice(2);
  return /^\d{10}$/.test(digits);
}

/** NL + 9 cijfers + 'B' + 2 cijfers (NL BTW-nummer). */
export function isValidDutchVatFormat(vat: string | null | undefined): boolean {
  if (!vat) return false;
  const s = vat.replace(/[\s.]/g, '').toUpperCase();
  return /^NL\d{9}B\d{2}$/.test(s);
}

/** Compacte, hoofdletter-genormaliseerde representatie van een BTW-id. */
export function normalizeVatId(vat: string | null | undefined): string | null {
  if (typeof vat !== 'string') return null;
  const s = vat.replace(/[\s.]/g, '').toUpperCase();
  return s.length > 0 ? s : null;
}

/**
 * Valideer een BTW-id in context van het opgegeven land.
 * - Lege waarde mag (klant kan particulier zijn of nog onbekend).
 * - Voor BE: moet exact `BE` + 10 cijfers zijn (anders 21% BTW i.p.v. verlegging).
 * - Voor NL: als ingevuld, moet het NL-formaat hebben.
 *
 * Retourneert de genormaliseerde waarde of een foutmelding.
 */
export function validateVatIdForCountry(
  country: string | null | undefined,
  rawVatId: string | null | undefined,
):
  | { ok: true; vat_id: string | null }
  | { ok: false; error: string } {
  const normalized = normalizeVatId(rawVatId);
  if (!normalized) return { ok: true, vat_id: null };

  if (/[^A-Z0-9]/.test(normalized)) {
    return {
      ok: false,
      error: 'BTW-nummer mag alleen letters en cijfers bevatten (geen e-mailadres of telefoonnummer).',
    };
  }

  const billingCountry = normalizeBillingCountry(country);

  if (billingCountry === 'BE') {
    if (!isValidBelgianVatFormat(normalized)) {
      return {
        ok: false,
        error: 'Ongeldig Belgisch BTW-nummer. Verwacht formaat: BE gevolgd door 10 cijfers (bv. BE0123456789).',
      };
    }
    return { ok: true, vat_id: normalized };
  }

  // NL of fallback: accepteer als het NL-formaat heeft, of een ander geldig EU-prefix.
  if (normalized.startsWith('NL')) {
    if (!isValidDutchVatFormat(normalized)) {
      return {
        ok: false,
        error: 'Ongeldig Nederlands BTW-nummer. Verwacht formaat: NL123456789B01.',
      };
    }
  } else if (/^[A-Z]{2}/.test(normalized)) {
    // Andere EU-prefix: minimaal 2 cijfers/letters na het landcode-prefix.
    if (normalized.length < 6) {
      return { ok: false, error: 'BTW-nummer is te kort.' };
    }
  } else {
    // Geen landcode-prefix: te onduidelijk, blokkeer.
    return {
      ok: false,
      error: 'BTW-nummer moet beginnen met een landcode (BE, NL, …).',
    };
  }

  return { ok: true, vat_id: normalized };
}

/** Normaliseer naar BE of NL. */
export function normalizeBillingCountry(raw: string | null | undefined): BillingCountry {
  const u = String(raw || 'NL')
    .trim()
    .toUpperCase();
  return u === 'BE' ? 'BE' : 'NL';
}

export function qualifiesBelgiumReverseCharge(input: {
  country: string | null | undefined;
  vat_id: string | null | undefined;
}): boolean {
  if (normalizeBillingCountry(input.country) !== 'BE') return false;
  return isValidBelgianVatFormat(input.vat_id);
}

export function computeInvoiceVat(params: {
  subtotalExclBtw: number;
  country: string | null | undefined;
  customerVatId: string | null | undefined;
}): {
  vat_mode: InvoiceVatMode;
  btw_percentage: number;
  btw_amount: number;
  total_incl_btw: number;
} {
  const sub = Math.round(Number(params.subtotalExclBtw) * 100) / 100;
  if (qualifiesBelgiumReverseCharge({ country: params.country, vat_id: params.customerVatId })) {
    return {
      vat_mode: 'reverse_charge_be',
      btw_percentage: 0,
      btw_amount: 0,
      total_incl_btw: sub,
    };
  }
  const btwPct = 21;
  const btwAmount = Math.round(sub * (btwPct / 100) * 100) / 100;
  return {
    vat_mode: 'domestic_nl',
    btw_percentage: btwPct,
    btw_amount: btwAmount,
    total_incl_btw: Math.round((sub + btwAmount) * 100) / 100,
  };
}

/** Effectieve BTW-marge (0 of 0.21) voor portaal-prijzen. */
export function portalBtwRate(input: { country?: string | null; vat_id?: string | null; reverse_charge?: boolean }): number {
  if (input.reverse_charge === true) return 0;
  if (qualifiesBelgiumReverseCharge({ country: input.country, vat_id: input.vat_id })) return 0;
  return 0.21;
}

/** Korte tekst voor Mollie-omschrijvingen / labels. */
export function mollieBtwLabel(vatMode: InvoiceVatMode): string {
  return vatMode === 'reverse_charge_be' ? 'BTW verlegd' : 'incl. 21% BTW';
}
